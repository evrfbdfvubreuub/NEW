// Commitment creation, validation, lifecycle (Blueprint §A4, §A5, §M4).
import type {
  Commitment,
  CommitmentLifecycle,
  DayRecord,
  EpochMs,
  HHmm,
  IANAZone,
} from "../types";
import {
  addDaysISO,
  compareISO,
  daysBetweenInclusive,
  todayISOInZone,
} from "../time/calendar";
import { isCommitmentActive, isRecordDone } from "./status";

export const LIMITS = {
  NAME_MAX: 80,
  TARGET_MIN_MS: 60_000, // 1 minute
  TARGET_MAX_MS: 24 * 60 * 60_000, // 24 hours
  DURATION_MIN: 1,
  DURATION_MAX: 3650,
  REMINDERS_MAX: 10,
} as const;

const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export interface CommitmentFormInput {
  name: string;
  targetHours: number;
  targetMinutes: number;
  durationDays: number;
  reminderTimes: string[];
}

export interface NormalizedCommitment {
  name: string;
  dailyTargetMs: number;
  durationDays: number;
  reminderTimes: HHmm[];
}

export type CommitmentFormErrors = Partial<
  Record<"name" | "target" | "durationDays" | "reminderTimes", string>
>;

export interface ValidationResult {
  valid: boolean;
  errors: CommitmentFormErrors;
  normalized?: NormalizedCommitment;
}

export function normalizeReminderTimes(times: readonly string[]): {
  ok: boolean;
  value: HHmm[];
  error?: string;
} {
  const cleaned = times.map((t) => t.trim()).filter((t) => t.length > 0);
  for (const t of cleaned) {
    if (!HHMM_RE.test(t)) return { ok: false, value: [], error: `Invalid time: ${t}` };
  }
  const unique = Array.from(new Set(cleaned));
  if (unique.length !== cleaned.length) {
    return { ok: false, value: [], error: "Reminder times must be unique." };
  }
  if (unique.length > LIMITS.REMINDERS_MAX) {
    return { ok: false, value: [], error: `At most ${LIMITS.REMINDERS_MAX} reminders.` };
  }
  unique.sort();
  return { ok: true, value: unique };
}

export function validateCommitmentForm(input: CommitmentFormInput): ValidationResult {
  const errors: CommitmentFormErrors = {};

  const name = input.name.trim();
  if (name.length < 1) errors.name = "Name is required.";
  else if (name.length > LIMITS.NAME_MAX) errors.name = `Name must be ${LIMITS.NAME_MAX} characters or fewer.`;

  const hours = Number.isFinite(input.targetHours) ? Math.trunc(input.targetHours) : 0;
  const minutes = Number.isFinite(input.targetMinutes) ? Math.trunc(input.targetMinutes) : 0;
  const dailyTargetMs = (hours * 60 + minutes) * 60_000;
  if (hours < 0 || minutes < 0 || minutes > 59) {
    errors.target = "Enter a valid daily target.";
  } else if (dailyTargetMs < LIMITS.TARGET_MIN_MS) {
    errors.target = "Daily target must be at least 1 minute.";
  } else if (dailyTargetMs > LIMITS.TARGET_MAX_MS) {
    errors.target = "Daily target cannot exceed 24 hours.";
  }

  const durationDays = Math.trunc(input.durationDays);
  if (!Number.isFinite(input.durationDays) || durationDays < LIMITS.DURATION_MIN) {
    errors.durationDays = "Duration must be at least 1 day.";
  } else if (durationDays > LIMITS.DURATION_MAX) {
    errors.durationDays = `Duration cannot exceed ${LIMITS.DURATION_MAX} days.`;
  }

  const reminders = normalizeReminderTimes(input.reminderTimes);
  if (!reminders.ok) errors.reminderTimes = reminders.error;

  if (Object.keys(errors).length > 0) return { valid: false, errors };

  return {
    valid: true,
    errors: {},
    normalized: { name, dailyTargetMs, durationDays, reminderTimes: reminders.value },
  };
}

export interface BuildContext {
  nowMs: EpochMs;
  timeZone: IANAZone;
  newId: () => string;
}

/** Build the immutable commitment plus its full permanent day-record set (Blueprint §A4, §C2). */
export function buildCommitmentAggregate(
  normalized: NormalizedCommitment,
  ctx: BuildContext,
): { commitment: Commitment; records: DayRecord[] } {
  const startDate = todayISOInZone(ctx.nowMs, ctx.timeZone);
  const endDate = addDaysISO(startDate, normalized.durationDays - 1);
  const commitmentId = ctx.newId();

  const commitment: Commitment = {
    id: commitmentId,
    schemaVersion: 1,
    name: normalized.name,
    dailyTargetMs: normalized.dailyTargetMs,
    durationDays: normalized.durationDays,
    reminderTimes: normalized.reminderTimes,
    startDate,
    endDate,
    timeZone: ctx.timeZone,
    createdAtMs: ctx.nowMs,
  };

  const records: DayRecord[] = [];
  for (let i = 0; i < normalized.durationDays; i += 1) {
    records.push({
      id: ctx.newId(),
      commitmentId,
      ordinal: i + 1,
      scheduledDate: addDaysISO(startDate, i),
      targetMs: normalized.dailyTargetMs,
      recordedMs: 0,
      completedAtMs: null,
      completionTiming: null,
      finalStatus: null,
      createdAtMs: ctx.nowMs,
      updatedAtMs: ctx.nowMs,
    });
  }

  return { commitment, records };
}

export function commitmentLifecycle(
  commitment: Commitment,
  records: readonly DayRecord[],
  nowMs: EpochMs,
): CommitmentLifecycle {
  if (isCommitmentActive(commitment, nowMs)) return "ACTIVE";
  return records.every(isRecordDone) ? "ENDED_COMPLETE" : "ENDED_INCOMPLETE";
}

/** Days remaining, inclusive of today while within range; 0 after end (Blueprint §M4). */
export function daysRemaining(commitment: Commitment, nowMs: EpochMs): number {
  const today = todayISOInZone(nowMs, commitment.timeZone);
  if (compareISO(commitment.endDate, today) < 0) return 0;
  return daysBetweenInclusive(today, commitment.endDate);
}

/** The record scheduled for the commitment-zone today, if the commitment covers today. */
export function findTodayRecord(
  commitment: Commitment,
  records: readonly DayRecord[],
  nowMs: EpochMs,
): DayRecord | null {
  const today = todayISOInZone(nowMs, commitment.timeZone);
  return records.find((r) => r.scheduledDate === today) ?? null;
}
