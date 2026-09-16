// Web Locks helper (Blueprint §F3): an extra cross-tab coordinator around timer
// commands. Falls back to running the callback directly when unsupported.
interface LockManagerLike {
  request<T>(name: string, callback: () => Promise<T>): Promise<T>;
}

function lockManager(): LockManagerLike | null {
  if (typeof navigator === "undefined") return null;
  const candidate = (navigator as unknown as { locks?: LockManagerLike }).locks;
  return candidate && typeof candidate.request === "function" ? candidate : null;
}

export async function withLock<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const manager = lockManager();
  if (!manager) return fn();
  return manager.request(name, fn);
}

export const TIMER_LOCK = "architect-timer";
