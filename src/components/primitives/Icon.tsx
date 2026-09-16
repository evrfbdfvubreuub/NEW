// Small consistent line-icon set (Blueprint §Q: fine strokes). currentColor.
import type { ReactNode } from "react";

export type IconName =
  | "play"
  | "pause"
  | "stop"
  | "check"
  | "cross"
  | "partial"
  | "dot"
  | "calendar"
  | "progress"
  | "settings"
  | "today"
  | "commitments"
  | "plus"
  | "chevron-left"
  | "chevron-right"
  | "chevron-down"
  | "download"
  | "upload"
  | "trash"
  | "bell"
  | "sun"
  | "moon"
  | "monitor"
  | "info"
  | "arrow-right"
  | "alert"
  | "lock"
  | "recover";

const PATHS: Record<IconName, ReactNode> = {
  play: <path d="M8 5v14l11-7z" fill="currentColor" stroke="none" />,
  pause: (
    <>
      <rect x="6" y="5" width="4" height="14" fill="currentColor" stroke="none" />
      <rect x="14" y="5" width="4" height="14" fill="currentColor" stroke="none" />
    </>
  ),
  stop: <rect x="6" y="6" width="12" height="12" fill="currentColor" stroke="none" />,
  check: <path d="M4 12.5 9 17.5 20 6.5" />,
  cross: <path d="M6 6l12 12M18 6 6 18" />,
  partial: <path d="M4 13c2-3 4-3 6 0s4 3 6 0 4-3 4-3" />,
  dot: <circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" />,
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="1.5" />
      <path d="M3.5 9.5h17M8 3.5v3M16 3.5v3" />
    </>
  ),
  progress: (
    <>
      <path d="M4 20h16" />
      <path d="M7 20v-6M12 20V8M17 20v-9" />
    </>
  ),
  settings: (
    <>
      <path d="M5 8h14M5 16h14" />
      <circle cx="9" cy="8" r="2.4" fill="var(--surface)" />
      <circle cx="15" cy="16" r="2.4" fill="var(--surface)" />
    </>
  ),
  today: <path d="M4 11 12 4l8 7M6 10v9h12v-9" />,
  commitments: <path d="M4 6h16M4 12h16M4 18h10" />,
  plus: <path d="M12 5v14M5 12h14" />,
  "chevron-left": <path d="M15 5l-7 7 7 7" />,
  "chevron-right": <path d="M9 5l7 7-7 7" />,
  "chevron-down": <path d="M5 9l7 7 7-7" />,
  download: <path d="M12 4v11m0 0 4-4m-4 4-4-4M5 20h14" />,
  upload: <path d="M12 20V9m0 0 4 4m-4-4-4 4M5 4h14" />,
  trash: <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />,
  bell: <path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4l2-2ZM10 20a2 2 0 0 0 4 0" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19" />
    </>
  ),
  moon: <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z" />,
  monitor: <path d="M4 5h16v10H4zM9 19h6M12 15v4" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </>
  ),
  "arrow-right": <path d="M5 12h14M13 6l6 6-6 6" />,
  alert: <path d="M12 4 2.5 20h19L12 4ZM12 10v5M12 18h.01" />,
  lock: (
    <>
      <rect x="5" y="10" width="14" height="10" rx="1.5" />
      <path d="M8 10V8a4 4 0 0 1 8 0v2" />
    </>
  ),
  recover: <path d="M4 12a8 8 0 1 0 2.5-5.8M4 4v3h3" />,
};

export interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
  title?: string;
}

export function Icon({ name, size = 20, className, title }: IconProps): JSX.Element {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      {PATHS[name]}
    </svg>
  );
}
