import { Navigate } from "react-router-dom";
import { useAppState } from "@/state/store-context";

/** Entry redirect (Blueprint §L, §M1): onboarding on first run, else Today. */
export function RootRedirect(): JSX.Element {
  const { data } = useAppState();
  const onboarded = data?.settings.onboardingCompleted ?? true;
  return <Navigate to={onboarded ? "/today" : "/welcome"} replace />;
}
