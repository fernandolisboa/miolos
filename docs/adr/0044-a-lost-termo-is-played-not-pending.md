# ADR-0044 — A lost Termo is *played*, not pending: the record carries its outcome and day state carries three verbs

**Status:** Accepted — 2026-08-02
**Depends on:** [ADR-0008](./0008-completion-and-streak-semantics-across-play-modes.md), [ADR-0026](./0026-completions-are-write-once-rows-on-time-is-derived.md), [ADR-0029](./0029-shared-daily-play-layer-in-apps-web-src-play.md), [ADR-0031](./0031-per-device-day-state-is-a-local-monotone-safe-affordance.md), [ADR-0032](./0032-a-nonogram-is-finished-when-the-picture-is-painted.md), [ADR-0033](./0033-the-nonogram-reveal-ships-no-name.md), [ADR-0038](./0038-termo-guesses-are-judged-by-a-stateless-server-route.md)

## Context

[ADR-0008](./0008-completion-and-streak-semantics-across-play-modes.md)
decision 3 has been in the repo since M0: *"A lost Termo is **played**, not
completed. The loss records in the Termo guess distribution as the fail row
— standard Termo behavior — but counts for neither streak nor Dia
Perfeito."* Nothing has ever produced one. `PlayCore.status`'s `"lost"`
member (`PlayCore` in `apps/web/src/play/types.ts`) is a
declared-but-dead union member, carried by
[ADR-0029](./0029-shared-daily-play-layer-in-apps-web-src-play.md)
decision 5 *"from day one"* for exactly this ticket.

Issue #27 is the first producer, and it forces three questions the shipped
layer cannot answer:

- **The play record has no shape for a Termo.** All three members are a flat
  `entries` array plus an optional solved `grid` (the three grid schemas in
  `apps/web/src/play/play-record.ts`). Termo's state is a sequence of judged
  guess rows, and its tiles cannot be re-derived on the client: the answer
  is on no payload, and `evaluateGuess` needs it.
