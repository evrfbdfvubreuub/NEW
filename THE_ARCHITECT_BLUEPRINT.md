# THE ARCHITECT — Complete Product & Technical Blueprint

**Tagline:** BUILD A BETTER YOU
**Core loop:** PLAN → EXECUTE → RECORD → REPEAT
**Document purpose:** Build contract for Claude Sonnet
**Version:** V1 blueprint
**Visual source:** The single supplied 24-screen reference board. No other visual reference exists or may be assumed.

---

## Builder directive

Build the complete responsive web application described here. Do not add features because they are common in other productivity products. In particular, do not add AI, chat, coaching, manual time entry, priorities, categories, tags, scoring, streak rewards, social features, or editable history.

Before implementation, present the proposed project tree. Then create a compiling skeleton, then implement in the order in section X. Treat the domain invariants, timer rules, date rules, and acceptance criteria as non-negotiable. UI details may be refined only within the visual system defined in section Q.

This document describes application contracts and pseudocode; it is not application implementation.

---

# 0. Decisions that must not be reinterpreted

1. A commitment schedules **every calendar day** for its duration. There is no weekday selector in V1.
2. `START COMMITMENT` starts it immediately in the commitment's captured local date and time zone.
3. `endDate = startDate + (durationDays - 1)`, so both dates are inclusive.
4. The original name, target, duration, reminder times, start date, end date, and captured time zone are immutable after start. Global notification delivery can be disabled; the commitment's original reminder values do not change.
5. A day can be worked only through the built-in timer. No code path or import UI may accept manual time.
6. Time belongs to the day record explicitly selected before starting. It is never silently moved between dates.
7. Only one timer may be running or paused across the whole app, all commitments, and all tabs.
8. A day reaches `DONE` only when credited duration is exactly the target. At that instant the timer is capped and stopped. More time cannot be stored.
9. A prior partial or missed record may be recovered only through the commitment's end-of-day deadline. Its scheduled date never changes.
10. No future day can be started early.
11. A timer crossing midnight remains attached to its selected record. Completion after its scheduled date is late.
12. No individual commitment, day, or session can be edited or deleted in V1. The only destructive operation is Reset All Data.
13. Data is local-first and durable in IndexedDB. Refreshing, closing, reopening, sleeping, or changing tabs must not lose valid elapsed time.
14. Browser notification limits must be represented honestly. A local-only site cannot guarantee a scheduled notification after every browser process is fully closed.
15. The app opens to Today after first-run onboarding.

---

# A. Product architecture

## A1. Product purpose

THE ARCHITECT is a private commitment execution and record system. It helps a person define a daily obligation, run a trustworthy timer, preserve what actually occurred, recover missed work within the original commitment window, and inspect consistency without judgment or game mechanics.

The product has four functional pillars:

- **Plan:** create a commitment with only name, daily target, duration, and reminder times.
- **Execute:** run the timer for today's record or an explicitly chosen recoverable record.
- **Record:** preserve scheduled date, credited duration, timer sessions, status, and actual completion date.
- **Repeat:** return to Today and review factual progress.

## A2. V1 boundaries

Included: first-run orientation, commitment creation, Today, one global timer, pause/resume/stop, daily records, late recovery, commitment history, calendar/timeline, restrained progress views, appearance, notification preferences, sound/vibration preferences, JSON export/import, reset, and About.

Excluded: accounts, backend sync, manual time, editing records, deleting selected history, AI of any kind, recommendations, content feeds, notes, subtasks, categories, tags, priority, recurrence patterns other than daily, teams, sharing, comments, points, XP, levels, badges, coins, leaderboards, streak rewards, public profiles, and motivational generated text.

## A3. Terminology

- **Commitment:** immutable definition plus system metadata and a fixed sequence of day records.
- **Day record:** permanent record for one scheduled date.
- **Target:** required credited duration per day, stored in milliseconds but entered as whole hours/minutes.
- **Raw elapsed:** sum of valid timer intervals at millisecond precision.
- **Credited duration:** `min(targetMs, floor(rawElapsedMs / 1000) * 1000)`; official progress is whole-second precise.
- **Timer session:** one Start-to-Stop unit, possibly containing multiple intervals due to pause/resume.
- **Interval:** one uninterrupted running period between Start/Resume and Pause/Stop/automatic cap.
- **On time:** target reached on the scheduled date in the commitment's captured time zone.
- **Late:** target reached after scheduled date, no later than the commitment deadline.
- **Recoverable:** an overdue incomplete record while the commitment deadline has not passed.
- **Due record:** a record whose scheduled date is today or earlier in its commitment time zone.

## A4. Creation contract and validation

The form contains only:

- Name: required, trim outer whitespace, 1–80 Unicode characters.
- Daily target: whole hours and minutes; minimum 1 minute, maximum 24 hours.
- Duration: whole days; minimum 1, maximum 3,650.
- Reminder times: optional list of unique local `HH:mm` values, sorted ascending; maximum 10.

System metadata such as IDs, timestamps, schema version, and time zone is not user configuration and does not violate the four-field product rule.

On `START COMMITMENT`:

1. Validate all fields.
2. Capture current IANA time zone and current `Temporal.Instant`.
3. Compute local `startDate` and inclusive `endDate` in that zone.
4. Create the commitment and all day records in one IndexedDB transaction.
5. If any write fails, create nothing and show an actionable error.
6. Navigate to the new commitment detail; Today immediately includes today's record.
7. Remove all editing controls. The detail page explicitly labels the plan as fixed.

## A5. Commitment lifecycle

- `ACTIVE`: current instant is strictly before the exclusive `deadlineInstant` defined in I1.
- `ENDED_COMPLETE`: current instant is at/after deadline and every day record is done, whether on time or late.
- `ENDED_INCOMPLETE`: current instant is at/after deadline and at least one day remains partial or missed.

A commitment cannot be finished early because future scheduled days cannot be pre-completed. At the deadline, incomplete records become final. Ended commitments are read-only and separated from active commitments.

---

# B. Technical architecture

## B1. Recommended stack

| Concern | Choice | Reason |
|---|---|---|
| UI | React with TypeScript in strict mode | Requested, mature, component-oriented |
| Build | Vite | Small, fast, simple static deployment |
| Routing | React Router | Nested layouts, route parameters, error boundaries |
| Persistence | IndexedDB through the small `idb` wrapper | Durable structured local transactions without a backend |
| Runtime validation | Zod | Valuable at the untrusted JSON import boundary |
| Date/time | Native Temporal when available, `@js-temporal/polyfill` fallback | Correct date-only, IANA zone, DST, instant, and deadline semantics |
| Styling | Vanilla CSS with custom-property tokens and CSS Modules or feature stylesheets | No UI framework fighting the supplied identity |
| Icons | A small consistent outline SVG set, tree-shaken; custom architectural SVGs | Matches fine-line reference without a large component library |
| Unit/component tests | Vitest + React Testing Library + `fake-indexeddb` | Vite-native and suitable for local persistence |
| End-to-end tests | Playwright | Refresh, visibility, multi-tab, responsive, and browser journeys |

Do not add Redux, Zustand, TanStack Query, a component framework, charting library, date-fns, Moment, an ORM, or a service-worker framework unless a demonstrated requirement cannot be met without it. Simple progress rings and bars are SVG/CSS.

Pin exact dependency versions in the lockfile when implementation begins rather than hard-coding potentially stale versions in this blueprint.

## B2. Layering

1. **Domain:** pure entities, invariants, state derivation, progress math, date rules, and timer calculations. No React or IndexedDB imports.
2. **Application:** use cases such as create commitment, start/pause/resume/stop timer, reconcile timer, recover day, export, import, and reset.
3. **Infrastructure:** IndexedDB repositories, system clock, Temporal adapter, BroadcastChannel, Web Locks adapter, notifications, file download/upload, and preferences.
4. **Presentation:** routes, screens, components, accessibility behavior, responsive layout, and visual tokens.

Presentation calls application use cases. Use cases depend on repository interfaces. IndexedDB implements those interfaces. A future API implementation can replace repositories without changing domain rules or screen contracts.

## B3. Runtime data flow

`User action → application use case → domain validation → single storage transaction → store invalidation/BroadcastChannel → selectors → React render`

Never display a mutation as successful before the transaction commits. The timer display may animate optimistically from a persisted start instant, but authoritative state always comes from persisted timestamps.

---

# C. Data model

The following are contracts, not final source code.

## C1. Commitment

```ts
Commitment {
  id: UUID
  schemaVersion: 1
  name: string
  dailyTargetMs: integer
  durationDays: integer
  reminderTimes: string[]       // immutable HH:mm values
  startDate: ISOPlainDate       // YYYY-MM-DD
  endDate: ISOPlainDate         // inclusive
  timeZone: IANAZone            // captured at creation
  createdAtMs: EpochMilliseconds
}
```

