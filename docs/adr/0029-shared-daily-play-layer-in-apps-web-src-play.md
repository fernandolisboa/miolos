# ADR-0029 — Shared daily-play code lives in `apps/web/src/play/`; the board and its input model stay per game

**Status:** Accepted — 2026-08-01
**Depends on:** [ADR-0002](./0002-plain-react-web-ui-not-universal-rn-web.md), [ADR-0008](./0008-completion-and-streak-semantics-across-play-modes.md), [ADR-0018](./0018-i18n-is-an-in-repo-typed-message-module.md), [ADR-0026](./0026-completions-are-write-once-rows-on-time-is-derived.md), [ADR-0027](./0027-the-hint-is-computed-on-the-client.md), [ADR-0028](./0028-daily-play-routes-and-the-conclusion.md)

## Context

Issue #18 shipped the first play screen as `apps/web/src/binairo/*`:
a reducer, an engine adapter, a play record, an offline sync queue, a
hint, a lifecycle hook, a board, controls, a conclusion view and two
stylesheets. [ADR-0028](./0028-daily-play-routes-and-the-conclusion.md)
already settled the *route* shape every later game inherits — *"**Every
future game screen is a copy of this shape**, not a new decision:
#23/#25/#27 add a slug, a `routes` entry, two `force-dynamic` server
segments and a conclusion view."* — and deliberately said nothing about
the modules behind those segments. Issue #23 is the second game, so the
question it left open is now forced: does the second screen copy those
modules, or share them?

**The trigger for answering it now is a correctness argument, not a
style one.** `apps/web/src/binairo/sync.ts` holds module-level
singletons — `flushing`, `reminted`, `retryStep`, `retryTimer` and the
`memoryQueue` map (`sync.ts:45-60`) — and they guard a **game-blind**
queue: `listPendingRecords()` (`play-record.ts:151`) scans the whole
`miolos:play:` `localStorage` prefix and returns *every* game's pending
records. `startCompletionSync()` is already registered twice in one
session (the play hook and the conclusion), and the module-level guards
are exactly what makes that overlap free. Two *copies* of the module
mounted in one SPA session would each POST every pending record and each
settle the other's — a double write against
[ADR-0026](./0026-completions-are-write-once-rows-on-time-is-derived.md)'s
idempotent replay, two independent retry ladders, and two 401 re-mints.
That is a bug, not a duplication smell.

A second fact forces part of the move regardless of taste:
`readPlayRecord(date)` hardcodes `playRecordKey("binairo", date)`
(`play-record.ts:113`), so a Sudoku screen calling the shipped signature
restores a 64-cell Binairo board into an 81-cell grid. The signature has
to change whether or not the module moves.

**[ADR-0002](./0002-plain-react-web-ui-not-universal-rn-web.md) is cited
here for placement only, and it is not a timing rule.** Its clause reads:
*"shared _web_ components may live there once a second consumer exists,
and until then they live in `apps/web`."* In an ADR whose whole subject
is web-versus-native code sharing, _there_ is `packages/ui` and _a second
consumer_ is a second consuming **package**. So ADR-0002 fixes **where**
a shared UI layer may live; it does not decide **when** two screens in
one app should stop being copies. An earlier draft of the #23 plan read
it as a timing rule and was wrong.

## Decision

1. **The shared layer is `apps/web/src/play/`, and it is
   app-internal by construction.** `packages/ui` is untouched and stays
   JSX-free: it holds tokens and primitives, has no second consuming
   package, and a play lifecycle hook is neither a token nor a pure
   value-returning function.

