// Progress metrics (Blueprint §M6, §M9). Two explicitly named, never-interchanged
// metrics: PLAN COMPLETION and HISTORICAL CONSISTENCY.
import type { Commitment, CommitmentAggregate, DayRecord, EpochMs } from "../types";
import { todayISOInZone } from "../time/calendar";
import { deriveCompletionTiming, isRecordDone } from "./status";

/** PLAN COMPLETION: all DONE records / full duration (includes future days). */
export interface PlanCompletion {
  doneCount: number;
  totalDays: number;
  percent: number; // 0..100, one decimal
}

export function planCompletion(
  commitment: Pick<Commitment, "durationDays">,
  records: readonly DayRecord[],
): PlanCompletion {
  const doneCount = records.filter(isRecordDone).length;
  const totalDays = commitment.durationDays;
  const percent = totalDays > 0 ? Math.round((doneCount / totalDays) * 1000) / 10 : 0;
  return { doneCount, totalDays, percent };
}

/**
 * HISTORICAL CONSISTENCY: among records strictly before the commitment-zone
 * today, count DONE (split on-time/late), PARTIAL, MISSED. Today and future are
 * excluded. Breakdown sums exactly to `pastCount`.
 */
export interface Consistency {
  pastCount: number;
  doneCount: number;
  onTime: number;
  late: number;
  partial: number;
  missed: number;
  percent: number; // done/past, one decimal
  hasClosedDays: boolean;
}

function emptyConsistency(): Consistency {
  return {
    pastCount: 0,
    doneCount: 0,
    onTime: 0,
    late: 0,
    partial: 0,
    missed: 0,
    percent: 0,
    hasClosedDays: false,
  };
}

function accumulate(target: Consistency, record: DayRecord, commitment: Commitment): void {
  target.pastCount += 1;
  if (isRecordDone(record)) {
    target.doneCount += 1;
    const timing = record.completionTiming ?? deriveCompletionTiming(record, commitment.timeZone);
    if (timing === "LATE") target.late += 1;
    else target.onTime += 1;
  } else if (record.recordedMs > 0) {
    target.partial += 1;
  } else {
    target.missed += 1;
  }
}

function finalize(target: Consistency): Consistency {
  target.hasClosedDays = target.pastCount > 0;
  target.percent =
    target.pastCount > 0 ? Math.round((target.doneCount / target.pastCount) * 1000) / 10 : 0;
  return target;
}

/** Consistency across one or more commitments; each record uses its own zone's today. */
export function calculateConsistency(
  aggregates: readonly CommitmentAggregate[],
  nowMs: EpochMs,
): Consistency {
  const result = emptyConsistency();
  for (const { commitment, records } of aggregates) {
    const today = todayISOInZone(nowMs, commitment.timeZone);
    for (const record of records) {
      if (record.scheduledDate < today) accumulate(result, record, commitment);
    }
  }
  return finalize(result);
}
