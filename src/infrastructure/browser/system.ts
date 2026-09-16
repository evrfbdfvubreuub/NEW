// Minimal runtime adapters (Blueprint §B3, §E1). Kept tiny so domain/application
// stay pure and testable.
import type { Clock } from "@/domain/time/clock";
import type { IANAZone } from "@/domain/types";

export const systemClock: Clock = {
  nowMs: () => Date.now(),
};

export function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Deterministic-enough fallback for environments without crypto.randomUUID.
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function currentTimeZone(): IANAZone {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}
