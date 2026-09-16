import { describe, expect, it } from "vitest";
import {
  baseStatus,
  deriveCompletionTiming,
  displayStatus,
  isRecoveryEligible,
  progressPercent,
} from "./status";
import { makeCommitment, makeRecord, TWO_HOURS_MS, utc } from "@/test/factories";

describe("progressPercent — exact boundary table (2h target)", () => {
  it("119:00 is 99.2%", () => {
    expect(progressPercent(7_140_000, TWO_HOURS_MS, false)).toBe(99.2);
  });
  it("119:59 is 99.9% (clamped, never rounds to 100)", () => {
    expect(progressPercent(7_199_000, TWO_HOURS_MS, false)).toBe(99.9);
  });
  it("120:00 is 100% only when DONE", () => {
    expect(progressPercent(7_200_000, TWO_HOURS_MS, false)).toBe(100);
    expect(progressPercent(7_200_000, TWO_HOURS_MS, true)).toBe(100);
  });
  it("an incomplete record never displays 100.0 due to rounding", () => {
    expect(progressPercent(7_199_999, TWO_HOURS_MS, false)).toBeLessThan(100);
  });
});

describe("baseStatus / displayStatus", () => {
  const commitment = makeCommitment({ timeZone: "UTC" });
  const now = utc(2026, 9, 10, 12); // "today" = 2026-09-10 UTC

  it("today with zero time is NOT_STARTED (never MISSED before midnight)", () => {
    const record = makeRecord({ scheduledDate: "2026-09-10", recordedMs: 0 });
    expect(baseStatus(record, commitment, now)).toBe("NOT_STARTED");
    expect(displayStatus(record, commitment, now)).toBe("NOT_STARTED");
  });

  it("future zero-time record displays UPCOMING", () => {
    const record = makeRecord({ scheduledDate: "2026-09-20", recordedMs: 0 });
    expect(displayStatus(record, commitment, now)).toBe("UPCOMING");
  });

  it("past zero-time record is MISSED", () => {
    const record = makeRecord({ scheduledDate: "2026-09-08", recordedMs: 0 });
    expect(baseStatus(record, commitment, now)).toBe("MISSED");
  });

  it("past nonzero incomplete record is PARTIAL", () => {
    const record = makeRecord({ scheduledDate: "2026-09-08", recordedMs: 60_000 });
    expect(baseStatus(record, commitment, now)).toBe("PARTIAL");
  });

  it("under one credited second on a past day stays MISSED", () => {
    const record = makeRecord({ scheduledDate: "2026-09-08", recordedMs: 0 }); // credit is whole-second
    expect(baseStatus(record, commitment, now)).toBe("MISSED");
  });
});

describe("completion timing — on time vs late", () => {
  const commitment = makeCommitment({ timeZone: "UTC" });

  it("completed on the scheduled date is ON_TIME (DONE_ON_TIME)", () => {
    const record = makeRecord({
      scheduledDate: "2026-09-08",
      recordedMs: TWO_HOURS_MS,
      completedAtMs: utc(2026, 9, 8, 23, 59, 59),
      completionTiming: "ON_TIME",
    });
    expect(deriveCompletionTiming(record, "UTC")).toBe("ON_TIME");
    expect(displayStatus(record, commitment, utc(2026, 9, 12))).toBe("DONE_ON_TIME");
  });

  it("completed after the scheduled date is LATE (COMPLETED_LATE)", () => {
    const record = makeRecord({
      scheduledDate: "2026-09-08",
      recordedMs: TWO_HOURS_MS,
      completedAtMs: utc(2026, 9, 12, 0, 0, 1),
      completionTiming: "LATE",
    });
    expect(deriveCompletionTiming(record, "UTC")).toBe("LATE");
    expect(displayStatus(record, commitment, utc(2026, 9, 12, 10))).toBe("COMPLETED_LATE");
  });
});

describe("isRecoveryEligible", () => {
  const commitment = makeCommitment({ timeZone: "UTC", endDate: "2026-09-30" });

  it("eligible when past, incomplete, and before the deadline", () => {
    const record = makeRecord({ scheduledDate: "2026-09-08", recordedMs: 0 });
    expect(isRecoveryEligible(record, commitment, utc(2026, 9, 12, 10))).toBe(true);
  });

  it("not eligible for today or future", () => {
    const today = makeRecord({ scheduledDate: "2026-09-12", recordedMs: 0 });
    expect(isRecoveryEligible(today, commitment, utc(2026, 9, 12, 10))).toBe(false);
  });

  it("not eligible when DONE", () => {
    const done = makeRecord({ scheduledDate: "2026-09-08", recordedMs: TWO_HOURS_MS });
    expect(isRecoveryEligible(done, commitment, utc(2026, 9, 12, 10))).toBe(false);
  });

  it("not eligible at/after the exclusive deadline instant", () => {
    const record = makeRecord({ scheduledDate: "2026-09-08", recordedMs: 0 });
    // deadline = start of 2026-10-01 UTC
    const deadline = utc(2026, 10, 1, 0, 0, 0);
    expect(isRecoveryEligible(record, commitment, deadline - 1)).toBe(true);
    expect(isRecoveryEligible(record, commitment, deadline)).toBe(false);
    expect(isRecoveryEligible(record, commitment, deadline + 1)).toBe(false);
  });
});