There is no generic update method for this entity. Repository code exposes `create` and `get`, not `updateCoreParameters`.

## C2. Day record

```ts
DayRecord {
  id: UUID
  commitmentId: UUID
  ordinal: integer              // 1..durationDays
  scheduledDate: ISOPlainDate   // immutable
  targetMs: integer             // immutable snapshot of target
  recordedMs: integer           // materialized credited duration, 0..targetMs
  completedAtMs: EpochMilliseconds | null
  completionTiming: "ON_TIME" | "LATE" | null
  finalStatus: "DONE" | "PARTIAL" | "MISSED" | null
  createdAtMs: EpochMilliseconds
  updatedAtMs: EpochMilliseconds
}
```

`recordedMs` is updated only from timer intervals in the same transaction. Sessions remain the audit source. `finalStatus` is set immediately for DONE, and for incomplete records only once the commitment deadline passes. Before finalization, current display state is derived.

## C3. Timer session and intervals

```ts
TimerSession {
  id: UUID
  commitmentId: UUID
  dayRecordId: UUID
  startedAtMs: EpochMilliseconds
  stoppedAtMs: EpochMilliseconds | null
  stopReason: "USER" | "TARGET_REACHED" | "COMMITMENT_ENDED" | null
  intervals: Array<{
    id: UUID
    startedAtMs: EpochMilliseconds
    endedAtMs: EpochMilliseconds | null
  }>
}
```

An interval with a null end is permitted only when the singleton active timer says RUNNING and references that session.

## C4. Global active timer

```ts
ActiveTimer {
  key: "singleton"
  sessionId: UUID
  commitmentId: UUID
  dayRecordId: UUID
  mode: "RUNNING" | "PAUSED"
  revision: integer
  updatedAtMs: EpochMilliseconds
} | null
```

The singleton is the cross-route and cross-tab lock. A paused timer still occupies it. The user must Resume or Stop before timing another record.

## C5. Settings and metadata

```ts
Settings {
  key: "singleton"
  theme: "SYSTEM" | "DARK" | "LIGHT"
  notificationsEnabled: boolean
  soundEnabled: boolean
  vibrationEnabled: boolean
  onboardingCompleted: boolean
}

AppMeta {
  key: "singleton"
  databaseSchemaVersion: integer
  installationId: UUID
  createdAtMs: EpochMilliseconds
  lastOpenedAtMs: EpochMilliseconds
  lastKnownTimeZone: IANAZone
  integrityWarnings: Array<{
    code: string
    observedAtMs: EpochMilliseconds
  }>                              // non-PII, deduplicated, newest 20 only
}
```

No sensitive profile is needed. Do not request name, email, age, or identity.

## C5a. Reminder delivery claim

```ts
ReminderDelivery {
  occurrenceId: string            // commitmentId|scheduledDate|HH:mm
  commitmentId: UUID
  scheduledAtMs: EpochMilliseconds
  state: "CLAIMED" | "DELIVERED" | "FAILED"
  ownerInstallationId: UUID
  leaseExpiresAtMs: EpochMilliseconds
  updatedAtMs: EpochMilliseconds
}
```

A short claim lease coordinates tabs. The claim is acquired atomically before notification work; an expired CLAIMED or FAILED occurrence may be retried by one tab, while DELIVERED is final.

## C6. Derived display status

The canonical base states remain `NOT_STARTED`, `PARTIAL`, `DONE`, and `MISSED`. The user-facing display states are:

- `NOT STARTED`
- `PARTIAL`
- `MISSED`
- `DONE ON TIME`
- `COMPLETED LATE`

DONE plus `completionTiming` yields the two completed display states. Do not store a second contradictory status string.

## C7. Integrity invariants

- Exactly `durationDays` records exist for each commitment.
- Record ordinals are unique and contiguous.
- Record dates are contiguous from start through end.
- Every record target equals the commitment target snapshot.
- Every session references one existing record in the same commitment.
- Intervals are well ordered, have `endedAtMs >= startedAtMs`, do not overlap within or across sessions, and do not globally overlap intervals for any other record; only the active session's last interval can be open.
- For each record, recompute raw duration from **all** referenced sessions in timestamp order. `recordedMs` must exactly equal the resulting credited duration.
- If cumulative raw time reaches target inside an interval, that interval must end at the exact target-crossing instant; no later interval may exist for that record.
- DONE implies `recordedMs === targetMs`; `completedAtMs` must exactly equal the recomputed target-crossing instant; timing and final status must match that instant and scheduled date.
- Non-DONE implies `recordedMs < targetMs` and no completion timestamp/timing.
- Every session's `startedAtMs` equals its first interval start, and a stopped session's `stoppedAtMs` equals its final interval end and has a valid stop reason.
- Scheduled date never changes.
- Completion date is derived from `completedAtMs` in the commitment zone; it is not typed by the user.
- At most one ActiveTimer exists, references the sole valid unfinished session, and is consistent with that session's open/closed interval state.

If integrity validation fails, enter read-only safe mode, preserve data, offer export, and do not silently rewrite history.

---

# D. IndexedDB/local persistence structure

Database name: `the-architect-v1`. Use explicit versioned migrations.

| Store | Key | Important indexes |
|---|---|---|
| `meta` | string key | none |
| `settings` | string key | none |
| `commitments` | commitment ID | `startDate`, `endDate` |
| `dayRecords` | record ID | unique `[commitmentId, ordinal]`, unique `[commitmentId, scheduledDate]`, `scheduledDate` |
| `timerSessions` | session ID | `dayRecordId`, `commitmentId`, `startedAtMs` |
| `activeTimer` | `singleton` | none |
| `reminderDeliveries` | composite reminder occurrence ID | `scheduledAtMs`, `state`, `leaseExpiresAtMs` |
| `recoveryBackups` | backup ID | `createdAtMs` |

LocalStorage may contain only noncritical early-paint hints such as last theme. It is never the source for commitments, sessions, or progress.

## D1. Atomic operations

The following must each be one read-write transaction over every affected store:

- Create commitment + all day records.
- Start timer + create session + open first interval + singleton lock.
- Pause/stop/reconcile + close interval + recompute record credit/status + update/remove singleton.
- Resume + append interval + update singleton revision.
- Automatic target completion.
- End-deadline reconciliation.
- Validated import replacement.
- Full reset.

## D2. Migrations

Each migration is forward-only, deterministic, and idempotence-tested. Coordinate `versionchange` through BroadcastChannel, ask other tabs to close their database connection, and show a blocked-upgrade state until they do.

IndexedDB's upgrade transaction is the atomic rollback boundary for schema changes: if a migration throws, the old database version remains intact. For any post-open transformation that could discard or reinterpret fields, first create a complete versioned snapshot in `recoveryBackups`; if quota cannot hold it, abort before transforming. Never infer or overwrite historical scheduled dates. If migration or backup fails, open the existing data in read-only safe mode with export rather than partially starting the app. Prune only superseded successful backups after a later verified launch; retain the newest recovery backup.

## D3. Capacity

Duration is capped at 3,650 days. Records are pre-created because it makes the permanent schedule explicit and keeps day IDs stable. Sessions are loaded by indexed record/commitment queries, never by reading the whole database on every timer tick.

---

# E. Timer algorithm

## E1. Clock model

Inject a `Clock` interface with `nowInstant()` for testability. Persist UTC epoch milliseconds from real wall-clock instants. Use `performance.now()` only to make an already-open screen animate smoothly; never persist or calculate cross-refresh truth from it.

A timer tick is a rendering convenience, not a source of elapsed duration.

## E2. Core calculations

Aggregate every session belonging to the selected record, not just the current session:

```text
closedRawMs = sum(end - start for every valid closed interval across all record sessions)
liveRawMs   = RUNNING ? max(0, now - openInterval.start) : 0
rawElapsed  = closedRawMs + liveRawMs
creditedMs  = min(targetMs, floor(rawElapsed / 1000) * 1000)
remainingRawMsBeforeOpen = max(0, targetMs - closedRawMs)
targetCapMs = openInterval.start + remainingRawMsBeforeOpen
effectiveCapMs = min(targetCapMs, deadlineInstantMs)
```

When `now >= effectiveCapMs`, close the interval at the mathematical cap, not at the delayed tick's `now`. If `targetCapMs <= deadlineInstantMs`, target completion wins, including equality. Otherwise deadline closure wins. This guarantees no bonus time after sleep, throttling, or reload.

Never persist an interval end earlier than its start. If the device clock regresses behind an open interval start, Pause/Stop may close it at its start (zero new duration) so the user is not trapped; Resume/Start is blocked until device time is at least the latest persisted timestamp. Show the clock warning from F4.

