// Timer commands (Blueprint §E). Every command is a single IndexedDB
// transaction. Exactly one RUNNING/PAUSED timer may exist app-wide (§J2).
import type {
  ActiveTimer,
  Commitment,
  DayRecord,
  StopReason,
  TimerSession,
} from "@/domain/types";
import {
  closedRawMs,
  findOpenInterval,
  recomputeFromSessions,
  resolveEffectiveEndMs,
  type OpenIntervalRef,
} from "@/domain/timer/calculations";
import { deriveCompletionTiming } from "@/domain/commitments/status";
import { deadlineInstantMs, todayISOInZone } from "@/domain/time/calendar";
import type { IDBPTransaction } from "idb";
import { SINGLETON_KEY, type ArchitectDB } from "@/infrastructure/db/schema";
import type { AppPorts, CommandResult } from "../ports";

const TIMER_STORES = ["dayRecords", "commitments", "timerSessions", "activeTimer"] as const;

type TimerTx = IDBPTransaction<ArchitectDB, typeof TIMER_STORES, "readwrite">;

interface RecordContext {
  record: DayRecord;
  commitment: Commitment;
  sessions: TimerSession[];
}

async function readRecordContext(
  tx: TimerTx,
  recordId: string,
): Promise<RecordContext | null> {
  const record = await tx.objectStore("dayRecords").get(recordId);
  if (!record) return null;
  const commitment = await tx.objectStore("commitments").get(record.commitmentId);
  if (!commitment) return null;
  const sessions = await tx.objectStore("timerSessions").index("by-record").getAll(recordId);
  return { record, commitment, sessions };
}

function maxTimestamp(sessions: readonly TimerSession[]): number {
  let max = 0;
  for (const session of sessions) {
    for (const interval of session.intervals) {
      max = Math.max(max, interval.startedAtMs, interval.endedAtMs ?? 0);
    }
  }
  return max;
}

interface Eligibility {
  ok: boolean;
  reason?: string;
}

/** START eligibility (Blueprint §E3, §H1). Past incomplete records are recovery. */
function assessStart(ctx: RecordContext, nowMs: number): Eligibility {
  const { record, commitment, sessions } = ctx;
  if (record.recordedMs >= record.targetMs) return { ok: false, reason: "ALREADY_DONE" };
  const today = todayISOInZone(nowMs, commitment.timeZone);
  if (record.scheduledDate > today) return { ok: false, reason: "FUTURE" };
  if (nowMs >= deadlineInstantMs(commitment.endDate, commitment.timeZone)) {
    return { ok: false, reason: "COMMITMENT_ENDED" };
  }
  if (nowMs < maxTimestamp(sessions)) return { ok: false, reason: "CLOCK_BEHIND" };
  return { ok: true };
}

function assessResume(ctx: RecordContext, nowMs: number): Eligibility {
  const { record, commitment, sessions } = ctx;
  if (record.recordedMs >= record.targetMs) return { ok: false, reason: "ALREADY_DONE" };
  if (nowMs >= deadlineInstantMs(commitment.endDate, commitment.timeZone)) {
    return { ok: false, reason: "COMMITMENT_ENDED" };
  }
  if (nowMs < maxTimestamp(sessions)) return { ok: false, reason: "CLOCK_BEHIND" };
  return { ok: true };
}

interface SettleOutcome {
  sessionToPut: TimerSession;
  record: DayRecord;
  removeActive: boolean;
}

/**
 * Close the open interval at its effective end and settle the record/session
 * (Blueprint §E4/§E6/§E7). Target completion takes precedence over deadline and
 * over a USER stop. On PAUSE with nothing crossed, the session stays open.
 */
function settleClose(
  ctx: RecordContext,
  openRef: OpenIntervalRef,
  nowMs: number,
  intent: "PAUSE" | "STOP",
): SettleOutcome {
  const { commitment } = ctx;
  const target = ctx.record.targetMs;
  const closed = closedRawMs(ctx.sessions); // excludes the open interval
  const openStart = openRef.interval.startedAtMs;
  const deadline = deadlineInstantMs(commitment.endDate, commitment.timeZone);

  const { endMs, reachedTarget, reachedDeadline } = resolveEffectiveEndMs({
    openStartMs: openStart,
    closedRawMs: closed,
    targetMs: target,
    nowMs,
    deadlineInstantMs: deadline,
  });

  openRef.interval.endedAtMs = endMs; // mutate in place; session is put below
  const recomputed = recomputeFromSessions(ctx.sessions, target);
  const record: DayRecord = { ...ctx.record, recordedMs: recomputed.creditedMs, updatedAtMs: nowMs };
  const session = openRef.session;

  let removeActive: boolean;
  let stopReason: StopReason | null = null;

  if (reachedTarget) {
    record.completedAtMs = recomputed.targetCrossingMs ?? endMs;
    record.completionTiming = deriveCompletionTiming(record, commitment.timeZone);
    record.finalStatus = "DONE";
    stopReason = "TARGET_REACHED";
    removeActive = true;
  } else if (reachedDeadline) {
    record.finalStatus = record.recordedMs > 0 ? "PARTIAL" : "MISSED";
    stopReason = "COMMITMENT_ENDED";
    removeActive = true;
  } else if (intent === "STOP") {
    stopReason = "USER";
    removeActive = true;
  } else {
    removeActive = false; // PAUSE: session remains open for a later interval
  }

  if (stopReason) {
    session.stoppedAtMs = endMs;
    session.stopReason = stopReason;
  }
  return { sessionToPut: session, record, removeActive };
}

