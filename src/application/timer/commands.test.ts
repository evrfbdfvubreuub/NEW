import { beforeEach, describe, expect, it } from "vitest";
import { freshPorts } from "@/test/db";
import { createCommitment } from "@/application/commitments/create-commitment";
import { pauseTimer, reconcileActiveTimer, resumeTimer, startTimer, stopTimer } from "./commands";
import {
  getActiveTimer,
  getRecord,
  getRecordsByCommitment,
  getSessionsByRecord,
} from "@/infrastructure/db/repositories";
import { computeTimerSnapshot } from "@/domain/timer/calculations";
import { deadlineInstantMs } from "@/domain/time/calendar";
import { TWO_HOURS_MS, utc } from "@/test/factories";
import type { AppPorts } from "@/application/ports";
import type { Clock } from "@/domain/time/clock";
import type { Commitment, DayRecord } from "@/domain/types";

type MutableClock = Clock & { set(ms: number): void; advance(ms: number): void };

interface Ctx {
  ports: AppPorts;
  clock: MutableClock;
  commitment: Commitment;
  records: DayRecord[];
}

async function setup(
  startMs: number,
  form: Partial<{ targetHours: number; targetMinutes: number; durationDays: number }> = {},
): Promise<Ctx> {
  const { ports, clock } = await freshPorts(startMs, "UTC");
  const result = await createCommitment(ports, {
    name: "Study Electronics",
    targetHours: form.targetHours ?? 2,
    targetMinutes: form.targetMinutes ?? 0,
    durationDays: form.durationDays ?? 30,
    reminderTimes: [],
  });
  if (!result.ok) throw new Error("commitment creation failed");
  const records = await getRecordsByCommitment(ports.db, result.commitment.id);
  return { ports, clock, commitment: result.commitment, records };
}

function byDate(records: DayRecord[], iso: string): DayRecord {
  const record = records.find((r) => r.scheduledDate === iso);
  if (!record) throw new Error(`no record for ${iso}`);
  return record;
}

