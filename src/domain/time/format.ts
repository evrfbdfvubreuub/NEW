// Duration + percentage formatting (pure). Progress truth is whole-second precise
// (Blueprint §A3, §E8).
import { pad2 } from "./calendar";

/** Whole seconds contained in a millisecond duration (floored). */
export function toWholeSeconds(ms: number): number {
  return Math.floor(Math.max(0, ms) / 1000);
}

/**
 * Adaptive H:MM:SS / M:SS. Examples: 2h => "2:00:00", 47m12s => "47:12",
 * 20m => "20:00". Uses tabular-friendly zero padding.
 */
export function formatDuration(ms: number): string {
  const total = toWholeSeconds(ms);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${pad2(m)}:${pad2(s)}` : `${m}:${pad2(s)}`;
}

/** Compact hours/minutes label for targets, e.g. "2h", "1h 30m", "45m". */
export function formatTargetLabel(ms: number): string {
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

/**
 * Percentage string honouring the incomplete clamp (Blueprint §E8):
 * DONE => "100%"; otherwise min(round(ratio*1000)/10, 99.9), integers shown
 * without a decimal.
 */
export function formatPercent(value: number): string {
  return Number.isInteger(value) ? `${value}%` : `${value.toFixed(1)}%`;
}
