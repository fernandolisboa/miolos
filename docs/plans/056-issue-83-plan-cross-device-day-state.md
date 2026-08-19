# Plan 056 — Issue #83: cross-device day state

**Issue:** [#83](https://github.com/fernandolisboa/miolos/issues/83) — *feat(web): cross-device day state — the server day-truth payload and `readDayState`'s body*
**Branch:** `feat/83-cross-device-day-state`, based on `main` `370f1e1`
**Tier:** 2 (one exploration pass, one plan document)
**Revision:** step 4 — the step-3 review (ACCEPT WITH FIXES, nothing blocking)
applied in full: the six MAJORs, every MINOR and NIT, and A2's improvement. §8 is
the deviation register; its item 3 maps every change to its finding id.

Numbering note: `054` and `055` were being taken the same night by a triage
document and the #126 plan, so this plan takes **056**. The ADR it proposes
takes **0060** for the same reason (`0058` tiered flows, `0059` property
split) — **re-verify `ls docs/adr | tail -3` before writing the file.**

---

## 1. What the ticket actually asks for

ADR-0031 decision 5 said #19 would replace `readDayState`'s body. It did not:
[ADR-0048](../adr/0048-the-streak-is-a-client-fetched-server-computed-value.md)
amends that decision and moves the server day-truth payload here. So the hub's
per-game done/pending is, today, purely what **this device** holds
(`apps/web/src/play/day-state.ts`), and a player who solved Sudoku on their
phone sees *pending* on their laptop — ADR-0031 consequence (d), stated out
loud when it shipped and owned by this ticket.

Four deliverables, in the issue's own words: a new endpoint and contract, a
merge discipline, a cache/refresh story, and `readDayState`'s body with the
local reader kept as the offline fallback.

## 2. Ground truth read at step 1

Everything below is from the branch, not from memory.

- `apps/web/src/play/day-state.ts` — `DayStatus = "pending" | "completed" | "played"`,
  `DayEntry = {status, elapsedMs?}`, `readDayState(date)`, `completedCount`,
  `useDayState(date)` over `useSyncExternalStore(subscribeToPlayRecords, …)`,
  and a single date-keyed `cachedDayState` slot for referential stability.
- `apps/web/app/hub-day-state.tsx` — `HubProgress` and `HubCardAction` each
  call `useDayState(date)`. On one hub render that is **five** calls
  (1 progress + 4 cards). `apps/web/src/play/conclusion-view.tsx:121` is the
  sixth caller, on all eight play/conclusion routes.
- `apps/web/app/page.tsx:59-61` — **two clocks, and they are not the same
  one.** One `new Date()` on the **web server**, from which `todayInSaoPaulo(now)`
  produces the masthead strings and **`todaySaoPauloDate(now)`** produces the
  `date` the tiles are rendered for (`force-dynamic`). `/day`'s `date` is
  `todaySaoPaulo(db)`, the **DB** clock (the `/streak` template);
  `todaySaoPauloDate` has no part in it. The two can disagree for seconds across
  midnight; `TermoDoneLink` already guards that with a `stats.date !== date`
  equality check (T-WEB-S157a).
- `apps/api/app/streak/route.ts` — the authenticated-read template: cookie →
  `requireUserId` (never mints), 401 `no-session`, `Cache-Control: no-store`
  on every branch including the catch-all 500, no OPTIONS handler, no request
  parameters, `dynamic = "force-dynamic"`, parse before `Response.json`.
- `packages/core/src/contracts/streak.ts` — `z.strictObject`, strict on both
  ends, with a header that already says the day payload must arrive as a new
  endpoint and contract.
- `packages/core/src/contracts/stats.ts` — the per-game contract precedent
  (`binairo`/`sudoku`/`nonogram`/`termo` keys spelled out) and `todayTermoGuesses`.
- `packages/db/src/completions.ts` — `onTimeSql()` is the single producer of
  on-time; `getCompletion(db, userId, game, date)` is the existing SQL
  date-scoped read; `listCompletionsForStreak` is the unfiltered one.
- `packages/db/src/schema.ts:302,325` — PK `(user_id, game, date)` and
  `index("completions_user_date_idx").on(t.userId, t.date)`, whose own comment
  reads *"the streak recompute and **'the day so far'** both read (user_id,
  date) across games"*.
- `apps/web/src/streak/{streak-client.ts,use-streak.ts}` — the client half:
  loud `NEXT_PUBLIC_API_URL` guard, `credentials: "include"`, no custom
  headers, every failure path answers `undefined`, no `localStorage` cache,
  fetch fires in a mount effect only.
- `apps/web/src/play/use-record-snapshot.ts` — the 1 s poll, the per-key
  `Map`, `pruneStaleSnapshots`, `SNAPSHOT_STALE_MS`. ADR-0056 decision 1.
- `apps/web/scripts/route-client-js.mjs` — `/` is the **baseline** every other
  route's delta is measured against; the shared budget is 40 KB and the
  noisiest clean route (`/nonogram`) has ~2.5 KB of slack.

## 3. Decisions

### D1 — The contract: `GET /day`, a new strict schema, three verbs per game

New file `packages/core/src/contracts/day.ts`:

```ts
export const dayGameStatusSchema = z.enum(["pending", "completed", "played"]);

export const dayResponseSchema = z.strictObject({
  date: isoDateString,                    // the DB clock's SP today
  games: z.strictObject({
    termo: dayGameStatusSchema,
    sudoku: dayGameStatusSchema,
    nonogram: dayGameStatusSchema,
    binairo: dayGameStatusSchema,
  }),
});
```

