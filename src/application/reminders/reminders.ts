// Reminder scheduling (Blueprint §K3). In-app reminders while open; the
// reminderDeliveries store provides an atomic cross-tab claim so a reminder is
// delivered once. No recovery reminders in V1.
import { deadlineInstantMs, reminderInstantMs, todayISOInZone } from "@/domain/time/calendar";
import {
  getAllCommitments,
  getRecordsByCommitment,
  getReminderDelivery,
  putReminderDelivery,
} from "@/infrastructure/db/repositories";
import type { AppPorts } from "../ports";

export interface DueReminder {
  occurrenceId: string;
  commitmentId: string;
  commitmentName: string;
  hhmm: string;
}

const CLAIM_LEASE_MS = 60_000;

/** Reminders that fell due within the recent grace window for today's open records. */
export async function collectDueReminders(
  ports: AppPorts,
  nowMs: number,
  graceMs = 120_000,
): Promise<DueReminder[]> {
  const due: DueReminder[] = [];
  const commitments = await getAllCommitments(ports.db);
  for (const commitment of commitments) {
    if (commitment.reminderTimes.length === 0) continue;
    if (nowMs >= deadlineInstantMs(commitment.endDate, commitment.timeZone)) continue;
    const today = todayISOInZone(nowMs, commitment.timeZone);
    const records = await getRecordsByCommitment(ports.db, commitment.id);
    const record = records.find((r) => r.scheduledDate === today);
    if (!record || record.recordedMs >= record.targetMs) continue; // none, or already DONE
    for (const hhmm of commitment.reminderTimes) {
      const instant = reminderInstantMs(today, hhmm, commitment.timeZone);
      if (instant <= nowMs && instant > nowMs - graceMs) {
        due.push({
          occurrenceId: `${commitment.id}|${today}|${hhmm}`,
          commitmentId: commitment.id,
          commitmentName: commitment.name,
          hhmm,
        });
      }
    }
  }
  return due;
}

/** Atomically claim a reminder occurrence; returns true only for the winning tab. */
export async function claimReminder(
  ports: AppPorts,
  reminder: DueReminder,
  nowMs: number,
): Promise<boolean> {
  const tx = ports.db.transaction("reminderDeliveries", "readwrite");
  const existing = await tx.store.get(reminder.occurrenceId);
  if (existing) {
    if (existing.state === "DELIVERED") {
      await tx.done;
      return false;
    }
    if (existing.state === "CLAIMED" && existing.leaseExpiresAtMs > nowMs) {
      await tx.done;
      return false;
    }
  }
  await tx.store.put({
    occurrenceId: reminder.occurrenceId,
    commitmentId: reminder.commitmentId,
    scheduledAtMs: nowMs,
    state: "CLAIMED",
    ownerInstallationId: ports.installationId,
    leaseExpiresAtMs: nowMs + CLAIM_LEASE_MS,
    updatedAtMs: nowMs,
  });
  await tx.done;
  return true;
}

export async function markReminderDelivered(
  ports: AppPorts,
  occurrenceId: string,
  nowMs: number,
): Promise<void> {
  const existing = await getReminderDelivery(ports.db, occurrenceId);
  if (existing) {
    await putReminderDelivery(ports.db, { ...existing, state: "DELIVERED", updatedAtMs: nowMs });
  }
}