## E3. START

1. Reconcile any existing singleton timer.
2. Validate that no timer remains running or paused.
3. Validate selected record exists, is not DONE, is not future, is recoverable or today, `now < deadlineInstant`, and `now` is not behind the latest persisted timer timestamp.
4. In one transaction create a session, create its open interval at `now`, and create ActiveTimer revision 1.
5. Broadcast committed state.

Starting a stopped partial record creates a new session. Session history remains visible.

## E4. PAUSE

1. Re-read the singleton and session inside the transaction.
2. Calculate `targetCapInstant` from all prior record sessions and the open interval, plus the single `deadlineInstant` from I1.
3. Effective end is the earliest of `max(now, openInterval.startedAtMs)`, target cap, and deadline. Equality follows I1: target wins when target cap equals deadline.
4. Close the open interval at effective end.
5. Recompute raw and credited duration.
6. If target reached, complete and remove singleton with reason TARGET_REACHED.
7. Else if deadline reached, stop and remove singleton with reason COMMITMENT_ENDED.
8. Else mark singleton PAUSED and increment revision.

## E5. RESUME

Validate the same paused singleton/revision, record eligibility, `now < deadlineInstant`, and `now >= latestPersistedTimerTimestamp`. Append a new open interval at `now`, mark RUNNING, increment revision, and commit atomically.

## E6. STOP

Use the same effective-end reconciliation as Pause, then close the session, store USER unless target/deadline takes precedence, recompute the record, and remove the singleton. A partial record remains available for a later new session.

## E7. Automatic completion

While visible, schedule the next UI update and a timeout for `effectiveCapMs`, but never trust timeout punctuality. On timeout, visibility change, page show, route change, any timer command, BroadcastChannel message, or app bootstrap, run reconciliation.

At target completion:

- close at mathematically exact `targetCapMs` (which must be `<= deadlineInstantMs`);
- set `recordedMs = targetMs`;
- set `completedAtMs = targetCapMs`;
- calculate ON_TIME/LATE from that instant in the commitment zone;
- set final status DONE;
- close session with TARGET_REACHED;
- remove ActiveTimer;
- prevent every later interval for that record;
- show a restrained completion state, optional sound/vibration if enabled, and no reward animation.

## E8. Exact percentage and boundary display

Domain status uses duration, never formatted text.

```text
ratio = creditedMs / targetMs
if DONE: 100.0%
else: min(round(ratio * 1000) / 10, 99.9%)
```

The incomplete clamp prevents a misleading rounded 100.0%.

For a 2-hour target (`7,200,000 ms`):

| Credited | Display | State |
|---|---:|---|
| 0:00 | 0% | MISSED only after date passes; otherwise NOT STARTED |
| 0:01 | 0.0% (or `<0.1%`) | PARTIAL |
| 1:59:00 | 99.2% | PARTIAL |
| 1:59:59 | 99.9% | PARTIAL |
| 1:59:59.999 raw | 99.9% | PARTIAL |
| 2:00:00 | 100% | DONE; timer stopped |
| Any later observed clock | 100% | DONE; stored end still exactly at cap |

Timer text floors current raw elapsed to whole seconds and uses stable `H:MM:SS` digits. Sub-second fragments are retained in session intervals and accumulate, but official credited progress is whole-second precise.

---

# F. Timer persistence and recovery

## F1. Bootstrap reconciliation

Before rendering actionable controls:

1. Open/migrate IndexedDB.
2. Read ActiveTimer and referenced session, record, and commitment.
3. Validate referential integrity.
4. If RUNNING, derive elapsed from persisted open interval and current instant.
5. If target or deadline was crossed while closed, finalize at the earlier exact cap.
6. If still valid, continue displaying RUNNING without creating a new interval.
7. If PAUSED, restore PAUSED exactly; closed time does not count.
8. Reconcile due/missed records and reminder state.
9. Then render routes.

## F2. Refresh, close, sleep, and background

- Refresh/reopen: running duration equals `now - persisted startedAt`, capped.
- Sleep: real elapsed time counts because the requirement says real timestamps. On wake, reconciliation caps at target/deadline.
- Tab switch/background: no dependency on animation frames or interval tick count.
- Paused app: no elapsed duration accumulates.
- Browser crash between attempted writes: IndexedDB transaction is all-or-nothing.

## F3. Multiple tabs

Use three layers:

1. IndexedDB ActiveTimer singleton as authority.
2. Transactional revision compare-and-swap around commands.
3. BroadcastChannel to invalidate and update other tabs promptly.

Use Web Locks around timer commands where supported as an additional coordinator, not as the source of truth. If two tabs race, only one transaction/revision wins; the other reloads state and explains that the timer changed in another tab. Never create two active intervals.

## F4. System clock limitations

A local-only web app cannot prove that the user did not change the system clock. Detect backward jumps relative to the last observed wall clock during one runtime, show `System time changed; timer was reconciled from device timestamps`, apply E2's safe command rules, and never create negative duration. Add a deduplicated `CLOCK_REGRESSION` warning to the bounded non-PII AppMeta list and export metadata. Do not silently invent elapsed time or claim tamper resistance without a server.

---

# G. Daily-state logic

Evaluate in this order using the record's commitment time zone:

```text
if creditedMs >= targetMs:
  baseStatus = DONE
  display = completion date == scheduled date
    ? DONE ON TIME
    : COMPLETED LATE
else if creditedMs > 0:
  baseStatus = PARTIAL
else if scheduledDate < zonedToday:
  baseStatus = MISSED
else:
  baseStatus = NOT_STARTED
```

Additional rules:

- A future zero-time record is stored as a record but displayed as UPCOMING/neutral in calendars; its canonical base state remains NOT_STARTED.
- Today at zero is NOT STARTED, never MISSED before midnight.
- At midnight, zero becomes MISSED and nonzero incomplete remains PARTIAL.
- PARTIAL applies both today and after the scheduled date.
- DONE never reverts.
- At commitment deadline, PARTIAL/MISSED are finalized.
- `completedAtMs` is the target-crossing instant, not the user's later page-open time.
- Calendar symbols always pair with accessible labels: `✓ Done on time`, `✓ Late` with amber treatment, `~ Partial`, `× Missed`, neutral dot Upcoming/Not started.

---

# H. Late-recovery algorithm

## H1. Eligibility

A record is recoverable only if all are true:

- scheduled date is before commitment-zoned today;
- state is PARTIAL or MISSED;
- target has not been reached;
- current instant is strictly before `deadlineInstant` (the exclusive start of the day after endDate);
- commitment is still ACTIVE.

Today is normal execution, not late recovery. Future records are ineligible.

## H2. Recovery flow

1. User opens an overdue day detail or selects `Recover` from a clear overdue context.
2. Screen keeps original scheduled date prominent and shows target, existing credited time, remaining time, and final recovery deadline.
3. User chooses `COMPLETE DAY 08`/`CONTINUE DAY 08`.
4. If another timer is running or paused, require Resume/Stop there; do not switch silently.
5. Start a timer explicitly linked to that original record.
6. New time adds to its existing sessions only.
7. If still incomplete, state is PARTIAL, including a formerly zero-time MISSED record after it receives at least one credited second.
8. At exact target, set DONE and LATE, with actual completion date derived from completion instant.

Example result:

```text
DAY 08 — COMPLETED LATE
Scheduled: 8 September
Completed: 12 September
Target: 2:00:00
Recorded: 2:00:00
```

Never change Day 08 to 12 September, never mark 12 September's own record as done, and never allocate time automatically to oldest debt.

## H3. Deadline behavior

Recovery may start/resume only while `now < deadlineInstant`. A running recovery interval may continue only until that exclusive boundary and closes exactly at equality. If `targetCapInstant <= deadlineInstant`, mark DONE; otherwise finalize PARTIAL, or MISSED if credited duration is zero. No Resume/Start is offered at or after the boundary.

---

# I. Date and midnight handling

## I1. Date types and exact deadline

- Session timestamps: `Temporal.Instant` / epoch milliseconds.
- Scheduled dates: `Temporal.PlainDate` serialized as `YYYY-MM-DD`.
- Deadlines/reminders: `Temporal.ZonedDateTime` in the commitment's captured IANA zone.
- Never use `new Date("YYYY-MM-DD")` for local schedule math.

Define one exclusive commitment boundary everywhere:

```text
deadlineInstant = start of (endDate + 1 calendar day) in commitment.timeZone
```

Construct it with Temporal's `compatible` disambiguation, then convert to Instant. Start/Resume requires `now < deadlineInstant`. A running interval closes when it reaches equality. If `targetCapInstant <= deadlineInstant`, target completion wins and the record is DONE; otherwise close at deadline and finalize incomplete. No code may separately manufacture `23:59:59.999`, which would introduce precision gaps.