2. **The seam is "the non-visual layer, the conclusion and the layout
   stylesheet are shared; JSX composition is per game".** Shared:
   `types.ts` (`PlayCore`, `HintState`, `LifecycleAction`,
   `ConclusionCopy`), `timer.ts`, `play-record.ts`, `sync.ts`,
   `grid-hint.ts`, `progress.ts`, `use-play-lifecycle.ts`,
   `use-record-snapshot.ts`, `day-state.ts`, `conclusion-view.tsx` with
   its stylesheet, `timer-readout.tsx`, and `screen.module.css` — the
   game-agnostic part of the play screen's layout, where the tuned
   values, the recorded frame deviations and the `impeccable` fixes
   actually live. Per game: the reducer and its action set, the engine
   adapter, the board, the controls or keypad, the board-geometry
   stylesheet, the play composition and its skeleton, the screen root,
   and all copy.

3. **`sync.ts` is exactly one module, permanently.** Its genericity is
   scoped to the **queue, retry ladder and settle machinery**;
   `buildBody` is the one per-game dispatch **inside** it. Termo's
   completion request carries guesses rather than a grid, so #27 adds a
   branch there — never a second sync module.

   **Qualified at #27 — the RE-MINT left this inventory, and only the
   inventory moved.** The list above also named the re-mint. `sync.ts` still
   *asks* for one on a 401, but the once-per-page-load allowance and the
   in-flight mint promise now live in `apps/web/src/session/bootstrap.ts`
   beside the shared promise they guard. Two modules re-mint since #27 — the
   completion flush and `termo/guess-client.ts`'s turn — and a boolean in
   each, over one shared promise, put two cookieless `POST /session` calls in
   flight at once, which costs the day
   ([ADR-0039](./0039-termo-cannot-be-played-offline.md) decision 4, as
   corrected). This decision's load is untouched: `sync.ts` is still exactly
   one module, still owns the queue, the ladder and `settle`, and there is
   still no second sync module.

4. **The play record is a discriminated union on `game`, and `v` stays
   `1`.** Records are keyed `(game, date)`; `readPlayRecord(game, date)`
   discards a record whose own `game` disagrees with the key it was
   found under, so a hand-edited store cannot feed one game's board into
   another's.

5. **The lifecycle's terminal predicate is "the game is CLOSED", never
   "the grid is solved".** `PlayCore.status` is
   `"playing" | "solved" | "lost"` from day one and every lifecycle gate
   tests `status !== "playing"`; the record builder's flag is `closed`.
   [ADR-0008](./0008-completion-and-streak-semantics-across-play-modes.md)
   keeps `lost` Termo-only — *"the outcome (won / lost, the latter
   Termo-only)"* — and a `"playing" | "solved"` union would leave a
   Termo loss with a running clock, no completion write and no way out
   of the play view. Binairo and Sudoku narrow the union in their own
   state types and gain nothing to carry.

6. **`play/grid-hint.ts` is the shared hint for grid games whose
   solution is client-recoverable from the published givens**, generic
   over an unconstrained cell type. It is named `grid-hint`, not `hint`,
   so the shared layer's naming stays honest.

7. **There is no shared `PlayCopy`.** Only the conclusion's copy is
   unified, as `ConclusionCopy` — exactly what the conclusion view
   reads.

## Rejected

- **Duplicate into `src/sudoku/` now and extract at #25.** The
  option that looks cheapest and is the one with a correctness defect:
  two `sync.ts` modules over one game-blind `localStorage` queue double
  the POSTs and cross-settle each other's records. It also copies 935
  lines of conclusion (`conclusion-view.tsx` 343 + its stylesheet 592)
  that will diverge before #25, does not avoid the `readPlayRecord`
  signature change anyway, and turns #25's and #27's merges into 3-way
  and 4-way ones.
- **Extract everything, including a reducer generic over the cell
  type.** It buys roughly a hundred more shared lines and costs a
  strategy-object reducer that must express both "a tap cycles through
  three values and a drag paints" and "select a cell, then type a
  digit, with roving focus". The abstraction would be wider than what it
  hides.
- **A `<PlayShell>` component taking the board, the controls, the hint,
  the timer and the copy as node props.** A shallow module: an interface
  as wide as its implementation, and it would force every game's JSX
  through one prop list for no shared behaviour.
