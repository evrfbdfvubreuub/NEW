import { Link } from "react-router-dom";
import { cx } from "@/lib/cx";
import { useAppState, useActions } from "@/state/store-context";
import { activeTimerView } from "@/state/selectors";
import { progressPercent } from "@/domain/commitments/status";
import { formatDuration } from "@/domain/time/format";
import { Panel } from "@/components/primitives/Panel";
import { Ring } from "@/components/progress/Ring";
import { IconButton } from "@/components/primitives/Button";
import { Icon } from "@/components/primitives/Icon";
import { useToast } from "@/components/primitives/Toast";

const REASONS: Record<string, string> = {
  TIMER_ACTIVE: "Another timer is already active.",
  NO_RUNNING_TIMER: "No running timer.",
  NO_PAUSED_TIMER: "No paused timer.",
  COMMITMENT_ENDED: "This commitment has ended.",
  CLOCK_BEHIND: "System time moved backward; timer reconciled.",
};

export function GlobalMiniTimer({ variant = "rail" }: { variant?: "rail" | "mobile" }): JSX.Element | null {
  const { data, nowMs } = useAppState();
  const actions = useActions();
  const toast = useToast();

  if (!data) return null;
  const view = activeTimerView(data, nowMs);
  if (!view) {
    return variant === "rail" ? <div className="mini-timer muted">No timer running</div> : null;
  }

  const done = view.snapshot.creditedMs >= view.record.targetMs;
  const percent = progressPercent(view.snapshot.creditedMs, view.record.targetMs, done);
  const running = view.mode === "RUNNING";

  const report = (reason: string) => toast.show(REASONS[reason] ?? "Timer could not update.", "error");

  const toggle = async (): Promise<void> => {
    const result = running ? await actions.pauseTimer() : await actions.resumeTimer();
    if (!result.ok) report(result.reason);
  };
  const stop = async (): Promise<void> => {
    const result = await actions.stopTimer();
    if (!result.ok) report(result.reason);
  };

  return (
    <Panel raised className={cx("mini-timer", variant === "mobile" && "mobile-mini-timer")}>
      <Ring value={percent} size={40} strokeWidth={4} tone={running ? "active" : "neutral"} label={`${percent}%`} />
      <div className="grow stack" style={{ minWidth: 0 }}>
        <span className="truncate label" style={{ fontSize: "var(--fs-xs)" }}>
          {view.isRecovery ? "Recovery · " : ""}
          {view.commitment.name}
        </span>
        <span className="mini-timer__readout numeric">
          {formatDuration(view.snapshot.creditedMs)} / {formatDuration(view.record.targetMs)}
        </span>
      </div>
      <IconButton icon={running ? "pause" : "play"} label={running ? "Pause" : "Resume"} onClick={toggle} />
      <IconButton icon="stop" label="Stop timer" onClick={stop} />
      <Link to={`/timer/${view.record.id}`} className="icon-btn" aria-label="Open timer">
        <Icon name="arrow-right" />
      </Link>
    </Panel>
  );
}