- **`DayEntry` collapses "played" and "completed" into one boolean.**
  `DayEntry.concluded` (then in `apps/web/src/play/day-state.ts`) is read by
  the hub's meta line, every hub card's action, the conclusion's day chips
  and the conclusion's chaining CTA. Under it a lost Termo is either a lie
  (`concluded: true` on a game that completed nothing, counted in "X de 4
  concluídos" on a day ADR-0008 decision 4 says is not perfect) or a trap
  (pending on a board with no guesses left — and `nextPendingDaily` chains
  on `!entryOf(candidate).concluded` with termo FIRST in `DAY_GAMES` (both
  in `apps/web/src/play/conclusion-view.tsx`), so it would be offered as the
  next pending daily on every other game's conclusion, forever).
- **`sync.ts`'s per-game dispatch is fail-closed and fires immediately.**
  `const unhandled: never = record` (`buildBody` in
  `apps/web/src/play/sync.ts`) makes a new `playRecordSchema` member a red
  typecheck until `buildBody` has its case.

[ADR-0031](./0031-per-device-day-state-is-a-local-monotone-safe-affordance.md)
decision 2 constrains any fix: *"A false pending is invisible — … A false
done would be a lie the player can catch."*

## Decision

1. **The play record's termo member holds judged guess rows, and nothing in
   flight.** `guesses` is an array of `{ guess, tiles }`, at most
   `MAX_GUESSES`; `guess` is the **normalized** form matching
   `/^[a-z]{5}$/` and `tiles` is a five-tuple of the engine's `TileState`.
   A guess the server has not judged lives in reducer state and never
   reaches `localStorage`
   ([ADR-0039](./0039-termo-cannot-be-played-offline.md) decision 5).

   The tiles are **stored, not re-derived**: `evaluateGuess(guess, answer)`
   needs the answer, termo's public projection is `game, date` only
   ([ADR-0040](./0040-the-termo-daily-stores-the-drawn-answer.md)), and the
   record is written on every judged guess — so mid-play there is no answer
   in scope and a record without tiles cannot re-render the board after a
   reload.

   The guesses are **normalized, not canonical**, because that is the form
   every engine call already applies internally, the form the wire carries,
   and the only form available: `content/termo/canonical-map.csv` is
   harness input and does not ship, so no runtime path produces the
   accented spelling of an arbitrary guess.

2. **`answer` — the canonical accented answer — lives in the record,
   written only on the closing write.** It arrives on the guess response at
   the moment the board closes
   ([ADR-0038](./0038-termo-guesses-are-judged-by-a-stateless-server-route.md)
   decision 2). The completion response is a broken channel for it, by the
   identical argument
   [ADR-0033](./0033-the-nonogram-reveal-ships-no-name.md)'s rejected list
   makes for the motif name: `acceptResponse` copies only `elapsedMs` and
   `hintsUsed`, and only on the `recorded: false` branch
   (in `apps/web/src/play/sync.ts`), and the replay path returns before
   the wall read by
   [ADR-0026](./0026-completions-are-write-once-rows-on-time-is-derived.md)
   decision 4's design. Without the record, `/termo/concluido` cannot show
   the word. Its bound is `.length(5)` — measured, all 400 canonicals are
   exactly five codepoints and NFC.

3. **`outcome` (`"won" | "lost"`, from `@miolos/core`'s
   `completionOutcomeSchema`) is STORED on the record, not derived from the
   tiles at every read.** The reason is blast radius, not bytes:
   `day-state.ts` is on every route's client graph — the hub's meta line,
   every hub card, every conclusion's day card — and it must never import a
   game engine. Doing so would put the Termo engine on `/`, and one lost
   `/*#__PURE__*/` annotation away
   ([ADR-0045](./0045-the-termo-screen-ships-no-hint-and-no-clock.md)
   decision 5) the word list with it. The derivation keeps exactly one
   definition: **the Termo reducer's `restore` discards a record whose
   `outcome` disagrees with `deriveBoardStatus(tiles)`**, the same way
   `nonogram/state.ts` discards a size mismatch.

   **The `TermoBoardStatus` → `PlayCore.status` mapping is stated here,
   because it is stated nowhere else and it is not the identity.** The
   engine and the wire speak `"playing" | "won" | "lost"`
   (`packages/games/src/termo/status.ts:11`). `PlayCore.status` is
   `"playing" | "solved" | "lost"` and has **no `"won"` member**
   (`PlayCore` in `apps/web/src/play/types.ts`). The reducer's `judged`
   transition maps `won → solved` and passes `lost` through, in one place.

   **`outcome` is stored on the RECORD and is not duplicated into the
   state.** `TermoPlayState` carries no `outcome` field: it would be a
   second terminal predicate beside `PlayCore.status`, which
   [ADR-0029](./0029-shared-daily-play-layer-in-apps-web-src-play.md)
   consequence (e) forbids by name — *"`PlayCore.status` and
   `buildRecord`'s `closed` flag are where 'the game is over' lives; a game
   that adds a terminal state adds a literal there rather than a second
   predicate in its own hook."* `buildRecord` writes the record's field from
   `state.status` (`solved → "won"`, `lost → "lost"`), which is the same
   one-way mapping read backwards and needs no engine call. What decision 3
   rules out is *re-deriving `outcome` from the tiles inside `day-state.ts`*
   — a different operation, in a different module, and the one that would
   put an engine on every route.

4. **`DayEntry.concluded: boolean` becomes
   `DayEntry.status: "pending" | "completed" | "played"`, and `elapsedMs`
   is NEVER set unless `status === "completed"`.** The verbs are
   `CONTEXT.md`'s own, minus the late completion a local reader cannot see.
   A lost Termo carries **no duration**: `DayEntry.elapsedMs`'s own contract
   (in `apps/web/src/play/day-state.ts`) is *"publishing that as the
   day's result would put a time on a game nobody finished,"* and a lost
   Termo is exactly that.

   **The rule is one-directional, and an earlier draft wrote it as a
   biconditional — *"`elapsedMs` is set iff `status === "completed"`"* —
   which the same PR then broke by design.** `"completed"` does not imply a
   duration: `entryFor` returns `{status: "completed", elapsedMs: undefined}`
   for a **won** Termo (in `apps/web/src/play/day-state.ts`), because
   [ADR-0045](./0045-the-termo-screen-ships-no-hint-and-no-clock.md)
   decision 4 declines to publish this game's elapsed time on any projection
   — the number is dominated by per-guess latency and #29 replaces it with
   `em 4/6`. So Termo withholds the duration on **both** its outcomes, not
   only on the loss. The surviving half of the rule is the load-bearing one
   and it is unchanged: a `"pending"` or `"played"` entry never carries a
   duration, because that is the *false result* direction ADR-0031 decision 2
   forbids. `"completed"` merely *permits* one. Three consumers are
   split-guarded for exactly this — `hub-day-state.tsx:82`, `DayChip`
   (decision 9 of
   [ADR-0043](./0043-the-conclusion-has-a-fourth-state-and-it-is-a-loss.md))
   and `conclusion-view.tsx`'s `dayEntry` — so each narrows through the
   **value** after branching on the **status**, and nothing renders
   `undefined`.

   An enum rather than a second flag, deliberately. A `closed` boolean
   beside `concluded` would fail **safe** — a consumer that forgot it reads
   pending. This fails **closed**: `DayEntry.concluded` ceases to exist, so
   all eight consumers are a red typecheck and every one has to decide.
   That is the choice `sync.ts`'s `const unhandled: never` and this file's
   spelled-out `Record<Game, DayEntry>` literal already make.

5. **`doneCount` becomes `completedCount` and counts `"completed"` only;
   `nextPendingDaily` chains on `"pending"` only.** A lost Termo does not
   enter "X de 4 concluídos" (ADR-0008 decision 4: *"A day containing a lost
   Termo is not perfect, whatever else happened"*), and it is never offered
   as the next daily, because the CTA's own contract is *"the first daily
   this device can still play today"* and a spent Termo cannot be played
   today. The rendering of the third verb — the `jogado` chip — is
   [ADR-0043](./0043-the-conclusion-has-a-fourth-state-and-it-is-a-loss.md)
   decision 9.

6. **Monotone safety is preserved, and the check is recorded rather than
   asserted.** Absence still reads `pending`, so the cold profile, the
   second device and `impeccable detect` are unchanged. `played` is a
   **weaker** claim than `completed`, not a stronger one: it publishes no
   time and enters no count. It drives a chip, a tile shape and a CTA
   target — the affordances ADR-0031 decision 6 permits — and never an
   entitlement.

7. **The completion body carries the guess WORDS and no verdict.**
   `buildBody` gains one case; the body is
   `{ game, date, guesses: string[1..6], elapsedMs, hintsUsed }`. The tiles
   and `outcome` never leave the device: the server re-judges against its
   stored answer. A client-asserted outcome is the class of input
   ADR-0026's rejected list calls *"the one input that would make a streak
   forgeable."*

8. **A six-guess loss is a `200` with `outcome: 'lost'`, never a `422`.**
   422 keeps
   [ADR-0032](./0032-a-nonogram-is-finished-when-the-picture-is-painted.md)
   decision 4's meaning — well-formed but not this puzzle — and stays in
   `TERMINAL_STATUSES`. Collapsing the two would `settle(record,
   "rejected")` a legitimately played Termo, show the player *"Não foi
   possível registrar este resultado no dia de hoje"* and deny #29 its fail
   row.

9. **The guess flow does not ride `sync.ts`.** That module carries the
   completion and only the completion
   ([ADR-0039](./0039-termo-cannot-be-played-offline.md) decision 4).

## Rejected

- **Re-deriving tiles from `guesses` + `answer` on restore.** Mid-play
  there is no answer, so the board cannot render after a reload. This is
  not an optimisation trade — it is unimplementable.
- **Persisting the in-flight guess.** A reload would find a row with no
  tiles that had already spent one of six attempts, and no client path
  could ever fill it in. Losing five typed letters to a crash is strictly
  better.
- **Two parallel arrays, `guesses: string[]` and `tiles: TileStates[]`.**
  They need a length cross-refine, a hand-edited store can desynchronise
  them, and the paired shape is structurally the engine's own
  `EvaluatedGuess`, so `deriveKeyboardState` reads the record with no
  adapter.
- **Deriving `outcome` from the tiles inside `day-state.ts`.** See
  decision 3: it puts a game engine on the one module every route carries.
- **An `outcome` field on all four record members.** A field three games
  can never populate is the shallow uniformity ADR-0029 decision 2 rejects
  for components, applied to a schema.
- **A third boolean `closed` beside `concluded`.** See decision 4: it fails
  safe where this repo consistently chooses to fail closed.
- **A discriminated-union `DayEntry`.** It would make "elapsedMs iff
  completed" a type, and it would delete both consumers' deliberate
  value-narrowing (*"an entry that somehow lost its duration degrades to
  the pending button instead of rendering 'undefined'"*) — a defence worth
  more than the invariant it would replace. Decision 4's qualification
  makes this rejection stronger than it read when it was written: the
  biconditional is not merely unenforced, it is **false** — a won Termo is
  `"completed"` with no duration — so the union would have encoded an
  invariant the same PR breaks, and the required `elapsedMs` would have
  been a red typecheck at `entryFor`'s Termo branch.
- **Publishing a lost Termo's elapsed time on the hub tile or the day
  chip.** A loss is not a result, and a duration beside it frames it as one.
- **Posting `{outcome, guessCount}` instead of the guess list.** The client
  would be asserting the outcome. ADR-0026's rejected list forbids exactly
  this class of client-supplied fact.
- **Bumping the play record's `v`.** ADR-0029 consequence (d): a discarded
  record carrying `pendingSync: true` is a lost streak day.
- **Renaming the record's `answer` field to dodge `FORBIDDEN_DAILY_KEYS`.**
  That list bans keys on *daily payloads* and substrings in *page markup*;
  a post-completion local record is neither. Renaming to satisfy a grep is
  cosmetic and would leave the real constraint unrecorded.

## Consequences

- **(a) `PlayCore.status`'s `"lost"` finally has a producer**, and the
  distinction ADR-0029 decision 5 carried on faith is now exercised:
  `closed` and `solved` no longer coincide for one game. Every lifecycle
  gate is unchanged, because all of them already test
  `status !== "playing"`.
- **(b) Eight sites go red, and that is the mechanism.** `day-state.ts`
  (`DayEntry`, `PENDING`, `entryFor`, `completedCount`, `sameDayState`),
  `conclusion-view.tsx` (`dayEntry`, `nextPendingDaily`, `DayChip`) and
  `hub-day-state.tsx` (`HubProgress`, `HubCardAction`). No shipped game
  changes behaviour: `entryFor` returns `"completed"` wherever it returned
  `concluded: true` and `"pending"` wherever it returned `PENDING`.
- **(c) `day-state.ts` gains its first per-game branch.** Its TSDoc
  claiming the file *"is NOT a tripwire for #27 … nothing in this file can
  go red for it"* is half true and becomes false: no key is added to the
  map, but the entry type, the reader, the counter and the comparator all
  change.
- **(d) `use-record-snapshot.ts`'s `sameToTheReader` gains the guess
  count.** Its header already requires this: *"A per-game payload field
  that can move INDEPENDENTLY of `concluded` breaks that and must be added
  below."* It compares exactly five chrome fields today
  (in `use-record-snapshot.ts`'s `sameToTheReader` — by SYMBOL and not by
  line, because #96's docblock rewrite moved the paragraph this pointed at,
  `:116-127` → `:146-156`). `answer` and `outcome` do not need
  adding — the record schema now makes their lockstep with `concluded` a
  parse-time invariant. #27 owes Termo's copy of `T-WEB-S64` for that
  lockstep, asserted on `answer`.
- **(e) The `superRefine` guards two documented throws, not just a shape.**
  `deriveBoardStatus` raises `RangeError` for more than `MAX_GUESSES` rows
  and for any row following an all-correct row
  (`packages/games/src/termo/status.ts:25-36`). A record violating either
  must be unparseable, or it crashes the reducer on restore. **The proof is
  named example cases, not a property test** — a *complete* cover of a
  finite and small domain rather than a sample of it (`T-WEB-S75`). A
  property test is not merely unnecessary but out of scope:
  [ADR-0017](./0017-vitest-and-fast-check-are-the-test-stack.md) confines
  fast-check to *"a devDependency of `packages/games` only"*, and this
  `superRefine` lives in `apps/web`. An earlier draft of this consequence
  said *"#27 owes one"*; it does not.

  **The division of labour between the schema, the array bound and the
  reducer, corrected at #27's step 6.** An earlier draft of this paragraph
  listed the refinement's branches as *"over-length, a win not in the last
  row, `outcome` disagreeing with the derived status, and the well-formed
  case"* — it named one check the `superRefine` does not perform and omitted
  two it does. This paragraph is what a future author reads to reason about
  what a parsed record guarantees, so it states the shipped split
  (`termoPlayRecordSchema` in `apps/web/src/play/play-record.ts`, and its
  `superRefine`):

  - **`superRefine`, four issue branches, all four covered by `T-WEB-S75`:**
    a win not in the last row; `answer` present exactly when `concluded`;
    `outcome` present exactly when `concluded`; and a closed board with zero
    judged guesses. The last is what makes `termoBody`'s `undefined` return
    unreachable for a legitimately closed record — and `undefined` there
    permanently settles the record as `rejected`.
  - **Over-length is not a refinement.** It is `.max(TERMO_MAX_GUESSES)` on
    the array itself, alongside the five-tuple of tile states and the
    `/^[a-z]{5}$/` guess shape. Same guarantee, one layer earlier, and
    `T-WEB-S75` pins it behaviourally against the engine's own value-imported
    constants.
  - **`outcome` versus the derived status is checked in the REDUCER, not in
    the schema**, and that is decision 3's requirement rather than an
    omission: *"the Termo reducer's `restore` discards a record whose
    `outcome` disagrees with `deriveBoardStatus(tiles)`"*
    (`apps/web/src/termo/state.ts:285-288`). Putting it in the schema would
    put a `packages/games/termo` call inside `play-record.ts`, which is on
    every route's client graph — the exact import decision 3 exists to keep
    out. The two placements also fail differently, and the difference is
    wanted: a schema issue makes the record **unparseable**, so `entryFor`
    returns `PENDING`; a reducer mismatch discards the record for **this
    render** and leaves it on disk.
- **(f) A tampered local `outcome` produces a false COMPLETED on this
  device, and the honest statement of that is the one ADR-0031 cares
  about.** `entryFor` (in `apps/web/src/play/day-state.ts`) reads the
  record's fields without consulting the engine — it cannot consult it,
  because decision 3 keeps `day-state.ts` engine-free — so a hand-edited
  `{concluded: true, outcome: "won"}` on a six-loss board yields
  `status: "completed"`, enters `completedCount` and publishes a duration.
  That is the *false done* direction ADR-0031 decision 2 singles out
  (*"A false pending is invisible… A false done would be a lie the player
  can catch"*), and saying it *"buys a worse game and nothing else"* was
  wrong. It is nevertheless accepted, on the three facts that bound it:
  it is **device-local** (the record lives in a user-editable
  `localStorage` entry the player owns), it is **self-inflicted** — the
  only person lied to is the person who edited it — and it **never reaches
  the wire**, because the completion body carries the guess words and no
  verdict (decision 7). ADR-0031 decision 6 keeps it out of every award:
  *"It may drive an affordance — a chip, a CTA target — and never an
  entitlement."* This is ADR-0027's `hints_used` posture, unchanged.
- **(g) Termo's completion body is not byte-canonical across players**,
  unlike every grid game's under ADR-0032 decision 1. Two players who both
  won on guess 4 with different words post different bytes. The warrant is
  that the guess *sequence* is itself outcome-bearing state — ADR-0008
  requires the fail row and #29's distribution is a function of the guess
  count. Nothing beyond the sequence is carried, and ADR-0032's other two
  mechanics (the explicit shape check before the compare loop, 422 as
  terminal) are inherited unchanged.
- **(h) `playRoutes` stays `Partial<Record<Game, Route>>`.** With all four
  games routed, `hub-day-state.tsx`'s `route === undefined` branch and
  `conclusion-view.tsx`'s `?? routes.home` are dead. Totalising the map is
  a real simplification and is filed as a follow-up rather than done here:
  it touches the exact two consumers this decision is simultaneously
  rewriting.
- **(i) The hub's Termo tile shows a duration where the F1 frame draws
  `em 4/6`.** `DayEntry` deliberately gains no `guesses` field: the guess
  count is #29's fact, and a second derivation of it here would be the
  second copy ADR-0031 decision 1 forbids (*"Nothing else derives
  completion"*). The deviation is filed against #29 rather than absorbed
  silently. Note that the *conclusion's* stamp does show the guess count —
  it is composed from the record by a client component, not from `DayEntry`
  ([ADR-0043](./0043-the-conclusion-has-a-fourth-state-and-it-is-a-loss.md)
  decision 5).
- **(j) Records already on disk are untouched, and an unreadable one fails
  toward PENDING.** `DayEntry` is **derived, never persisted**: `entryFor`
  builds it in memory from `readPlayRecord` on every read
  (in `apps/web/src/play/day-state.ts`), so reshaping it costs nothing in
  storage and needs no migration. `v` stays **1** and the three shipped
  `playRecordSchema` members are untouched (the binairo, sudoku and nonogram
  schemas in `apps/web/src/play/play-record.ts` — three `v: z.literal(1)`),
  so a Binairo, Sudoku or Nonogram record written before this PR parses
  identically after it. A record that *does* fail to parse returns
  `undefined` from `parseAt` (`play-record.ts`), so `entryFor` returns
  `PENDING` — it **fails toward pending**, the safe direction ADR-0031
  decision 2 names. The honest corollary, stated rather than left implicit:
  an unparseable **Termo** record re-offers a spent board as playable, and
  what prevents the double count is not the client — it is the server's
  write-once row (ADR-0026 decision 1) plus the idempotent `getCompletion`
  short-circuit in `POST /completions`
  (`apps/api/app/completions/route.ts`), which returns the stored row before
  any judging.
