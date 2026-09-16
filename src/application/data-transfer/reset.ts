// Reset All Data (Blueprint §U3): clear every app-owned store atomically, then
// recreate fresh singletons. The only destructive operation in V1.
import { defaultMeta, defaultSettings } from "@/infrastructure/db/defaults";
import { ALL_STORES } from "@/infrastructure/db/schema";
import { clearThemeHint } from "@/infrastructure/browser/theme";
import type { AppPorts } from "../ports";

export async function resetAllData(ports: AppPorts): Promise<void> {
  const now = ports.clock.nowMs();
  const tx = ports.db.transaction(ALL_STORES, "readwrite");
  for (const name of ALL_STORES) {
    await tx.objectStore(name).clear();
  }
  await tx.objectStore("meta").put(
    defaultMeta({ installationId: ports.newId(), nowMs: now, timeZone: ports.timeZone() }),
  );
  await tx.objectStore("settings").put(defaultSettings());
  await tx.done;

  clearThemeHint();
  ports.onChanged?.();
}
