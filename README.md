# THE ARCHITECT

**Build a better you.** A private, local‑first commitment execution and record system.

> Plan → Execute → Record → Repeat

THE ARCHITECT helps you define a daily obligation, run a trustworthy timer, preserve exactly what happened, recover missed work within the original window, and understand your consistency — with no judgment and no game mechanics. It is **not** a habit tracker, an AI coach, or a social app.

This application was built from [`THE_ARCHITECT_BLUEPRINT.md`](./THE_ARCHITECT_BLUEPRINT.md), which is the authoritative product and technical contract.

---

## Getting started

Requirements: **Node.js 18+** (built with Node 22).

```bash
npm install        # install dependencies
npm run dev        # start the dev server (Vite) at the printed URL
```

Other scripts:

```bash
npm run build      # type-check + production build to dist/
npm run preview    # preview the production build
npm test           # run the unit + integration test suite (Vitest)
npm run typecheck  # TypeScript type-check only
```

No account, no server, no network required. Your data stays in your browser.

---

## What it does (V1)

- **Commitments** — create a commitment with only a **name**, **daily target**, **duration**, and optional **reminder times**. Once started, these are **immutable**; make a new commitment if you want different parameters.
- **Timer** — Start / Pause / Resume / Stop. Time is recorded **only** through the timer (no manual entry). Exactly **one** timer can run or be paused across the whole app and all browser tabs.
- **Exact completion** — a day is DONE only at **exactly** the target. For a 2‑hour target: `1:59:00 → 99.2% PARTIAL`, `1:59:59 → 99.9% PARTIAL`, `2:00:00 → 100% DONE`. At the target the timer stops and no bonus time is stored.
- **Daily records** — every scheduled day has a permanent record: `NOT STARTED`, `PARTIAL`, `MISSED`, `DONE ON TIME`, or `COMPLETED LATE`.
- **Late recovery** — a missed or partial day can be completed later, until the commitment ends. The original scheduled date never changes; completing late is recorded as **COMPLETED LATE**.
- **Today / Commitments / Progress** — Today is the action screen (ordered by state, no priorities). Progress shows factual consistency, never scores or streaks.
- **Data** — versioned **JSON export**, validated **replace‑all import** (with an automatic rollback backup), and **Reset All Data**.
- **Appearance** — dark (primary) and warm ivory light themes, plus System.

### Reliability

Timer truth comes from **real timestamps**, never tick counts — so refresh, tab switches, sleep, and reopening all preserve the correct elapsed time, and a timer that reaches its target while the app was closed is finalized at the **exact** target instant. Dates use the commitment's captured time zone (DST‑safe via Temporal).

### Honest limits

Browser notifications are used only where supported and permitted. A local‑only app **cannot guarantee** a reminder after the browser is fully closed; in‑app reminders work while the app is open.

---

## Architecture

Strict layering (a future backend is a repository swap):

```
Presentation (React screens, design system)
   → Application (use cases: create, timer commands, reminders, data transfer)
      → Domain (pure: timer math, status, progress, dates, invariants)
      → Infrastructure (IndexedDB repositories, browser adapters)
```

- **Stack:** React 18 + TypeScript (strict) + Vite, React Router, `idb` (IndexedDB), Zod (import validation only), `@js-temporal/polyfill` (via a native‑preferring adapter). Vanilla CSS tokens.
- **Persistence:** IndexedDB (`the-architect-v1`) is authoritative; all multi‑entity mutations are atomic; integrity failures enter read‑only **safe mode** instead of rewriting history.
- **State:** a small `useSyncExternalStore` app store over the repositories; a singleton `TimerEngine` owns the render tick and reconciliation; pure selectors derive views.

```
src/
  domain/         pure logic + unit tests (no React/IndexedDB)
  application/    use cases (commitments, timer, reminders, data-transfer, settings)
  infrastructure/ IndexedDB (schema/migrations/repositories) + browser adapters
  state/          app store, timer engine, selectors, React bindings
  components/     primitives, status, progress, layout
  features/       one folder per screen
  styles/         tokens, themes, blueprint grid, typography, global
```

## Testing

Vitest + Testing Library + `fake-indexeddb`, all with an injected clock (no real waiting). Coverage focuses on the critical logic: exact timer boundaries, no‑bonus cap, target‑crossing instant, midnight on‑time vs late, recovery eligibility at the exclusive deadline, progress metrics, single‑timer lock, refresh reconstruction, and the create→Today UI flow.

```bash
npm test
```

## License / privacy

Personal project. All data is stored locally in your browser and is never transmitted.