## I2. Captured time zone policy

A commitment stays anchored to the IANA time zone captured at creation. Traveling or changing device zone must not silently move historical deadlines. New commitments use the current zone. If app zone differs from an active commitment zone, show a small factual note where deadlines could be confusing, e.g. `Schedule uses America/New_York`.

Actual completion date is also derived in the commitment zone, ensuring on-time/late rules remain stable.

## I3. Midnight reconciliation

Compute the next zoned midnight and schedule a wake-up only as a convenience. Also reconcile on startup, `visibilitychange`, `pageshow`, and timer actions because background scheduling may be throttled.

At midnight:

- yesterday's zero record becomes MISSED;
- yesterday's incomplete nonzero record remains PARTIAL and becomes recoverable;
- a running timer stays attached to yesterday;
- today's separate record becomes actionable;
- Today re-sorts;
- notification schedule is rebuilt.

If the old timer reaches target after midnight, it completes late. It never spills into today's record.

## I4. DST and unusual days

Target duration is absolute elapsed time, not wall-clock duration, so a 2-hour timer requires 7,200,000 raw milliseconds even on DST transitions. Day boundaries use the captured zone. If a reminder local time does not exist during spring-forward, Temporal's compatible disambiguation moves it forward by the gap. If a time repeats during fall-back, deliver once using a deterministic earlier occurrence and the reminder occurrence ID prevents duplicates.

Creation just before midnight is valid; Day 1 has only the remaining real time before its on-time deadline. The UI confirms the date before starting but does not alter the commitment.

---

# J. Multiple-commitment handling

Any number within storage capacity may be active. There is no priority field and no drag ordering.

## J1. Today ordering

Each active commitment appears once and is assigned to the first matching group:

1. **Needs attention:** owns the global running/paused timer, or has recoverable overdue records.
2. **Partial:** today's record has credited time but is incomplete.
3. **Not started:** today's record has zero time.
4. **Completed:** today's record is DONE.

Within Needs attention: running, then paused, then oldest recoverable scheduled date. Remaining ties use commitment creation time then name for deterministic rendering. This is state-based sorting, not user priority.

A card with overdue debt still shows today's progress separately and states how many prior days are recoverable. Recovery selection never happens implicitly from the card.

## J2. Timer exclusivity

Only one record across all commitments can be RUNNING or PAUSED. Other cards remain readable but their Start buttons explain which timer must be resumed/stopped. This prevents double-counting real time.

## J3. Progress isolation

Each commitment's records and percentages are computed independently. Overall progress aggregates records, not concurrent wall-clock time. A recovered old day and today's day remain two distinct records.

---

# K. Notification architecture

## K1. Capability levels

1. **In-app reminder:** reliable while the app is open; show a blueprint-style banner/toast at the reminder time.
2. **System browser notification:** use the Notification API when permission is granted and an open/background page runtime can execute. Do not add a service worker or push backend solely to imply local closed-process scheduling in V1.
3. **Fully closed browser:** not guaranteed in a backend-free V1. Reliable closed-process scheduling generally needs Web Push/backend or platform-specific APIs. State this in Settings; do not claim otherwise.

## K2. Permission flow

Do not request permission on first load. In Settings or after the user adds reminders, explain the benefit and request only after a user click. States: unsupported, default/not requested, granted, denied. If denied, retain original reminder times and continue in-app reminders while open.

## K3. Scheduling rules

- Interpret immutable `HH:mm` in commitment zone for today's active scheduled record.
- Suppress reminders for a day already DONE. V1 sends **no recovery reminders**; overdue work is surfaced in Today instead.
- Use deterministic occurrence key `[commitmentId, scheduledDate, HH:mm]` in `reminderDeliveries`.
- Before invoking in-app/system notification work, atomically insert or acquire a CLAIMED occurrence with a short lease. Only the claim owner may deliver. On success mark DELIVERED; on recoverable API failure mark FAILED. Another tab may retry only FAILED or an expired claim. Web Locks/BroadcastChannel improve coordination but are not the dedupe authority.
- Reconcile the record after claiming and immediately before delivery; if it became DONE, mark the occurrence DELIVERED/SUPPRESSED without notifying.
- Do not replay many stale system notifications after reopening. Show one in-app summary that reminders were missed while closed.
- Clicking a notification opens/focuses `/today` and the relevant commitment card; it never starts a timer.

## K4. Sound and vibration

Only use after user interaction and when enabled. Respect browser support, page visibility, OS silent modes, and reduced-motion/user preferences. Failure is nonfatal. Use short restrained cues for reminder and exact completion; no celebratory reward effects.

---

# L. Routing

| Route | Purpose |
|---|---|
| `/` | Redirect to onboarding first run, otherwise `/today` |
| `/welcome` | First-run three-panel orientation; after completion direct visits redirect to Today |
| `/today` | Primary action screen |
| `/timer/:recordId` | Focused running/paused/completed timer view |
| `/commitments` | Active list and separate ended list |
| `/commitments/new` | Simple create flow |
| `/commitments/:commitmentId` | Commitment overview/timeline |
| `/commitments/:commitmentId/calendar` | Full calendar |
| `/commitments/:commitmentId/days/:recordId` | Permanent day detail/recovery |
| `/progress` | Meaningful overall progress |
| `/progress/:commitmentId` | Per-commitment progress |
| `/settings` | Appearance, notifications, sound/vibration, About |
| `/settings/data` | Export, import, reset |
| `*` | Branded not-found screen with Return to Today |

Use IDs, not mutable names or dates, as route identity. Validate every parameter and render a route-level not-found state without crashing.

---

# M. Page structure and behavior

## M1. First run

Use the reference's restrained sequence: `A SYSTEM FOR A BETTER YOU`, `YOUR TIME. YOUR RULES.`, `SMALL STEPS. BIG RESULTS.` with architectural line drawings and concise factual copy. It is shown on first run, may be skipped with a clearly labeled Skip action, and finishes with `GET STARTED`. Both actions set `onboardingCompleted`; later direct navigation to `/welcome` redirects to `/today`. No login, personalization survey, replay feature, or marketing carousel.

## M2. Today

Required content:

- Current date and `TODAY` heading.
- Active commitment cards ordered by section J.
- Today's exact elapsed/target and percentage.
- Timer mode and Start/Continue/Resume controls.
- Recoverable-day indicator where relevant.
- Completed section/state.
- Summary such as `2 / 4 completed` without points or praise scoring.
- Empty state with architectural folder/structure line art and `+ NEW COMMITMENT`.

Desktop main column holds actionable cards; context rail shows the global timer, today's factual summary, and nearest reminder/recovery deadline. Mobile cards match the supplied board's compact layout and bottom navigation.

## M3. Focused timer

Show commitment name, selected scheduled date (and `RECOVERY — DAY 08` when applicable), large ring, stable elapsed/target, percentage/state, Pause/Resume and Stop. If paused, ring and label clearly say PAUSED. At completion show check, `DAILY TARGET COMPLETED`, exact target/target, and `VIEW PROGRESS`; no bonus time and no restart.

Closing/navigating away does not stop it. A persistent mini-timer appears in shell/context on other routes.

## M4. Commitments

Heading `MY COMMITMENTS`, Active and Ended tabs/sections, plus `+ NEW COMMITMENT`. Each active card shows name, daily target, days remaining, and overall completed-days progress. `days remaining` includes today when today is within range and returns 0 after end. Ended cards show COMPLETE or INCOMPLETE outcome and remain inspectable.

## M5. New commitment

Keep only the four inputs. Mobile may use the reference's two compact steps (definition, then reminders); desktop may place them in one focused panel. The final action is `START COMMITMENT`, not Save Draft. Show an explicit immutable-plan confirmation near the action. There is no edit route.

## M6. Commitment detail

Show name, start date, end date, daily target, `completed days / total days`, and **plan completion** (`all DONE records / durationDays`). This metric answers how much of the fixed plan is fulfilled and includes future days in its denominator. Provide a compact recent timeline plus `VIEW CALENDAR` and `VIEW PROGRESS`. Parameters are visibly fixed; do not show edit/delete menus.

## M7. Calendar/timeline

Month navigation is constrained to months intersecting the commitment. Every scheduled day has symbol, color, and accessible status text. Future days are neutral. Selecting a scheduled day opens its permanent record. Non-scheduled calendar dates are inert. A legend distinguishes on-time, late, partial, missed, and upcoming.

## M8. Day detail

Always show Day ordinal, original scheduled date, target, credited time, display status, session list, and actual completion date if DONE late (also safe to show for on-time). When eligible, show remaining time, final recovery deadline, and `COMPLETE/CONTINUE DAY NN`. If ended, explain that recovery window closed. Never present editable fields.

