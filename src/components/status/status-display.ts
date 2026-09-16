// Status display language (Blueprint §Q5). Every status pairs colour + symbol + words.
import type { DisplayStatus } from "@/domain/types";
import type { IconName } from "@/components/primitives/Icon";

export type Tone = "done" | "late" | "partial" | "missed" | "neutral" | "active";

export interface StatusDisplay {
  label: string;
  icon: IconName;
  tone: Tone;
}

export const STATUS_DISPLAY: Record<DisplayStatus, StatusDisplay> = {
  DONE_ON_TIME: { label: "Done on time", icon: "check", tone: "done" },
  COMPLETED_LATE: { label: "Completed late", icon: "check", tone: "late" },
  PARTIAL: { label: "Partial", icon: "partial", tone: "partial" },
  MISSED: { label: "Missed", icon: "cross", tone: "missed" },
  NOT_STARTED: { label: "Not started", icon: "dot", tone: "neutral" },
  UPCOMING: { label: "Upcoming", icon: "dot", tone: "neutral" },
};

export function toneColor(tone: Tone): string {
  switch (tone) {
    case "done":
      return "var(--done)";
    case "late":
    case "partial":
      return "var(--late)";
    case "missed":
      return "var(--missed)";
    case "active":
      return "var(--action)";
    case "neutral":
    default:
      return "var(--inactive)";
  }
}

/** Short calendar glyph for a status (accompanied by an accessible label). */
export function statusGlyph(status: DisplayStatus): string {
  switch (status) {
    case "DONE_ON_TIME":
    case "COMPLETED_LATE":
      return "✓";
    case "PARTIAL":
      return "~";
    case "MISSED":
      return "×";
    default:
      return "·";
  }
}