- **Putting the layer in `packages/ui`.** It needs JSX and React state,
  `packages/ui` has no second consuming package, and ADR-0002 forbids
  the component abstraction that would grow there.
- **Bumping the play record's `v` "to be safe" while reshaping the
  schema.** A version bump discards every stored record on deploy, and a
  discarded record carrying `pendingSync: true` is the only copy of a
  completion the server has not acknowledged — a lost streak day.
- **Extracting the pointer-stroke machinery with the rest.** See
  consequence (c).

## Consequences

- **(a) `packages/ui` is unchanged and stays JSX-free.** This layer is
  `apps/web`-internal by construction, and nothing here weakens
  ADR-0002's veto on a cross-platform component abstraction. A future
  native client still shares `packages/games` and `packages/core` and
  reimplements the screen.
- **(b) The shared boundary is stated as a rule, not a file list:** CSS
  and the non-visual layer are shared, JSX composition is per game. A
  later contributor who wants to "finish the job" by hoisting the board
  into `play/` is undoing decision 2, not completing it.
- **(c) The pointer-stroke machinery stays in `binairo/grid.tsx` until
  #25 gives it a second consumer.** Sudoku does not drag, so extracting
  it now would create a shared module with exactly one consumer. That is
  plain YAGNI — **not** an ADR-0002 consequence, which is a rule about
  packages, not about directories inside `apps/web`.
- **(d) `playRecordSchema` may never bump `v`.** The rule outlives this
  ticket: every future game adds a member to the discriminated union,
  and a member is additive. Only a change that genuinely cannot be
  parsed as `v: 1` may bump it, and then it owes a migration that
  preserves records with `pendingSync: true`.
- **(e) The terminal predicate is a shared concept with one
  definition.** `PlayCore.status` and `buildRecord`'s `closed` flag are
  where "the game is over" lives; a game that adds a terminal state adds
  a literal there rather than a second predicate in its own hook.
- **(f) #27 extends `buildBody`, not the module count.** The rule that
  makes this stick is decision 3: the queue's guards are module-level
  singletons, so genericity below `buildBody` is a correctness property
  and the per-game branch has to live inside the module that owns them.
- **(g) ADR-0027's argument does not transfer to Termo.**
  `play/grid-hint.ts` serves games whose published projection carries
  the givens the solution is recoverable from
  ([ADR-0027](./0027-the-hint-is-computed-on-the-client.md): *"today's
  board is _published_, its givens are legitimately in the client's
  hands"*). Termo's public projection is `game, date` only and its
  guesses are judged server-side, so its answer is never on the wire and
  a client-computed hint is structurally impossible. #27 decides Termo's
  hint on its own evidence; nothing here has decided it.
- **(h) The per-game `play` copy bundles are structurally different by
  construction** — Binairo's carries sticky-mode button copy, Sudoku's
  carries the keypad, the level label and the level names — so only
  `ConclusionCopy` is shared. Unifying the play bundles behind one type
  would be the same shallow abstraction decision 2 rejects for
  components, in the layer
  [ADR-0018](./0018-i18n-is-an-in-repo-typed-message-module.md) makes
  the migration contract.
- **The extraction is a move, not a rewrite.** It lands as its own
  commit with the Binairo suite green and its assertions unchanged in
  *what they assert*. The findings #18 paid for are encoded in those
  bodies — the `pageshow` gate, the two clobber guards, the two-sided
  `elapsedMs` clamp, the completion handoff — and a tidy-up while moving
  is how they come back.

  **Qualified at #25's step 7:** this governs the extraction COMMIT, not
  the extracted module's future. `usePointerStroke` gained a window-scoped
  stroke-end net in a later commit on the same branch, which does change
  Binairo's cycle-mode path — see
  [ADR-0037](./0037-the-nonogram-board-is-a-three-state-brush-board.md)
  decision 2's amendment. A later change to shared machinery is ordinary
  work; presenting it as part of "a move" is what this line forbids.