## M9. Progress

Use two explicitly named metrics; never label them interchangeably:

- **Plan completion** (commitment detail): all DONE records divided by all fixed duration records.
- **Historical consistency** (Progress): DONE past records divided by all past records, where `scheduledDate < zonedToday`. Today is intentionally excluded because it is still open and is shown live on Today. Future records are excluded.

The Progress primary statement follows the requested form: `42 / 57 DAYS COMPLETED — 73.7%`, where 42 is DONE among the same 57 past records. The breakdown contains ON TIME, LATE, PARTIAL, and MISSED; these four counts sum exactly to 57, and ON TIME + LATE equals 42. Scope is explicit (`ALL COMMITMENTS` or selected commitment). With no past records, show `NO CLOSED DAYS YET`, not `0 / 0` or NaN.

Useful visuals only:

- historical-consistency progress ring;
- status composition bar with counts and labels;
- calendar/timeline;
- compact recent closed-day status bars if they communicate consistency.

Today never appears to regress because it is absent from this closed-day metric; it joins on the next zoned date. Do not add arbitrary productivity scores, predictive insights, streaks, heatmap competition, time-of-day analysis, or generated advice. Per-commitment progress uses the same named definitions and its commitment zone; the all-commitments view evaluates each record against its own commitment-zone today.

## M10. Settings

- Appearance: System, Dark, Light.
- Notifications: capability/status, enabled toggle, permission action, honest limitation copy.
- Sound and vibration where supported.
- Data: Export JSON, Import JSON, Reset All Data.
- About: product name, tagline, version, philosophy, privacy statement (`Data stays in this browser unless exported`).

---

# N. Component hierarchy

```text
App
├─ BootstrapGate
├─ AppErrorBoundary
├─ AppShell
│  ├─ DesktopSidebar / MobileBottomNav
│  ├─ MainWorkspace (route outlet)
│  ├─ ContextRail / ContextDrawer
│  ├─ GlobalMiniTimer
│  ├─ ReminderHost
│  ├─ ToastRegion
│  └─ ModalHost
└─ Routes
   ├─ WelcomePage
   ├─ TodayPage
   │  ├─ DateHeader
   │  ├─ TodaySummary
   │  ├─ CommitmentStateGroup
   │  │  └─ CommitmentTodayCard
   │  │     ├─ StatusMark
   │  │     ├─ ProgressBar
   │  │     ├─ TimerAction
   │  │     └─ RecoveryIndicator
   │  └─ EmptyState
   ├─ TimerPage
   │  ├─ TimerRing
   │  ├─ TimeReadout
   │  └─ TimerControls
   ├─ CommitmentsPage
   │  ├─ SegmentedFilter
   │  └─ CommitmentCard
   ├─ NewCommitmentPage
   │  ├─ CommitmentDefinitionForm
   │  ├─ ReminderTimeList
   │  └─ ImmutablePlanNotice
   ├─ CommitmentDetailPage
   │  ├─ CommitmentFacts
   │  ├─ CompletionSummary
   │  └─ RecordTimeline
   ├─ CalendarPage
   │  ├─ MonthNavigator
   │  ├─ StatusLegend
   │  └─ CalendarGrid
   ├─ DayDetailPage
   │  ├─ DayFacts
   │  ├─ SessionList
   │  └─ RecoveryPanel
   ├─ ProgressPage
   │  ├─ ScopeSelector
   │  ├─ ProgressRing
   │  ├─ StatusComposition
   │  └─ StatusTimeline
   └─ Settings/DataPages
      ├─ SettingsSection/Row
      ├─ CapabilityNotice
      ├─ ImportPreviewDialog
      └─ DestructiveConfirmDialog
```

Primitives: Button, IconButton, Input, Select, Switch, Card/BlueprintPanel, Divider, StatusBadge, ProgressBar, Ring, Dialog, Toast, Tooltip, VisuallyHidden, Skeleton, and InlineError. Keep business logic out of visual primitives.

---

# O. State-management strategy

## O1. State categories

- **Persistent domain state:** repositories in IndexedDB.
- **Derived domain state:** pure selectors for status, progress, eligibility, ordering, and remaining time.
- **Ephemeral UI state:** local React state for open dialogs, form drafts, and selected progress scope.
- **Global runtime state:** a small application store implemented with `useSyncExternalStore`, holding bootstrap status, current repository snapshot revisions, notification capability, and active timer view.
- **URL state:** selected commitment/record and progress scope when shareable/deep-linkable locally.

Do not duplicate entire IndexedDB tables in Context. Query narrowly through repositories, cache route snapshots, and invalidate by entity/store revision after commits. Use React Context only to supply stable services/store references.

## O2. Timer engine

Create one singleton `TimerEngine` service outside component trees. It owns reconciliation triggers and publishes a view model. Components never create competing `setInterval` sources. The engine is recreated safely on hot reload/development and disposed on app teardown.

## O3. Selectors

Pure, heavily tested selectors include:

- `deriveDayStatus(record, commitment, now)`
- `deriveCommitmentLifecycle(commitment, records, now)`
- `isRecoveryEligible(record, commitment, now)`
- `calculateTimerSnapshot(session, record, commitment, now)`
- `calculateProgress(records, scope, now)`
- `sortTodayCommitments(viewModels)`
- `getNextReminder(commitments, records, now)`

---

# P. Folder structure

```text
/
├─ public/
│  └─ icons/                         # app/static icons only
├─ src/
│  ├─ app/
│  │  ├─ App.tsx
│  │  ├─ router.tsx
│  │  ├─ bootstrap.ts
│  │  ├─ providers.tsx
│  │  └─ error-boundaries.tsx
│  ├─ domain/
│  │  ├─ commitments/
│  │  │  ├─ commitment.ts
│  │  │  ├─ day-record.ts
│  │  │  ├─ status.ts
│  │  │  └─ progress.ts
│  │  ├─ timer/
│  │  │  ├─ timer-session.ts
│  │  │  ├─ calculations.ts
│  │  │  └─ invariants.ts
│  │  └─ time/
│  │     ├─ clock.ts
│  │     ├─ calendar.ts
│  │     └─ timezone.ts
│  ├─ application/
│  │  ├─ commitments/
│  │  ├─ timer/
│  │  ├─ reminders/
│  │  ├─ data-transfer/
│  │  └─ reconciliation/
│  ├─ infrastructure/
│  │  ├─ db/
│  │  │  ├─ database.ts
│  │  │  ├─ schema.ts
│  │  │  ├─ migrations/
│  │  │  └─ repositories/
│  │  ├─ browser/
│  │  │  ├─ clock.ts
│  │  │  ├─ notifications.ts
│  │  │  ├─ broadcast.ts
│  │  │  ├─ locks.ts
│  │  │  └─ files.ts
│  │  └─ validation/
│  │     └─ import-schema.ts
│  ├─ features/
│  │  ├─ onboarding/
│  │  ├─ today/
│  │  ├─ timer/
│  │  ├─ commitments/
│  │  ├─ calendar/
│  │  ├─ progress/
│  │  └─ settings/
│  ├─ components/
│  │  ├─ primitives/
│  │  ├─ status/
│  │  ├─ progress/
│  │  └─ layout/
│  ├─ state/
│  │  ├─ app-store.ts
│  │  ├─ timer-engine.ts
│  │  └─ selectors.ts
│  ├─ styles/
│  │  ├─ tokens.css
│  │  ├─ themes.css
│  │  ├─ reset.css
│  │  ├─ typography.css
│  │  ├─ blueprint.css
│  │  └─ global.css
│  ├─ test/
│  │  ├─ factories.ts
│  │  ├─ fake-clock.ts
│  │  └─ setup.ts
│  └─ main.tsx
├─ e2e/
├─ index.html
├─ package.json
├─ tsconfig.json
└─ vite.config.ts
```

Tests live beside pure modules where practical, with cross-feature E2E tests in `/e2e`.

---

# Q. Design-system structure

## Q1. Reference analysis

The supplied image is one board containing 24 related mobile screens. It establishes:

- dark navy-black as primary environment and warm ivory drafting-paper as alternate light mode;
- subtle orthogonal blueprint grids and construction guides;
- fine cyan/blue-gray technical strokes, architectural wireframes, roof/building/folder motifs;
- a high-contrast, narrow serif uppercase brand wordmark;
- condensed/tracked uppercase labels and compact sans-serif body/data typography;
- circular timer/progress rings, thin segmented bars, calendars, compact rows, and sparse factual charts;
- very small corner radii, 1px outlines, restrained shadows, dense disciplined spacing;
- cyan/blue for action/progress, mint for done/on-time, amber for late/partial, coral for missed, gray for inactive;
- calm, exact, purposeful, private mood—never playful, bubbly, neon-gaming, or motivational-poster styled.

