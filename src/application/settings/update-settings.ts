// Settings updates (Blueprint §M10). Settings are app preferences, not history.
import type { Settings } from "@/domain/types";
import { defaultSettings } from "@/infrastructure/db/defaults";
import { getSettings, putSettings } from "@/infrastructure/db/repositories";
import type { AppPorts } from "../ports";

export async function updateSettings(
  ports: AppPorts,
  patch: Partial<Omit<Settings, "key">>,
): Promise<Settings> {
  const current = (await getSettings(ports.db)) ?? defaultSettings();
  const next: Settings = { ...current, ...patch, key: "singleton" };
  await putSettings(ports.db, next);
  ports.onChanged?.();
  return next;
}
