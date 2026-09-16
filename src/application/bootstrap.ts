// App bootstrap (Blueprint §F1): ensure singletons, integrity-gate into safe
// mode, then reconcile the active timer and finalize ended commitments.
import { deadlineInstantMs } from "@/domain/time/calendar";
import { validateIntegrity, type IntegrityViolation } from "@/domain/timer/invariants";
import { defaultMeta, defaultSettings } from "@/infrastructure/db/defaults";
import {
  getAllCommitments,
  getMeta,
  getRecordsByCommitment,
  getSettings,
  putMeta,
  putSettings,
  readIntegritySnapshot,
} from "@/infrastructure/db/repositories";
import type { AppPorts } from "./ports";
import { reconcileActiveTimer } from "./timer/commands";

export interface BootstrapResult {
  safeMode: boolean;
  violations: IntegrityViolation[];
  installationId: string;
}

/** Finalize records of commitments whose deadline has passed (Blueprint §A5, §G). */
async function finalizeEndedRecords(ports: AppPorts): Promise<void> {
  const now = ports.clock.nowMs();
  const commitments = await getAllCommitments(ports.db);
  for (const commitment of commitments) {
    if (now < deadlineInstantMs(commitment.endDate, commitment.timeZone)) continue;
    const records = await getRecordsByCommitment(ports.db, commitment.id);
    const pending = records.filter((r) => r.finalStatus === null && r.recordedMs < r.targetMs);
    if (pending.length === 0) continue;
    const tx = ports.db.transaction("dayRecords", "readwrite");
    for (const record of pending) {
      await tx.store.put({
        ...record,
        finalStatus: record.recordedMs > 0 ? "PARTIAL" : "MISSED",
        updatedAtMs: now,
      });
    }
    await tx.done;
  }
}

export async function bootstrap(ports: AppPorts): Promise<BootstrapResult> {
  const now = ports.clock.nowMs();

  // Ensure meta.
  const existingMeta = await getMeta(ports.db);
  const meta = existingMeta
    ? { ...existingMeta, lastOpenedAtMs: now, lastKnownTimeZone: ports.timeZone() }
    : defaultMeta({ installationId: ports.newId(), nowMs: now, timeZone: ports.timeZone() });
  await putMeta(ports.db, meta);

  // Ensure settings.
  const existingSettings = await getSettings(ports.db);
  if (!existingSettings) await putSettings(ports.db, defaultSettings());

  // Integrity gate: if violated, enter read-only safe mode without rewriting data.
  const snapshot = await readIntegritySnapshot(ports.db);
  const violations = validateIntegrity(snapshot);
  if (violations.length > 0) {
    return { safeMode: true, violations, installationId: meta.installationId };
  }

  // Reconcile timer + finalize ended records.
  await reconcileActiveTimer(ports);
  await finalizeEndedRecords(ports);

  return { safeMode: false, violations: [], installationId: meta.installationId };
}
