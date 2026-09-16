import type { ReactNode } from "react";
import { useAppState } from "@/state/store-context";
import { ErrorScreen, Splash } from "@/components/layout/Feedback";

/** Gates the router until bootstrap resolves (Blueprint §F1). */
export function BootstrapGate({ children }: { children: ReactNode }): JSX.Element {
  const { status, error } = useAppState();
  if (status === "LOADING") return <Splash />;
  if (status === "ERROR") {
    return (
      <ErrorScreen
        title="Could not open your data"
        message={error ?? "Local storage is unavailable in this browser."}
        onRetry={() => window.location.reload()}
      />
    );
  }
  return <>{children}</>;
}
