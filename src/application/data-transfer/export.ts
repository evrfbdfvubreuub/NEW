// JSON export (Blueprint §U1). Snapshots domain data atomically and sanitizes a
// running timer so transfer time never counts after import.
import { deriveCompletionTiming } from "@/domain/commitments/status";
import { deadlineInstantMs } from "@/domain/time/calendar";
import {
  closedRawMs,
  findOpenInterval,
  recomputeFromSessions,
  resolveEffectiveEndMs,
} from "@/domain/timer/calculations";
import { readDomainSnapshot } from "@/infrastructure/db/repositories";
import type { DatabaseSnapshot } from "@/infrastructure/db/schema";
import { APP_VERSION } from "@/lib/version";
import type { AppPorts } from "../ports";
import { CANONICALIZATION, sha256Hex, stableStringify } from "./canonical";

export interface ExportEnvelope {
  format: "the-architect";
  formatVersion: 1;
  exportedAt: string;
  appVersion: string;
  sourceTimeZone: string;
  warnings: unknown[];
  data: DatabaseSnapshot;
  integrity: { algorithm: string; canonicalization: string; digest: string };
}

/** Freeze a running timer in the exported copy (Blueprint §U1). Pure on a clone. */
export function sanitizeForExport(snapshot: DatabaseSnapshot, nowMs: number): DatabaseSnapshot {
  const copy = structuredClone(snapshot);
  const active = copy.activeTimer;
  if (!active || active.mode === "PAUSED") return copy;

  const record = copy.dayRecords.find((r) => r.id === active.dayRecordId);
  const commitment = copy.commitments.find((c) => c.id === active.commitmentId);
  if (!record || !commitment) {
    copy.activeTimer = null;
    return copy;
  }
  const sessions = copy.timerSessions.filter((s) => s.dayRecordId === record.id);
  const open = findOpenInterval(sessions);
  if (!open) {
    copy.activeTimer = { ...active, mode: "PAUSED", updatedAtMs: nowMs };
    return copy;
  }

  const deadline = deadlineInstantMs(commitment.endDate, commitment.timeZone);
  const { endMs, reachedTarget, reachedDeadline } = resolveEffectiveEndMs({
    openStartMs: open.interval.startedAtMs,
    closedRawMs: closedRawMs(sessions),
    targetMs: record.targetMs,
    nowMs,
    deadlineInstantMs: deadline,
  });
  open.interval.endedAtMs = endMs;
  const recomputed = recomputeFromSessions(sessions, record.targetMs);
  record.recordedMs = recomputed.creditedMs;
  record.updatedAtMs = endMs;

  if (reachedTarget) {
    record.completedAtMs = recomputed.targetCrossingMs ?? endMs;
    record.completionTiming = deriveCompletionTiming(record, commitment.timeZone);
    record.finalStatus = "DONE";
    open.session.stoppedAtMs = endMs;
    open.session.stopReason = "TARGET_REACHED";
    copy.activeTimer = null;
  } else if (reachedDeadline) {
    record.finalStatus = record.recordedMs > 0 ? "PARTIAL" : "MISSED";
    open.session.stoppedAtMs = endMs;
    open.session.stopReason = "COMMITMENT_ENDED";
    copy.activeTimer = null;
  } else {
    // Session stays open (stoppedAtMs null) with the interval closed => PAUSED.
    copy.activeTimer = { ...active, mode: "PAUSED", updatedAtMs: nowMs };
  }
  return copy;
}

export async function buildExport(ports: AppPorts): Promise<ExportEnvelope> {
  const now = ports.clock.nowMs();
  const raw = await readDomainSnapshot(ports.db);
  const data = sanitizeForExport(raw, now);
  const digest = (await sha256Hex(stableStringify(data))) ?? "";
  return {
    format: "the-architect",
    formatVersion: 1,
    exportedAt: new Date(now).toISOString(),
    appVersion: APP_VERSION,
    sourceTimeZone: ports.timeZone(),
    warnings: [],
    data,
    integrity: { algorithm: "SHA-256", canonicalization: CANONICALIZATION, digest },
  };
}
