import { createBrowserRouter } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { RootRedirect } from "./RootRedirect";
import { WelcomePage } from "@/features/onboarding/WelcomePage";
import { TodayPage } from "@/features/today/TodayPage";
import { TimerPage } from "@/features/timer/TimerPage";
import { CommitmentsPage } from "@/features/commitments/CommitmentsPage";
import { NewCommitmentPage } from "@/features/commitments/NewCommitmentPage";
import { CommitmentDetailPage } from "@/features/commitments/CommitmentDetailPage";
import { CalendarPage } from "@/features/calendar/CalendarPage";
import { DayDetailPage } from "@/features/commitments/DayDetailPage";
import { ProgressPage } from "@/features/progress/ProgressPage";
import { SettingsPage } from "@/features/settings/SettingsPage";
import { DataPage } from "@/features/settings/DataPage";
import { NotFoundPage } from "@/features/misc/NotFoundPage";

export const router = createBrowserRouter([
  { path: "/welcome", element: <WelcomePage /> },
  {
    element: <AppShell />,
    children: [
      { index: true, element: <RootRedirect /> },
      { path: "/today", element: <TodayPage /> },
      { path: "/timer/:recordId", element: <TimerPage /> },
      { path: "/commitments", element: <CommitmentsPage /> },
      { path: "/commitments/new", element: <NewCommitmentPage /> },
      { path: "/commitments/:commitmentId", element: <CommitmentDetailPage /> },
      { path: "/commitments/:commitmentId/calendar", element: <CalendarPage /> },
      { path: "/commitments/:commitmentId/days/:recordId", element: <DayDetailPage /> },
      { path: "/progress", element: <ProgressPage /> },
      { path: "/progress/:commitmentId", element: <ProgressPage /> },
      { path: "/settings", element: <SettingsPage /> },
      { path: "/settings/data", element: <DataPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
