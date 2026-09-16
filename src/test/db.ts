// Integration-test harness: a fresh IndexedDB + injected fixed clock.
import { deleteDatabase, getDb } from "@/infrastructure/db/database";
import { fixedClock } from "@/domain/time/clock";
import type { AppPorts } from "@/application/ports";

let idCounter = 0;

export interface TestHarness {
  ports: AppPorts;
  clock: ReturnType<typeof fixedClock>;
}

export async function freshPorts(startMs: number, timeZone = "UTC"): Promise<TestHarness> {
  await deleteDatabase();
  const db = await getDb();
  const clock = fixedClock(startMs);
  const ports: AppPorts = {
    db,
    clock,
    newId: () => `u-${(idCounter += 1)}`,
    timeZone: () => timeZone,
    installationId: "install-test",
  };
  return { ports, clock };
}
