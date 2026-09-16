import { describe, expect, it } from "vitest";
import {
  closedRawMs,
  computeTimerSnapshot,
  creditFromRaw,
  findOpenInterval,
  recomputeFromSessions,
  resolveEffectiveEndMs,
} from "./calculations";
import { closedInterval, makeSession, openInterval, TWO_HOURS_MS } from "@/test/factories";

const FAR_FUTURE = Number.MAX_SAFE_INTEGER;

describe("creditFromRaw", () => {
  it("floors to whole seconds and caps at the target", () => {
    expect(creditFromRaw(1_999, TWO_HOURS_MS)).toBe(1_000);
    expect(creditFromRaw(7_199_999, TWO_HOURS_MS)).toBe(7_199_000); // 119:59
    expect(creditFromRaw(7_200_000, TWO_HOURS_MS)).toBe(7_200_000); // 120:00
    expect(creditFromRaw(9_999_999, TWO_HOURS_MS)).toBe(7_200_000); // never exceeds target
  });
});

describe("closedRawMs / findOpenInterval", () => {
  it("sums closed intervals and finds the single open one", () => {
    const session = makeSession({
      intervals: [closedInterval(0, 1_000), closedInterval(2_000, 5_000), openInterval(6_000)],
    });
    expect(closedRawMs([session])).toBe(4_000);
    expect(findOpenInterval([session])?.interval.startedAtMs).toBe(6_000);
  });
});

describe("computeTimerSnapshot — exact boundaries (2h target)", () => {
  it("119:00 => 99.2% PARTIAL band (credited 7,140,000)", () => {
    const session = makeSession({ intervals: [closedInterval(0, 7_140_000)] });
    const snap = computeTimerSnapshot([session], TWO_HOURS_MS, 7_140_000, FAR_FUTURE);
    expect(snap.creditedMs).toBe(7_140_000);
    expect(snap.isRunning).toBe(false);
  });

  it("119:59 => credited 7,199,000 (PARTIAL, not DONE)", () => {
    const session = makeSession({ intervals: [closedInterval(0, 7_199_000)] });
    const snap = computeTimerSnapshot([session], TWO_HOURS_MS, 7_199_000, FAR_FUTURE);
    expect(snap.creditedMs).toBe(7_199_000);
    expect(snap.creditedMs < TWO_HOURS_MS).toBe(true);
  });

  it("120:00 => credited exactly the target (DONE)", () => {
    const session = makeSession({ intervals: [closedInterval(0, 7_200_000)] });
    const snap = computeTimerSnapshot([session], TWO_HOURS_MS, 7_200_000, FAR_FUTURE);
    expect(snap.creditedMs).toBe(TWO_HOURS_MS);
  });
});

describe("computeTimerSnapshot — running caps, no bonus time", () => {
  it("caps live elapsed at the target even when now is far past", () => {
    const session = makeSession({ intervals: [openInterval(0)] });
    const snap = computeTimerSnapshot([session], TWO_HOURS_MS, 99_999_999, FAR_FUTURE);
    expect(snap.isRunning).toBe(true);
    expect(snap.rawElapsedMs).toBe(TWO_HOURS_MS);
    expect(snap.creditedMs).toBe(TWO_HOURS_MS);
    expect(snap.targetCapMs).toBe(TWO_HOURS_MS);
    expect(snap.effectiveCapMs).toBe(TWO_HOURS_MS);
  });

  it("accumulates closed + live and caps at the deadline when earlier than target", () => {
    const session = makeSession({ intervals: [closedInterval(0, 1_000_000), openInterval(2_000_000)] });
    const deadline = 2_500_000; // 500s of live room only
    const snap = computeTimerSnapshot([session], TWO_HOURS_MS, 9_000_000, deadline);
    expect(snap.effectiveCapMs).toBe(deadline);
    expect(snap.rawElapsedMs).toBe(1_000_000 + 500_000);
  });

  it("does not count negative live time when now precedes the open start", () => {
    const session = makeSession({ intervals: [openInterval(5_000)] });
    const snap = computeTimerSnapshot([session], TWO_HOURS_MS, 1_000, FAR_FUTURE);
    expect(snap.rawElapsedMs).toBe(0);
  });
});

describe("recomputeFromSessions", () => {
  it("computes the exact target-crossing instant from closed intervals", () => {
    // 119:59 already banked, then a 2s interval crosses the 120:00 target.
    const s1 = makeSession({ id: "s1", intervals: [closedInterval(0, 7_199_000)] });
    const s2 = makeSession({ id: "s2", intervals: [closedInterval(10_000_000, 10_002_000)] });
    const result = recomputeFromSessions([s1, s2], TWO_HOURS_MS);
    expect(result.reachedTarget).toBe(true);
    expect(result.creditedMs).toBe(TWO_HOURS_MS);
    // remaining raw = 1,000ms into the second interval => 10,000,000 + 1,000
    expect(result.targetCrossingMs).toBe(10_001_000);
  });

  it("reports no crossing when the target is not reached", () => {
    const s1 = makeSession({ intervals: [closedInterval(0, 60_000)] });
    const result = recomputeFromSessions([s1], TWO_HOURS_MS);
    expect(result.reachedTarget).toBe(false);
    expect(result.targetCrossingMs).toBeNull();
    expect(result.creditedMs).toBe(60_000);
  });
});

describe("resolveEffectiveEndMs", () => {
  it("closes at the exact target cap when the target is reached", () => {
    const r = resolveEffectiveEndMs({
      openStartMs: 1_000,
      closedRawMs: 7_199_000,
      targetMs: TWO_HOURS_MS,
      nowMs: 5_000,
      deadlineInstantMs: FAR_FUTURE,
    });
    expect(r.endMs).toBe(2_000); // 1,000 + (7,200,000 - 7,199,000)
    expect(r.reachedTarget).toBe(true);
  });

  it("closes at now when neither target nor deadline reached", () => {
    const r = resolveEffectiveEndMs({
      openStartMs: 0,
      closedRawMs: 0,
      targetMs: TWO_HOURS_MS,
      nowMs: 60_000,
      deadlineInstantMs: FAR_FUTURE,
    });
    expect(r.endMs).toBe(60_000);
    expect(r.reachedTarget).toBe(false);
  });

  it("closes at the deadline and never before the interval start (backward clock)", () => {
    const deadline = resolveEffectiveEndMs({
      openStartMs: 0,
      closedRawMs: 0,
      targetMs: TWO_HOURS_MS,
      nowMs: 9_000_000,
      deadlineInstantMs: 3_000_000,
    });
    expect(deadline.endMs).toBe(3_000_000);
    expect(deadline.reachedDeadline).toBe(true);

    const backward = resolveEffectiveEndMs({
      openStartMs: 5_000,
      closedRawMs: 0,
      targetMs: TWO_HOURS_MS,
      nowMs: 1_000, // clock regressed behind start
      deadlineInstantMs: FAR_FUTURE,
    });
    expect(backward.endMs).toBe(5_000); // zero-length safe close, no negative time
  });
});
