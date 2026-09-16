// React bindings for the app store (Blueprint §O1). Provides the store via
// context and exposes typed hooks + bound actions to the presentation layer.
import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";
import type { Settings } from "@/domain/types";
import type { CommitmentFormInput } from "@/domain/commitments/commitment";
import { createCommitment } from "@/application/commitments/create-commitment";
import {
  pauseTimer,
  resumeTimer,
  startTimer,
  stopTimer,
} from "@/application/timer/commands";
import { updateSettings } from "@/application/settings/update-settings";
import type { AppState, AppStore } from "./app-store";

const StoreContext = createContext<AppStore | null>(null);

export function StoreProvider({
  store,
  children,
}: {
  store: AppStore;
  children: ReactNode;
}): JSX.Element {
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useStore(): AppStore {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useStore must be used within a StoreProvider");
  return store;
}

export function useAppState(): AppState {
  const store = useStore();
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}

export function usePorts() {
  return useStore().ports;
}

export interface Actions {
  createCommitment: (form: CommitmentFormInput) => ReturnType<typeof createCommitment>;
  startTimer: (recordId: string) => ReturnType<typeof startTimer>;
  pauseTimer: () => ReturnType<typeof pauseTimer>;
  resumeTimer: () => ReturnType<typeof resumeTimer>;
  stopTimer: () => ReturnType<typeof stopTimer>;
  updateSettings: (patch: Partial<Omit<Settings, "key">>) => ReturnType<typeof updateSettings>;
}

export function useActions(): Actions {
  const store = useStore();
  return useMemo<Actions>(
    () => ({
      createCommitment: (form) => createCommitment(store.ports, form),
      startTimer: (recordId) => startTimer(store.ports, recordId),
      pauseTimer: () => pauseTimer(store.ports),
      resumeTimer: () => resumeTimer(store.ports),
      stopTimer: () => stopTimer(store.ports),
      updateSettings: (patch) => updateSettings(store.ports, patch),
    }),
    [store],
  );
}
