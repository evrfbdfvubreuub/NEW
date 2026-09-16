import type { EpochMs } from "../types";

/**
 * Injectable clock (Blueprint §E1). All authoritative durations derive from
 * real wall-clock epoch milliseconds — never from tick counts.
 */
export interface Clock {
  nowMs(): EpochMs;
}

/** Test/helper clock with a settable instant. */
export function fixedClock(startMs: EpochMs): Clock & { set(ms: EpochMs): void; advance(ms: number): void } {
  let current = startMs;
  return {
    nowMs: () => current,
    set: (ms: EpochMs) => {
      current = ms;
    },
    advance: (ms: number) => {
      current += ms;
    },
  };
}
