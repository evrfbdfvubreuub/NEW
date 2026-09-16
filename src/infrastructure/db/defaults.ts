import type { AppMeta, EpochMs, IANAZone, Settings } from "@/domain/types";
import { DB_VERSION } from "./schema";

export function defaultSettings(): Settings {
  return {
    key: "singleton",
    theme: "SYSTEM",
    notificationsEnabled: false,
    soundEnabled: false,
    vibrationEnabled: false,
    onboardingCompleted: false,
  };
}

export function defaultMeta(params: {
  installationId: string;
  nowMs: EpochMs;
  timeZone: IANAZone;
}): AppMeta {
  return {
    key: "singleton",
    databaseSchemaVersion: DB_VERSION,
    installationId: params.installationId,
    createdAtMs: params.nowMs,
    lastOpenedAtMs: params.nowMs,
    lastKnownTimeZone: params.timeZone,
    integrityWarnings: [],
  };
}
