// Domain entity contracts (Blueprint §C). Pure types only — no React, no IndexedDB.

export type UUID = string;
export type EpochMs = number;
/** Calendar date serialized as YYYY-MM-DD (Blueprint §I1). */
export type ISODate = string;
export type IANAZone = string;
/** Local reminder time "HH:mm". */
export type HHmm = string;

export type CompletionTiming = "ON_TIME" | "LATE";
export type FinalStatus = "DONE" | "PARTIAL" | "MISSED";
export type BaseStatus = "NOT_STARTED" | "PARTIAL" | "DONE" | "MISSED";

/** User-facing display states (Blueprint §C6). UPCOMING is the neutral future view of NOT_STARTED. */
export type DisplayStatus =
  | "NOT_STARTED"
  | "UPCOMING"
  | "PARTIAL"
  | "MISSED"
  | "DONE_ON_TIME"
  | "COMPLETED_LATE";

export type StopReason = "USER" | "TARGET_REACHED" | "COMMITMENT_ENDED";
export type TimerMode = "RUNNING" | "PAUSED";
export type ThemePreference = "SYSTEM" | "DARK" | "LIGHT";
export type CommitmentLifecycle = "ACTIVE" | "ENDED_COMPLETE" | "ENDED_INCOMPLETE";

export interface Commitment {
  id: UUID;
  schemaVersion: 1;
  name: string;
  dailyTargetMs: number;
  durationDays: number;
  reminderTimes: HHmm[];
  startDate: ISODate;
  endDate: ISODate; // inclusive
  timeZone: IANAZone; // captured at creation
  createdAtMs: EpochMs;
}

export interface DayRecord {
  id: UUID;
  commitmentId: UUID;
  ordinal: number; // 1..durationDays
  scheduledDate: ISODate; // immutable
  targetMs: number; // immutable snapshot
  recordedMs: number; // credited duration, 0..targetMs
  completedAtMs: EpochMs | null;
  completionTiming: CompletionTiming | null;
  finalStatus: FinalStatus | null;
  createdAtMs: EpochMs;
  updatedAtMs: EpochMs;
}

export interface TimerInterval {
  id: UUID;
  startedAtMs: EpochMs;
  endedAtMs: EpochMs | null;
}

export interface TimerSession {
  id: UUID;
  commitmentId: UUID;
  dayRecordId: UUID;
  startedAtMs: EpochMs;
  stoppedAtMs: EpochMs | null;
  stopReason: StopReason | null;
  intervals: TimerInterval[];
}

export interface ActiveTimer {
  key: "singleton";
  sessionId: UUID;
  commitmentId: UUID;
  dayRecordId: UUID;
  mode: TimerMode;
  revision: number;
  updatedAtMs: EpochMs;
}

export interface Settings {
  key: "singleton";
  theme: ThemePreference;
  notificationsEnabled: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  onboardingCompleted: boolean;
}

export interface IntegrityWarning {
  code: string;
  observedAtMs: EpochMs;
}

export interface AppMeta {
  key: "singleton";
  databaseSchemaVersion: number;
  installationId: UUID;
  createdAtMs: EpochMs;
  lastOpenedAtMs: EpochMs;
  lastKnownTimeZone: IANAZone;
  integrityWarnings: IntegrityWarning[];
}

export interface ReminderDelivery {
  occurrenceId: string; // commitmentId|scheduledDate|HH:mm
  commitmentId: UUID;
  scheduledAtMs: EpochMs;
  state: "CLAIMED" | "DELIVERED" | "FAILED";
  ownerInstallationId: UUID;
  leaseExpiresAtMs: EpochMs;
  updatedAtMs: EpochMs;
}

/** A commitment together with its full record set — the primary read aggregate. */
export interface CommitmentAggregate {
  commitment: Commitment;
  records: DayRecord[];
}
