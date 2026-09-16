import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/primitives/Icon";
import { Button } from "@/components/primitives/Button";

export function Splash(): JSX.Element {
  return (
    <div className="splash blueprint-bg">
      <div className="stack gap-3">
        <div className="splash__brand">THE ARCHITECT</div>
        <p className="muted label" style={{ fontSize: "var(--fs-xs)" }}>
          Build a better you
        </p>
      </div>
    </div>
  );
}

export function ErrorScreen({
  title = "Something went wrong",
  message,
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}): JSX.Element {
  return (
    <div className="error-screen blueprint-bg">
      <div className="stack gap-4" style={{ maxWidth: 420 }}>
        <Icon name="alert" size={40} className="text-missed" />
        <h1 className="section-title">{title}</h1>
        {message ? <p className="muted">{message}</p> : null}
        {onRetry ? (
          <div className="row gap-2" style={{ justifyContent: "center" }}>
            <Button variant="primary" onClick={onRetry}>
              Retry
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: IconName;
  title: string;
  description?: string;
  action?: ReactNode;
}): JSX.Element {
  return (
    <div className="empty-state">
      <Icon name={icon} size={44} />
      <div className="stack gap-2">
        <h2 className="section-title" style={{ color: "var(--text)" }}>
          {title}
        </h2>
        {description ? <p className="muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
