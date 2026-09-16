import { RouterProvider } from "react-router-dom";
import { StoreProvider } from "@/state/store-context";
import type { AppStore } from "@/state/app-store";
import { ToastProvider } from "@/components/primitives/Toast";
import { AppErrorBoundary } from "./error-boundary";
import { ThemeController } from "./theme-controller";
import { router } from "./router";
import { BootstrapGate } from "./BootstrapGate";

export function App({ store }: { store: AppStore }): JSX.Element {
  return (
    <AppErrorBoundary>
      <StoreProvider store={store}>
        <ToastProvider>
          <ThemeController />
          <BootstrapGate>
            <RouterProvider router={router} />
          </BootstrapGate>
        </ToastProvider>
      </StoreProvider>
    </AppErrorBoundary>
  );
}