async function persistSettle(
  tx: TimerTx,
  outcome: SettleOutcome,
  active: ActiveTimer,
  nowMs: number,
): Promise<void> {
  await tx.objectStore("timerSessions").put(outcome.sessionToPut);
  await tx.objectStore("dayRecords").put(outcome.record);
  if (outcome.removeActive) {
    await tx.objectStore("activeTimer").delete(SINGLETON_KEY);
  } else {
    await tx.objectStore("activeTimer").put({
      ...active,
      mode: "PAUSED",
      revision: active.revision + 1,
      updatedAtMs: nowMs,
    });
  }
}

export async function startTimer(ports: AppPorts, recordId: string): Promise<CommandResult> {
  // Finalize any stale timer (target/deadline crossed while closed) first.
  await reconcileActiveTimer(ports);

  const now = ports.clock.nowMs();
  const tx = ports.db.transaction(TIMER_STORES, "readwrite");
  const active = await tx.objectStore("activeTimer").get(SINGLETON_KEY);
  if (active) {
    await tx.done;
    return { ok: false, reason: "TIMER_ACTIVE" };
  }
  const ctx = await readRecordContext(tx, recordId);
  if (!ctx) {
    await tx.done;
    return { ok: false, reason: "NOT_FOUND" };
  }
  const eligibility = assessStart(ctx, now);
  if (!eligibility.ok) {
    await tx.done;
    return { ok: false, reason: eligibility.reason ?? "INELIGIBLE" };
  }

  const sessionId = ports.newId();
  const session: TimerSession = {
    id: sessionId,
    commitmentId: ctx.commitment.id,
    dayRecordId: recordId,
    startedAtMs: now,
    stoppedAtMs: null,
    stopReason: null,
    intervals: [{ id: ports.newId(), startedAtMs: now, endedAtMs: null }],
  };
  const activeTimer: ActiveTimer = {
    key: SINGLETON_KEY,
    sessionId,
    commitmentId: ctx.commitment.id,
    dayRecordId: recordId,
    mode: "RUNNING",
    revision: 1,
    updatedAtMs: now,
  };
  await tx.objectStore("timerSessions").put(session);
  await tx.objectStore("activeTimer").put(activeTimer);
  await tx.done;

  ports.onChanged?.();
  return { ok: true };
}

export async function pauseTimer(ports: AppPorts): Promise<CommandResult> {
  const now = ports.clock.nowMs();
  const tx = ports.db.transaction(TIMER_STORES, "readwrite");
  const active = await tx.objectStore("activeTimer").get(SINGLETON_KEY);
  if (!active || active.mode !== "RUNNING") {
    await tx.done;
    return { ok: false, reason: "NO_RUNNING_TIMER" };
  }
  const ctx = await readRecordContext(tx, active.dayRecordId);
  if (!ctx) {
    await tx.objectStore("activeTimer").delete(SINGLETON_KEY);
    await tx.done;
    ports.onChanged?.();
    return { ok: false, reason: "NOT_FOUND" };
  }
  const openRef = findOpenInterval(ctx.sessions);
  if (!openRef) {
    // Inconsistent (RUNNING without an open interval): drop the singleton.
    await tx.objectStore("activeTimer").delete(SINGLETON_KEY);
    await tx.done;
    ports.onChanged?.();
    return { ok: false, reason: "INCONSISTENT" };
  }
  const outcome = settleClose(ctx, openRef, now, "PAUSE");
  await persistSettle(tx, outcome, active, now);
  await tx.done;

  ports.onChanged?.();
  return { ok: true };
}

export async function resumeTimer(ports: AppPorts): Promise<CommandResult> {
  const now = ports.clock.nowMs();
  const tx = ports.db.transaction(TIMER_STORES, "readwrite");
  const active = await tx.objectStore("activeTimer").get(SINGLETON_KEY);
  if (!active || active.mode !== "PAUSED") {
    await tx.done;
    return { ok: false, reason: "NO_PAUSED_TIMER" };
  }
  const ctx = await readRecordContext(tx, active.dayRecordId);
  if (!ctx) {
    await tx.objectStore("activeTimer").delete(SINGLETON_KEY);
    await tx.done;
    ports.onChanged?.();
    return { ok: false, reason: "NOT_FOUND" };
  }
  const eligibility = assessResume(ctx, now);
  if (!eligibility.ok) {
    await tx.done;
    return { ok: false, reason: eligibility.reason ?? "INELIGIBLE" };
  }
  const session = await tx.objectStore("timerSessions").get(active.sessionId);
  if (!session) {
    await tx.objectStore("activeTimer").delete(SINGLETON_KEY);
    await tx.done;
    ports.onChanged?.();
    return { ok: false, reason: "NOT_FOUND" };
  }
  session.intervals.push({ id: ports.newId(), startedAtMs: now, endedAtMs: null });
  await tx.objectStore("timerSessions").put(session);
  await tx.objectStore("activeTimer").put({
    ...active,
    mode: "RUNNING",
    revision: active.revision + 1,
    updatedAtMs: now,
  });
  await tx.done;

  ports.onChanged?.();
  return { ok: true };
}

