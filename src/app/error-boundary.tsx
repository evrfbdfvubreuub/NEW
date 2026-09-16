import { Component, type ErrorInfo, type ReactNode } from "react";
import { ErrorScreen } from "@/components/layout/Feedback";

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

/** App-level boundary (Blueprint §T). The timer engine reconciles independently. */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Minimal non-PII diagnostic; never transmitted (no backend in V1).
    console.error("[architect] render error", error.message, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <ErrorScreen
          title="Unexpected error"
          message="The screen failed to render. Your data is safe on this device."
          onRetry={() => window.location.assign("/today")}
        />
      );
    }
    return this.props.children;
  }
}
