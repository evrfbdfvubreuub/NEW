import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { usePageTitle } from "@/lib/usePageTitle";
import { useAppState } from "@/state/store-context";
import { recordsFor } from "@/state/selectors";
import {
  formatMonthYear,
  isoYearMonth,
  monthGrid,
  todayISOInZone,
  weekdayHeadings,
} from "@/domain/time/calendar";
import { displayStatus } from "@/domain/commitments/status";
import type { DayRecord, DisplayStatus } from "@/domain/types";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/layout/Feedback";
import { Panel } from "@/components/primitives/Panel";
import { IconButton } from "@/components/primitives/Button";
import { STATUS_DISPLAY, statusGlyph, statusTone, toneColor } from "@/components/status/status-display";

const monthIndex = (year: number, month: number): number => year * 12 + (month - 1);

const LEGEND: Array<{ status: DisplayStatus; label: string }> = [
  { status: "DONE_ON_TIME", label: "On time" },
  { status: "COMPLETED_LATE", label: "Late" },
  { status: "PARTIAL", label: "Partial" },
  { status: "MISSED", label: "Missed" },
  { status: "UPCOMING", label: "Upcoming" },
];

export function CalendarPage(): JSX.Element | null {
  const { commitmentId } = useParams();
  const { data, nowMs } = useAppState();
  usePageTitle("Calendar");

  const commitment = data?.commitments.find((c) => c.id === commitmentId);
  const start = commitment ? isoYearMonth(commitment.startDate) : null;
  const [cursor, setCursor] = useState<{ year: number; month: number } | null>(null);

  if (!data) return null;
  if (!commitment || !start) {
    return (
      <div>
        <PageHeader title="Calendar" back={{ to: "/commitments", label: "Commitments" }} />
        <EmptyState icon="alert" title="Commitment not found" />
      </div>
    );
  }

  const end = isoYearMonth(commitment.endDate);
  const todayIso = todayISOInZone(nowMs, commitment.timeZone);
  const todayYm = isoYearMonth(todayIso);
  const startIdx = monthIndex(start.year, start.month);
  const endIdx = monthIndex(end.year, end.month);
  const initial =
    monthIndex(todayYm.year, todayYm.month) >= startIdx && monthIndex(todayYm.year, todayYm.month) <= endIdx
      ? todayYm
      : start;
  const current = cursor ?? initial;
  const currentIdx = monthIndex(current.year, current.month);

  const byDate = new Map<string, DayRecord>();
  for (const record of recordsFor(data.records, commitment.id)) byDate.set(record.scheduledDate, record);

  const step = (delta: number): void => {
    const idx = currentIdx + delta;
    if (idx < startIdx || idx > endIdx) return;
    const year = Math.floor(idx / 12);
    const month = (idx % 12) + 1;
    setCursor({ year, month });
  };

  const weeks = monthGrid(current.year, current.month);

  return (
    <div>
      <PageHeader
        title={commitment.name}
        eyebrow="Calendar"
        back={{ to: `/commitments/${commitment.id}`, label: "Commitment" }}
      />
      <Panel className="card">
        <div className="calendar__head">
          <IconButton icon="chevron-left" label="Previous month" disabled={currentIdx <= startIdx} onClick={() => step(-1)} />
          <span className="section-title">{formatMonthYear(current.year, current.month)}</span>
          <IconButton icon="chevron-right" label="Next month" disabled={currentIdx >= endIdx} onClick={() => step(1)} />
        </div>

        <div className="calendar__grid" role="grid" aria-label={formatMonthYear(current.year, current.month)}>
          {weekdayHeadings.map((dow) => (
            <div key={dow} className="calendar__dow" role="columnheader">
              {dow}
            </div>
          ))}
          {weeks.flat().map((cell, i) => {
            if (!cell) return <div key={`empty-${i}`} aria-hidden="true" />;
            const record = byDate.get(cell.iso);
            if (!record) {
              return (
                <div key={cell.iso} className="cal-cell" aria-hidden="true">
                  {cell.day}
                </div>
              );
            }
            const status = displayStatus(record, commitment, nowMs);
            const isToday = cell.iso === todayIso;
            return (
              <Link
                key={cell.iso}
                to={`/commitments/${commitment.id}/days/${record.id}`}
                className={`cal-cell cal-cell--scheduled${isToday ? " cal-cell--today" : ""}`}
                aria-label={`Day ${record.ordinal}, ${cell.day} ${formatMonthYear(current.year, current.month)}, ${STATUS_DISPLAY[status].label}`}
              >
                <span>{cell.day}</span>
                <span
                  aria-hidden="true"
                  className="cal-cell__dot"
                  style={{ background: toneColor(statusTone(status)) }}
                  title={statusGlyph(status)}
                />
              </Link>
            );
          })}
        </div>

        <div className="legend">
          {LEGEND.map((item) => (
            <span className="legend__item" key={item.status}>
              <span className="legend__swatch" style={{ background: toneColor(statusTone(item.status)) }} />
              {item.label}
            </span>
          ))}
        </div>
      </Panel>
    </div>
  );
}
