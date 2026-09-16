import { Link, useParams } from "react-router-dom";
import { usePageTitle } from "@/lib/usePageTitle";
import { useAppState } from "@/state/store-context";
import { recordsFor } from "@/state/selectors";
import { commitmentLifecycle, daysRemaining } from "@/domain/commitments/commitment";
import { planCompletion } from "@/domain/commitments/progress";
import { displayStatus } from "@/domain/commitments/status";
import { formatDateMedium, todayISOInZone } from "@/domain/time/calendar";
import { formatPercent, formatTargetLabel } from "@/domain/time/format";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/layout/Feedback";
import { Panel } from "@/components/primitives/Panel";
import { ProgressBar } from "@/components/progress/ProgressBar";
import { statusTone, STATUS_DISPLAY, toneColor } from "@/components/status/status-display";

function Fact({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="kpi">
      <span className="kpi__value numeric" style={{ fontSize: "var(--fs-md)" }}>
        {value}
      </span>
      <span className="kpi__label">{label}</span>
    </div>
  );
}

export function CommitmentDetailPage(): JSX.Element | null {
  const { commitmentId } = useParams();
  const { data, nowMs } = useAppState();
  usePageTitle("Commitment");
  if (!data) return null;

  const commitment = data.commitments.find((c) => c.id === commitmentId);
  if (!commitment) {
    return (
      <div>
        <PageHeader title="Commitment" back={{ to: "/commitments", label: "Commitments" }} />
        <EmptyState icon="alert" title="Commitment not found" />
      </div>
    );
  }

  const records = recordsFor(data.records, commitment.id);
  const plan = planCompletion(commitment, records);
  const lifecycle = commitmentLifecycle(commitment, records, nowMs);
  const today = todayISOInZone(nowMs, commitment.timeZone);

  const centerIndex = Math.max(
    0,
    records.findIndex((r) => r.scheduledDate >= today),
  );
  const windowStart = Math.max(0, centerIndex - 6);
  const windowRecords = records.slice(windowStart, windowStart + 14);

  return (
    <div>
      <PageHeader
        eyebrow={lifecycle === "ACTIVE" ? "Active" : lifecycle === "ENDED_COMPLETE" ? "Ended · complete" : "Ended · incomplete"}
        title={commitment.name}
        back={{ to: "/commitments", label: "Commitments" }}
        actions={
          <>
            <Link to={`/commitments/${commitment.id}/calendar`} className="btn btn--ghost btn--sm">
              View calendar
            </Link>
            <Link to={`/progress/${commitment.id}`} className="btn btn--ghost btn--sm">
              View progress
            </Link>
          </>
        }
      />

      <Panel className="facts">
        <Fact label="Start date" value={formatDateMedium(commitment.startDate)} />
        <Fact label="End date" value={formatDateMedium(commitment.endDate)} />
        <Fact label="Daily target" value={formatTargetLabel(commitment.dailyTargetMs)} />
        <Fact label="Completed days" value={`${plan.doneCount} / ${plan.totalDays}`} />
        {lifecycle === "ACTIVE" ? <Fact label="Days remaining" value={String(daysRemaining(commitment, nowMs))} /> : null}
      </Panel>

      <div className="section-head">
        <span className="section-title">Plan completion</span>
        <span className="numeric muted">{formatPercent(plan.percent)}</span>
      </div>
      <Panel className="card">
        <ProgressBar value={plan.percent} tone={lifecycle === "ENDED_INCOMPLETE" ? "missed" : "done"} label={`${plan.percent}%`} />
      </Panel>

      <div className="section-head">
        <span className="section-title">Timeline</span>
        <Link to={`/commitments/${commitment.id}/calendar`} className="btn btn--quiet">
          Full calendar
        </Link>
      </div>
      <Panel className="card">
        <div className="calendar__grid" style={{ gridTemplateColumns: "repeat(7, 1fr)" }}>
          {windowRecords.map((record) => {
            const status = displayStatus(record, commitment, nowMs);
            const isToday = record.scheduledDate === today;
            return (
              <Link
                key={record.id}
                to={`/commitments/${commitment.id}/days/${record.id}`}
                className={`cal-cell cal-cell--scheduled${isToday ? " cal-cell--today" : ""}`}
                aria-label={`Day ${record.ordinal}, ${formatDateMedium(record.scheduledDate)}, ${STATUS_DISPLAY[status].label}`}
              >
                <span>{record.ordinal}</span>
                <span className="cal-cell__dot" style={{ background: toneColor(statusTone(status)) }} />
              </Link>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}
