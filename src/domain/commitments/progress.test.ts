import { describe, expect, it } from "vitest";
import { calculateConsistency, planCompletion } from "./progress";
import { makeCommitment, makeRecord, TWO_HOURS_MS, utc } from "@/test/factories";
import type { DayRecord } from "@/domain/types";

describe("planCompletion", () => {
  it("counts DONE over the full duration (future days included in denominator)", () => {
    const commitment = makeCommitment({ durationDays: 4 });
    const records = [
      makeRecord({ id: "r1", recordedMs: TWO_HOURS_MS }),
      makeRecord({ id: "r2", recordedMs: TWO_HOURS_MS }),
      makeRecord({ id: "r3", recordedMs: 0 }),
      makeRecord({ id: "r4", recordedMs: 0 }),
    ];
    expect(planCompletion(commitment, records)).toEqual({ doneCount: 2, totalDays: 4, percent: 50 });
  });
});

describe("calculateConsistency", () => {
  const commitment = makeCommitment({ timeZone: "UTC", durationDays: 60 });
  const now = utc(2026, 10, 28, 12); // plenty of past days

  function pastRecord(over: Partial<DayRecord>): DayRecord {
    return makeRecord({ scheduledDate: "2026-09-08", ...over });
  }

  it("breakdown sums to the past count and done = onTime + late", () => {
    const records = [
      pastRecord({ id: "d1", recordedMs: TWO_HOURS_MS, completedAtMs: utc(2026, 9, 8, 10), completionTiming: "ON_TIME" }),
      pastRecord({ id: "d2", recordedMs: TWO_HOURS_MS, completedAtMs: utc(2026, 9, 11, 10), completionTiming: "LATE" }),
      pastRecord({ id: "d3", recordedMs: 60_000 }), // partial
      pastRecord({ id: "d4", recordedMs: 0 }), // missed
      // a future record must be excluded entirely
      makeRecord({ id: "future", scheduledDate: "2026-11-15", recordedMs: 0 }),
    ];
    const c = calculateConsistency([{ commitment, records }], now);
    expect(c.pastCount).toBe(4);
    expect(c.doneCount).toBe(2);
    expect(c.onTime).toBe(1);
    expect(c.late).toBe(1);
    expect(c.partial).toBe(1);
    expect(c.missed).toBe(1);
    expect(c.onTime + c.late).toBe(c.doneCount);
    expect(c.onTime + c.late + c.partial + c.missed).toBe(c.pastCount);
    expect(c.percent).toBe(50);
    expect(c.hasClosedDays).toBe(true);
  });

  it("reports no closed days when there is no past history", () => {
    const only = makeRecord({ scheduledDate: "2026-11-15", recordedMs: 0 });
    const c = calculateConsistency([{ commitment, records: [only] }], now);
    expect(c.hasClosedDays).toBe(false);
    expect(c.pastCount).toBe(0);
    expect(c.percent).toBe(0);
  });
});
