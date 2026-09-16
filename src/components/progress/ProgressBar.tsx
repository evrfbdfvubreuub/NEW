import { toneColor, type Tone } from "@/components/status/status-display";

export interface ProgressBarProps {
  value: number; // 0..100
  tone?: Tone;
  label?: string;
}

export function ProgressBar({ value, tone = "active", label }: ProgressBarProps): JSX.Element {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      className="bar"
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <span className="bar__fill" style={{ width: `${clamped}%`, background: toneColor(tone) }} />
    </div>
  );
}