All screens must feel like extensions of that system. Do not introduce glassmorphism, oversized rounded cards, gradients unrelated to ring progress, mascot art, photographic backgrounds, or generic colorful dashboard styling.

## Q2. Starting color tokens

These are implementation starting points visually estimated from the one reference; tune by screenshot comparison while preserving roles and accessible contrast.

```text
Dark:
--canvas:          #071319
--canvas-deep:     #041015
--surface:         #0B1B22
--surface-raised:  #10242C
--line:            #29414B
--line-strong:     #47636E
--text:            #F0F2EE
--text-muted:      #8FA4AC
--grid:            rgba(111, 169, 188, 0.08)

Light:
--canvas:          #F2EFE5
--surface:         #FAF7ED
--surface-raised:  #FFFFFF
--line:            #B9C2BD
--line-strong:     #788B8D
--text:            #14242A
--text-muted:      #637276
--grid:            rgba(55, 107, 120, 0.10)

Semantic:
--action:          #39B7EE
--done:            #53D6A5
--late:            #F1B44C
--partial:         #F1B44C
--missed:          #EF6457
--inactive:        #6F8188
--focus:           #69CCF5
```

Never rely on these colors alone. Every status also has text and symbol/shape.

## Q3. Typography

- Brand/display: a self-hosted licensed high-contrast serif resembling the reference (for example Cormorant Garamond), uppercase, wide tracking; use only for THE ARCHITECT and occasional major statement.
- UI headings/labels: a licensed condensed sans resembling the reference (for example Barlow Condensed), uppercase with restrained tracking.
- Body/data: compact highly legible sans (Inter/Inter Tight or system fallback).
- Timer and statistics: tabular numerals via `font-variant-numeric: tabular-nums`.
- Do not render paragraphs in all caps. Preserve readability.

Suggested scale: 12 labels, 14 body, 16 emphasized body, 20 section, 28 page, responsive 48–64 timer, and restrained 32–44 brand. Verify at 200% zoom.

## Q4. Spacing and geometry

Use a 4px base rhythm: 4, 8, 12, 16, 24, 32, 48, 64. Card padding 16–24. Major desktop gaps 24–32. Borders 1px. Radii 3–6px, with circles only for rings/status points/icon buttons. Minimum interactive target 44×44px even when visible glyph is smaller.

Blueprint background uses two repeating linear gradients at a subtle opacity and never reduces text contrast. Architectural corner ticks/guide lines may frame major panels, but decorative density must remain lower than the reference board's presentation background.

## Q5. Status language

| State | Color | Symbol | Text |
|---|---|---|---|
| Done on time | Mint | ✓ | DONE ON TIME |
| Completed late | Amber | ✓ plus late marker | COMPLETED LATE |
| Partial | Amber | ~ | PARTIAL |
| Missed | Coral | × | MISSED |
| Not started | Muted gray/cyan outline | • | NOT STARTED |
| Running | Cyan animated arc | pause glyph available | RUNNING |
| Paused | Gray/cyan static arc | pause bars | PAUSED |

Use exact, nonjudgmental microcopy. Avoid `failed`, guilt language, inspirational AI-like prose, confetti, and reward language.

## Q6. Motion and illustration

Motion is functional: ring progression, 120–180ms control transitions, drawer/dialog movement, and subtle current-timer pulse. Respect `prefers-reduced-motion`; timer data still updates without continuous animation. Completion transitions to a stable mint ring/check without confetti.

Create original simple SVG line drawings using the visible architectural vocabulary—wireframe buildings, roof planes, plan lines, folder outline. Do not search for or assume unseen assets.

---

# R. Responsive strategy

## R1. Desktop (≥1280px)

Use `SIDEBAR | MAIN WORKSPACE | CONTEXT AREA`:

- Sidebar: approximately 224–248px, brand, primary navigation, theme/status footer.
- Main: fluid `minmax(0, 1fr)`, useful maximum reading width around 920–1040px but allow calendar/progress to expand.
- Context: approximately 300–360px for mini timer, today's summary, selected record facts, or next reminder.

Use available width for side-by-side factual panels, not giant mobile cards stretched across the screen. Calendar displays a complete readable month. Today may use two card columns only when scanning order and state groups remain unambiguous.

## R2. Tablet (768–1279px)

Collapse sidebar to a 72px icon rail or compact top navigation. Context area becomes a drawer or an inline panel beneath the page header. Main remains one/two columns based on available width.

## R3. Mobile (<768px)

Match the board's compact single-column screens. Use a four-item bottom bar: Today, Commitments, Progress, Settings. Account for safe-area insets. Focused timer can be full screen. Sticky primary actions are allowed but must not cover record content. Forms use native-friendly controls and do not trigger horizontal zoom.

At 320px width, no horizontal page scrolling. At landscape/mobile keyboard, primary actions remain reachable. At 200% browser zoom desktop layout may collapse naturally rather than overlap.

---

# S. Accessibility

Target WCAG 2.2 AA.

- Semantic `header`, `nav`, `main`, `aside`, lists, tables only for tabular data, and real buttons/links/forms.
- Provide a first-focusable `Skip to main content` link in AppShell.
- On client-side route changes, set a meaningful document title and move focus to the page H1/main start unless navigation came from an interaction whose logical focus target persists.
- One logical H1 per page; headings do not skip levels.
- Every control has a visible label. Error messages identify field and resolution and are programmatically associated.
- Full keyboard operation, visible focus, predictable tab order, Escape/return-focus dialog behavior, and no keyboard trap.
- Status is always symbol + words + color. Progress rings expose text values, not raw SVG only.
- Timer controls announce state changes. Do not announce every second; use a polite live region for Start/Pause/Resume/Stop/completion and optionally minute milestones.
- Timer digits use tabular numerals and do not cause layout shift.
- Contrast: 4.5:1 normal text, 3:1 large text and meaningful UI boundaries. Check both themes and status combinations.
- Touch target minimum 44px; adequate spacing prevents accidental Stop.
- Destructive confirmation is explicit and not color-only.
- Respect reduced motion, increased contrast where practical, browser text resizing, screen readers, and forced-colors mode.
- Calendar supports arrow-key grid navigation plus a list/timeline alternative.
- Charts have adjacent counts and a screen-reader summary.
- Sound/vibration never carries information that is absent visually.

---

# T. Error handling

## T1. Error categories

- **Validation:** inline, preserve form values, focus first invalid field.
- **Expected capability:** notifications denied/unsupported, vibration absent, download blocked; show explanation and fallback without alarming global errors.
- **Storage mutation failure/quota:** keep prior committed UI state, stop claiming success, offer Retry and Export Existing Data.
- **Integrity/corruption:** enter read-only safe mode, show affected scope, offer raw/versioned export, do not auto-repair history.
- **Route/not found:** branded local not-found state and return path.
- **Unexpected render error:** route/app error boundary with Retry and Return to Today; timer engine continues/reconciles independently if storage remains sound.
- **Cross-tab conflict:** reload authoritative state and say `Timer changed in another tab`.

## T2. Timer command failure

If Start transaction fails, no running UI begins. If Pause/Stop write fails, the persisted open interval remains authoritative and the UI clearly says the command was not saved; immediately retry/reconcile. Never close only the visual timer. At target, reconciliation retries an idempotent completion transaction.

## T3. Diagnostics

Development builds may log structured errors. Production keeps minimal non-PII local diagnostics (error type, schema version, browser capability, timestamp) and never transmits data because V1 has no backend. About may expose version and database schema for support.

---

# U. Export, import, and reset

## U1. JSON export

Export one UTF-8 JSON file named like `the-architect-export-2026-09-16T143000Z.json`.

Envelope:

```json
{
  "format": "the-architect",
  "formatVersion": 1,
  "exportedAt": "instant",
  "appVersion": "string",
  "sourceTimeZone": "IANA zone",
  "warnings": [],
  "data": {
    "settings": {},
    "commitments": [],
    "dayRecords": [],
    "timerSessions": [],
    "activeTimer": null
  },
  "integrity": {
    "algorithm": "SHA-256",
    "canonicalization": "RFC-8785-JCS",
    "digest": "digest of canonical data payload"
  }
}
```

Take an atomic read transaction snapshot. The SHA-256 digest is required and covers the UTF-8 RFC 8785 JSON Canonicalization Scheme representation of `data`; it detects accidental corruption, **not authorship or tampering**, because a user can edit JSON and calculate a new digest. Import is supported only for trusted app-generated exports; this local app does not claim forensic provenance.

Sanitize timer state in the exported copy:

