// Calendar / timezone math (Blueprint §I). All schedule math uses Temporal —
// never `new Date("YYYY-MM-DD")`. Exposed signatures use only strings/numbers.
import { Temporal } from "./temporal";
import type { EpochMs, IANAZone, ISODate } from "../types";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTHS_ABBR = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const WEEKDAYS_ABBR = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** The local calendar date of an instant within a given zone (YYYY-MM-DD). */
export function dateInZone(nowMs: EpochMs, zone: IANAZone): ISODate {
  return Temporal.Instant.fromEpochMilliseconds(nowMs)
    .toZonedDateTimeISO(zone)
    .toPlainDate()
    .toString();
}

/** Alias emphasising "today" for a commitment's captured zone. */
export function todayISOInZone(nowMs: EpochMs, zone: IANAZone): ISODate {
  return dateInZone(nowMs, zone);
}

export function addDaysISO(iso: ISODate, days: number): ISODate {
  return Temporal.PlainDate.from(iso).add({ days }).toString();
}

export function compareISO(a: ISODate, b: ISODate): number {
  return Temporal.PlainDate.compare(Temporal.PlainDate.from(a), Temporal.PlainDate.from(b));
}

/** Inclusive whole-day span between two ISO dates. */
export function daysBetweenInclusive(startISO: ISODate, endISO: ISODate): number {
  const start = Temporal.PlainDate.from(startISO);
  const end = Temporal.PlainDate.from(endISO);
  return end.since(start, { largestUnit: "days" }).days + 1;
}

/**
 * The single exclusive commitment boundary (Blueprint §I1):
 * start of (endDate + 1 day) in the captured zone, as epoch ms.
 */
export function deadlineInstantMs(endDate: ISODate, zone: IANAZone): EpochMs {
  const dayAfterEnd = Temporal.PlainDate.from(endDate).add({ days: 1 });
  // No plainTime => start of day, `compatible` disambiguation (DST-safe).
  return dayAfterEnd.toZonedDateTime(zone).toInstant().epochMilliseconds;
}

/** Local instant (epoch ms) for a reminder "HH:mm" on a scheduled date. */
export function reminderInstantMs(scheduledDate: ISODate, hhmm: string, zone: IANAZone): EpochMs {
  const parts = hhmm.split(":");
  const hour = Number(parts[0]);
  const minute = Number(parts[1]);
  const zdt = Temporal.PlainDate.from(scheduledDate).toZonedDateTime({
    timeZone: zone,
    plainTime: Temporal.PlainTime.from({ hour, minute }),
  });
  return zdt.toInstant().epochMilliseconds;
}

/** Actual completion date derived from a completion instant in the commitment zone. */
export function completionDateISO(completedAtMs: EpochMs, zone: IANAZone): ISODate {
  return dateInZone(completedAtMs, zone);
}

export function startOfNextLocalMidnightMs(nowMs: EpochMs, zone: IANAZone): EpochMs {
  const today = Temporal.Instant.fromEpochMilliseconds(nowMs)
    .toZonedDateTimeISO(zone)
    .toPlainDate();
  return today.add({ days: 1 }).toZonedDateTime(zone).toInstant().epochMilliseconds;
}

// ---- Display helpers (pure) ----

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** e.g. "8 September 2026". */
export function formatDateLong(iso: ISODate): string {
  const d = Temporal.PlainDate.from(iso);
  return `${d.day} ${MONTHS[d.month - 1] ?? ""} ${d.year}`;
}

/** e.g. "16 Sep 2026". */
export function formatDateMedium(iso: ISODate): string {
  const d = Temporal.PlainDate.from(iso);
  return `${d.day} ${MONTHS_ABBR[d.month - 1] ?? ""} ${d.year}`;
}

/** e.g. "Wed, 16 Sep 2026". */
export function formatDateWithWeekday(iso: ISODate): string {
  const d = Temporal.PlainDate.from(iso);
  return `${WEEKDAYS_ABBR[d.dayOfWeek - 1] ?? ""}, ${formatDateMedium(iso)}`;
}

/** e.g. "September 2026" for calendar headers. */
export function formatMonthYear(year: number, month: number): string {
  return `${MONTHS[month - 1] ?? ""} ${year}`;
}

export interface CalendarCell {
  iso: ISODate;
  day: number;
}

/**
 * Weeks (Monday-first) for a month grid. Leading/trailing days from adjacent
 * months are returned as null so the UI can render inert placeholders.
 */
export function monthGrid(year: number, month: number): Array<Array<CalendarCell | null>> {
  const first = Temporal.PlainDate.from({ year, month, day: 1 });
  const daysInMonth = first.daysInMonth;
  const leading = first.dayOfWeek - 1; // Mon=1 => 0 blanks
  const cells: Array<CalendarCell | null> = [];
  for (let i = 0; i < leading; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ iso: first.with({ day }).toString(), day });
  }
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: Array<Array<CalendarCell | null>> = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export function isoYearMonth(iso: ISODate): { year: number; month: number } {
  const d = Temporal.PlainDate.from(iso);
  return { year: d.year, month: d.month };
}

export const weekdayHeadings = WEEKDAYS_ABBR;

export { pad2 };
