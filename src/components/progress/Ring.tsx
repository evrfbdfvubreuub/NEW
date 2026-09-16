import type { ReactNode } from "react";
import { toneColor, type Tone } from "@/components/status/status-display";

export interface RingProps {
  value: number; // 0..100
  size?: number;
  strokeWidth?: number;
  tone?: Tone;
  label: string;
  children?: ReactNode;
}

export function Ring({
  value,
  size = 200,
  strokeWidth = 10,
  tone = "active",
  label,
  children,
}: RingProps): JSX.Element {
  const clamped = Math.max(0, Math.min(100, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);

  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg
        className="ring"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={label}
      >
        <circle
          className="ring__track"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
        />
        <circle
          className="ring__value"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ stroke: toneColor(tone) }}
        />
      </svg>
      {children ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            textAlign: "center",
          }}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
