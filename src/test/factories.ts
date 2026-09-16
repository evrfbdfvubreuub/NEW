// Test data factories (deterministic ids, UTC zone by default).
import type {
  ActiveTimer,
  Commitment,
  DayRecord,
  TimerInterval,
  TimerSession,
} from "@/domain/types";

let counter = 0;
export function nextId(prefix = "id"): string {
  counter += 1;
  return `${prefix}-${counter}`;
}
export function resetIds(): void {
  counter = 0;
}

export const TWO_HOURS_MS = 7_200_000;

/** epoch ms for a UTC wall-clock time. month is 1-based here for readability. */
export function utc(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
): number {
  return Date.UTC(year, month - 1, day, hour, minute, second);
}

export function makeCommitment(over: Partial<Commitment> = {}): Commitment {
  return {
    id: over.id ?? "commitment-1",
    schemaVersion: 1,
    name: over.name ?? "Study Electronics",
    dailyTargetMs: over.dailyTargetMs ?? TWO_HOURS_MS,
    durationDays: over.durationDays ?? 30,
    reminderTimes: over.reminderTimes ?? [],
    startDate: over.startDate ?? "2026-09-01",
    endDate: over.endDate ?? "2026-09-30",
    timeZone: over.timeZone ?? "UTC",
    createdAtMs: over.createdAtMs ?? utc(2026, 9, 1, 8),
  };
}

export function makeRecord(over: Partial<DayRecord> = {}): DayRecord {
  return {
    id: over.id ?? "record-1",
    commitmentId: over.commitmentId ?? "commitment-1",
    ordinal: over.ordinal ?? 1,
    scheduledDate: over.scheduledDate ?? "2026-09-01",
    targetMs: over.targetMs ?? TWO_HOURS_MS,
    recordedMs: over.recordedMs ?? 0,
    completedAtMs: over.completedAtMs ?? null,
    completionTiming: over.completionTiming ?? null,
    finalStatus: over.finalStatus ?? null,
    createdAtMs: over.createdAtMs ?? utc(2026, 9, 1, 8),
    updatedAtMs: over.updatedAtMs ?? utc(2026, 9, 1, 8),
  };
}

export function closedInterval(startMs: number, endMs: number): TimerInterval {
  return { id: nextId("interval"), startedAtMs: startMs, endedAtMs: endMs };
}

export function openInterval(startMs: number): TimerInterval {
  return { id: nextId("interval"), startedAtMs: startMs, endedAtMs: null };
}

export function makeSession(over: Partial<TimerSession> = {}): TimerSession {
  const intervals = over.intervals ?? [];
  const first = intervals[0];
  const last = intervals[intervals.length - 1];
  return {
    id: over.id ?? "session-1",
    commitmentId: over.commitmentId ?? "commitment-1",
    dayRecordId: over.dayRecordId ?? "record-1",
    startedAtMs: over.startedAtMs ?? first?.startedAtMs ?? 0,
    stoppedAtMs:
      over.stoppedAtMs !== undefined
        ? over.stoppedAtMs
        : last && last.endedAtMs != null
          ? last.endedAtMs
          : null,
    stopReason: over.stopReason ?? null,
    intervals,
  };
}

export function makeActiveTimer(over: Partial<ActiveTimer> = {}): ActiveTimer {
  return {
    key: "singleton",
    sessionId: over.sessionId ?? "session-1",
    commitmentId: over.commitmentId ?? "commitment-1",
    dayRecordId: over.dayRecordId ?? "record-1",
    mode: over.mode ?? "RUNNING",
    revision: over.revision ?? 1,
    updatedAtMs: over.updatedAtMs ?? 0,
  };
}
