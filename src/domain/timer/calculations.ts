// Timer math (Blueprint §E). Authoritative durations come from persisted
// interval timestamps. Progress is credited in whole seconds and capped at
// the target so a day reaches DONE only at EXACTLY the target.
import type { EpochMs, TimerInterval, TimerSession } from "../types";

export interface OpenIntervalRef {
  session: TimerSession;
  interval: TimerInterval;
}

/** Sum of every CLOSED interval across the provided sessions (raw ms). */
export function closedRawMs(sessions: readonly TimerSession[]): number {
  let sum = 0;
  for (const session of sessions) {
    for (const interval of session.intervals) {
      if (interval.endedAtMs != null) {
        sum += Math.max(0, interval.endedAtMs - interval.startedAtMs);
      }
    }
  }
  return sum;
}

/** The single open (running) interval, if any. */
export function findOpenInterval(sessions: readonly TimerSession[]): OpenIntervalRef | null {
  for (const session of sessions) {
    for (const interval of session.intervals) {
      if (interval.endedAtMs == null) return { session, interval };
    }
  }
  return null;
}

/**
 * Credited duration (Blueprint §A3): floor raw ms to whole seconds, then cap at
 * the target. Whole-second credit is what drives status and percentage.
 */
export function creditFromRaw(rawMs: number, targetMs: number): number {
  const flooredSeconds = Math.floor(Math.max(0, rawMs) / 1000) * 1000;
  return Math.min(targetMs, flooredSeconds);
}

export interface TimerSnapshot {
  isRunning: boolean;
  rawElapsedMs: number;
  creditedMs: number;
  remainingCreditedMs: number;
  /** Instant at which RAW elapsed reaches the target for the current open interval. */
  targetCapMs: EpochMs | null;
  /** Earliest of target cap and deadline for the current open interval. */
  effectiveCapMs: EpochMs | null;
}

/**
 * Live snapshot for a record given all its sessions and `now`.
 * Running state is inferred from the presence of an open interval
 * (invariant: an open interval exists only while RUNNING).
 */
export function computeTimerSnapshot(
  sessions: readonly TimerSession[],
  targetMs: number,
  nowMs: EpochMs,
  deadlineInstantMs: EpochMs,
): TimerSnapshot {
  const closed = closedRawMs(sessions);
  const open = findOpenInterval(sessions);
  const isRunning = open != null;

  let targetCapMs: EpochMs | null = null;
  let effectiveCapMs: EpochMs | null = null;
  let liveRaw = 0;

  if (open) {
    const remainingRawBeforeOpen = Math.max(0, targetMs - closed);
    targetCapMs = open.interval.startedAtMs + remainingRawBeforeOpen;
    effectiveCapMs = Math.min(targetCapMs, deadlineInstantMs);
    // Live portion never exceeds the effective cap; and never negative.
    const boundedNow = Math.min(Math.max(nowMs, open.interval.startedAtMs), effectiveCapMs);
    liveRaw = boundedNow - open.interval.startedAtMs;
  }

  const rawElapsedMs = closed + liveRaw;
  const creditedMs = creditFromRaw(rawElapsedMs, targetMs);
  return {
    isRunning,
    rawElapsedMs,
    creditedMs,
    remainingCreditedMs: Math.max(0, targetMs - creditedMs),
    targetCapMs,
    effectiveCapMs,
  };
}

export interface Recomputed {
  rawMs: number;
  creditedMs: number;
  reachedTarget: boolean;
  /** Exact instant raw elapsed first reaches the target, from CLOSED intervals. */
  targetCrossingMs: EpochMs | null;
}

/**
 * Recompute a record purely from its CLOSED session intervals (Blueprint §C7).
 * Used by integrity validation and import to prove recorded values.
 */
export function recomputeFromSessions(
  sessions: readonly TimerSession[],
  targetMs: number,
): Recomputed {
  const intervals: TimerInterval[] = [];
  for (const session of sessions) {
    for (const interval of session.intervals) {
      if (interval.endedAtMs != null) intervals.push(interval);
    }
  }
  intervals.sort((a, b) => a.startedAtMs - b.startedAtMs);

  let cumulative = 0;
  let crossing: EpochMs | null = null;
  for (const interval of intervals) {
    const duration = Math.max(0, (interval.endedAtMs as number) - interval.startedAtMs);
    if (crossing == null && cumulative + duration >= targetMs) {
      crossing = interval.startedAtMs + (targetMs - cumulative);
    }
    cumulative += duration;
  }

  return {
    rawMs: cumulative,
    creditedMs: creditFromRaw(cumulative, targetMs),
    reachedTarget: cumulative >= targetMs,
    targetCrossingMs: crossing,
  };
}

/**
 * The effective end instant for closing an open interval on Pause/Stop/reconcile
 * (Blueprint §E4): earliest of `now`, target cap, and deadline — but never before
 * the interval start (guards a backward clock). Target wins ties with deadline.
 */
export function resolveEffectiveEndMs(params: {
  openStartMs: EpochMs;
  closedRawMs: number;
  targetMs: number;
  nowMs: EpochMs;
  deadlineInstantMs: EpochMs;
}): { endMs: EpochMs; reachedTarget: boolean; reachedDeadline: boolean } {
  const { openStartMs, targetMs, nowMs, deadlineInstantMs: deadline } = params;
  const targetCapMs = openStartMs + Math.max(0, targetMs - params.closedRawMs);
  const safeNow = Math.max(nowMs, openStartMs);
  const endMs = Math.min(safeNow, targetCapMs, deadline);
  return {
    endMs,
    reachedTarget: targetCapMs <= endMs, // equality => target reached
    reachedDeadline: deadline <= endMs && targetCapMs > deadline,
  };
}
