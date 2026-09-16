// Injectable ports for the application/use-case layer (Blueprint §B2).
import type { ArchitectDatabase } from "@/infrastructure/db/database";
import type { Clock } from "@/domain/time/clock";
import type { IANAZone } from "@/domain/types";

export interface AppPorts {
  db: ArchitectDatabase;
  clock: Clock;
  newId: () => string;
  timeZone: () => IANAZone;
  installationId: string;
  /** Called after a successful committed mutation so the store/other tabs refresh. */
  onChanged?: () => void;
}

export type CommandResult =
  | { ok: true }
  | { ok: false; reason: string };
