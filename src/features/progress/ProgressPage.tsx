import { useParams, useNavigate } from "react-router-dom";
import { usePageTitle } from "@/lib/usePageTitle";
import { useAppState } from "@/state/store-context";
import { commitmentConsistency, overallConsistency } from "@/state/selectors";
import type { Consistency } from "@/domain/commitments/progress";
import { formatPercent } from "@/domain/time/format";
import type { Tone } from "@/components/status/status-display";
import { toneColor } from "@/components/status/status-display";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/layout/Feedback";
import { Panel } from "@/components/primitives/Panel";
import { Ring } from "@/components/progress/Ring";
import { Select } from "@/components/primitives/form";

interface Row {
  label: string;
  count: number;
  tone: Tone;
}

function Composition({ consistency }: { consistency: Consistency }): JSX.Element {
  const rows: Row[] = [
    { label: "On time", count: consistency.onTime, tone: "done" },
    { label: "Late", count: consistency.late, tone: "late" },
    { label: "Partial", count: consistency.partial, tone: "partial" },
    { label: "Missed", count: consistency.missed, tone: "missed" },
  ];
  const total = Math.max(1, consistency.pastCount);
  return (
    <div className="composition">
      {rows.map((row) => (
        <div className="composition__row" key={row.label}>
          <span className="row gap-2">
            <span className="legend__swatch" style={{ background: toneColor(row.tone) }} />
            {row.label}
          </span>
          <div className="bar">
            <span className="bar__fill" style={{ width: `${(row.count / total) * 100}%`, background: toneColor(row.tone) }} />
          </div>
          <span className="composition__count numeric">{row.count}</span>
        </div>
      ))}
    </div>
  );
}

export function ProgressPage(): JSX.Element | null {
  const { commitmentId } = useParams();
  const { data, nowMs } = useAppState();
  const navigate = useNavigate();
  usePageTitle("Progress");
  if (!data) return null;

  const selected = commitmentId ? data.commitments.find((c) => c.id === commitmentId) : undefined;
  const consistency = selected
    ? commitmentConsistency(selected, data.records, nowMs)
    : overallConsistency(data, nowMs);
  const scopeLabel = selected ? selected.name : "All commitments";

  return (
    <div>
      <PageHeader eyebrow="Progress" title={scopeLabel} />

      {data.commitments.length > 0 ? (
        <div style={{ maxWidth: 280, marginBottom: "var(--space-5)" }}>
          <Select
            aria-label="Progress scope"
            value={selected ? selected.id : "all"}
            onChange={(e) => {
              const value = e.currentTarget.value;
              navigate(value === "all" ? "/progress" : `/progress/${value}`);
            }}
            options={[
              { value: "all", label: "All commitments" },
              ...data.commitments.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
        </div>
      ) : null}

      {!consistency.hasClosedDays ? (
        <EmptyState
          icon="progress"
          title="No closed days yet"
          description="Progress appears once a scheduled day has passed. Today stays on the Today screen while it is still open."
        />
      ) : (
        <div className="split split--2">
          <Panel className="card" style={{ display: "grid", placeItems: "center", gap: "var(--space-4)", padding: "var(--space-6)" }}>
            <Ring value={consistency.percent} size={200} strokeWidth={12} tone="done" label={`${consistency.percent}% of closed days completed`}>
              <div className="stack gap-1">
                <span className="page-title numeric">{formatPercent(consistency.percent)}</span>
                <span className="muted numeric" style={{ fontSize: "var(--fs-xs)" }}>
                  {consistency.doneCount} / {consistency.pastCount} days
                </span>
              </div>
            </Ring>
            <span className="label muted" style={{ fontSize: "var(--fs-xs)" }}>
              {consistency.doneCount} / {consistency.pastCount} days completed
            </span>
          </Panel>

          <Panel className="card">
            <span className="section-title" style={{ display: "block", marginBottom: "var(--space-4)" }}>
              Breakdown
            </span>
            <Composition consistency={consistency} />
          </Panel>
        </div>
      )}
    </div>
  );
}
