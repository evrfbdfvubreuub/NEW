import { Link, useNavigate } from "react-router-dom";
import { usePageTitle } from "@/lib/usePageTitle";
import { useActions, useAppState } from "@/state/store-context";
import { buildTodayView, todaySummary, type TodayCommitmentView, type TodayGroup } from "@/state/selectors";
import { dateInZone, formatDateWithWeekday } from "@/domain/time/calendar";
import { formatPercent, formatTargetLabel } from "@/domain/time/format";
import { currentTimeZone } from "@/infrastructure/browser/system";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/layout/Feedback";
import { Panel } from "@/components/primitives/Panel";
import { Button } from "@/components/primitives/Button";
import { Icon } from "@/components/primitives/Icon";
import { StatusBadge } from "@/components/status/StatusBadge";
import { ProgressBar } from "@/components/progress/ProgressBar";
import { statusTone } from "@/components/status/status-display";
import { useToast } from "@/components/primitives/Toast";

const GROUP_LABEL: Record<TodayGroup, string> = {
  NEEDS_ATTENTION: "Needs attention",
  PARTIAL: "Partial",
  NOT_STARTED: "Not started",
  COMPLETED: "Completed",
};

function TodayCard({ view }: { view: TodayCommitmentView }): JSX.Element {
  const actions = useActions();
  const toast = useToast();
  const navigate = useNavigate();
  const record = view.todayRecord;
  const done = view.status === "DONE_ON_TIME" || view.status === "COMPLETED_LATE";

  const start = async (): Promise<void> => {
    if (!record) return;
    const result = await actions.startTimer(record.id);
    if (result.ok) navigate(`/timer/${record.id}`);
    else toast.show(startError(result.reason), "error");
  };

  return (
    <Panel className="today-card">
      <span className="list-row__icon">
        <Icon name="commitments" size={18} />
      </span>
      <div className="today-card__body">
        <Link to={`/commitments/${view.commitment.id}`} className="today-card__name truncate">
          {view.commitment.name}
        </Link>
        <div className="today-card__meta">
          <span>{formatTargetLabel(view.targetMs)} / day</span>
          {view.status ? <StatusBadge status={view.status} /> : null}
        </div>
        <ProgressBar value={view.percent} tone={done ? "done" : statusTone(view.status)} label={`${view.percent}%`} />
        {view.recoverableCount > 0 ? (
          <Link to={`/commitments/${view.commitment.id}/calendar`} className="recover-flag">
            <Icon name="recover" size={13} />
            {view.recoverableCount} earlier day{view.recoverableCount > 1 ? "s" : ""} to recover
          </Link>
        ) : null}
      </div>
      <div className="stack gap-2" style={{ alignItems: "flex-end" }}>
        <span className="today-card__pct numeric">{formatPercent(view.percent)}</span>
        {done ? (
          <Icon name="check" className="text-done" />
        ) : view.ownsTimer ? (
          <Link to={`/timer/${record?.id}`} className="btn btn--ghost btn--sm">
            {view.timerMode === "RUNNING" ? "Open" : "Resume"}
          </Link>
        ) : (
          <Button variant="primary" size="sm" icon="play" onClick={() => void start()}>
            {view.creditedMs > 0 ? "Continue" : "Start"}
          </Button>
        )}
      </div>
    </Panel>
  );
}

export function TodayPage(): JSX.Element | null {
  usePageTitle("Today");
  const { data, nowMs } = useAppState();
  if (!data) return null;

  const views = buildTodayView(data, nowMs);
  const summary = todaySummary(views);
  const todayIso = dateInZone(nowMs, currentTimeZone());

  if (views.length === 0) {
    return (
      <div>
        <PageHeader eyebrow={formatDateWithWeekday(todayIso)} title="Today" />
        <EmptyState
          icon="commitments"
          title="No commitments yet"
          description="Start by creating your first commitment."
          action={
            <Link to="/commitments/new" className="btn btn--primary">
              + New commitment
            </Link>
          }
        />
      </div>
    );
  }

  let lastGroup: TodayGroup | null = null;
  return (
    <div>
      <PageHeader
        eyebrow={formatDateWithWeekday(todayIso)}
        title="Today"
        actions={
          <Link to="/commitments/new" className="btn btn--ghost btn--sm">
            + New
          </Link>
        }
      />
      <p className="today-quote">“Discipline today. A better tomorrow.”</p>
      <p className="muted" style={{ marginTop: "var(--space-2)" }}>
        {summary.completed} / {summary.total} completed
      </p>

      <div className="list" style={{ marginTop: "var(--space-4)" }}>
        {views.map((view) => {
          const showLabel = view.group !== lastGroup;
          lastGroup = view.group;
          return (
            <div key={view.commitment.id}>
              {showLabel ? <div className="today-group-label">{GROUP_LABEL[view.group]}</div> : null}
              <TodayCard view={view} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function startError(reason: string): string {
  switch (reason) {
    case "TIMER_ACTIVE":
      return "Another timer is active. Stop or resume it first.";
    case "FUTURE":
      return "You can't start a future day early.";
    case "COMMITMENT_ENDED":
      return "This commitment has ended.";
    default:
      return "Could not start the timer.";
  }
}
