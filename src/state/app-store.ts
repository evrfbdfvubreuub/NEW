// Global runtime store (Blueprint §O1) backed by useSyncExternalStore. Holds the
// persistent read model, a `nowMs` tick, and bootstrap/notification status.
// Persistence remains authoritative; this is a cache invalidated on every commit.
import type { AppPorts } from "@/application/ports";
import type { AppMeta, Settings } from "@/domain/types";
import type { IntegrityViolation } from "@/domain/timer/invariants";
import { bootstrap } from "@/application/bootstrap";
import { createBroadcast } from "@/infrastructure/browser/broadcast";
import {
  getNotificationCapability,
  type NotificationCapability,
} from "@/infrastructure/browser/notifications";
import { getMeta, readDomainSnapshot } from "@/infrastructure/db/repositories";
import type { Clock } from "@/domain/time/clock";
import type { ArchitectDatabase } from "@/infrastructure/db/database";
import type { AppData as TimelineData } from "./selectors";

export interface AppData extends TimelineData {
  settings: Settings;
  meta: AppMeta | null;
}

export type AppStatus = "LOADING" | "READY" | "SAFE_MODE" | "ERROR";

export interface AppState {
  status: AppStatus;
  data: AppData | null;
  nowMs: number;
  notificationCapability: NotificationCapability;
  violations: IntegrityViolation[];
  error: string | null;
}

export interface AppStoreConfig {
  db: ArchitectDatabase;
  clock: Clock;
  newId: () => string;
  timeZone: () => string;
}

export interface AppStore {
  ports: AppPorts;
  subscribe(listener: () => void): () => void;
  getSnapshot(): AppState;
  init(): Promise<void>;
  reload(): Promise<void>;
  setNow(ms: number): void;
  refreshNotificationCapability(): void;
  dispose(): void;
}

export function createAppStore(config: AppStoreConfig): AppStore {
  const listeners = new Set<() => void>();
  const broadcast = createBroadcast();

  let state: AppState = {
    status: "LOADING",
    data: null,
    nowMs: config.clock.nowMs(),
    notificationCapability: getNotificationCapability(),
    violations: [],
    error: null,
  };

  function emit(): void {
    for (const listener of listeners) listener();
  }
  function setState(patch: Partial<AppState>): void {
    state = { ...state, ...patch };
    emit();
  }

  const ports: AppPorts = {
    db: config.db,
    clock: config.clock,
    newId: config.newId,
    timeZone: config.timeZone,
    installationId: config.newId(),
    onChanged: () => {
      void reload();
      broadcast.post({ kind: "CHANGED" });
    },
  };

  async function loadData(): Promise<AppData> {
    const [meta, snapshot] = await Promise.all([getMeta(config.db), readDomainSnapshot(config.db)]);
    const activeSessions = snapshot.activeTimer
      ? snapshot.timerSessions.filter((s) => s.dayRecordId === snapshot.activeTimer!.dayRecordId)
      : [];
    return {
      commitments: snapshot.commitments,
      records: snapshot.dayRecords,
      settings: snapshot.settings,
      meta: meta ?? null,
      activeTimer: snapshot.activeTimer,
      activeSessions,
    };
  }

  let reloadChain: Promise<void> = Promise.resolve();
  function reload(): Promise<void> {
    reloadChain = reloadChain.then(async () => {
      try {
        const data = await loadData();
        setState({ data, nowMs: config.clock.nowMs() });
      } catch (error) {
        setState({ status: "ERROR", error: describeError(error) });
      }
    });
    return reloadChain;
  }

  broadcast.subscribe((message) => {
    if (message.kind === "CHANGED" || message.kind === "RESET") void reload();
  });

  return {
    ports,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot() {
      return state;
    },
    async init() {
      setState({ status: "LOADING", error: null });
      try {
        const result = await bootstrap(ports);
        ports.installationId = result.installationId;
        const data = await loadData();
        setState({
          status: result.safeMode ? "SAFE_MODE" : "READY",
          data,
          violations: result.violations,
          nowMs: config.clock.nowMs(),
          notificationCapability: getNotificationCapability(),
        });
      } catch (error) {
        setState({ status: "ERROR", error: describeError(error) });
      }
    },
    reload,
    setNow(ms) {
      if (ms !== state.nowMs) setState({ nowMs: ms });
    },
    refreshNotificationCapability() {
      setState({ notificationCapability: getNotificationCapability() });
    },
    dispose() {
      broadcast.close();
      listeners.clear();
    },
  };
}

function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
