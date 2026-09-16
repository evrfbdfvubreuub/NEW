import { beforeEach, describe, expect, it } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { deleteDatabase, getDb } from "@/infrastructure/db/database";
import { fixedClock } from "@/domain/time/clock";
import { createAppStore, type AppStore } from "@/state/app-store";
import { StoreProvider } from "@/state/store-context";
import { ToastProvider } from "@/components/primitives/Toast";
import { TodayPage } from "@/features/today/TodayPage";
import { createCommitment } from "@/application/commitments/create-commitment";
import { utc } from "@/test/factories";

let idc = 0;

async function makeStore(): Promise<AppStore> {
  await deleteDatabase();
  const db = await getDb();
  const store = createAppStore({
    db,
    clock: fixedClock(utc(2026, 9, 10, 9)),
    newId: () => `ui-${(idc += 1)}`,
    timeZone: () => "UTC",
  });
  await store.init();
  return store;
}

function renderToday(store: AppStore): void {
  render(
    <StoreProvider store={store}>
      <ToastProvider>
        <MemoryRouter initialEntries={["/today"]}>
          <TodayPage />
        </MemoryRouter>
      </ToastProvider>
    </StoreProvider>,
  );
}

describe("Today integration", () => {
  beforeEach(() => {
    idc = 0;
  });

  it("shows the empty state, then a created commitment appears", async () => {
    const store = await makeStore();
    renderToday(store);

    expect(screen.getByText("No commitments yet")).toBeInTheDocument();

    await act(async () => {
      await createCommitment(store.ports, {
        name: "Study Electronics",
        targetHours: 2,
        targetMinutes: 0,
        durationDays: 30,
        reminderTimes: [],
      });
      await store.reload();
    });

    expect(await screen.findByText("Study Electronics")).toBeInTheDocument();
    expect(screen.getByText("0 / 1 completed")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /start/i })).toBeInTheDocument();
  });
});
