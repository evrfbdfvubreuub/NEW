import { useState } from "react";
import { Link } from "react-router-dom";
import { usePageTitle } from "@/lib/usePageTitle";
import { useAppState } from "@/state/store-context";
import { buildCommitmentListViews, type CommitmentListView } from "@/state/selectors";
import { formatPercent, formatTargetLabel } from "@/domain/time/format";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/layout/Feedback";
import { Panel } from "@/components/primitives/Panel";
import { ProgressBar } from "@/components/progress/ProgressBar";
import { SegmentedControl } from "@/components/primitives/form";

function CommitmentCard({ view }: { view: CommitmentListView }): JSX.Element {
  const ended = view.lifecycle !== "ACTIVE";
  const outcome = view.lifecycle === "ENDED_COMPLETE" ? "Complete" : "Incomplete";
  return (
    <Link to={`/commitments/${view.commitment.id}`}>
      <Panel className="commitment-card">
        <div className="stack gap-2" style={{ minWidth: 0 }}>
          <span className="today-card__name truncate">{view.commitment.name}</span>
          <span className="muted" style={{ fontSize: "var(--fs-xs)" }}>
            {formatTargetLabel(view.commitment.dailyTargetMs)} / day ·{" "}
            {ended ? outcome : `${view.daysRemaining} day${view.daysRemaining === 1 ? "" : "s"} left`}
          </span>
          <ProgressBar
            value={view.plan.percent}
            tone={view.lifecycle === "ENDED_INCOMPLETE" ? "missed" : "done"}
            label={`${view.plan.percent}%`}
          />
        </div>
        <div className="kpi" style={{ alignItems: "flex-end" }}>
          <span className="kpi__value numeric">{formatPercent(view.plan.percent)}</span>
          <span className="kpi__label">
            {view.plan.doneCount}/{view.plan.totalDays} days
          </span>
        </div>
      </Panel>
    </Link>
  );
}

export function CommitmentsPage(): JSX.Element | null {
  usePageTitle("My commitments");
  const { data, nowMs } = useAppState();
  const [tab, setTab] = useState<"active" | "ended">("active");
  if (!data) return null;

  const { active, ended } = buildCommitmentListViews(data, nowMs);
  const list = tab === "active" ? active : ended;

  return (
    <div>
      <PageHeader
        title="My commitments"
        actions={
          <Link to="/commitments/new" className="btn btn--primary btn--sm">
            + New commitment
          </Link>
        }
      />
      <SegmentedControl
        ariaLabel="Filter commitments"
        value={tab}
        onChange={setTab}
        options={[
          { value: "active", label: `Active (${active.length})` },
          { value: "ended", label: `Ended (${ended.length})` },
        ]}
      />
      <div className="list" style={{ marginTop: "var(--space-4)" }}>
        {list.length === 0 ? (
          <EmptyState
            icon="commitments"
            title={tab === "active" ? "No active commitments" : "No ended commitments"}
            description={tab === "active" ? "Create one to begin." : "Completed and ended commitments appear here."}
            action={
              tab === "active" ? (
                <Link to="/commitments/new" className="btn btn--primary">
                  + New commitment
                </Link>
              ) : undefined
            }
          />
        ) : (
          list.map((view) => <CommitmentCard key={view.commitment.id} view={view} />)
        )}
      </div>
    </div>
  );
}