describe("timer commands", () => {
  beforeEach(() => {
    // fresh DB is created per setup() call
  });

  it("start creates a running session; pause credits time and excludes paused time", async () => {
    const t0 = utc(2026, 9, 10, 9);
    const { ports, clock, records } = await setup(t0);
    const today = byDate(records, "2026-09-10");

    expect((await startTimer(ports, today.id)).ok).toBe(true);
    let active = await getActiveTimer(ports.db);
    expect(active?.mode).toBe("RUNNING");

    clock.advance(60_000); // 60s
    expect((await pauseTimer(ports)).ok).toBe(true);
    active = await getActiveTimer(ports.db);
    expect(active?.mode).toBe("PAUSED");

    let record = await getRecord(ports.db, today.id);
    expect(record?.recordedMs).toBe(60_000);

    // Advance while paused — must not accrue.
    clock.advance(999_999);
    const sessions = await getSessionsByRecord(ports.db, today.id);
    const snap = computeTimerSnapshot(sessions, TWO_HOURS_MS, clock.nowMs(), Number.MAX_SAFE_INTEGER);
    expect(snap.isRunning).toBe(false);
    expect(snap.creditedMs).toBe(60_000);

    // Resume + 60s + stop => 120s total.
    expect((await resumeTimer(ports)).ok).toBe(true);
    clock.advance(60_000);
    expect((await stopTimer(ports)).ok).toBe(true);
    record = await getRecord(ports.db, today.id);
    expect(record?.recordedMs).toBe(120_000);
    expect(await getActiveTimer(ports.db)).toBeNull();
  });

  it("survives refresh: elapsed derives from persisted timestamps", async () => {
    const t0 = utc(2026, 9, 10, 9);
    const { ports, clock, records } = await setup(t0);
    const today = byDate(records, "2026-09-10");
    await startTimer(ports, today.id);

    clock.advance(90_000); // 90s later, no pause
    // Re-read persisted sessions and compute — simulates reopen.
    const sessions = await getSessionsByRecord(ports.db, today.id);
    const snap = computeTimerSnapshot(sessions, TWO_HOURS_MS, clock.nowMs(), Number.MAX_SAFE_INTEGER);
    expect(snap.isRunning).toBe(true);
    expect(snap.creditedMs).toBe(90_000);
  });

  it("reaching the target completes at EXACTLY the target with no bonus time", async () => {
    const t0 = utc(2026, 9, 10, 9);
    const { ports, clock, records } = await setup(t0);
    const today = byDate(records, "2026-09-10");
    await startTimer(ports, today.id);

    clock.advance(TWO_HOURS_MS + 5_000); // 5s past the target
    const changed = await reconcileActiveTimer(ports);
    expect(changed).toBe(true);

    const record = await getRecord(ports.db, today.id);
    expect(record?.recordedMs).toBe(TWO_HOURS_MS);
    expect(record?.completedAtMs).toBe(t0 + TWO_HOURS_MS); // exact cap, not now
    expect(record?.completionTiming).toBe("ON_TIME");
    expect(record?.finalStatus).toBe("DONE");
    expect(await getActiveTimer(ports.db)).toBeNull();
  });

  it("enforces a single timer across the whole app", async () => {
    const t0 = utc(2026, 9, 10, 9);
    const { ports, clock, records } = await setup(t0);
    const a = byDate(records, "2026-09-10");

    // A second commitment with its own today record.
    const second = await createCommitment(ports, {
      name: "Read",
      targetHours: 1,
      targetMinutes: 0,
      durationDays: 30,
      reminderTimes: [],
    });
    if (!second.ok) throw new Error("second commitment failed");
    const bRecords = await getRecordsByCommitment(ports.db, second.commitment.id);
    const b = byDate(bRecords, "2026-09-10");

    expect((await startTimer(ports, a.id)).ok).toBe(true);
    clock.advance(1_000);
    const blocked = await startTimer(ports, b.id);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.reason).toBe("TIMER_ACTIVE");
  });

  it("cannot start a future day", async () => {
    const t0 = utc(2026, 9, 10, 9);
    const { ports, records } = await setup(t0);
    const future = byDate(records, "2026-09-20");
    const result = await startTimer(ports, future.id);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("FUTURE");
  });

  it("late recovery keeps the scheduled date and marks COMPLETED LATE; today untouched", async () => {
    const created = utc(2026, 9, 8, 9);
    const { ports, clock, records } = await setup(created);
    const day8 = byDate(records, "2026-09-08");
    const day12 = byDate(records, "2026-09-12");

    clock.set(utc(2026, 9, 12, 9)); // now day 12
    expect((await startTimer(ports, day8.id)).ok).toBe(true); // recovery
    clock.advance(TWO_HOURS_MS + 1_000);
    await reconcileActiveTimer(ports);

    const recovered = await getRecord(ports.db, day8.id);
    expect(recovered?.scheduledDate).toBe("2026-09-08"); // never moves
    expect(recovered?.finalStatus).toBe("DONE");
    expect(recovered?.completionTiming).toBe("LATE");
    // The day-12 record is not touched by recovering day 8.
    const today = await getRecord(ports.db, day12.id);
    expect(today?.recordedMs).toBe(0);
    expect(today?.completedAtMs).toBeNull();
  });

  it("caps a running timer at the commitment deadline (PARTIAL, no completion)", async () => {
    const created = utc(2026, 9, 8, 9);
    const { ports, clock, commitment, records } = await setup(created, {
      targetHours: 24,
      durationDays: 1,
    });
    const day = byDate(records, "2026-09-08");
    const deadline = deadlineInstantMs(commitment.endDate, commitment.timeZone);
    expect(deadline).toBe(utc(2026, 9, 9, 0));

    await startTimer(ports, day.id);
    clock.set(utc(2026, 9, 9, 2)); // 2h past deadline, before the 24h target cap
    await reconcileActiveTimer(ports);

    const record = await getRecord(ports.db, day.id);
    // Credited from 09:00 to next midnight = 15h.
    expect(record?.recordedMs).toBe(15 * 60 * 60_000);
    expect(record?.finalStatus).toBe("PARTIAL");
    expect(record?.completedAtMs).toBeNull();
    expect(await getActiveTimer(ports.db)).toBeNull();
  });
});
