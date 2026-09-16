// Daily-state logic (Blueprint §G) and exact percentage (Blueprint §E8).
import type {
  BaseStatus,
  Commitment,
  CompletionTiming,
  DayRecord,
  DisplayStatus,
  EpochMs,
} from "../types";
import { completionDateISO, deadlineInstantMs, todayISOInZone } from "../time/calendar";

/** Whole-second-credited completion test. */
export function isRecordDone(record: Pick<DayRecord, "recordedMs" | "targetMs">): boolean {
  return record.recordedMs >= record.targetMs;
}

export function deriveCompletionTiming(
  record: Pick<DayRecord, "completedAtMs" | "scheduledDate">,
  zone: string,
): CompletionTiming | null {
  if (record.completedAtMs == null) return null;
  const completionDate = completionDateISO(record.completedAtMs, zone);
  return completionDate === record.scheduledDate ? "ON_TIME" : "LATE";
}

export function baseStatus(
  record: Pick<DayRecord, "recordedMs" | "targetMs" | "scheduledDate">,
  commitment: Pick<Commitment, "timeZone">,
  nowMs: EpochMs,
): BaseStatus {
  if (record.recordedMs >= record.targetMs) return "DONE";
  if (record.recordedMs > 0) return "PARTIAL";
  const today = todayISOInZone(nowMs, commitment.timeZone);
  return record.scheduledDate < today ? "MISSED" : "NOT_STARTED";
}

export function displayStatus(
  record: DayRecord,
  commitment: Pick<Commitment, "timeZone">,
  nowMs: EpochMs,
): DisplayStatus {
  const base = baseStatus(record, commitment, nowMs);
  if (base === "DONE") {
    const timing = record.completionTiming ?? deriveCompletionTiming(record, commitment.timeZone);
    return timing === "LATE" ? "COMPLETED_LATE" : "DONE_ON_TIME";
  }
  if (base === "PARTIAL") return "PARTIAL";
  if (base === "MISSED") return "MISSED";
  const today = todayISOInZone(nowMs, commitment.timeZone);
  return record.scheduledDate > today ? "UPCOMING" : "NOT_STARTED";
}

/**
 * Recovery eligibility (Blueprint §H1): a past, incomplete record while the
 * commitment deadline has not passed.
 */
export function isRecoveryEligible(
  record: Pick<DayRecord, "recordedMs" | "targetMs" | "scheduledDate">,
  commitment: Pick<Commitment, "timeZone" | "endDate">,
  nowMs: EpochMs,
): boolean {
  if (record.recordedMs >= record.targetMs) return false; // DONE
  const today = todayISOInZone(nowMs, commitment.timeZone);
  if (!(record.scheduledDate < today)) return false; // today/future are not recovery
  return nowMs < deadlineInstantMs(commitment.endDate, commitment.timeZone);
}

/** Whether `now` is before the exclusive commitment boundary. */
export function isCommitmentActive(
  commitment: Pick<Commitment, "endDate" | "timeZone">,
  nowMs: EpochMs,
): boolean {
  return nowMs < deadlineInstantMs(commitment.endDate, commitment.timeZone);
}

/**
 * Numeric percentage with the incomplete clamp (Blueprint §E8).
 * Returns 100 only when the record is DONE; otherwise never returns 100.
 */
export function progressPercent(creditedMs: number, targetMs: number, isDone: boolean): number {
  if (isDone || creditedMs >= targetMs) return 100;
  if (targetMs <= 0) return 0;
  const ratio = creditedMs / targetMs;
  return Math.min(Math.round(ratio * 1000) / 10, 99.9);
}