export async function stopTimer(ports: AppPorts): Promise<CommandResult> {
  const now = ports.clock.nowMs();
  const tx = ports.db.transaction(TIMER_STORES, "readwrite");
  const active = await tx.objectStore("activeTimer").get(SINGLETON_KEY);
  if (!active) {
    await tx.done;
    return { ok: false, reason: "NO_TIMER" };
  }
  const ctx = await readRecordContext(tx, active.dayRecordId);
  if (!ctx) {
    await tx.objectStore("activeTimer").delete(SINGLETON_KEY);
    await tx.done;
    ports.onChanged?.();
    return { ok: false, reason: "NOT_FOUND" };
  }

  if (active.mode === "RUNNING") {
    const openRef = findOpenInterval(ctx.sessions);
    if (openRef) {
      const outcome = settleClose(ctx, openRef, now, "STOP");
      await tx.objectStore("timerSessions").put(outcome.sessionToPut);
      await tx.objectStore("dayRecords").put(outcome.record);
    }
    await tx.objectStore("activeTimer").delete(SINGLETON_KEY);
  } else {
    // PAUSED: close the paused session at its last interval end, no new time.
    const session = await tx.objectStore("timerSessions").get(active.sessionId);
    if (session) {
      const last = session.intervals[session.intervals.length - 1];
      session.stoppedAtMs = last?.endedAtMs ?? now;
      session.stopReason = "USER";
      await tx.objectStore("timerSessions").put(session);
    }
    await tx.objectStore("activeTimer").delete(SINGLETON_KEY);
  }
  await tx.done;

  ports.onChanged?.();
  return { ok: true };
}

/**
 * Finalize a stale/active timer if the target or deadline was crossed while the
 * app was closed (Blueprint §F1). Returns true if anything changed.
 */
export async function reconcileActiveTimer(ports: AppPorts): Promise<boolean> {
  const now = ports.clock.nowMs();
  const tx = ports.db.transaction(TIMER_STORES, "readwrite");
  const active = await tx.objectStore("activeTimer").get(SINGLETON_KEY);
  if (!active) {
    await tx.done;
    return false;
  }
  const ctx = await readRecordContext(tx, active.dayRecordId);
  if (!ctx) {
    await tx.objectStore("activeTimer").delete(SINGLETON_KEY);
    await tx.done;
    ports.onChanged?.();
    return true;
  }
  const deadline = deadlineInstantMs(ctx.commitment.endDate, ctx.commitment.timeZone);
  let changed = false;

  if (active.mode === "RUNNING") {
    const openRef = findOpenInterval(ctx.sessions);
    if (!openRef) {
      await tx.objectStore("activeTimer").delete(SINGLETON_KEY);
      changed = true;
    } else {
      const closed = closedRawMs(ctx.sessions);
      const targetCap = openRef.interval.startedAtMs + Math.max(0, ctx.record.targetMs - closed);
      if (now >= targetCap || now >= deadline) {
        const outcome = settleClose(ctx, openRef, now, "STOP");
        await tx.objectStore("timerSessions").put(outcome.sessionToPut);
        await tx.objectStore("dayRecords").put(outcome.record);
        await tx.objectStore("activeTimer").delete(SINGLETON_KEY);
        changed = true;
      }
    }
  } else if (now >= deadline) {
    // PAUSED past the deadline: finalize the paused session.
    const session = ctx.sessions.find((s) => s.id === active.sessionId);
    if (session) {
      const last = session.intervals[session.intervals.length - 1];
      session.stoppedAtMs = last?.endedAtMs ?? session.startedAtMs;
      session.stopReason = "COMMITMENT_ENDED";
      const recomputed = recomputeFromSessions(ctx.sessions, ctx.record.targetMs);
      const record: DayRecord = {
        ...ctx.record,
        recordedMs: recomputed.creditedMs,
        finalStatus: recomputed.creditedMs > 0 ? "PARTIAL" : "MISSED",
        updatedAtMs: now,
      };
      await tx.objectStore("timerSessions").put(session);
      await tx.objectStore("dayRecords").put(record);
    }
    await tx.objectStore("activeTimer").delete(SINGLETON_KEY);
    changed = true;
  }

  await tx.done;
  if (changed) ports.onChanged?.();
  return changed;
}
