import { useParams, useNavigate } from "react-router-dom";
import { usePageTitle } from "@/lib/usePageTitle";
import { useActions, useAppState } from "@/state/store-context";
import { useRecordSessions } from "@/features/useRecordSessions";
import { closedRawMs, computeTimerSnapshot } from "@/domain/timer/calculations";
import { displayStatus, isRecoveryEligible, progressPercent } from "@/domain/commitments/status";
import { completionDateISO, dateInZone, deadlineInstantMs, formatDateLong, formatDateMedium } from "@/domain/time/calendar";
import { formatDuration, formatPercent } from "@/domain/time/format";
import type { TimerSession } from "@/domain/types";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/layout/Feedback";
import { Panel } from "@/components/primitives/Panel";
import { Button } from "@/components/primitives/Button";
import { Icon } from "@/components/primitives/Icon";
import { StatusBadge } from "@/components/status/StatusBadge";
import { ProgressBar } from "@/components/progress/ProgressBar";
import { statusTone } from "@/components/status/status-display";
import { useToast } from "@/components/primitives/Toast";

function timeInZone(ms: number, zone: string): string {
  return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", timeZone: zone }).format(
    new Date(ms),
  );
}

function Fact({ label, value, tone }: { label: string; value: string; tone?: string }): JSX.Element {
  return (
    <div className="kpi">
      <span className="kpi__value numeric" style={{ fontSize: "var(--fs-md)", color: tone }}>
        {value}
      </span>
      <span className="kpi__label">{label}</span>
    </div>
  );
}

export function DayDetailPage(): JSX.Element | null {
  const { commitmentId, recordId } = useParams();
  const { data, nowMs } = useAppState();
  const actions = useActions();
  const toast = useToast();
  const navigate = useNavigate();
  const sessions = useRecordSessions(recordId);
  usePageTitle("Day detail");

  if (!data) return null;
  const commitment = data.commitments.find((c) => c.id === commitmentId);
  const record = data.records.find((r) => r.id === recordId);
  if (!commitment || !record) {
    return (
      <div>
        <PageHeader title="Day" back={{ to: `/commitments/${commitmentId ?? ""}`, label: "Commitment" }} />
        <EmptyState icon="alert" title="Day not found" />
      </div>
    );
  }

  const zone = commitment.timeZone;
  const deadline = deadlineInstantMs(commitment.endDate, zone);
  const isActive = data.activeTimer?.dayRecordId === record.id;
  const snapshot = computeTimerSnapshot(sessions, record.targetMs, nowMs, deadline);
  const credited = isActive ? snapshot.creditedMs : record.recordedMs;
  const done = credited >= record.targetMs;
  const status = displayStatus(record, commitment, nowMs);
  const percent = progressPercent(credited, record.targetMs, done);
  const recoverable = isRecoveryEligible(record, commitment, nowMs);

  const recover = async (): Promise<void> => {
    const result = await actions.startTimer(record.id);
    if (result.ok) navigate(`/timer/${record.id}`);
    else toast.show(result.reason === "TIMER_ACTIVE" ? "Stop or resume the active timer first." : "Could not start.", "error");
  };

  return (
    <div>
      <PageHeader
        eyebrow={`Day ${record.ordinal}`}
        title={commitment.name}
        back={{ to: `/commitments/${commitment.id}/calendar`, label: "Calendar" }}
      />

      <Panel className="facts">
        <Fact label="Scheduled date" value={formatDateLong(record.scheduledDate)} />
        <Fact label="Target" value={formatDuration(record.targetMs)} />
        <Fact label="Recorded" value={formatDuration(credited)} />
        {record.completedAtMs != null ? (
          <Fact
            label="Completed"
            value={formatDateMedium(completionDateISO(record.completedAtMs, zone))}
            tone={record.completionTiming === "LATE" ? "var(--late)" : "var(--done)"}
          />
        ) : null}
      </Panel>

      <div className="section-head">
        <span className="section-title">Status</span>
        <StatusBadge status={status} />
      </div>
      <Panel className="card">
        <div className="row-between">
          <ProgressBar value={percent} tone={done ? (record.completionTiming === "LATE" ? "late" : "done") : statusTone(status)} label={`${percent}%`} />
          <span className="numeric" style={{ marginLeft: "var(--space-3)" }}>{formatPercent(percent)}</span>
        </div>
      </Panel>

      {recoverable ? (
        <>
          <div className="section-head">
            <span className="section-title">Recover this day</span>
          </div>
          <Panel className="card">
            <div className="stack gap-3">
              <p className="muted">
                Originally scheduled {formatDateLong(record.scheduledDate)}. You can complete the
                remaining {formatDuration(record.targetMs - credited)} on time within this
                commitment — recovery is available until the end of {formatDateMedium(commitment.endDate)}.
                Completing it now will record it as <strong>completed late</strong>. The scheduled
                date never changes.
              </p>
              <Button variant="primary" icon="recover" onClick={() => void recover()}>
                {credited > 0 ? `Continue Day ${record.ordinal}` : `Complete Day ${record.ordinal}`}
              </Button>
            </div>
          </Panel>
        </>
      ) : null}

      <div className="section-head">
        <span className="section-title">Timer sessions</span>
      </div>
      <Panel className="card">
        {sessions.length === 0 ? (
          <p className="muted">No timer sessions recorded for this day.</p>
        ) : (
          <div className="session-list">
            {sessions
              .slice()
              .sort((a: TimerSession, b: TimerSession) => a.startedAtMs - b.startedAtMs)
              .map((session) => (
                <div className="session-row" key={session.id}>
                  <span>
                    {formatDateMedium(dateInZone(session.startedAtMs, zone))} · {timeInZone(session.startedAtMs, zone)}
                  </span>
                  <span className="row gap-2">
                    <Icon name="today" size={14} className="muted" />
                    {formatDuration(closedRawMs([session]))}
                  </span>
                </div>
              ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
