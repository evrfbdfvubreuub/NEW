// Cross-tab notification channel (Blueprint §F3). BroadcastChannel is used to
// promptly invalidate other tabs; it is NOT the source of truth (IndexedDB is).
export type SyncMessage =
  | { kind: "CHANGED" }
  | { kind: "DB_CLOSE_REQUEST" }
  | { kind: "RESET" };

export interface BroadcastAdapter {
  post(message: SyncMessage): void;
  subscribe(handler: (message: SyncMessage) => void): () => void;
  close(): void;
}

const CHANNEL_NAME = "architect-sync";

export function createBroadcast(): BroadcastAdapter {
  if (typeof BroadcastChannel === "undefined") {
    return {
      post: () => {},
      subscribe: () => () => {},
      close: () => {},
    };
  }
  const channel = new BroadcastChannel(CHANNEL_NAME);
  return {
    post: (message) => channel.postMessage(message),
    subscribe: (handler) => {
      const listener = (event: MessageEvent<SyncMessage>) => handler(event.data);
      channel.addEventListener("message", listener);
      return () => channel.removeEventListener("message", listener);
    },
    close: () => channel.close(),
  };
}