- **Two of the three verbs are CONTEXT.md's; the third is not, and the
  contract says so in its own words.** `completed` is `Conclusão` (on time) and
  `played` is `Jogado` (ADR-0008 rule 3 — only Termo can land there). The third,
  `pending`, is the **absence of a row**: `CONTEXT.md` names Completion,
  Late completion, Played and Win and has no `pending` entry, and `day-state.ts`'s
  own doc is already careful about this (*"CONTEXT.md's verbs, minus the one a
  local reader cannot see"*). `pending` is the local projection's spelling for an
  absence, which this contract adopts rather than invents; if the glossary should
  gain a row for it, that is a `/domain-modeling` call and not this ticket's. All
  three are the same three the local projection already publishes, which is what
  makes the merge in D2 a merge and not a translation. `DayStatus` in
  `day-state.ts` becomes an alias of the contract's type rather than a second
  spelling.
- **Nested `games` rather than flat per-game keys**, diverging from
  `statsResponseSchema`'s flat shape with a reason — and the reason is stronger
  than "flattening needs a re-projection at every use". `/stats`'s four per-game
  values are **heterogeneous** (`timedGameStatsSchema` × 3 + `termoStatsSchema`,
  `packages/core/src/contracts/stats.ts:37-50`) and interleaved with two scalars
  (`perfectDays`, `todayTermoGuesses`), so `Record<Game, X>` **does not exist in
  that payload at any shape** and flat is the only honest spelling there. `/day`'s
  four are **homogeneous**, so `DayResponse["games"]` **is** `Record<Game,
  DayStatus>` by construction — literally `mergeDayState`'s input type, typed
  without a cast or a helper. The two shapes differ because the payloads differ,
  not because one of them drifted. Total over the four games, spelled out one key
  per game — `day-state.ts`'s own justification for its literal map, and
  `statsResponseSchema`'s.
- **What it does NOT carry.** No puzzle content of any kind, no puzzle id, no
  answer, no board, no `date` other than the server's own today
  ([ADR-0004](../adr/0004-no-unpublished-puzzle-reaches-the-client.md): there
  is nothing here to leak, and the route takes no date parameter so there is
  no way to ask about tomorrow). No streak (that is `/streak`). No
  `elapsedMs`, no guess count — see D6. **No `onTime` field, because nothing
  consumes it** — the on-time rule is applied server-side and only its verdict
  travels, as one of the three verbs. The tempting warrant *"on-time never rides
  a wire contract"* is **false and must not be written**:
  `completionResponseSchema` carries `onTime: z.boolean()`
  (`packages/core/src/contracts/completion.ts:223`) for a different reason — it is
  the write path's receipt. ADR-0051 decision 1's actual words are narrower than
  the paraphrase, and are about the stats ADR's own payloads: *"nothing **here**
  exposes `onTime` on a wire contract or pre-empts '#58 changes the producer and
  nothing downstream'"*. The #58 boundary is untouched either way — `/day` adds no
  second producer, only a projection of `onTimeSql()`.
- **Route:** `apps/api/app/day/route.ts`, a verbatim clone of the `GET /streak`
  template — `dynamic = "force-dynamic"`, cookie → `requireUserId`, **401
  `no-session`** for a cookieless caller (a cold visitor mid-mint gets the
  same honest answer `/streak` gives it), whole-body try/catch → 500
  `internal`, `Cache-Control: no-store` **and** the CORS grant on every branch
  including the catch, no OPTIONS handler (a credentialed GET with no custom
  headers never preflights), **no request parameters at all** — the user is
  the cookie, the day is the DB clock. "Verbatim" includes the shipped route's
  two *deliberate absence* comments — **no origin guard** and **no content-type
  check** — with their reasoning and the step-6 security finding LOW 1 /
  `T-API-S53` pins they name. Carried across, a step-6 security reviewer reads a
  decision; dropped, the same reviewer files two omissions.
- **Anonymous-tolerant is rejected.** A 200 with four `pending`s for a caller
  with no session is indistinguishable from a real answer, and it would cost a
  branch on every consumer to tell them apart. 401 is the shipped precedent
  and the client already treats every non-200 identically (D4).

### D2 — The merge discipline, stated as an invariant

Two claims exist about a game's day, and they are different kinds of object.
The **device** claims *"this device concluded this game today"* — self-reported,
an affordance and never an entitlement (ADR-0031 decision 6). The **server**
claims *"a completion row exists for (user, game, today)"* — the authority for
the streak, the statistics and the medals (ADR-0009, ADR-0026).

> **The invariant.** For each game, the server **makes a claim** exactly when
> its status is not `pending`; `pending` from the server is the *absence* of a
> completion row and therefore the absence of a claim, never a denial. Where the
> server claims, its claim is the day state; where it does not, the device's is.
> Absence on either side proves nothing, presence on the server is authority,
> presence on the device is an affordance. Nothing is blended field by field and
> no third value is ever synthesised.

```
merged[game] = server[game] === "pending" ? local[game] : server[game]
```

with a precondition: **the payload is ignored in full unless
`payload.date === date`.** A payload for another day is not weaker evidence,
it is evidence about a different question — merging it across the São Paulo
rollover would paint yesterday's dones onto today's tiles, the false *done*
ADR-0031 decision 2 forbids by name. This is `TermoDoneLink`'s shipped
`stats.date !== date` gate (`hub-day-state.tsx:187-190`, whose header comment
names the DB-versus-web-server disagreement as its reason), applied to the whole
payload — **with a strictly larger blast radius, said out loud so that "shipped
precedent" is not read as "shipped consequence"**: `TermoDoneLink`'s gate discards
a **caption** and the tile keeps its shape (`Feito`, chip-only), while this gate
discards a **tile shape**, so for the length of the skew a cross-device done
reverts to pending. Same mechanism, more visible loss — and bounded: what is lost
is only the cross-device *addition*, never a local truth. D5's Rollover paragraph
says how it recovers.

Why the server wins where both speak, rather than "the stronger verb wins":

- Local `completed` + server `played` is reachable, and it is Termo-only: win
  today's Termo on device A having lost it on device B. The row is write-once
  (ADR-0026 decision 1); the POST from A short-circuits and returns B's stored
  **lost** row (ADR-0053 decision 10 layer 1). The day genuinely does not
  count for the streak, so `completed` on the hub would be a lie the player
  can catch — and `completedCount` would disagree with `/streak`'s
  `todayCounts`.
- Local `pending` + server `completed` is the whole point of the ticket.
- Local `completed` + server `pending` is the queued-or-just-finished case:
  the device is ahead of the server, and it keeps its claim.

**Three consequences, named rather than discovered later.**

1. **Hydration can now DEMOTE** for the first time — **and the same one-line
   rule PROMOTES in the mirror case.** Every shipped surface promises hydration
   only ever adds a done tile (`day-state.ts:123-136` says it in those words);
   this ticket creates exactly one demotion — the server contradicting the device
   on a lost Termo — which is a *correction*, not an understatement, and moves
   `X de 4` down by one. It is Termo-only in v1 (no grid game can lose) and it is
   the direction ADR-0031 decision 2 permits.

   **The mirror is `local played + server completed`, and it is reachable.**
   Traced: device B wins today's Termo and its row lands `won`. Device A plays
   independently (guesses are judged by a stateless server route, ADR-0038) and
   loses all six. A's POST short-circuits on the composite PK and returns B's
   stored `won` row with `recorded: false` — and per ADR-0053 decision 10's own
   correction, *"the client discards both `completionResponseSchema.outcome` and
   `.onTime`"*, so device A's local record stays `lost`. Merged, the day reads
   **`completed`**: device A's hub tile says `Feito`, mounts `TermoDoneLink`, and
   captions itself `em 4/6` from `/stats` — and that tile is a
   `<Link href="/termo">` whose whole documented justification
   (`hub-day-state.tsx:60-67`) is that it *"restores straight into"* the
   conclusion the player earned. It restores into a **loss screen**: `Feito` →
   tap → *que pena*. Demotion and promotion are one rule and one decision; both
   are in §7 item 2, and `T-WEB-S233` asserts both arms.
2. **The server payload is never written into a play record.** The merge lives
   in the projection only. A synthesised record would imply board content the
   device does not have, would survive the connection that produced it, and
   would make a cross-device *done* outlive the evidence for it. `localStorage`
   stays a device-written store.
3. **A cross-device done tile links to a route that renders a fresh PLAYABLE
   board** — all four games, not Termo alone. The screen roots swap to
   `ConclusionView` only via `isClosedAndFrozen(play.state)`
   (`apps/web/src/sudoku/sudoku-screen.tsx:50` and its three siblings), i.e. off
   the **local** record; cross-device there is no local record, so `/sudoku`
   renders a blank, playable, replayable board. Today that path is unreachable
   from the hub — the tile is `pending` and says *"Jogar hoje"*, which is honest.
   After this ticket the tile says `Feito` and its `href` is a promise the screen
   behind it does not keep; ADR-0031 consequence (d) asserts the opposite in as
   many words (*"lands them on a screen that immediately restores into its own
   conclusion"* — written about the chaining CTA, false for a device with no
   record). **Decided here, not discovered at step 6: ship it, named.** The replay
   writes nothing (ADR-0053 decision 10 layer 1), and layer 3 already blesses
   exactly this shape as *"Cross-device or post-retention, the honest gap … the
   board is playable; on submit the server answers with the stored row and
   **writes nothing**"* — on the archive. What is new is that the **daily hub**
   points at it for the first time. Pinned rather than assumed by a reserved
   `T-WEB` tail (`T-WEB-S241`): a cross-device `Feito` tile keeps its `href`, and
   the play route behind it renders the playable board. Flagged in §7 item 3.

**What is NOT merged, exhaustively:**

- **In-progress board state** — grid, guesses, draft, timer, `elapsedMs`,
  `hintsUsed`. It is device-local, the server has no notion of an unfinished
  board (nothing is persisted before a completion), and none of it goes on the
  wire. Resuming a half-played board on a second device is **not** in scope and
  is not made possible by this ticket.
- **`pendingSync` / `syncOutcome`** — device facts about the queue. The
  conclusion's pending-sync line keeps its exact present meaning; the tile
  keeps ignoring both, which is what `T-WEB-S215` pins between the hub and the
  archive.
- **Durations and guess counts** — D6.
- **The streak** — `/streak` owns it; `/day` never carries it and never
  derives it.
- **Any day but today**, and any user but the caller.
- **The archive.** ADR-0053 decision 10's refusal of a per-day per-user read
  stands untouched: it is about arbitrary past dates on a public,
  crawler-facing route with one consumer. This endpoint answers about today
  only, on the authenticated surface ADR-0031 decision 4 routes server-sourced
  user facts to. `apps/web/src/archive/card-status.ts` is not touched.

### D3 — The DB read, and the migration question

**No schema change, no migration.** Evidence: `completions` already carries
`(user_id, game, date, outcome, completed_at, …)` with PK
`(user_id, game, date)` (`packages/db/src/schema.ts:302`), and
`completions_user_date_idx` on `(user_id, date)` exists — its own comment
names *"the day so far"* as one of the two reads it was built for. On-time is
derived by the existing `onTimeSql()` and this ticket adds no second spelling.

New reader `listCompletionsForDay(db, userId, date)` in
`packages/db/src/completions.ts`, projecting `{game, outcome, onTime}` for
exactly that user and that date, exported from `@miolos/db/user`.

- **Date-scoped in SQL, not in core**, unlike `listCompletionsForStreak` and
  `listCompletionsForStats`. Those are unfiltered because the *exclusion rules*
  (lost, late) must live in one place; scoping to one date is not a rule, and
  `getCompletion` already scopes `(user, game, date)` in SQL two functions up.
  The read is ≤ 4 rows on an index built for it, constant cost forever, on the
  most-hit route in the app.
- **Rejected: reuse `listCompletionsForStats`.** It needs no db change at all,
  which is its real merit — but it reads the user's entire completion history
  (~2 900 rows after two years) to produce four enum values, on every hub view,
  and ADR-0051 decision 3 already names *"the hub gets a narrow endpoint"* as
  the fix for exactly that pressure. Building the narrow endpoint with the wide
  read is building it and skipping the point.
- `T-DB-9e`, the user-entry export tripwire, is **widened in place** with the
  new name (a tripwire that counts one more export is the same claim — the
  `T-DB-9a`/`T-DB-S5` precedent). No new id for it.

### D4 — `readDayState`'s new body, and the fallback

```ts
export function readDayState(
  date: string,
  server?: DayResponse,          // undefined = no server truth, for any reason
): Readonly<Record<Game, DayEntry>>
```

- The local projection (`entryFor` over `readPlayRecord`) is **unchanged** and
  is still the whole answer when `server` is `undefined` or its `date` differs.
  `readDayState` has exactly **one** runtime caller (`dayStateSnapshot`, same
  file); the rest are the **~14** `readDayState(DATE)` call sites in
  `apps/web/test/day-state.test.ts` — re-counted at step 4, where this plan had
  said six, because this repo's plans get cited later as if their figures were
  measured. An optional second parameter is source-compatible with every one of
  them, so all compile and behave identically, which keeps `T-WEB-S14`'s block
  green and makes the diff auditable.
- `elapsedMs` follows the status the merge produced: kept from the local entry
  only when the merged status is `completed` **and** the local entry was
  `completed`; `undefined` in every other case. A `played` entry never carries
  a duration (the type's own rule), and a cross-device `completed` carries none
  because this device has no record — which renders as the chip-only done tile
  the hub already ships for a won Termo and for a settled-but-valueless
  `/stats`. See §7 item 1.
- `useDayState(date)` composes three things and stays the only seam:

```ts
const local = useSyncExternalStore(subscribeToPlayRecords, snapshot(date), serverDayState);
const truth = useDayTruth();               // module store, D5 — takes NO argument
return useMemo(() => mergeDayState(local, date, truth), [local, date, truth]);
```

  `serverDayState` in that first line is the **React SSR** snapshot that already
  exists at `day-state.ts:183` — which is exactly why the new module is called
  `day-truth` and not `server-day-state` (E4): `serverDayState` and a
  `useServerDayState` two lines apart, meaning the React server and the API
  server, is a trap laid for step 5. `getServerSnapshot` still returns
  `NOTHING_DONE` and the store's SSR snapshot is `undefined`, so the server markup
  and the pre-hydration client render agree byte-for-byte and **no fetch happens
  at render** — the hub's first-paint contract (T-WEB-S17 / T-WEB-S127) is
  untouched.
- **`useDayTruth()` takes NO argument, and that is load-bearing rather than
  terse.** The date filter lives inside `mergeDayState`, where the rendered day is
  already a parameter. The moment the hook takes `date` and filters internally,
  one module-level slot is serving a **keyed projection** — ADR-0056's exact
  defect one level up: N consumers with different keys evicting each other on
  every `getSnapshot`, a fresh object per read, `Maximum update depth exceeded`
  (measured there at 17 live consumers against a 16-entry cache, plain and in
  StrictMode). There is exactly one "today" payload and every consumer reads the
  same value, so there is nothing to key and nothing to evict. Written down here
  so a step-5 tidy-up cannot undo it.
- `cachedDayState`'s single date-keyed slot is **not** repaired and does not
  need to be: it still caches the *local* projection only, and no surface
  mounts two dates. ADR-0056 decision 1's sibling note stands as written.
- **Failure is degradation, never a block.** `fetchDayTruth` answers `undefined`
  on: `NEXT_PUBLIC_API_URL` unset (with the loud `console.error` the streak client
  uses), any non-2xx including 401, a network rejection, and a `safeParse`
  failure. **The silent parse failure is chosen, not overlooked:**
  `streak-client.ts:38-40` returns `undefined` on `safeParse` failure with no
  logging while its env guard is loudly `console.error`, and `stats-client.ts`
  splits the same way. A third client that shouted would make `/day` the only one
  of three that does, and one spelling is the rule this repo enforces hardest; if
  loud parse failures are wanted, they are a three-client ticket of their own.
  Offline, the fetch rejects, the merge sees `undefined`, and the
  reader is exactly the shipped local reader — which is ADR-0031 decision 1's
  first fact and the reason the conclusion can finish offline at all. Nothing
  on any play path awaits this fetch.

### D5 — The refresh story: one shared store, no second loop

New `apps/web/src/day/`, named in the issue's own vocabulary — `day-truth`, not
`server-day-state`, because `serverDayState` already means the React SSR snapshot
in `day-state.ts` (E4), and because it makes the lint group (`**/day`,
`**/day/**`) read as what it bans:

- `day-client.ts` — `fetchDayTruth(): Promise<DayResponse | undefined>`, fetch
  and parse only, no React, a line-by-line sibling of `streak-client.ts`.
- `day-truth.ts` — a **module-level store**: one value, a `Set` of listeners, an
  in-flight guard, and `useDayTruth()` (no argument, D4) over
  `useSyncExternalStore`.

Why a store and not `useStreak`'s mount effect: `useDayState` is called **five
times on one hub render**. A per-hook mount effect would fire five credentialed
GETs per hub view. The store makes it one, and it is the idiom
`use-record-snapshot.ts` already establishes for a module-level source with N
consumers. A React context is rejected: the hub's client fragments are separate
islands inside a server component, and a provider would restructure `page.tsx`
to buy the same thing.

**When it fetches:**

| Trigger | Behaviour |
|---|---|
| **Listener count 0 → 1** (effect time, post-hydration) | one fetch; further subscribers ride it |
| `visibilitychange` → visible, and `focus` | refetch, deduped by the in-flight guard |
| `online` | refetch — free, and it is the offline → online recovery path D4 promises |
| Anything else | nothing |

**"Listener count 0 → 1", not "the first subscriber".** The difference is the
common case, not an edge: a client-side navigation `/sudoku/concluido → /` drops
every subscriber and re-adds five, so a store that fetched once per page load
would answer the most frequent way a player looks at the hub with the payload
from the session's first mount. Every remount refetches; `T-WEB-S231` pins the
0 → 1 reading, and the in-flight guard keeps a five-subscriber remount at one GET.

**Cleanup drops the listeners and RETAINS the payload.** The last unsubscribe
removes the `visibilitychange` / `focus` / `online` handlers and leaves the cached
value in place; only the date precondition retires it. Clearing it would flip the
snapshot to `undefined` and demote every cross-device tile to pending **for the
length of a fetch, on every navigation** — the same visible loss the date gate is
bounded against, arriving far more often.

**No interval — a decision with a named cost, not a gate borrowed from another
ADR.** ADR-0056 decision 1 governs `use-record-snapshot.ts`'s 1 s
**`localStorage`** poll and its staleness sweep; it says nothing about a *network*
refresh interval, so "no interval" cannot stand on its authority and this plan no
longer claims it does. The choice stands on its own warrant: a polling network
loop would multiply §7's credentialed GETs on the most-hit route in the app, for a
payload that can change at most four times a day, and every trigger in the table
is an event the player actually generated. ADR-0056's poll stays what it is and
never gains a network call. A test asserts no timer is installed by this store
(`T-WEB-S231`).

**The residual, stated rather than left to be found.** An already-open,
already-focused tab does not learn about a completion made elsewhere until it is
refocused or navigated — a second monitor left on the hub, which is this ticket's
own demo case, never updates on its own. That is accepted for v1; the successor is
a poll or a push, and the trigger for revisiting is a complaint, not a schedule.
The same sentence is in ADR-0060 decision 5 and in §7 item 4.

- The snapshot keeps its previous object identity when the incoming payload is
  field-for-field equal (date + four statuses), so a refetch that changes
  nothing re-renders nothing — `sameDayState`'s discipline, one level up.
- **No `localStorage` cache of the payload**, on ADR-0048 decision 4's
  argument: a stale server answer presented as current is wrong in both
  directions, and the local reader is already the honest offline answer.
- **Rollover.** The date-equality precondition in D2 is the whole mechanism:
  after the SP midnight the payload's date moves and the page's does not, so
  the payload is ignored and the hub falls back to the local reader for the day
  it is actually rendering. **How the skew recovers:** on the next fetch whose
  payload date matches the rendered day — the next `visibilitychange`, `focus`,
  `online` or remount, since the page's own date moves only on a navigation. On an
  already-open, already-focused tab that fetch may never come (the residual
  above), so the honest statement is that the skew costs the cross-device addition
  until the tab is touched. The cost is bounded in both directions, because both
  fall back to a reader that is never blank: DB ahead of the page keeps everything
  this device did today, page ahead of the DB shows all pending, which is what a
  new day *is*. The hub does **not** gain a midnight auto-reload —
  it is `force-dynamic` and the next navigation resolves the new day, which is
  today's behaviour and is out of scope here.
- **Known small gap, inherited from `/streak`:** a brand-new visitor's fetch
  can race `SessionBootstrap`'s mint and 401. There is no retry; the next
  focus or navigation resolves it. Same trade the shipped streak makes.

### D6 — What `/day` deliberately does not carry

- **`todayTermoGuesses` (the `em 4/6` caption).** It is per-game today state and
  it *would* let the hub drop its `/stats` fetch — but it already exists on
  `statsResponseSchema`, both contracts are strict on both ends, so carrying it
  here creates a **second producer** of one value and removing it there is a
  breaking change for deployed clients. One spelling wins. `TermoDoneLink`
  keeps reading `/stats`, unchanged. ADR-0051 decision 3's *"the hub gets a
  narrow endpoint (or `todayTermoGuesses` splits out of `/stats`)"* trigger is
  **not** discharged by this ticket and stands as written.
- **A duration for a cross-device completion.** The row stores `elapsedMs`, so
  it is available — and it is not carried: solve times are a `/stats` concern
  (ADR-0051 decision 4), Termo publishes none anywhere (ADR-0045 decision 4),
  and it would be a wire field whose only consumer is a caption the hub already
  renders without. The consequence is visible and is flagged in §7 item 1.
- **`onTime` as a field** — D1.
- **Any second day.** No `?date=`. A parameter would be an archive feature and
  ADR-0053 decision 10 refuses it.

### D7 — An ADR is owed: ADR-0060

The merge discipline is a new decision of real weight — it is the first time in
the repo that a server claim and a device claim about the same fact meet, and
it creates the first hydration path that can demote. The proposal:

**ADR-0060 — The day payload is server truth for today, and the device may
only add to it.**

1. `GET /day`, no parameters, anchored on the DB clock's today; a new strict
   contract, never a field on `streakResponseSchema` or `statsResponseSchema`
   (ADR-0048 decision 3, obeyed).
2. Three verbs per game and nothing else on the wire: no puzzle content, no
   duration, no guess count, no day but today — and **no `onTime`, because
   nothing consumes it**, the rule being applied server-side and only its verdict
   travelling. Written with D1's warrant and **not** with "on-time never rides a
   wire contract": `completionResponseSchema.onTime` already does, as the write
   path's receipt, and ADR-0051 decision 1's sentence is about the stats ADR's own
   payloads and the #58 boundary.
3. The merge invariant of D2, **carried with its formula and not only its
   prose**: the server makes a claim exactly when its status is not `pending`,
   `pending` being the absence of a completion row and therefore the absence of a
   claim, never a denial; `merged[game] = server[game] === "pending" ?
   local[game] : server[game]`; the date-equality precondition; and the named
   exhaustive list of what is not merged.
4. In-progress board state is device-local, is never on the wire, and
   cross-device resume is not a v1 capability.
5. The refresh discipline: one shared store fetching on **listener count 0 → 1**
   and on `visibilitychange` / `focus` / `online`; the ADR-0056 poll stays
   `localStorage`-only **and this decision does not borrow its authority**; no
   payload cache on the device. **With its cost named:** an already-open,
   already-focused tab does not learn about a completion made elsewhere until it
   is refocused or navigated; that is accepted for v1, the successor is a poll or
   a push, and the trigger for revisiting is a complaint, not a schedule.
6. Every failure degrades to the local reader; play never blocks on this fetch.
7. Hydration may demote in exactly one case (the server contradicting the device
   on a lost Termo), which is a correction and not an understatement — and **the
   same rule promotes in the mirror case** (a Termo lost here and won elsewhere),
   where `Feito` sits one tap from this device's own loss screen. One rule, both
   directions, stated together so neither arrives as a discovery.
8. A cross-device `Feito` tile keeps its `href`, and the play route behind it
   renders a fresh **playable** board, because `isClosedAndFrozen` reads the local
   record and cross-device there is none. That is ADR-0053 decision 10 layer 3's
   *"honest gap"*, reached from the daily hub for the first time; the replay
   writes nothing.

**Records owed with it** (`docs/agents/domain.md`'s lifecycle rule):

- **It lands `Accepted`, in one step.** `Proposed` is scoped to *"the first PR of
  a two-PR ticket"* (`docs/agents/domain.md:39-59`) and this is a one-PR ticket,
  so the header is written `**Status:** Accepted — <merge day> (issue #83, shipped
  in #PR)` at step 5, with the code. Writing `Proposed` and flipping it inside the
  same diff is churn the rule does not ask for.
- **`**Amends:** ADR-0031 — decisions 1 and 2, and consequence (d).** The
  amendment is wider than consequence (d) alone, and each part is named with what
  survives it:
  - **Decision 1** — *"`readDayState(date)` returns, per game, whether **this
    device** concluded that day's puzzle"* — is narrowed. The one-seam property
    survives untouched (it is still the only function that derives completion, and
    every consumer still reads it); what it returns is now the device's record
    merged with the server's claim for today.
  - **Decision 2** — its **safety property survives**: the day state still can
    never overstate the *user's* day, and the one demotion is a correction in the
    direction the decision itself permits. Its **mechanism does not**: *"**absence
    proves nothing** and renders as *pending*"* is false for the merged
    projection, where absence on the device renders as whatever the server says.
    Same property, different sentences.
  - **Consequence (d)** — *"Tiles and day chips understate across devices … until
    #19"* — becomes false, discharged here rather than at #19; and its second
    sentence about the chaining CTA (*"lands them on a screen that immediately
    restores into its own conclusion"*) is corrected by decision 8 above.
  - **Decision 5**, as narrowed by ADR-0048, is **discharged**.

  The reciprocal `**Amended by:**` plus the in-place annotations go on ADR-0031 in
  the same commit.
- **ADR-0048 owes a one-line reciprocal.** Its `**Amends:**` block names #83 as
  the deferral target; it gains *"discharged at #83 / ADR-0060"* so the pointer is
  not left dangling in the direction that was actually fulfilled. (Its own
  decisions need no change — this is the fulfilment it predicted.)
- **ADR-0053 decision 10 and ADR-0056 decision 1 are obeyed, not amended**, and
  the ADR says so in those words — a reviewer will ask about both. Decision 10
  layer 3 is additionally **cited** by decision 8, as the precedent that makes the
  playable board acceptable; citing is not amending.

## 4. Test plan, at the seams

Frontier read from `docs/agents/test-ids.md` (plan 051): `T-CORE-S86`,
`T-DB-S59`, `T-API-S109`, `T-WEB-S230`, `T-LINT-S47`. **Re-derive by grep at
step 5** — another agent may take ids the same night.

Reserved contiguous ranges, tails burned if unspent:
**`T-CORE-S86…S97`**, **`T-DB-S59…S61`**, **`T-API-S109…S116`**,
**`T-WEB-S230…S242`**, **`T-LINT-S47…S48`**.

### `packages/core` — the contract and the merge as pure functions

| Id | Claim |
|---|---|
| `T-CORE-S86` | `dayResponseSchema` is strict both ways: an unknown top-level key, an unknown key inside `games`, a missing game, an unknown status and a malformed date all fail `parse` |
| `T-CORE-S87` | `dayStateFromRows([])` is four `pending`s, total over `GAMES` |
| `T-CORE-S88` | a won on-time row → `completed`; a lost row → `played`, on time or not (ADR-0008 rule 3) |
| `T-CORE-S89` | a won **late** row → `pending` — unreachable for a today-anchored payload and defined anyway, so the on-time rule has one spelling and fails safe; plus row-order independence |
| `T-CORE-S90` | `mergeDayStatus`, the full 3 × 3 table: server `pending` returns local; every other server value returns itself |
| `T-CORE-S91` | **property** (fast-check): merge is total over the enum, idempotent, and returns `pending` only when both inputs are `pending` |
| `T-CORE-S92` | **property, re-aimed at step 4** (as written it was S91's other branch — one property, proved twice): `mergeDayState` is **pointwise**, i.e. the result for game *g* depends on no other game's status. That is what makes the date precondition's "discarded in full" the *only* whole-payload rule in the merge |
| `T-CORE-S93` | **property, cross-endpoint**: for arbitrary row sets, `computeStreak(rows, today).todayCounts` ⇔ some game reads `completed` in `dayStateFromRows(rows on today)`. The hub's "X de 4 ≥ 1" and the streak's "maintained today" can never disagree |
| `T-CORE-S94` | the payload's key set is exactly `{date, games}` and `games`' is exactly the four games — the ADR-0004 tripwire: nothing about a puzzle can be added without reddening this |
| `T-CORE-S95` | the wire status enum's value set is exactly the local projection's three verbs (the alias, not a second spelling) |
| `S96`, `S97` | review-round headroom |

### `packages/db`

| Id | Claim |
|---|---|
| `T-DB-S59` | `listCompletionsForDay` returns only that user's rows for exactly that date, with the SQL-derived `onTime`, and never another user's or another day's |
| `T-DB-S60` | the rollover boundary under a faked clock (the `T-DB-14` idiom): a row whose write instant falls on the next SP day reads `onTime: false` |
| `S61` | headroom |
| `T-DB-9e` | **widened in place**, one more export name. No new id |

### `apps/api`

| Id | Claim |
|---|---|
| `T-API-S109` | 200: `date` is the DB clock's SP today and the four statuses match the seeded rows |
| `T-API-S110` | a cookieless GET is 401 `no-session`, and costs zero queries (auth first, sequential) |
| `T-API-S111` | `Cache-Control: no-store` **and** the CORS grant on all three branches — 200, 401 and the catch-all 500 (`T-API-S53`'s shape) |
| `T-API-S112` | cross-user isolation: another user's rows never appear |
| `T-API-S113` | query parameters are ignored — `?date=<tomorrow>` still answers today. The ADR-0004 tripwire at the route |
| `T-API-S114` | a row for another date never enters the payload (yesterday's completion does not make today `completed`) |
| `S115`, `S116` | headroom |

### `apps/web`

| Id | Claim |
|---|---|
| `T-WEB-S230` | `fetchDayTruth` answers `undefined` on: env unset (with the loud `console.error`), 401, 500, a network rejection and a malformed body |
| `T-WEB-S231` | the store fetches **once** for N subscribers; it fetches **again when the listener count goes 0 → 1** (a remount, not only the session's first mount); the last unsubscribe removes the listeners and **retains the payload**; and **no interval is installed**. Asserted **plain and in StrictMode** — subscribe → unsubscribe → subscribe drives 0 → 1 twice, and the in-flight or recency guard must absorb the second (`T-WEB-S214`'s convention; `use-streak.ts` documents the React 19 double-effect it survives) |
| `T-WEB-S232` | it refetches on `visibilitychange` → visible, on `focus` and on `online`, deduped while one is in flight |
| `T-WEB-S233` | the merge arms end to end: server `completed` + local `pending` → done with no duration; server `pending` + local `completed` → done with the local duration; server `played` + local `completed` → played, no duration (the **demotion**); server `completed` + local `played` → done (the **promotion** — `Feito` over a board this device lost, D2 consequence 1) |
| `T-WEB-S234` | a payload whose `date` differs is ignored **in full**, not per game |
| `T-WEB-S235` | `useDayState`'s server snapshot is `NOTHING_DONE` and no fetch is issued during render |
| `T-WEB-S236` | the hub island renders `Feito` for a game completed on another device, and `X de 4` counts it |
| `T-WEB-S237` | the conclusion still renders its stamp when `fetchDayTruth` rejects — the offline fallback ADR-0031 decision 1 requires |
| `T-WEB-S238` | referential stability: an unchanged payload and unchanged records hand back the same object; N consumers (4, 16, 32) stable, no render loop, **plain and in StrictMode** — ADR-0056's lesson applied to the new store, at the N and under the two modes `T-WEB-S214` uses |
| `T-WEB-S239` | the merged state never demotes a local `completed` to `pending`, over the full table (the one permitted demotion is `completed` → `played`, asserted in S233) |
| `T-WEB-S240` | `src/day/**` is imported by `play/day-state.ts` and by nothing else — the seam stays one function body wide |
| `T-WEB-S241` | a cross-device `Feito` tile keeps its `href`, and the play route behind it renders the **playable** board (no local record → no `isClosedAndFrozen` swap) — D2 consequence 3, asserted rather than assumed |
| `S242` | review-round headroom |
| `T-WEB-S183` | **widened in place**: the archive module-graph scan also excludes the new day client. No new id |

### lint

| Id | Claim |
|---|---|
| `T-LINT-S47` | free play cannot import `src/day` — both specifier shapes (`**/day`, `**/day/**`), the stats group's verbatim pattern |
| `T-LINT-S48` | the dynamic-import ban covers it too |

Glob check owed at step 5: `**/day` / `**/day/**` must not accidentally match
`play/day-state` or `app/hub-day-state`, and must not shadow an existing group.

## 5. Build sequence

One PR. Five batches; **B and D can run in parallel**, and C follows B.

- **A — core (blocking).** `contracts/day.ts`, `day.ts`
  (`dayStateFromRows`, `mergeDayStatus`, `mergeDayState`), the `index.ts`
  exports, `packages/core/test/day.test.ts`. Everything else depends on the
  types this batch fixes, so it lands first and alone.
- **B — db.** `listCompletionsForDay`, the `@miolos/db/user` export, the
  widened `T-DB-9e`, `packages/db/test/user.test.ts`.
- **C — api.** `apps/api/app/day/route.ts`, `apps/api/test/day.test.ts`.
  Depends on A and B.
- **D — web.** `src/day/day-client.ts`, `src/day/day-truth.ts`,
  `src/play/day-state.ts`'s new body, the three test files. Depends on A only,
  so it runs beside B and C.
- **E — walls, records, measurement.** `eslint.config.mjs` +
  `eslint-free-play-wall.test.ts`, ADR-0060, the ADR-0031 amendment, the ADR-0048
  reciprocal, `docs/agents/test-ids.md`'s reservation paragraph and frontier,
  `docs/README.md`, the `route-client-js.mjs` comment if the figures move — **and
  the source prose this ticket falsifies, inventoried below.**

### The prose this ticket falsifies

ADR-0056's own record is the precedent and the warning: *"What is falsified by
decision 1 is source prose, in **seven** places … The last two of those were found
at step 6 (finding M4)."* This ticket falsifies more than that one did, so the
inventory is part of batch E rather than a step-6 discovery. Nine sites, each read
on this tree at step 4:

| File | What becomes false, and what it becomes |
|---|---|
| `apps/web/src/play/day-state.ts:1-19` | *"Device state, not user state"*, *"also what a second device sees"*, *"This reader stays the day-state source"* — the reader becomes one of two inputs to the day state, and the #83 deferral it names is discharged |
| `apps/web/src/play/day-state.ts:26-54` (`DayStatus` doc) | *"MONOTONE SAFETY IS PRESERVED … Absence still reads `pending`, so the cold profile, the second device and `impeccable detect` are unchanged"* — the cold profile and the visual gate are still unchanged; **the second device is not** |
| `apps/web/src/play/day-state.ts:123-136` (`useDayState` doc) | **"Hydration can then only ever ADD a done tile — the monotone direction"** — directly falsified by the flagged demotion; must state the one exception and that it is a correction |
| `apps/web/app/hub-day-state.tsx:14-24` | *"What they render is DEVICE state, not user state"*; *"The one server value read HERE is #29's caption"* — there are now two server reads on this surface, and one of them decides the tile's **shape**, not its caption |
| `apps/web/app/hub-day-state.tsx:36-39` (`HubProgress` doc) | *"X being what **this device** has COMPLETED today"* — X becomes what the **user** has completed today, as far as the server and this device together know |
| `apps/web/app/hub-day-state.tsx:60-67` | the done tile *"restores straight into"* the conclusion — false cross-device (D2 consequence 3); the sentence owes the honest-gap caveat |
| `apps/web/src/play/conclusion-view.tsx:117-120` | *"It can only understate — a game solved on another device reads `falta` here"* — it no longer does; this surface carries the merged answer too |
| `apps/web/src/archive/{binairo,sudoku,nonogram,termo}-screen.tsx` (×4, ~l.14-22) | each explains the archive exclusion partly via *"`conclusion-view.tsx` calls `useDayState(date)`"* — still true, and the reason **strengthens**: `useDayState` now also fetches, so composing a daily screen root on an archived date would fire `/day` as well as `/streak`. `T-WEB-S183` widens to match, and the ADR-0053 decision 9 claim moves with it |
| `packages/core/src/contracts/streak.ts:5-12` | *"that future payload MUST arrive as a new endpoint and contract"* — **fulfilled** by this ticket; the sentence owes a pointer to `day.ts` rather than a prediction |

## 6. Gates, measurements and landmines

- `pnpm typecheck`, `pnpm lint`, `pnpm test` — full suite once at the end,
  with output pasted (CLAUDE.md's evidence rule). Note the box: cap the
  fan-out per ADR-0057 and do not run the suite beside other agents.
- **Property tests** ship with the core functions (`T-CORE-S91…S93`),
  fast-check, ADR-0017/ADR-0023.
- **Zod at the boundary**: parsed on the route before `Response.json` and
  parsed again on arrival in the client. Never cast.
- **`npx impeccable detect`** — this touches UI. What the gate scans is
  unchanged in shape: a clean profile has no session, `/day` answers 401, and
  both viewports still scan the pending composition (ADR-0031 consequence (e)).
- **`route-client-js.mjs`** must be re-run — a written convention, not ceremony:
  the script records *"RE-CHECKED at #96 rather than carried forward (step-6
  finding M6), over a fresh `rm -rf .next && pnpm build`"*, and this ticket moves
  both the baseline and the conclusion surface. Two things the measurement has to
  be read with:
  - **The re-measured surface is EIGHT routes, not four.** `conclusion-view` is
    reached from `/<jogo>/concluido` *and* from `/<jogo>`, because the screen roots
    swap to `ConclusionView` in place (`sudoku-screen.tsx:50`). The script's own
    comment already records that bimodality (*"The eight routes that carry the
    conclusion screen root … grew +6.5 to +6.7 KB"*).
  - **The direction, so a green run is not read as comfort.** `/` is the
    **baseline**, so growing the hub *shrinks* every other route's delta. Baseline
    and conclusion routes grow here by roughly the same weight, so the deltas
    should come out near-flat and prove very little — the `#19` precedent the
    script documents is exactly this (*"the card side won by ~0.5 KB, so every
    measured delta moved UP a hair"*). The figures that actually need updating are
    the absolute ones, and the load-bearing line is **`/nonogram` at 37.5 KB
    against the shared 40 KB budget — 2.5 KB of slack** — with its two siblings.

  The new code is a fetch, a small store and a zod schema on a graph that already
  carries zod. Measure over a fresh `rm -rf .next && pnpm build` and update those
  figures.
- **Landmines.**
  1. Five `useDayState` calls per hub render — a per-hook fetch is five GETs.
     D5 exists for this.
  2. `useSyncExternalStore` loops forever on an unstable snapshot. The store
     must return the same object when nothing changed (`T-WEB-S238`).
  3. The archive must not acquire `day-state` or the day client
     (`T-WEB-S183`, ADR-0053 decision 9).
  4. The free-play wall fails **open** for a directory nobody bans
     (`T-LINT-S47`).
  5. The hub's date is the web server's clock and the payload's is the DB's.
     Without the equality gate the tiles lie for the length of one rollover.
  6. `apps/api` has no migration runner: nothing here needs one, and that is
     asserted in D3 rather than assumed.

## 7. For Fernando — assumptions taken, flagged for the morning

Four items, all product-visible, none blocking the build. I proceed under the
stated assumption in each; any of them reverses cheaply.

1. **A game completed on another device shows `Feito` with no time.** The payload
   carries no duration (D6), so the cross-device done tile renders the chip-only
   shape the hub already ships for a won Termo. *Assumption taken: correct — a
   time this device did not measure is not this device's to publish. Adding
   `elapsedMs` to the wire is one field and one test if you disagree.*
2. **Termo, both directions of one rule — please answer them together.** The
   server wins wherever it speaks, which means:
   - **Demotion** — won here, lost on another device: the tile flips `Feito` →
     `Jogado` a moment after the page settles, and `X de 4` drops by one.
   - **Promotion** — lost here, won on another device: the tile reads `Feito`
     with `em 4/6`, and tapping it restores **this device's loss screen**.

   *Assumption taken: ship both.* The server is the streak's authority, and
   showing `Feito` on a day the streak does not count is the lie the player can
   catch (ADR-0031 decision 2). The alternative — *"`played` wins whenever either
   side says `played`"* — buys a consistent Termo tile at the price of the hub
   disagreeing with `/streak`'s `todayCounts`, which is exactly the trade this
   plan rejects for the demotion. Reversing it is one line in `mergeDayStatus`
   plus `T-WEB-S233`'s arms.
3. **A cross-device `Feito` tile leads to a playable board — in all four games.**
   The conclusion swap reads the *local* record, and cross-device there is none.
   *Assumption taken: ship it, named.* The replay writes nothing (ADR-0053
   decision 10 layer 1) and layer 3 already calls this shape *"the honest gap"* on
   the archive; what is new is that the daily hub points at it. If you would
   rather the tile were inert cross-device, that is a tile-shape decision, not a
   merge one, and it does not touch the contract.
4. **An already-open, already-focused tab never updates on its own.** Refresh
   fires on mount, on remount, on `visibilitychange`, on `focus` and on `online` —
   there is no interval. A second monitor left sitting on the hub is precisely the
   case that misses. *Assumption taken: accepted for v1.* The successor is a poll
   or a push, and the trigger for revisiting is a complaint, not a schedule.

One thing genuinely outside this plan's authority: whether the hub should
eventually collapse `/streak`, `/stats` and `/day` into one hub read. The shape
after this ticket is **two** credentialed GETs on a normal hub view (`/streak` and
`/day`) and **three** once Termo is done — `/stats` is fetched only by
`TermoDoneLink`, which mounts only for a *completed* Termo
(`hub-day-state.tsx:105-107`), and this ticket makes that three-GET case **more
frequent**, because a Termo completed on another device now mounts `TermoDoneLink`
where it previously did not. Add one `GET /day` on each conclusion surface — all
eight play/conclusion routes, at the moment the board closes (§2, §6). ADR-0051
decision 3 already owns that collapse trigger and quantifies it; I have not
pre-empted it.

## 8. Deviation register

1. **The plan number and the ADR number are both contested by parallel work**
   (header note). `056` was taken over `054`/`055`; `0060` is claimed on the same
   assumption and **must be re-verified** (`ls docs/adr | tail -3`) before the file
   is written, as must the test-id frontier (§4).
2. **`T-WEB` headroom is one tail, not two.** `S241` was spent at step 4 on the
   playable-board pin (B4), leaving `S242`. Two headroom per area is the shipped
   shape; one is a deliberate spend on a named consequence, and unspent tails burn.
3. **Step-4 changes** — the step-3 review's findings, each applied; step 5 and the
   step-6 reviewers can diff this list against the review.
   - **A2** (improvement) — D1's nested-`games` bullet now argues from
     *heterogeneity*: `/stats`'s four per-game values are `timedGameStatsSchema` ×
     3 + `termoStatsSchema` interleaved with two scalars, so `Record<Game, X>`
     never existed in that payload; `/day`'s are homogeneous, so
     `DayResponse["games"]` **is** `Record<Game, DayStatus>` by construction.
   - **A3** (MAJOR) — the false warrant is gone. D1 and ADR-0060 decision 2 now
     read *"no `onTime`, because nothing consumes it"*, name
     `packages/core/src/contracts/completion.ts:223`'s `onTime: z.boolean()` as the
     counter-example, and quote ADR-0051 decision 1's actual, narrower sentence.
   - **A5** (NIT) — D1's route bullet: the clone carries the shipped route's
     **no origin guard** and **no content-type check** comments.
   - **B1** (MAJOR) — the invariant is restated in the review's words: the server
     makes a claim exactly when its status is not `pending`, and `pending` is the
     absence of a row and therefore of a claim, never a denial. ADR-0060 decision 3
     now inherits the **formula** as well as the prose.
   - **B3** (MAJOR) — §7 item 2 carries both directions of the Termo case as one
     decision; D2 consequence 1 carries the traced mirror (device B wins, device A
     loses all six, A's POST short-circuits on the PK, A discards the response's
     outcome per ADR-0053 decision 10, merged reads `completed`, `Feito` +
     `em 4/6` on a `<Link>` that restores a loss screen). `T-WEB-S233` keeps both
     arms.
   - **B4** (MAJOR) — the playable-board gap is named: new D2 consequence 3,
     ADR-0060 decision 8, §7 item 3, and `T-WEB-S241` to pin it. ADR-0053 decision
     10 layer 3's *"honest gap"* is cited as the precedent, with the daily hub
     named as the first surface to point at it.
   - **C1** (NIT) — §2's `page.tsx` bullet corrected: `:59-61`, one `new Date()`,
     `todayInSaoPaulo(now)` for the masthead strings and `todaySaoPauloDate(now)`
     for the tiles' date, against `todaySaoPaulo(db)` on the payload.
   - **C2** (MINOR) — D5's Rollover paragraph says how the skew recovers (the next
     matching-date fetch: `visibilitychange`, `focus`, `online` or a remount) and
     that on a focused tab it may not.
   - **C3** (MINOR) — D2's precondition paragraph names the difference from the
     `TermoDoneLink` precedent: that gate discards a caption, this one discards a
     tile shape — same mechanism, strictly larger blast radius.
   - **D1** (NIT) — "six existing test call sites" corrected to **~14**, with the
     one runtime caller named.
   - **D3** (NIT) — D4 states the silent parse failure as chosen, matching
     `streak-client.ts:38-40` and `stats-client.ts`, with the three-client ticket
     named as the alternative.
   - **E1** (MAJOR) — the refresh story: the trigger is **listener count 0 → 1**
     (with the `/sudoku/concluido → /` remount as the reason it matters), `online`
     joins the set, the already-focused-tab residual is stated in D5, in ADR-0060
     decision 5 and in §7 item 4, and the *"no interval is a gate on ADR-0056"*
     framing is dropped — ADR-0056 decision 1 governs a `localStorage` poll, not a
     network one. The no-interval choice stands, re-warranted on its own cost.
   - **E3a** (MINOR) — `useDayTruth()` takes **no argument**, with the reason
     written down: a `date` parameter would make one module-level slot serve a
     keyed projection, ADR-0056's exact defect one level up.
   - **E3b** (MINOR) — cleanup drops the listeners and **retains** the payload;
     clearing it would demote every cross-device tile for the length of a fetch on
     every remount. In D5 and in `T-WEB-S231`.
   - **E3c** (MINOR) — `T-WEB-S231` and `T-WEB-S238` assert **plain and in
     StrictMode**, per `T-WEB-S214`'s convention and the React 19 double-effect
     `use-streak.ts` documents.
   - **E4** (MINOR) — renamed throughout: `src/day/day-truth.ts`, `useDayTruth()`,
     `fetchDayTruth()`. `serverDayState` at `day-state.ts:183` already means the
     React SSR snapshot, two lines from where the new hook would have sat.
   - **F2** (MAJOR) — §5 batch E gains a **nine-row prose-falsification table** in
     the ADR-0056 shape, and the ADR-0031 amendment widens from consequence (d)
     alone to **decisions 1 and 2 and consequence (d)**, each with what survives —
     decision 2's never-overstate property does, its "absence renders pending"
     mechanism does not.
   - **F4** (MINOR) — §6: the re-measured surface is **eight** routes, the
     direction is stated (growing the baseline shrinks every other delta, so a
     green run proves little), and `/nonogram`'s **37.5 KB / 2.5 KB of slack** is
     named as the figure that matters.
   - **F5a** (NIT) — ADR-0060 lands **`Accepted`** at step 5; `Proposed` is for the
     first PR of a two-PR ticket and this is one PR.
   - **F5b** (NIT) — ADR-0048 gains a one-line *"discharged at #83 / ADR-0060"*
     reciprocal, and it is in batch E's file list.
   - **F6** (MINOR) — `T-CORE-S92` re-aimed at **pointwise-ness** rather than
     restating S91's other branch. `T-CORE-S93`, the cross-endpoint invariant, is
     untouched.
   - **F7** (MINOR) — §7's arithmetic fixed: **two** credentialed GETs on a normal
     hub view, **three** once Termo is done (a case this ticket makes more
     frequent), plus one on each conclusion surface.
   - **F8** (MINOR) — D1 says `pending` is not a `CONTEXT.md` term, in the
     contract's own words.
   - **Not applied: none.** The `docs/README.md` row for this plan was updated in
     the same pass, since it repeated the A3 warrant and the ADR-0056 "gate"
     framing verbatim.

4. **Step-5 deviations**, each dated 2026-08-19 and recorded here rather than
   patched forward silently.

   - **The ADR keeps `0060` although `0059` was free.** `ls docs/adr | tail -3`
     at step 5 read `0056`, `0057`, `0058` — so `0059` is unclaimed on `main`.
     It is kept for #126 (open, its plan `055` not yet landed), whose property
     split this plan's header note already allocated it to and whose agent is
     working tonight. Taking it would have raced a parallel branch, and every
     comment in this diff — nine source files, three ADRs, two docs — already
     names ADR-0060. The cost is a numbering hole if #126 lands without an
     ADR; the repo has no contiguity rule, and the alternative was a collision.
   - **`T-WEB`'s reserved range shifted by one, to `S231…S243`.** §4 reserved
     `S230…S242` off a frontier row that read `S231` next free while `S230` was
     already in use: #63 (Tier 1, no plan) spent it hours earlier on
     `apps/web/test/aligning-numerals.test.ts`. The step-5 grep caught it
     before an id was minted. Every §4 `T-WEB` id therefore reads one higher
     than the table above: `S230 → S231`, … , `S242 → S243` (burned).
   - **The status vocabulary lives in `packages/core/src/day.ts`, not in
     `contracts/day.ts`.** D1 wrote `dayGameStatusSchema` into the contract
     file; it is declared beside the arithmetic instead, and the contract
     imports it — the `COMPLETION_OUTCOMES` / `completionOutcomeSchema`
     arrangement, and the direction every other contract already runs
     (`contracts/completion.ts` imports from `../completion`). The names are
     the plan's, unchanged, and `T-CORE-S95` is what makes the single spelling
     mechanical rather than stated.
   - **`dayStateFromRows` defines the duplicate-row case, which the plan did
     not.** Two rows for one game are impossible by the composite primary key;
     the fold takes the **weakest** claim if it ever saw two, which makes the
     function order-independent over an ARBITRARY row array rather than only
     over the arrays the schema can produce — so `T-CORE-S93` can quantify
     without a caveat — and errs in the never-overstate direction ADR-0031
     decision 2 permits.
   - **`readDayState`'s merge body is shared with `useDayState` through a
     private `applyDayTruth`.** D4's snippet showed `useDayState` composing a
     `mergeDayState(local, date, truth)` that packages/core cannot own (core
     has no `DayEntry` and no clock). The shipped shape: `readDayState(date,
     server?)` = local projection + `applyDayTruth`, and `useDayState` =
     subscribed local snapshot + `applyDayTruth` — ONE body, so the seam the
     tests drive is literally the code the hub runs. `dayStateSnapshot` keeps
     calling `readDayState(date)` with one argument, as D4 states.
   - **Four web test files, not three** (`day-client.test.ts`,
     `day-truth.test.tsx`, the `day-state.test.ts` extension and
     `hub-day-truth.test.tsx`). The store's tests need JSX (StrictMode as a
     wrapper) and `day-state.test.ts` is a `.ts` file; splitting the rendered
     surfaces out of it was cheaper than converting it.
   - **`packages/core/test/day.test.ts` carries the properties too**, rather
     than a `day-properties.test.ts` sibling — the plan's own file list, on
     `date.test.ts`'s precedent. The subject is ~180 lines of source and the
     three files would only ever change together.
   - **`T-API-S115` was spent, not burned.** The route-module export shape
     (`GET` + `dynamic`, the no-OPTIONS absence) is `T-API-S51`'s claim about a
     SECOND route in a second file, so it needed its own id rather than a
     cross-file span — the `T-CORE-S18a`/`S18b` rule. `S116` is the burned tail.
   - **The route's two reads are sequential**, where `/streak` runs its pair in
     one round-trip window: the day read is scoped BY the day, so it cannot
     start before the clock answers. Named in the route's own comment.
   - **A FAILED fetch retains the held payload**, as cleanup does. D5 specified
     retention on unsubscribe and left the failure case unstated;
     `fetchDayTruth` answers `undefined` for a network blip and a real absence
     alike, so clearing would demote every cross-device tile on a transient
     failure — the loss retention exists to avoid. The date precondition still
     bounds how long a retained payload can be believed.
   - **Three of the nine prose sites were fixed in batch D, not E.** The three
     in `src/play/day-state.ts` are in the file batch D rewrites, and shipping
     a commit whose own header contradicts its body is what step 6 rejects.
     The other six landed in E as written.
   - **`T-DB-S59` asserts `onTime: false` for the yesterday-dated row.** It is
     written TODAY, so `onTimeSql()` derives false — the reader returns the row
     unfiltered and packages/core turns it into `pending`. The first draft
     expected `true` and was wrong about the fixture, not about the reader.
   - **ADR-0060's status line names `#133` as its PR, unverified.** The
     lifecycle rule (`docs/agents/domain.md`) requires `shipped in #PR` at step
     5, and no PR exists yet at step 5 by this ticket's own instruction. `#133`
     is the next number after `#132` (the last merge at the time of writing)
     and **must be re-checked and corrected on the PR's first push**, together
     with the date if the merge day has moved.
