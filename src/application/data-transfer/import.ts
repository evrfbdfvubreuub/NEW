// Validated Replace-All import (Blueprint §U2): parse -> validate -> preview ->
// backup -> atomic replace. No merge, no partial import.
import { recomputeFromSessions } from "@/domain/timer/calculations";
import { validateIntegrity } from "@/domain/timer/invariants";
import { envelopeSchema } from "@/infrastructure/validation/import-schema";
import type { DatabaseSnapshot } from "@/infrastructure/db/schema";
import {
  pruneRecoveryBackups,
  putRecoveryBackup,
  readDomainSnapshot,
  replaceDomainData,
} from "@/infrastructure/db/repositories";
import type { AppPorts } from "../ports";
import { sha256Hex, stableStringify } from "./canonical";

export interface ImportPreview {
  commitments: number;
  records: number;
  sessions: number;
  exportedAt: string;
  warnings: number;
}

export interface ValidatedImport {
  snapshot: DatabaseSnapshot;
  preview: ImportPreview;
}

export type ValidateResult =
  | { ok: true; value: ValidatedImport }
  | { ok: false; error: string };

export async function validateImport(text: string): Promise<ValidateResult> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: "File is not valid JSON." };
  }

  const result = envelopeSchema.safeParse(parsed);
  if (!result.success) {
    return { ok: false, error: "File is not a valid THE ARCHITECT export." };
  }
  const envelope = result.data;
  const data = envelope.data as DatabaseSnapshot;

  if (envelope.integrity?.digest) {
    const digest = await sha256Hex(stableStringify(data));
    if (digest && digest !== envelope.integrity.digest) {
      return { ok: false, error: "Integrity check failed — the file may be corrupted." };
    }
  }

  if (data.activeTimer && data.activeTimer.mode === "RUNNING") {
    return { ok: false, error: "Import contains a running timer, which is not allowed." };
  }

  // Recompute every record from its sessions and require exact equality.
  for (const record of data.dayRecords) {
    const sessions = data.timerSessions.filter((s) => s.dayRecordId === record.id);
    const recomputed = recomputeFromSessions(sessions, record.targetMs);
    if (recomputed.creditedMs !== record.recordedMs) {
      return { ok: false, error: "Import rejected: recorded time does not match sessions." };
    }
    if (record.recordedMs >= record.targetMs) {
      if (
        record.completedAtMs == null ||
        (recomputed.targetCrossingMs != null && recomputed.targetCrossingMs !== record.completedAtMs)
      ) {
        return { ok: false, error: "Import rejected: completion instant is inconsistent." };
      }
    }
  }

  const violations = validateIntegrity({
    commitments: data.commitments,
    records: data.dayRecords,
    sessions: data.timerSessions,
    activeTimer: data.activeTimer,
  });
  if (violations.length > 0) {
    return { ok: false, error: `Import rejected: integrity check (${violations[0]!.code}).` };
  }

  return {
    ok: true,
    value: {
      snapshot: data,
      preview: {
        commitments: data.commitments.length,
        records: data.dayRecords.length,
        sessions: data.timerSessions.length,
        exportedAt: envelope.exportedAt,
        warnings: envelope.warnings?.length ?? 0,
      },
    },
  };
}

/** Backup current data, then atomically replace it (Blueprint §U2 steps 7-9). */
export async function commitImport(ports: AppPorts, snapshot: DatabaseSnapshot): Promise<void> {
  const current = await readDomainSnapshot(ports.db);
  await putRecoveryBackup(ports.db, {
    id: ports.newId(),
    createdAtMs: ports.clock.nowMs(),
    reason: "IMPORT",
    snapshot: current,
  });
  await replaceDomainData(ports.db, snapshot);
  await pruneRecoveryBackups(ports.db, 2);
  ports.onChanged?.();
}
