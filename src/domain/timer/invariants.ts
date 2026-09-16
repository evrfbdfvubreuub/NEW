// Data-integrity invariants (Blueprint §C7). Used at bootstrap and at the import
// boundary. Returns violations; an empty array means the snapshot is consistent.
import type {
  ActiveTimer,
  Commitment,
  DayRecord,
  TimerSession,
} from "../types";
import { addDaysISO } from "../time/calendar";
import { deriveCompletionTiming, isRecordDone } from "../commitments/status";
import { recomputeFromSessions } from "./calculations";

export interface IntegritySnapshot {
  commitments: readonly Commitment[];
  records: readonly DayRecord[];
  sessions: readonly TimerSession[];
  activeTimer: ActiveTimer | null;
}

export interface IntegrityViolation {
  code: string;
  message: string;
}

export function validateIntegrity(snapshot: IntegritySnapshot): IntegrityViolation[] {
  const violations: IntegrityViolation[] = [];
  const add = (code: string, message: string) => violations.push({ code, message });

  const recordsByCommitment = new Map<string, DayRecord[]>();
  for (const record of snapshot.records) {
    const list = recordsByCommitment.get(record.commitmentId) ?? [];
    list.push(record);
    recordsByCommitment.set(record.commitmentId, list);
  }
  const sessionsByRecord = new Map<string, TimerSession[]>();
  for (const session of snapshot.sessions) {
    const list = sessionsByRecord.get(session.dayRecordId) ?? [];
    list.push(session);
    sessionsByRecord.set(session.dayRecordId, list);
  }
  const commitmentIds = new Set(snapshot.commitments.map((c) => c.id));
  const recordIds = new Set(snapshot.records.map((r) => r.id));

  for (const commitment of snapshot.commitments) {
    const records = (recordsByCommitment.get(commitment.id) ?? []).slice();
    if (records.length !== commitment.durationDays) {
      add("RECORD_COUNT", `Commitment ${commitment.id} has ${records.length} records; expected ${commitment.durationDays}.`);
    }
    records.sort((a, b) => a.ordinal - b.ordinal);
    records.forEach((record, index) => {
      const expectedOrdinal = index + 1;
      if (record.ordinal !== expectedOrdinal) {
        add("ORDINAL", `Commitment ${commitment.id} ordinal gap at ${record.ordinal}.`);
      }
      const expectedDate = addDaysISO(commitment.startDate, index);
      if (record.scheduledDate !== expectedDate) {
        add("DATE_SEQUENCE", `Record ${record.id} date ${record.scheduledDate} != ${expectedDate}.`);
      }
      if (record.targetMs !== commitment.dailyTargetMs) {
        add("TARGET_SNAPSHOT", `Record ${record.id} target != commitment target.`);
      }
    });
  }

  // Per-record recompute + status consistency.
  for (const record of snapshot.records) {
    if (!commitmentIds.has(record.commitmentId)) {
      add("ORPHAN_RECORD", `Record ${record.id} references missing commitment.`);
      continue;
    }
    const sessions = sessionsByRecord.get(record.id) ?? [];
    const recomputed = recomputeFromSessions(sessions, record.targetMs);
    if (recomputed.creditedMs !== record.recordedMs) {
      add("RECORDED_MISMATCH", `Record ${record.id} recordedMs ${record.recordedMs} != recomputed ${recomputed.creditedMs}.`);
    }
    if (isRecordDone(record)) {
      if (record.recordedMs !== record.targetMs) {
        add("DONE_NOT_EXACT", `Record ${record.id} is DONE but recordedMs != targetMs.`);
      }
      if (record.completedAtMs == null) {
        add("DONE_NO_TIMESTAMP", `Record ${record.id} is DONE without completedAtMs.`);
      } else if (recomputed.targetCrossingMs != null && recomputed.targetCrossingMs !== record.completedAtMs) {
        add("COMPLETION_INSTANT", `Record ${record.id} completedAtMs != target-crossing instant.`);
      }
      const commitment = snapshot.commitments.find((c) => c.id === record.commitmentId);
      if (commitment && record.completionTiming) {
        const derived = deriveCompletionTiming(record, commitment.timeZone);
        if (derived !== record.completionTiming) {
          add("TIMING_MISMATCH", `Record ${record.id} stored timing != derived.`);
        }
      }
    } else {
      if (record.recordedMs >= record.targetMs) {
        add("NONDONE_CREDIT", `Record ${record.id} not DONE but credited >= target.`);
      }
      if (record.completedAtMs != null || record.completionTiming != null) {
        add("NONDONE_COMPLETION", `Record ${record.id} not DONE but has completion data.`);
      }
    }
  }

  // Session structural checks.
  for (const session of snapshot.sessions) {
    if (!recordIds.has(session.dayRecordId)) {
      add("ORPHAN_SESSION", `Session ${session.id} references missing record.`);
    }
    const first = session.intervals[0];
    const last = session.intervals[session.intervals.length - 1];
    if (first && session.startedAtMs !== first.startedAtMs) {
      add("SESSION_START", `Session ${session.id} startedAtMs != first interval start.`);
    }
    if (session.stoppedAtMs != null) {
      if (!session.stopReason) add("SESSION_REASON", `Stopped session ${session.id} missing stop reason.`);
      if (last && last.endedAtMs !== session.stoppedAtMs) {
        add("SESSION_STOP", `Session ${session.id} stoppedAtMs != last interval end.`);
      }
    }
    for (const interval of session.intervals) {
      if (interval.endedAtMs != null && interval.endedAtMs < interval.startedAtMs) {
        add("INTERVAL_ORDER", `Interval ${interval.id} ends before it starts.`);
      }
    }
  }

  // Global interval ordering / single open interval (one timer, Blueprint §J2).
  const allIntervals = snapshot.sessions.flatMap((s) =>
    s.intervals.map((iv) => ({ sessionId: s.id, start: iv.startedAtMs, end: iv.endedAtMs })),
  );
  allIntervals.sort((a, b) => a.start - b.start);
  const openIntervals = allIntervals.filter((iv) => iv.end == null);
  if (openIntervals.length > 1) add("MULTIPLE_OPEN", "More than one open interval exists.");
  for (let i = 1; i < allIntervals.length; i += 1) {
    const prev = allIntervals[i - 1];
    const cur = allIntervals[i];
    if (!prev || !cur) continue;
    const prevEnd = prev.end ?? Number.POSITIVE_INFINITY;
    if (prevEnd > cur.start) add("INTERVAL_OVERLAP", "Timer intervals overlap.");
  }

  // Active timer consistency.
  const openRef = openIntervals[0];
  if (snapshot.activeTimer) {
    const at = snapshot.activeTimer;
    if (!snapshot.sessions.some((s) => s.id === at.sessionId)) {
      add("ACTIVE_ORPHAN", "Active timer references missing session.");
    }
    if (at.mode === "RUNNING" && !openRef) {
      add("ACTIVE_RUNNING_NO_OPEN", "Active timer RUNNING but no open interval.");
    }
    if (at.mode === "PAUSED" && openRef) {
      add("ACTIVE_PAUSED_OPEN", "Active timer PAUSED but an open interval exists.");
    }
  } else if (openRef) {
    add("OPEN_NO_ACTIVE", "Open interval exists without an active timer.");
  }

  return violations;
}
