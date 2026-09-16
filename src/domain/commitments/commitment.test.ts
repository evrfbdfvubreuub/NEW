import { describe, expect, it } from "vitest";
import {
  buildCommitmentAggregate,
  commitmentLifecycle,
  daysRemaining,
  validateCommitmentForm,
} from "./commitment";
import { makeCommitment, makeRecord, nextId, resetIds, TWO_HOURS_MS, utc } from "@/test/factories";

describe("validateCommitmentForm", () => {
  const valid = {
    name: "  Study Electronics  ",
    targetHours: 2,
    targetMinutes: 0,
    durationDays: 30,
    reminderTimes: ["21:00", "09:00", "09:00"],
  };

  it("rejects duplicate reminder times", () => {
    const result = validateCommitmentForm(valid);
    expect(result.valid).toBe(false);
    expect(result.errors.reminderTimes).toBeTruthy();
  });

  it("normalizes name and reminder ordering when valid", () => {
    const result = validateCommitmentForm({ ...valid, reminderTimes: ["21:00", "09:00"] });
    expect(result.valid).toBe(true);
    expect(result.normalized?.name).toBe("Study Electronics");
    expect(result.normalized?.dailyTargetMs).toBe(TWO_HOURS_MS);
    expect(result.normalized?.reminderTimes).toEqual(["09:00", "21:00"]);
  });

  it("enforces target and duration bounds", () => {
    expect(validateCommitmentForm({ ...valid, targetHours: 0, targetMinutes: 0 }).errors.target).toBeTruthy();
    expect(validateCommitmentForm({ ...valid, targetHours: 25, targetMinutes: 0 }).errors.target).toBeTruthy();
    expect(validateCommitmentForm({ ...valid, durationDays: 0 }).errors.durationDays).toBeTruthy();
    expect(validateCommitmentForm({ ...valid, durationDays: 4000 }).errors.durationDays).toBeTruthy();
    expect(validateCommitmentForm({ ...valid, name: "" }).errors.name).toBeTruthy();
  });

  it("rejects malformed reminder times", () => {
    expect(validateCommitmentForm({ ...valid, reminderTimes: ["9:00"] }).errors.reminderTimes).toBeTruthy();
    expect(validateCommitmentForm({ ...valid, reminderTimes: ["24:00"] }).errors.reminderTimes).toBeTruthy();
  });
});

describe("buildCommitmentAggregate", () => {
  it("captures inclusive dates and one permanent record per day", () => {
    resetIds();
    const { commitment, records } = buildCommitmentAggregate(
      { name: "Read", dailyTargetMs: TWO_HOURS_MS, durationDays: 30, reminderTimes: [] },
      { nowMs: utc(2026, 9, 16, 9), timeZone: "UTC", newId: () => nextId("x") },
    );
    expect(commitment.startDate).toBe("2026-09-16");
    expect(commitment.endDate).toBe("2026-10-15"); // inclusive: start + (30 - 1)
    expect(records).toHaveLength(30);
    expect(records[0]?.ordinal).toBe(1);
    expect(records[0]?.scheduledDate).toBe("2026-09-16");
    expect(records[29]?.ordinal).toBe(30);
    expect(records[29]?.scheduledDate).toBe("2026-10-15");
    expect(records.every((r) => r.targetMs === TWO_HOURS_MS)).toBe(true);
    expect(records.every((r) => r.recordedMs === 0)).toBe(true);
  });

  it("supports duration of 1", () => {
    const { commitment, records } = buildCommitmentAggregate(
      { name: "One", dailyTargetMs: 60_000, durationDays: 1, reminderTimes: [] },
      { nowMs: utc(2026, 9, 16, 9), timeZone: "UTC", newId: () => nextId("y") },
    );
    expect(commitment.startDate).toBe(commitment.endDate);
    expect(records).toHaveLength(1);
  });
});

describe("daysRemaining", () => {
  it("includes today while in range and is 0 after the end", () => {
    const commitment = makeCommitment({ timeZone: "UTC", startDate: "2026-09-01", endDate: "2026-09-30" });
    expect(daysRemaining(commitment, utc(2026, 9, 1, 12))).toBe(30);
    expect(daysRemaining(commitment, utc(2026, 9, 30, 12))).toBe(1);
    expect(daysRemaining(commitment, utc(2026, 10, 1, 12))).toBe(0);
  });
});

describe("commitmentLifecycle", () => {
  const commitment = makeCommitment({ timeZone: "UTC", durationDays: 2, startDate: "2026-09-01", endDate: "2026-09-02" });

  it("is ACTIVE before the deadline", () => {
    const records = [makeRecord({ recordedMs: 0 }), makeRecord({ id: "r2", recordedMs: 0 })];
    expect(commitmentLifecycle(commitment, records, utc(2026, 9, 2, 12))).toBe("ACTIVE");
  });

  it("is ENDED_COMPLETE when all done after the deadline", () => {
    const records = [
      makeRecord({ recordedMs: TWO_HOURS_MS }),
      makeRecord({ id: "r2", recordedMs: TWO_HOURS_MS }),
    ];
    expect(commitmentLifecycle(commitment, records, utc(2026, 9, 3, 12))).toBe("ENDED_COMPLETE");
  });

  it("is ENDED_INCOMPLETE when any incomplete after the deadline", () => {
    const records = [makeRecord({ recordedMs: TWO_HOURS_MS }), makeRecord({ id: "r2", recordedMs: 0 })];
    expect(commitmentLifecycle(commitment, records, utc(2026, 9, 3, 12))).toBe("ENDED_INCOMPLETE");
  });
});
