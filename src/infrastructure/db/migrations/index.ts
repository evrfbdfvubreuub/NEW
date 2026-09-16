// Forward-only, deterministic migrations (Blueprint §D2). The IndexedDB upgrade
// transaction is the atomic rollback boundary: if a step throws, the previous
// version remains intact.
import type { IDBPDatabase } from "idb";
import type { ArchitectDB } from "../schema";

function createV1(db: IDBPDatabase<ArchitectDB>): void {
  db.createObjectStore("meta", { keyPath: "key" });
  db.createObjectStore("settings", { keyPath: "key" });

  const commitments = db.createObjectStore("commitments", { keyPath: "id" });
  commitments.createIndex("by-startDate", "startDate");
  commitments.createIndex("by-endDate", "endDate");

  const dayRecords = db.createObjectStore("dayRecords", { keyPath: "id" });
  dayRecords.createIndex("by-commitment", "commitmentId");
  dayRecords.createIndex("by-commitment-ordinal", ["commitmentId", "ordinal"], { unique: true });
  dayRecords.createIndex("by-commitment-date", ["commitmentId", "scheduledDate"], { unique: true });
  dayRecords.createIndex("by-scheduledDate", "scheduledDate");

  const sessions = db.createObjectStore("timerSessions", { keyPath: "id" });
  sessions.createIndex("by-record", "dayRecordId");
  sessions.createIndex("by-commitment", "commitmentId");
  sessions.createIndex("by-startedAt", "startedAtMs");

  db.createObjectStore("activeTimer", { keyPath: "key" });

  const reminders = db.createObjectStore("reminderDeliveries", { keyPath: "occurrenceId" });
  reminders.createIndex("by-scheduledAt", "scheduledAtMs");
  reminders.createIndex("by-state", "state");
  reminders.createIndex("by-leaseExpiresAt", "leaseExpiresAtMs");

  const backups = db.createObjectStore("recoveryBackups", { keyPath: "id" });
  backups.createIndex("by-createdAt", "createdAtMs");
}

export function runMigrations(db: IDBPDatabase<ArchitectDB>, oldVersion: number): void {
  // Each version block is applied in order; only creates that don't yet exist.
  if (oldVersion < 1) createV1(db);
}
