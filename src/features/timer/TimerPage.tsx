import { Link, useParams } from "react-router-dom";
import { usePageTitle } from "@/lib/usePageTitle";
import { useActions, useAppState } from "@/state/store-context";
import { useRecordSessions } from "@/features/useRecordSessions";
import { computeTimerSnapshot } from "@/domain/timer/calculations";
import { progressPercent } from "@/domain/commitments/status";
import { deadlineInstantMs, formatDateMedium, todayISOInZone } from "@/domain/time/calendar";
import { formatDuration, formatPercent } from "@/domain/time/format";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/layout/Feedback";
import { Button } from "@/components/primitives/Button";
import { Ring } from "@/components/progress/Ring";
import { Icon } from "@/components/primitives/Icon";
import { useToast } from "@/components/primitives/Toast";

const REASONS: Record<string, string> = {
  TIMER_ACTIVE: "Another timer is active. Stop or resume it first.",
  FUTURE: "You can't start a future day early.",
  COMMITMENT_ENDED: "This commitment has ended.",
  ALREADY_DONE: "This day is already complete.",
  CLOCK_BEHIND: "System time moved backward; the timer was reconciled.",
};

export function TimerPage(): JSX.Element | null {
  const { recordId } = useParams();
  const { data, nowMs } = useAppState();
  const actions = useActions();
  const toast = useToast();
  const sessions = useRecordSessions(recordId);

  usePageTitle("Timer");
  if (!data) return null;

  const record = data.records.find((r) => r.id === recordId);
  const commitment = record ? data.commitments.find((c) => c.id === record.commitmentId) : undefined;
  if (!record || !commitment) {
    return (
      <div>
        <PageHeader title="Timer" back={{ to: "/today", label: "Today" }} />
        <EmptyState icon="alert" title="Timer not found" description="This day no longer exists." />
      </div>
    );
  }

  const deadline = deadlineInstantMs(commitment.endDate, commitment.timeZone);
  const snapshot = computeTimerSnapshot(sessions, record.targetMs, nowMs, deadline);
  const isActive = data.activeTimer?.dayRecordId === record.id;
  const mode = isActive ? data.activeTimer?.mode : null;
  const done = snapshot.creditedMs >= record.targetMs;
  const credited = snapshot.creditedMs;
  const percent = progressPercent(credited, record.targetMs, done);
  const today = todayISOInZone(nowMs, commitment.timeZone);
  const isPast = record.scheduledDate < today;
  const isFuture = record.scheduledDate > today;
  const running = snapshot.isRunning;

  const report = (reason: string): void => toast.show(REASONS[reason] ?? "Timer error.", "error");
  const doPause = async (): Promise<void> => {
    const r = await actions.pauseTimer();
    if (!r.ok) report(r.reason);
  };
  const doResume = async (): Promise<void> => {
    const r = await actions.resumeTimer();
    if (!r.ok) report(r.reason);
  };
  const doStop = async (): Promise<void> => {
    const r = await actions.stopTimer();
    if (!r.ok) report(r.reason);
  };
  const doStart = async (): Promise<void> => {
    const r = await actions.startTimer(record.id);
    if (!r.ok) report(r.reason);
  };

  const tone = done ? "done" : running ? "active" : "neutral";
  const stateLabel = done ? "Completed" : running ? "Running" : mode === "PAUSED" ? "Paused" : isPast ? `Recovery · Day ${record.ordinal}` : "Ready";

  return (
    <div>
      <PageHeader
        eyebrow={isPast && !done ? `Recovery · Day ${record.ordinal}` : formatDateMedium(record.scheduledDate)}
        title={commitment.name}
        back={{ to: "/today", label: "Today" }}
      />
      <div className="timer-screen">
        <Ring value={percent} size={240} strokeWidth={12} tone={tone} label={`${percent}% complete`}>
          <div className="stack gap-1">
            {done ? <Icon name="check" size={40} className="text-done" /> : null}
            <span className="timer-readout numeric">{formatDuration(credited)}</span>
            <span className="timer-target numeric">/ {formatDuration(record.targetMs)}</span>
          </div>
        </Ring>

        <div className="stack gap-1">
          <span className="timer-state" style={{ color: done ? "var(--done)" : "var(--text-muted)" }}>
            {stateLabel}
          </span>
          <span className="muted numeric">{formatPercent(percent)} complete</span>
        </div>

        {done ? (
          <div className="stack gap-4" style={{ alignItems: "center" }}>
            <p className="section-title text-done">Daily target completed</p>
            <Link to={`/progress/${commitment.id}`} className="btn btn--ghost">
              View progress
            </Link>
          </div>
        ) : isActive ? (
          <div className="timer-controls">
            {running ? (
              <Button variant="primary" size="lg" icon="pause" onClick={() => void doPause()}>
                Pause
              </Button>
            ) : (
              <Button variant="primary" size="lg" icon="play" onClick={() => void doResume()}>
                Resume
              </Button>
            )}
            <Button variant="ghost" size="lg" icon="stop" onClick={() => void doStop()}>
              Stop
            </Button>
          </div>
        ) : isFuture ? (
          <p className="muted">This day is scheduled for {formatDateMedium(record.scheduledDate)}. You can't start it early.</p>
        ) : (
          <div className="timer-controls">
            <Button variant="primary" size="lg" icon="play" onClick={() => void doStart()}>
              {isPast ? `Complete Day ${record.ordinal}` : credited > 0 ? "Continue" : "Start"}
            </Button>
          </div>
        )}

        <p className="timer-quote">Deep work. Real progress.</p>
      </div>
    </div>
  );
}
