import { describe, expect, it } from "vitest";
import {
  addDaysISO,
  completionDateISO,
  daysBetweenInclusive,
  deadlineInstantMs,
  monthGrid,
  reminderInstantMs,
  todayISOInZone,
} from "./calendar";
import { utc } from "@/test/factories";

describe("date math", () => {
  it("adds days across month boundaries", () => {
    expect(addDaysISO("2026-09-16", 29)).toBe("2026-10-15");
    expect(addDaysISO("2026-02-28", 1)).toBe("2026-03-01"); // 2026 not a leap year
  });

  it("computes inclusive spans", () => {
    expect(daysBetweenInclusive("2026-09-01", "2026-09-01")).toBe(1);
    expect(daysBetweenInclusive("2026-09-01", "2026-09-30")).toBe(30);
  });

  it("derives today in a zone from an instant", () => {
    // 2026-09-16 01:00 UTC is still 2026-09-15 in New York.
    expect(todayISOInZone(utc(2026, 9, 16, 1), "UTC")).toBe("2026-09-16");
    expect(todayISOInZone(utc(2026, 9, 16, 1), "America/New_York")).toBe("2026-09-15");
  });
});

describe("deadlineInstantMs", () => {
  it("is the exclusive start of the day after endDate in the captured zone", () => {
    expect(deadlineInstantMs("2026-09-30", "UTC")).toBe(utc(2026, 10, 1, 0, 0, 0));
  });

  it("respects the captured zone offset", () => {
    // New York is UTC-4 in early October (DST) => midnight NY = 04:00 UTC.
    expect(deadlineInstantMs("2026-09-30", "America/New_York")).toBe(utc(2026, 10, 1, 4, 0, 0));
  });
});

describe("reminderInstantMs & completionDateISO", () => {
  it("resolves a reminder time within the zone", () => {
    expect(reminderInstantMs("2026-09-16", "09:00", "UTC")).toBe(utc(2026, 9, 16, 9, 0, 0));
  });

  it("derives the completion date in the commitment zone", () => {
    expect(completionDateISO(utc(2026, 9, 12, 0, 0, 1), "UTC")).toBe("2026-09-12");
  });
});

describe("monthGrid", () => {
  it("produces Monday-first weeks with correct in-month cells", () => {
    const weeks = monthGrid(2026, 9); // September 2026 begins on a Tuesday
    expect(weeks[0]?.[0]).toBeNull(); // Monday blank
    expect(weeks[0]?.[1]?.iso).toBe("2026-09-01");
    const flat = weeks.flat().filter((c): c is NonNullable<typeof c> => c != null);
    expect(flat).toHaveLength(30);
    expect(flat[flat.length - 1]?.iso).toBe("2026-09-30");
  });
});