- If live state is RUNNING, close its copied open interval at the earliest of `exportedAt`, exact target cap, and deadline.
- If that copied instant reaches target/deadline, finalize the copied record/session and export `activeTimer: null`.
- Otherwise leave the copied session unfinished with all intervals closed and export a consistent `activeTimer` in PAUSED mode referencing it.
- If live state is already PAUSED and still eligible, export its consistent PAUSED singleton; if no timer exists, export null.

The live app timer is not changed. This prevents transfer/storage time from counting after import.

Do not export transient toasts, reminder delivery claims/logs, recovery backups, or browser permission state. Export the bounded integrity-warning metadata, immutable reminder times, and notification-enabled preference, but actual permission must be requested again on the destination.

## U2. Import

V1 supports **validated Replace All**, not merge. Merge semantics could duplicate or silently rewrite immutable history.

1. User selects a JSON file.
2. Parse defensively with file-size and JSON errors handled.
3. Validate envelope/version with Zod and require/verify the RFC-8785 SHA-256 digest.
4. Recompute every DayRecord from all session intervals; require exact equality for credit, completion instant/timing, and final fields. Validate interval/session containment, global non-overlap, referential integrity, one valid optional PAUSED active timer, and every invariant in C7. An edited file that does not remain internally valid is rejected; import remains data portability, not proof of provenance.
5. Show preview: commitment count, record count, session count, export date, warning count, and replacement warning.
6. Require explicit confirmation.
7. Before replacement, create a complete rollback snapshot in `recoveryBackups`; if quota or backup write fails, abort without changing current data.
8. Complete all parsing, derivation, and synchronous validation before mutation. Then replace all imported domain stores and set an import operation marker in one transaction. A transaction failure automatically leaves the prior domain data intact.
9. Restore an imported active timer only as PAUSED, with no open interval, and require explicit Resume. Never import RUNNING state.
10. On the next read in the same use case, verify the committed snapshot and clear the operation marker. If this impossible-state check fails, enter safe mode and offer explicit restoration from the backup in a second transaction; if restoration fails, keep both backup and current raw data exportable.
11. Keep the newest successful pre-import backup until one later verified app launch, then it may be pruned.
12. Move focus to the imported-data summary heading and announce completion; after Reset, move focus to the first-run heading.

Do not partially import. Do not accept foreign newer versions without a supported migration. Do not provide CSV because it cannot faithfully round-trip timer sessions and immutable relationships; JSON is the V1 source-of-truth export.

## U3. Reset

`RESET ALL DATA` clears every durable app-owned store: commitments, records, sessions, active timer, settings, metadata/warnings, reminder deliveries, recovery backups, and onboarding state. If a timer exists, explain it will stop. Require typing `RESET` (or equivalent strong confirmation) and recommend export. Coordinate other tabs to close/stop work, then clear all stores and create fresh AppMeta/default Settings in one IndexedDB transaction; clear every app-owned LocalStorage theme hint immediately after. If another tab blocks coordination or the transaction fails, report failure and retain current domain data. On success return/focus to first-run state.

---

# V. Testing strategy

Use injected clocks and Temporal values; never make domain tests wait in real time.

## V1. Unit tests

- Creation validation, inclusive end date, record count/date sequence, immutable repository API.
- Status truth table for future/today/past, 0, 1 second, target minus 1 second, target.
- Exact 2-hour cases: 0:00, 0:01, 1:59:00 = 99.2% PARTIAL, 1:59:59 = 99.9% PARTIAL, 2:00:00 = 100% DONE.
- Delayed reconciliation closes at cap instant, never delayed current time.
- Multiple intervals and accumulated sub-second fragments.
- Pause excludes paused duration; Resume appends rather than rewrites.
- Stop followed by new session accumulates correctly.
- On-time versus late at 23:59:59 and immediately after midnight.
- Recovery eligibility and exact exclusive deadline at −1 ms, equality, and +1 ms; target-cap equality wins DONE.
- Ended complete/incomplete lifecycle.
- Today sorting precedence and stable ties.
- Progress denominator/breakdown consistency.
- DST spring/fall and reminder dedupe.
- Backward clock on RUNNING: Pause/Stop writes a zero-length safe close, Resume/Start blocks, and no negative/future interval is persisted.
- Captured-zone behavior after device-zone change.

## V2. Persistence/application integration tests

Using `fake-indexeddb`:

- Atomic commitment + records creation and rollback on injected failure.
- Active timer/session/interval consistency for every command.
- Bootstrap running/paused restoration.
- Automatic cap after simulated hours offline.
- Deadline cap while offline.
- Migration fixtures from every prior schema once they exist, including blocked-tab, quota, and failed-upgrade behavior.
- Export round trip, required canonical digest, sanitized PAUSED active timer, target/deadline finalization, invalid references, globally overlapping intervals, unsupported version, backup quota failure, restoration, and restoration-failure safe mode.
- Reset all stores and LocalStorage hints; block/coordinate a second tab; no false success.
- Integrity safe mode on corrupted fixture.
- Revision conflict permits only one cross-tab timer command.
- Simultaneous reminder claims permit one delivery; test expired claim, failed delivery retry, and record completion between claim and delivery.

## V3. Component/accessibility tests

- Today grouping and control labels.
- Forms, validation, immutable notice, and no extra fields.
- Timer Start/Pause/Resume/Stop states.
- Calendar keyboard navigation and status names.
- Day-detail late completion dates.
- Appearance modes.
- Notification permission states.
- Dialog focus/return, live-region messages, reduced motion, and status not color-only.
- Automated accessibility scan plus manual keyboard and screen-reader spot checks.

## V4. Playwright critical journeys

1. First run → create commitment → timer Start/Pause/Resume/Stop → refresh → continue.
2. Start, advance clock beyond target while page hidden/reloaded → exact target DONE, no bonus.
3. Refresh and full context recreation while RUNNING; elapsed remains correct.
4. Cross midnight while RUNNING with target-crossing instant after midnight → old record COMPLETED LATE, new record untouched; companion case with cap before midnight but delayed reconciliation remains DONE ON TIME.
5. Miss Day 8, recover on Day 12; both dates remain correct.
6. Attempt recovery after commitment deadline; denied and history unchanged.
7. Two commitments; global timer prevents simultaneous execution.
8. Two browser tabs race Start; one session wins.
9. Export with running timer → import → timer restored paused without transfer time.
10. Dark/light/system, 320px mobile, tablet, three-column desktop, 200% zoom.
11. Notifications granted/denied/unsupported with no crash.
12. IndexedDB write failure simulation with no false-success UI.

## V5. Quality gates

Strict TypeScript, lint, production build, unit/integration tests, critical E2E suite, accessibility checks, and screenshot review against the supplied board's visual language. Do not use snapshot tests as the only proof of timer/domain behavior.

---

# W. Edge-case catalogue

- Creation at final seconds before midnight: allowed with explicit start/end preview.
- Duration 1: one record; recovery ends at that same date's midnight, so no later-day recovery.
- Target 24 hours: valid absolute duration but difficult to finish on time; do not shorten for DST.
- Duplicate reminders: normalize/reject duplicates.
- No reminders: valid.
- Name with Unicode/emoji: preserve safely; never inject as HTML.
- Empty app, no active commitments, all commitments ended.
- Today's record DONE while older recoverable debt exists: commitment remains Needs attention but card shows today done.
- Missed record receives under one raw second: display credited 0:00 and remains MISSED after date until accumulated raw sessions reach one credited second.
- Stop at target boundary: target completion takes precedence over USER stop.
- Target and commitment deadline same instant: DONE if target cap is not later than deadline; otherwise incomplete at deadline.
- Page resumes long after target/deadline: finalize at historical cap, not reopen time.
- Paused across midnight: remains paused on original record and becomes a recovery timer; Resume only if deadline remains open.
- Paused beyond commitment end: bootstrap closes session at prior pause and removes singleton; no extra time.
- Time-zone change/travel: existing commitments stay anchored; new ones capture new zone.
- DST nonexistent/duplicate reminder times: deterministic policy in section I.
- Browser clock moves backward: no negative interval; warn/reconcile.
- Browser clock moves forward: real wall-clock model counts it; warn when detectable and cap.
- Multiple tabs, duplicate clicks, rapid Pause/Resume: revisioned idempotent commands.
- Browser crash during transaction: old or new state, never half state.
- Storage quota/private mode/IndexedDB unavailable: explain local storage requirement; do not fall back to fragile in-memory commitments.
- Import same file twice: second import is replacement, not duplication.
- Import with open intervals: freeze/import paused; never keep stale RUNNING time.
- Older/newer schema exports, corrupt JSON, huge file, digest mismatch, dangling IDs.
- Reset during timer: explicit warning and atomic removal.
- Notification permission revoked in OS: capability refresh; in-app remains.
- Reminder fires exactly as record becomes DONE: reconcile first and suppress.
- Route references deleted/reset data: not-found and safe navigation.
- Long names: wrap/ellipsis visually while full accessible name remains.
- Very long commitments: virtualize long timelines if measured performance requires it; calendar queries remain indexed.
- No network: core app continues after static assets are loaded; no domain behavior depends on network.
- Future backend: server conflicts must never overwrite immutable local history silently; outside V1.

