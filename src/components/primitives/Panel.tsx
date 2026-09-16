import type { HTMLAttributes } from "react";
import { cx } from "@/lib/cx";

export interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  raised?: boolean;
  ticks?: boolean;
  flush?: boolean;
}

export function Panel({
  raised = false,
  ticks = false,
  flush = false,
  className,
  ...rest
}: PanelProps): JSX.Element {
  return (
    <div
      className={cx(
        "panel",
        raised && "panel--raised",
        ticks && "panel--ticks",
        flush && "panel--flush",
        className,
      )}
      {...rest}
    />
  );
}
