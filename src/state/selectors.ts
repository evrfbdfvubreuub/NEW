// Pure selectors / view-model builders (Blueprint §O3). No side effects.
import type {
  ActiveTimer,
  Commitment,
  CommitmentAggregate,
  CommitmentLifecycle,
  DayRecord,
  DisplayStatus,
  TimerMode,
} from "@/domain/types";
import { deadlineInstantMs } from "@/domain/time/calendar";
import {
  displayStatus,
  isRecordDone,
  isRecoveryEligible,
  progressPercent,
} from "@/domain/commitments/status";
import {
  commitmentLifecycle,
  daysRemaining,
  findTodayRecord,
} from "@/domain/commitments/commitment";
import { calculateConsistency, planCompletion, type Consistency, type PlanCompletion } from "@/domain/commitments/progress";
import { computeTimerSnapshot, type TimerSnapshot } from "@/domain/timer/calculations";

export interface AppData {
  commitments: Commitment[];
  records: DayRecord[];
  activeTimer: ActiveTimer | null;
  activeSessions: DayRecordSessionList;
}

// Sessions belonging to the active record (loaded alongside the active timer).
type DayRecordSessionList = import("@/domain/types").TimerSession[];

export function recordsFor(records: readonly DayRecord[], commitmentId: string): DayRecord[] {
  return records
    .filter((r) => r.commitmentId === commitmentId)
    .sort((a, b) => a.ordinal - b.ordinal);
}

export function aggregatesOf(
  commitments: readonly Commitment[],
  records: readonly DayRecord[],
): CommitmentAggregate[] {
  return commitments.map((commitment) => ({
    commitment,
    records: recordsFor(records, commitment.id),
  }));
}

// ---- Today ----

export type TodayGroup = "NEEDS_ATTENTION" | "PARTIAL" | "NOT_STARTED" | "COMPLETED";

const GROUP_ORDER: Record<TodayGroup, number> = {
  NEEDS_ATTENTION: 0,
  PARTIAL: 1,
  NOT_STARTED: 2,
  COMPLETED: 3,
};

export interface TodayCommitmentView {
  commitment: Commitment;
  todayRecord: DayRecord | null;
  group: TodayGroup;
  status: DisplayStatus | null;
  creditedMs: number;
  targetMs: number;
  percent: number;
  recoverableCount: number;
  earliestRecoverableDate: string | null;
  ownsTimer: boolean;
  timerMode: TimerMode | null;
  attentionRank: number; // 0 running, 1 paused, 2 recovery-only
}

export function buildTodayView(
  data: Pick<AppData, "commitments" | "records" | "activeTimer">,
  nowMs: number,
): TodayCommitmentView[] {
  const views: TodayCommitmentView[] = [];
  for (const commitment of data.commitments) {
    const records = recordsFor(data.records, commitment.id);
    if (commitmentLifecycle(commitment, records, nowMs) !== "ACTIVE") continue;

    const todayRecord = findTodayRecord(commitment, records, nowMs);
    const recoverable = records.filter((r) => isRecoveryEligible(r, commitment, nowMs));
    const recoverableCount = recoverable.length;
    const earliestRecoverableDate =
      recoverable.length > 0
        ? recoverable.reduce((min, r) => (r.scheduledDate < min ? r.scheduledDate : min), recoverable[0]!.scheduledDate)
        : null;

    const ownsTimer = data.activeTimer?.commitmentId === commitment.id;
    const timerMode = ownsTimer ? (data.activeTimer?.mode ?? null) : null;

    const done = todayRecord ? isRecordDone(todayRecord) : false;
    const credited = todayRecord?.recordedMs ?? 0;
    const target = todayRecord?.targetMs ?? commitment.dailyTargetMs;

    let group: TodayGroup;
    if (ownsTimer || recoverableCount > 0) group = "NEEDS_ATTENTION";
    else if (done) group = "COMPLETED";
    else if (credited > 0) group = "PARTIAL";
    else group = "NOT_STARTED";

    const attentionRank = timerMode === "RUNNING" ? 0 : timerMode === "PAUSED" ? 1 : 2;

    views.push({
      commitment,
      todayRecord,
      group,
      status: todayRecord ? displayStatus(todayRecord, commitment, nowMs) : null,
      creditedMs: credited,
      targetMs: target,
      percent: progressPercent(credited, target, done),
      recoverableCount,
      earliestRecoverableDate,
      ownsTimer,
      timerMode,
      attentionRank,
    });
  }

  return views.sort((a, b) => {
    if (a.group !== b.group) return GROUP_ORDER[a.group] - GROUP_ORDER[b.group];
    if (a.group === "NEEDS_ATTENTION") {
      if (a.attentionRank !== b.attentionRank) return a.attentionRank - b.attentionRank;
      if (a.earliestRecoverableDate && b.earliestRecoverableDate && a.earliestRecoverableDate !== b.earliestRecoverableDate) {
        return a.earliestRecoverableDate < b.earliestRecoverableDate ? -1 : 1;
      }
    }
    if (a.commitment.createdAtMs !== b.commitment.createdAtMs) {
      return a.commitment.createdAtMs - b.commitment.createdAtMs;
    }
    return a.commitment.name.localeCompare(b.commitment.name);
  });
}

