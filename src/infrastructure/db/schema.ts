// IndexedDB schema (Blueprint §D). Database name and store/index shapes.
import type { DBSchema } from "idb";
import type {
  ActiveTimer,
  AppMeta,
  Commitment,
  DayRecord,
  ReminderDelivery,
  Settings,
  TimerSession,
} from "@/domain/types";

export const DB_NAME = "the-architect-v1";
export const DB_VERSION = 1;
export const SINGLETON_KEY = "singleton" as const;

/** LocalStorage key for the noncritical early-paint theme hint (never authoritative). */
export const THEME_HINT_KEY = "architect.theme";

export interface RecoveryBackup {
  id: string;
  createdAtMs: number;
  reason: "IMPORT" | "MIGRATION" | "MANUAL";
  snapshot: DatabaseSnapshot;
}

/** Domain data snapshot used for export, import, and rollback backups. */
export interface DatabaseSnapshot {
  settings: Settings;
  commitments: Commitment[];
  dayRecords: DayRecord[];
  timerSessions: TimerSession[];
  activeTimer: ActiveTimer | null;
}

export interface ArchitectDB extends DBSchema {
  meta: {
    key: string;
    value: AppMeta;
  };
  settings: {
    key: string;
    value: Settings;
  };
  commitments: {
    key: string;
    value: Commitment;
    indexes: {
      "by-startDate": string;
      "by-endDate": string;
    };
  };
  dayRecords: {
    key: string;
    value: DayRecord;
    indexes: {
      "by-commitment": string;
      "by-commitment-ordinal": [string, number];
      "by-commitment-date": [string, string];
      "by-scheduledDate": string;
    };
  };
  timerSessions: {
    key: string;
    value: TimerSession;
    indexes: {
      "by-record": string;
      "by-commitment": string;
      "by-startedAt": number;
    };
  };
  activeTimer: {
    key: string;
    value: ActiveTimer;
  };
  reminderDeliveries: {
    key: string;
    value: ReminderDelivery;
    indexes: {
      "by-scheduledAt": number;
      "by-state": string;
      "by-leaseExpiresAt": number;
    };
  };
  recoveryBackups: {
    key: string;
    value: RecoveryBackup;
    indexes: {
      "by-createdAt": number;
    };
  };
}

export type DomainStoreName =
  | "settings"
  | "commitments"
  | "dayRecords"
  | "timerSessions"
  | "activeTimer";

/** Stores that hold replaceable domain data (import/reset scope). */
export const DOMAIN_STORES: DomainStoreName[] = [
  "settings",
  "commitments",
  "dayRecords",
  "timerSessions",
  "activeTimer",
];

export const ALL_STORES = [
  "meta",
  "settings",
  "commitments",
  "dayRecords",
  "timerSessions",
  "activeTimer",
  "reminderDeliveries",
  "recoveryBackups",
] as const;
