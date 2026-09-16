// Singleton timer engine (Blueprint §O2, §E7, §I3). Owns reconciliation
// triggers and the render tick. Components never create their own setInterval.
import { reconcileActiveTimer } from "@/application/timer/commands";
import { activeTimerView } from "./selectors";
import type { AppStore } from "./app-store";

const RUNNING_TICK_MS = 250;
const HEARTBEAT_MS = 15_000;

export interface TimerEngine {
  start(): void;
  stop(): void;
}

export function createTimerEngine(store: AppStore): TimerEngine {
  let runningInterval: ReturnType<typeof setInterval> | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let reconciling = false;
  let started = false;

  async function reconcileAndReload(): Promise<void> {
    if (reconciling) return;
    reconciling = true;
    try {
      const changed = await reconcileActiveTimer(store.ports);
      if (!changed) await store.reload();
    } finally {
      reconciling = false;
    }
  }

  function tick(): void {
    const { data, status } = store.getSnapshot();
    if (!data || (status !== "READY" && status !== "SAFE_MODE")) return;
    const now = store.ports.clock.nowMs();
    if (data.activeTimer?.mode === "RUNNING") {
      store.setNow(now);
      const view = activeTimerView(data, now);
      if (view?.snapshot.effectiveCapMs != null && now >= view.snapshot.effectiveCapMs) {
        void reconcileAndReload();
      }
    }
  }

  function ensureRunningLoop(): void {
    const running = store.getSnapshot().data?.activeTimer?.mode === "RUNNING";
    if (running && runningInterval === null) {
      runningInterval = setInterval(tick, RUNNING_TICK_MS);
    } else if (!running && runningInterval !== null) {
      clearInterval(runningInterval);
      runningInterval = null;
    }
  }

  const onVisibility = (): void => {
    if (typeof document !== "undefined" && document.visibilityState === "visible") {
      void reconcileAndReload();
    }
  };
  const onFocusOrShow = (): void => {
    void reconcileAndReload();
  };
  const storeUnsub = { current: null as null | (() => void) };

  return {
    start() {
      if (started) return;
      started = true;
      // React to store changes to toggle the running loop.
      storeUnsub.current = store.subscribe(ensureRunningLoop);
      ensureRunningLoop();
      heartbeat = setInterval(() => {
        store.setNow(store.ports.clock.nowMs());
        void reconcileAndReload();
      }, HEARTBEAT_MS);
      if (typeof document !== "undefined") {
        document.addEventListener("visibilitychange", onVisibility);
      }
      if (typeof window !== "undefined") {
        window.addEventListener("pageshow", onFocusOrShow);
        window.addEventListener("focus", onFocusOrShow);
      }
    },
    stop() {
      started = false;
      if (runningInterval !== null) clearInterval(runningInterval);
      if (heartbeat !== null) clearInterval(heartbeat);
      runningInterval = null;
      heartbeat = null;
      storeUnsub.current?.();
      storeUnsub.current = null;
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibility);
      }
      if (typeof window !== "undefined") {
        window.removeEventListener("pageshow", onFocusOrShow);
        window.removeEventListener("focus", onFocusOrShow);
      }
    },
  };
}