export function todaySummary(views: readonly TodayCommitmentView[]): { completed: number; total: number } {
  const completed = views.filter((v) => v.group === "COMPLETED").length;
  return { completed, total: views.length };
}

// ---- Commitments list ----

export interface CommitmentListView {
  commitment: Commitment;
  lifecycle: CommitmentLifecycle;
  daysRemaining: number;
  plan: PlanCompletion;
}

export function buildCommitmentListViews(
  data: Pick<AppData, "commitments" | "records">,
  nowMs: number,
): { active: CommitmentListView[]; ended: CommitmentListView[] } {
  const active: CommitmentListView[] = [];
  const ended: CommitmentListView[] = [];
  for (const commitment of data.commitments) {
    const records = recordsFor(data.records, commitment.id);
    const lifecycle = commitmentLifecycle(commitment, records, nowMs);
    const view: CommitmentListView = {
      commitment,
      lifecycle,
      daysRemaining: daysRemaining(commitment, nowMs),
      plan: planCompletion(commitment, records),
    };
    if (lifecycle === "ACTIVE") active.push(view);
    else ended.push(view);
  }
  const byCreated = (a: CommitmentListView, b: CommitmentListView) =>
    b.commitment.createdAtMs - a.commitment.createdAtMs;
  active.sort(byCreated);
  ended.sort(byCreated);
  return { active, ended };
}

// ---- Progress ----

export function overallConsistency(
  data: Pick<AppData, "commitments" | "records">,
  nowMs: number,
): Consistency {
  return calculateConsistency(aggregatesOf(data.commitments, data.records), nowMs);
}

export function commitmentConsistency(
  commitment: Commitment,
  records: readonly DayRecord[],
  nowMs: number,
): Consistency {
  return calculateConsistency([{ commitment, records: recordsFor(records, commitment.id) }], nowMs);
}

// ---- Active timer ----

export interface ActiveTimerView {
  commitment: Commitment;
  record: DayRecord;
  snapshot: TimerSnapshot;
  mode: TimerMode;
  isRecovery: boolean;
}

export function activeTimerView(data: AppData, nowMs: number): ActiveTimerView | null {
  if (!data.activeTimer) return null;
  const record = data.records.find((r) => r.id === data.activeTimer!.dayRecordId);
  const commitment = data.commitments.find((c) => c.id === data.activeTimer!.commitmentId);
  if (!record || !commitment) return null;
  const deadline = deadlineInstantMs(commitment.endDate, commitment.timeZone);
  const snapshot = computeTimerSnapshot(data.activeSessions, record.targetMs, nowMs, deadline);
  const today = findTodayRecord(commitment, recordsFor(data.records, commitment.id), nowMs);
  return {
    commitment,
    record,
    snapshot,
    mode: data.activeTimer.mode,
    isRecovery: today?.id !== record.id,
  };
}
