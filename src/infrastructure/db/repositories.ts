// Repository helpers over the typed IndexedDB connection (Blueprint §B2, §D1).
// Reads use consistent single transactions; multi-store writes are atomic.
import type {
  ActiveTimer,
  AppMeta,
  Commitment,
  DayRecord,
  ReminderDelivery,
  Settings,
  TimerSession,
} from "@/domain/types";
import type { IntegritySnapshot } from "@/domain/timer/invariants";
import type { ArchitectDatabase } from "./database";
import { SINGLETON_KEY, type DatabaseSnapshot, type RecoveryBackup } from "./schema";
import { defaultSettings } from "./defaults";

// ---- Singletons ----

export function getMeta(db: ArchitectDatabase): Promise<AppMeta | undefined> {
  return db.get("meta", SINGLETON_KEY);
}

export function putMeta(db: ArchitectDatabase, meta: AppMeta): Promise<string> {
  return db.put("meta", meta);
}

export function getSettings(db: ArchitectDatabase): Promise<Settings | undefined> {
  return db.get("settings", SINGLETON_KEY);
}

export function putSettings(db: ArchitectDatabase, settings: Settings): Promise<string> {
  return db.put("settings", settings);
}

export async function getActiveTimer(db: ArchitectDatabase): Promise<ActiveTimer | null> {
  return (await db.get("activeTimer", SINGLETON_KEY)) ?? null;
}

// ---- Commitments / records / sessions ----

export function getCommitment(db: ArchitectDatabase, id: string): Promise<Commitment | undefined> {
  return db.get("commitments", id);
}

export function getAllCommitments(db: ArchitectDatabase): Promise<Commitment[]> {
  return db.getAll("commitments");
}

export function getRecord(db: ArchitectDatabase, id: string): Promise<DayRecord | undefined> {
  return db.get("dayRecords", id);
}

export function getRecordsByCommitment(
  db: ArchitectDatabase,
  commitmentId: string,
): Promise<DayRecord[]> {
  return db.getAllFromIndex("dayRecords", "by-commitment", commitmentId);
}

export function getSessionsByRecord(
  db: ArchitectDatabase,
  recordId: string,
): Promise<TimerSession[]> {
  return db.getAllFromIndex("timerSessions", "by-record", recordId);
}

export function getSessionsByCommitment(
  db: ArchitectDatabase,
  commitmentId: string,
): Promise<TimerSession[]> {
  return db.getAllFromIndex("timerSessions", "by-commitment", commitmentId);
}

// ---- Consistent multi-store snapshots ----

export async function readDomainSnapshot(db: ArchitectDatabase): Promise<DatabaseSnapshot> {
  const tx = db.transaction(
    ["settings", "commitments", "dayRecords", "timerSessions", "activeTimer"],
    "readonly",
  );
  const [settings, commitments, dayRecords, timerSessions, activeTimer] = await Promise.all([
    tx.objectStore("settings").get(SINGLETON_KEY),
    tx.objectStore("commitments").getAll(),
    tx.objectStore("dayRecords").getAll(),
    tx.objectStore("timerSessions").getAll(),
    tx.objectStore("activeTimer").get(SINGLETON_KEY),
  ]);
  await tx.done;
  return {
    settings: settings ?? defaultSettings(),
    commitments,
    dayRecords,
    timerSessions,
    activeTimer: activeTimer ?? null,
  };
}

export async function readIntegritySnapshot(db: ArchitectDatabase): Promise<IntegritySnapshot> {
  const tx = db.transaction(
    ["commitments", "dayRecords", "timerSessions", "activeTimer"],
    "readonly",
  );
  const [commitments, records, sessions, activeTimer] = await Promise.all([
    tx.objectStore("commitments").getAll(),
    tx.objectStore("dayRecords").getAll(),
    tx.objectStore("timerSessions").getAll(),
    tx.objectStore("activeTimer").get(SINGLETON_KEY),
  ]);
  await tx.done;
  return { commitments, records, sessions, activeTimer: activeTimer ?? null };
}

/** Atomically clear and rewrite all domain stores (Blueprint §U2 import). */
export async function replaceDomainData(
  db: ArchitectDatabase,
  snapshot: DatabaseSnapshot,
): Promise<void> {
  const tx = db.transaction(
    ["settings", "commitments", "dayRecords", "timerSessions", "activeTimer"],
    "readwrite",
  );
  await Promise.all([
    tx.objectStore("settings").clear(),
    tx.objectStore("commitments").clear(),
    tx.objectStore("dayRecords").clear(),
    tx.objectStore("timerSessions").clear(),
    tx.objectStore("activeTimer").clear(),
  ]);
  await tx.objectStore("settings").put(snapshot.settings);
  for (const commitment of snapshot.commitments) await tx.objectStore("commitments").put(commitment);
  for (const record of snapshot.dayRecords) await tx.objectStore("dayRecords").put(record);
  for (const session of snapshot.timerSessions) await tx.objectStore("timerSessions").put(session);
  if (snapshot.activeTimer) await tx.objectStore("activeTimer").put(snapshot.activeTimer);
  await tx.done;
}

// ---- Recovery backups ----

export function putRecoveryBackup(db: ArchitectDatabase, backup: RecoveryBackup): Promise<string> {
  return db.put("recoveryBackups", backup);
}

export function getAllRecoveryBackups(db: ArchitectDatabase): Promise<RecoveryBackup[]> {
  return db.getAll("recoveryBackups");
}

export async function pruneRecoveryBackups(db: ArchitectDatabase, keepNewest: number): Promise<void> {
  const all = await db.getAll("recoveryBackups");
  all.sort((a, b) => b.createdAtMs - a.createdAtMs);
  const stale = all.slice(keepNewest);
  if (stale.length === 0) return;
  const tx = db.transaction("recoveryBackups", "readwrite");
  for (const backup of stale) await tx.store.delete(backup.id);
  await tx.done;
}

// ---- Reminder deliveries ----

export function getReminderDelivery(
  db: ArchitectDatabase,
  occurrenceId: string,
): Promise<ReminderDelivery | undefined> {
  return db.get("reminderDeliveries", occurrenceId);
}

export function putReminderDelivery(
  db: ArchitectDatabase,
  delivery: ReminderDelivery,
): Promise<string> {
  return db.put("reminderDeliveries", delivery);
}
