// Zod schemas for the untrusted JSON import boundary (Blueprint §U2).
import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const commitmentSchema = z.object({
  id: z.string().min(1),
  schemaVersion: z.literal(1),
  name: z.string().min(1).max(80),
  dailyTargetMs: z.number().int().positive(),
  durationDays: z.number().int().positive(),
  reminderTimes: z.array(hhmm),
  startDate: isoDate,
  endDate: isoDate,
  timeZone: z.string().min(1),
  createdAtMs: z.number().int().nonnegative(),
});

export const intervalSchema = z.object({
  id: z.string().min(1),
  startedAtMs: z.number().int().nonnegative(),
  endedAtMs: z.number().int().nonnegative().nullable(),
});

export const sessionSchema = z.object({
  id: z.string().min(1),
  commitmentId: z.string().min(1),
  dayRecordId: z.string().min(1),
  startedAtMs: z.number().int().nonnegative(),
  stoppedAtMs: z.number().int().nonnegative().nullable(),
  stopReason: z.enum(["USER", "TARGET_REACHED", "COMMITMENT_ENDED"]).nullable(),
  intervals: z.array(intervalSchema),
});

export const recordSchema = z.object({
  id: z.string().min(1),
  commitmentId: z.string().min(1),
  ordinal: z.number().int().positive(),
  scheduledDate: isoDate,
  targetMs: z.number().int().positive(),
  recordedMs: z.number().int().nonnegative(),
  completedAtMs: z.number().int().nonnegative().nullable(),
  completionTiming: z.enum(["ON_TIME", "LATE"]).nullable(),
  finalStatus: z.enum(["DONE", "PARTIAL", "MISSED"]).nullable(),
  createdAtMs: z.number().int().nonnegative(),
  updatedAtMs: z.number().int().nonnegative(),
});

export const activeTimerSchema = z
  .object({
    key: z.literal("singleton"),
    sessionId: z.string().min(1),
    commitmentId: z.string().min(1),
    dayRecordId: z.string().min(1),
    mode: z.enum(["RUNNING", "PAUSED"]),
    revision: z.number().int().nonnegative(),
    updatedAtMs: z.number().int().nonnegative(),
  })
  .nullable();

export const settingsSchema = z.object({
  key: z.literal("singleton"),
  theme: z.enum(["SYSTEM", "DARK", "LIGHT"]),
  notificationsEnabled: z.boolean(),
  soundEnabled: z.boolean(),
  vibrationEnabled: z.boolean(),
  onboardingCompleted: z.boolean(),
});

export const envelopeSchema = z.object({
  format: z.literal("the-architect"),
  formatVersion: z.literal(1),
  exportedAt: z.string(),
  appVersion: z.string(),
  sourceTimeZone: z.string(),
  warnings: z.array(z.unknown()).optional(),
  data: z.object({
    settings: settingsSchema,
    commitments: z.array(commitmentSchema),
    dayRecords: z.array(recordSchema),
    timerSessions: z.array(sessionSchema),
    activeTimer: activeTimerSchema,
  }),
  integrity: z
    .object({
      algorithm: z.string(),
      canonicalization: z.string().optional(),
      digest: z.string(),
    })
    .optional(),
});

export type ImportEnvelope = z.infer<typeof envelopeSchema>;