---

# X. Implementation order

1. **Confirm structure:** present project tree and decision summary; add no features.
2. **Skeleton:** Vite/React/strict TypeScript, router, empty page components, token styles, build/lint/test commands. Verify compilation before filling pages.
3. **Domain foundation:** data contracts, invariant functions, percentage/status/progress math, Temporal date/zone utilities, fake clock, boundary unit tests.
4. **Persistence:** IndexedDB schema, migrations, repositories, transactions, integrity validation, bootstrap/safe mode.
5. **Commitment use cases:** creation validation, immutable write, day-record generation, lifecycle and selectors.
6. **Timer engine:** singleton, intervals, exact cap, commands, reconciliation, revisioning, BroadcastChannel/Web Locks, timer tests.
7. **Core workflow UI:** AppShell, Today, create commitment, focused timer, mini timer, commitments list/detail.
8. **History/recovery:** calendar, day detail, session history, late recovery, deadline reconciliation.
9. **Progress:** exact overall/per-commitment counts, composition, timeline; no extra analytics.
10. **Design completion:** reference-derived dark/light themes, architectural SVGs, responsive desktop/tablet/mobile layouts, empty/loading/error states.
11. **Notifications/settings:** permission/capability adapter, reminders/dedupe, sound/vibration, About.
12. **Data controls:** export, validated replacement import with rollback, reset.
13. **Accessibility:** keyboard/focus/live regions/calendar alternative/contrast/reduced motion/zoom audit.
14. **Verification:** integration and E2E matrix, multi-tab, refresh, simulated sleep, midnight/DST, import failures, production build.
15. **Final audit:** search UI/data model for prohibited fields/features, verify all acceptance criteria, and document browser notification limitations.

Do not start with pixel polishing before domain and timer tests pass. Do not postpone exact timing/date behavior until after UI.

---

# Y. Final acceptance criteria

## Y1. Product scope

- [ ] Brand is THE ARCHITECT and tagline is BUILD A BETTER YOU.
- [ ] Core loop PLAN → EXECUTE → RECORD → REPEAT is represented without becoming a game or coach.
- [ ] There are no AI, chat, social, manual-time, priority, category, tag, XP, points, badge, level, coin, leaderboard, or streak-reward features in UI, model, or dead code.
- [ ] App opens to Today after one-time onboarding.

## Y2. Commitment integrity

- [ ] Creation exposes only name, daily target, duration, and reminder times.
- [ ] Start/end preview is correct and end date is inclusive.
- [ ] Starting atomically creates exactly one permanent record per day.
- [ ] Name, target, duration, reminders, dates, and captured zone cannot be edited after start.
- [ ] No per-item delete silently removes history.
- [ ] Ended commitments are read-only and separated from active commitments.

## Y3. Timer correctness

- [ ] START, PAUSE, RESUME, STOP all work and preserve session intervals.
- [ ] Only one global running/paused timer is possible, including across tabs.
- [ ] Timer truth comes from timestamps, not tick counts.
- [ ] Tab changes, throttling, sleep, refresh, close, and reopen preserve correct elapsed duration.
- [ ] Paused time never counts.
- [ ] At target, stored duration is exactly target, timer stops, controls prevent more time, and no bonus duration exists.
- [ ] A delayed wake finalizes at calculated cap instant, not wake time.
- [ ] For 120-minute target: 119:00 is 99.2% PARTIAL; 119:59 is 99.9% PARTIAL; exactly 120:00 is 100% DONE.
- [ ] No incomplete record displays 100.0% due to rounding.
- [ ] Every displayed session belongs to the correct record and commitment.

## Y4. Daily states and midnight

- [ ] The five display states are distinguishable: NOT STARTED, PARTIAL, MISSED, DONE ON TIME, COMPLETED LATE.
- [ ] Today with zero time is NOT STARTED until its zoned midnight.
- [ ] Past zero-time record is MISSED; past nonzero incomplete record is PARTIAL.
- [ ] Completion timestamp determines on-time/late in the captured commitment zone.
- [ ] Midnight creates no new data ad hoc because permanent records already exist; it correctly changes derived action/state.
- [ ] Timer crossing midnight stays on original record and cannot credit the new day.
- [ ] DST and device-zone changes follow the documented fixed-zone policy.

## Y5. Late recovery and end date

- [ ] Only overdue PARTIAL/MISSED records within the active commitment window can recover.
- [ ] User explicitly selects the record; allocation is never automatic.
- [ ] Original scheduled date remains visible and unchanged before, during, and after recovery.
- [ ] Exact target completion stores actual completion date and COMPLETED LATE.
- [ ] Day 8 scheduled 8 September and finished 12 September displays both dates exactly.
- [ ] Recovery may Start/Resume only before the exclusive start of the day after endDate; at equality it is impossible.
- [ ] A running recovery timer is capped at the earlier target/deadline, and target-cap equality is DONE.
- [ ] Recovering an old record does not modify today's record.

## Y6. Multiple commitments and pages

- [ ] Today shows active commitments, exact today's progress, timer state/actions, completed items, and current date.
- [ ] Today order is Needs attention, Partial, Not started, Completed with deterministic ties and no priority model.
- [ ] My Commitments shows name, target, days remaining, progress, New Commitment, and a separate ended area.
- [ ] Commitment detail shows requested facts and selectable calendar/timeline.
- [ ] Day detail shows scheduled date, target, recorded time, status, completion date when late, sessions, and recovery when eligible.
- [ ] Progress historical consistency shows DONE past-day count / all past-day count, exact percentage, and on-time/late/partial/missed counts that sum to the same denominator; commitment detail separately labels plan completion.
- [ ] Empty, loading, unsupported, not-found, and error states are complete.

## Y7. Persistence and data controls

- [ ] IndexedDB is authoritative and refresh does not lose data.
- [ ] All multi-entity mutations are atomic.
- [ ] Integrity failures preserve data and enter safe mode rather than silently rewriting it.
- [ ] JSON export is versioned, complete, validated, and downloadable.
- [ ] Running timer export is frozen in exported copy; import restores it paused and counts no transfer time.
- [ ] Import validates schema, digest/references/invariants, previews, replaces atomically, and rolls back on failure.
- [ ] Reset requires strong confirmation and clears all data atomically.
- [ ] Persistence is behind repository interfaces suitable for a future backend.

## Y8. Notifications/settings

- [ ] Settings contains System/Dark/Light, notifications, supported sound/vibration, data controls, and About.
- [ ] Permission is requested only after user action.
- [ ] In-app reminders work while open and reminder duplicates are prevented across tabs/reloads.
- [ ] System notifications are used only where supported/permitted.
- [ ] UI plainly states that fully closed delivery is not guaranteed in local-only V1.
- [ ] Done records suppress later reminders.

## Y9. Visual/responsive/accessibility quality

- [ ] Both themes use the single reference's blueprint/architectural visual identity, not a generic dashboard identity.
- [ ] Dark mode is primary; warm ivory light mode is complete, not an inversion afterthought.
- [ ] Color, typography, grid, line art, fine borders, small radii, rings, bars, and status language follow section Q.
- [ ] Desktop intelligently uses Sidebar | Main Workspace | Context Area.
- [ ] Tablet and mobile preserve hierarchy; 320px has no page-level horizontal scroll.
- [ ] All functionality works with keyboard, visible focus, screen reader labels, reduced motion, text zoom, and non-color status cues.
- [ ] Automated and manual WCAG 2.2 AA checks pass for critical paths.

## Y10. Release proof

- [ ] Strict typecheck, lint, production build, domain/integration tests, and critical E2E suite pass.
- [ ] Exact-boundary, refresh, sleep-like suspension, midnight, late recovery, deadline, multiple-commitment, and multi-tab scenarios have explicit passing tests.
- [ ] Final source/UI search finds no prohibited V1 features or editable-history path.
- [ ] Browser support and notification limitations are documented without misleading claims.

---

## Definition of done

V1 is done only when a person can create multiple immutable daily commitments, accurately time exactly one selected day at a time, survive browser lifecycle interruptions, cap each day at its exact target, preserve every original scheduled date and timer session, recover eligible old days through the fixed end date, understand factual consistency, move data by validated JSON, and use the same coherent architectural design system on mobile and desktop—without any prohibited feature or silent history rewrite.
