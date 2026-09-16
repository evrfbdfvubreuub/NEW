// Database opener + singleton connection (Blueprint §D, §F1). Coordinates
// version upgrades so other tabs release their connection.
import { deleteDB, openDB, type IDBPDatabase } from "idb";
import { DB_NAME, DB_VERSION, type ArchitectDB } from "./schema";
import { runMigrations } from "./migrations";

export type ArchitectDatabase = IDBPDatabase<ArchitectDB>;

let dbPromise: Promise<ArchitectDatabase> | null = null;
let blockedNotifier: (() => void) | null = null;

export function onUpgradeBlocked(fn: (() => void) | null): void {
  blockedNotifier = fn;
}

function open(): Promise<ArchitectDatabase> {
  return openDB<ArchitectDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      runMigrations(db, oldVersion);
    },
    blocked() {
      // Another connection (older version) is preventing this upgrade.
      blockedNotifier?.();
    },
    blocking() {
      // A newer version wants to open; release this connection so it can proceed.
      void closeDb();
    },
    terminated() {
      dbPromise = null;
    },
  });
}

export function getDb(): Promise<ArchitectDatabase> {
  if (!dbPromise) dbPromise = open();
  return dbPromise;
}

export async function closeDb(): Promise<void> {
  if (!dbPromise) return;
  try {
    const db = await dbPromise;
    db.close();
  } catch {
    /* already closed */
  } finally {
    dbPromise = null;
  }
}

/** Delete the entire database (used only by tests / hard reset fallback). */
export async function deleteDatabase(): Promise<void> {
  await closeDb();
  await deleteDB(DB_NAME);
}
