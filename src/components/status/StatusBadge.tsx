import type { DisplayStatus } from "@/domain/types";
import { Icon } from "@/components/primitives/Icon";
import { STATUS_DISPLAY, toneColor } from "./status-display";

export function StatusBadge({ status }: { status: DisplayStatus }): JSX.Element {
  const display = STATUS_DISPLAY[status];
  return (
    <span className="badge" style={{ color: toneColor(display.tone) }}>
      <span className="badge__mark">
        <Icon name={display.icon} size={13} />
      </span>
      {display.label}
    </span>
  );
}
