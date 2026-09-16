import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/styles/global.css";
import "@/components/primitives/primitives.css";
import "@/components/layout/layout.css";
import "@/features/features.css";
import { getDb } from "@/infrastructure/db/database";
import { currentTimeZone, newId, systemClock } from "@/infrastructure/browser/system";
import { createAppStore } from "@/state/app-store";
import { createTimerEngine } from "@/state/timer-engine";
import { App } from "@/app/App";

async function boot(): Promise<void> {
  const container = document.getElementById("root");
  if (!container) throw new Error("Missing #root");
  const root = createRoot(container);

  const db = await getDb();
  const store = createAppStore({
    db,
    clock: systemClock,
    newId,
    timeZone: currentTimeZone,
  });
  const engine = createTimerEngine(store);

  root.render(
    <StrictMode>
      <App store={store} />
    </StrictMode>,
  );

  await store.init();
  engine.start();
}

void boot();
