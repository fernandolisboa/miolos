# ADR-0045 — The Termo screen ships no hint and no clock; its bundle ships the validation dictionary and not the answers

**Status:** Accepted — 2026-08-02
**Depends on:** [ADR-0004](./0004-no-unpublished-puzzle-reaches-the-client.md), [ADR-0006](./0006-monetization-convenience-not-access.md), [ADR-0015](./0015-termo-word-list-is-ai-curated-under-mechanical-constraints.md), [ADR-0019](./0019-per-game-subpath-exports-in-packages-games.md), [ADR-0027](./0027-the-hint-is-computed-on-the-client.md), [ADR-0029](./0029-shared-daily-play-layer-in-apps-web-src-play.md), [ADR-0036](./0036-aligning-numerals-use-instrument-sans-not-fraunces.md)
**Amends:** [`docs/handoffs/001-handoff-project-foundation.md`](../handoffs/001-handoff-project-foundation.md) — "Decisões travadas → Produto", *"Dicas: 1 grátis por puzzle; extras via rewarded ad quando ads ativarem. Sem saldo acumulável."* (`:42`, having been `:41` before this ADR's own amendment row lengthened the table above it) — by scoping the free hint to the games that have something to hint: Termo ships **zero**, per Decision 1. This is a **product** rule, not a technical one, so the contradiction is surfaced rather than absorbed (`CLAUDE.md`, "When in doubt"): the founding handoff's amendment table gains a row and `CONTEXT.md`'s **Hint / Dica** row (`:19`) gains the Termo qualification, both in the commit that lands this ADR; and #27's PR body carries it as a named item Fernando may overturn. Reverting is one ADR and one button. The three grid games are untouched, and the wire bound stays `.max(1)` (Decision 2) so a later Termo hint is not a contract change.

## Context

The shared play layer hands every game the same chrome: a free-hint button
in its own grid area, a count-up timer in two responsive slots, a progress
meter, and a completion stamp whose three lines are a label, a time and a
hint count. Three grid games take all of it. Termo takes almost none, and
#27 has to say which, and why, before a step-6 reviewer asks.

Two threads meet here, and they are one subject: **what #27 declines to put
on the Termo client.**

- **The hint.**
  [ADR-0029](./0029-shared-daily-play-layer-in-apps-web-src-play.md)
  consequence (g) records that
  [ADR-0027](./0027-the-hint-is-computed-on-the-client.md)'s argument does
  not transfer — *"#27 decides Termo's hint on its own evidence; nothing
  here has decided it"* — and `apps/web/src/play/grid-hint.ts:16-21` says
  the same in the module's own header. ADR-0027:125-131 additionally
  forecloses the reverse move: *"Any future feature whose security rests on
  'the client does not have today's solution' is built on a false premise —
  including any Termo design that assumes the same for the answer word."*
  So the decision may rest on neither "the client can recover it" nor "the
  client must not know it."
- **The bundle.** `@miolos/games/termo`'s barrel re-exports `word-list`,
  which statically reaches `words.generated.ts` — 40,591 bytes of source,
  15,131 gzipped, holding both the 5,310-word validation dictionary and the
  400-word answer pool. The client genuinely wants `isValidGuess` (offline
  "não está na lista", #27 AC 3). It has no use for `TERMO_ANSWERS`.
  Handoff 021 §4.3 required a re-measurement for termo — #25 measured
  tree-shaking on the *nonogram* barrel — and named the only sanctioned fix
  as *"making the existing barrel tree-shakeable, never a sub-barrel and
  never a deep import."*

## Decision

1. **Termo ships no hint in #27** — not a client hint, not a server hint,
   not a placeholder standing in for one.

   The argument is neither of the foreclosed ones: **there is nothing to
   hint.** A grid hint reveals one cell of a solution the player is already
   writing into — 1/64 of a Binairo, 1/225 of a large Nonogram. Termo's
   board is *output*: the player writes guesses, not cells
   ([ADR-0042](./0042-the-termo-board-is-read-only-output.md) decision 1).
   The only things a Termo hint could reveal are a letter at a position —
   **one of five tiles, 20 % of the puzzle** — or a candidate from the
   answer pool, which decision 5 removes from the client. Revealing a fifth
   of a six-guess game is not a nudge; it is a different game, and choosing
   its economy is a product decision that belongs to a ticket whose
   acceptance criteria contain one. #27's do not.

2. **Termo's state carries no `HintState`.** `HintState`
   (`apps/web/src/play/types.ts:44-50`) is a standalone interface, composed
   by each game rather than part of `PlayCore`, so Termo simply omits the
   field. Nothing is widened, and `HintState.lastIndex: number | null` —
   *"the cell the hint filled"*, a flat board index with no Termo meaning —
   never has to be reinterpreted. `hintsUsed` is written as the literal
   `0`, and its `.max(1)` wire bound is unchanged because one free hint per
   puzzle is a **product** rule, not a per-game one
   (`packages/core/src/contracts/completion.ts:100-103`).

3. **The Termo conclusion makes no hint claim** — not in the stamp's
   visible third line, not in the composed accessible name.
   `messages.conclusion.hints(0)` renders "sem dicas", which on Termo would
   present as a virtue something that was never possible.

4. **The timer runs and is recorded; it is not rendered.** It must run:
   `PlayCore` requires it, the conclusion swap gates on
   `timer.runningSince === null`, and every completion request member
   requires a real `elapsedMs` — faking a constant `0` would put a false
   number in a write-once server row. It must not be shown: on a game with
   a server round trip per guess the number is dominated by latency and
   idle time ([ADR-0039](./0039-termo-cannot-be-played-offline.md)
   decision 8), #29's Termo statistic is the guess distribution rather than
   a duration
   ([ADR-0008](./0008-completion-and-streak-semantics-across-play-modes.md)),
   and the design system already draws Termo's hub result as `em 4/6`. The
   conclusion's stamp shows the guess count in the time's place; the
   mechanism is
   [ADR-0043](./0043-the-conclusion-has-a-fourth-state-and-it-is-a-loss.md)
   decision 5. Recorded and rendered are two different questions:
   `elapsedMs` still goes on the wire and into the play record for every
   Termo, won or lost, and what is withheld is the *`DayEntry`* duration —
   the hub and day-card projection, not the row.

   **That projection is withheld on BOTH Termo outcomes, and an earlier
   draft of this sentence said only *"on a `played` day"*.**
   [ADR-0044](./0044-a-lost-termo-is-played-not-pending.md) decision 4
   forbids a duration on a `"played"` entry — a time on a game nobody
   finished. This decision withholds it on the **won** one as well, for its
   own reason: the number is dominated by per-guess round trips and idle
   time, no Termo statistic will ever reflect it, and #29 puts `em 4/6`
   there instead. So `entryFor` returns `elapsedMs: undefined` for every
   Termo record (`apps/web/src/play/day-state.ts:168-175`), and a
   `"completed"` entry without a duration is a legal shape rather than a bug
   — which is why ADR-0044 decision 4's rule reads *never set unless
   completed*, one-directionally, and why `DayChip` branches on the status
   before narrowing through the value
   ([ADR-0043](./0043-the-conclusion-has-a-fourth-state-and-it-is-a-loss.md)
   decision 9). The `.progressCard`/`.progressBar`
   slots carry "tentativa N de 6", composed in Termo's own copy bundle —
   `apps/web/src/play/progress.ts`'s `countFilled` is not reused, for the
   reason that module already records about Nonogram: it would be *"the
   shallow reuse ADR-0029 rejects."*

5. **`TERMO_ANSWERS` must not reach the client, and the fix is two
   `/*#__PURE__*/` annotations in
   `packages/games/src/termo/word-list.ts:16-20` — one on `Object.freeze(`,
   one on `ANSWER_CANONICALS.split(`.** Both are required; annotating only
   the outer call does not work.

   **Measured** on this branch (`pnpm build` + `pnpm bundle-check`, probing
   an import from a `"use client"` root reached only by `/nonogram`,
   reverted): the engine alone costs +1.5 KB raw / +0.6 KB gzip and pulls
   **no** word list — Turbopack already shakes this barrel at module
   granularity. Adding `isValidGuess` costs +40.7 KB raw / +16.2 KB gzip
   **and ships the answer pool**, proved by three accented canonicals
   (`então`, `mamãe`, `época`) appearing in a client chunk;
   `validation.txt` is US-ASCII, so they can only come from
   `ANSWER_CANONICALS`. With both annotations: +37.9 KB raw / +14.4 KB
   gzip, the accented canonicals absent, the validation words present.
   **The answer pool costs 2.8 KB raw / 1.8 KB gzip.**

   **The reason is cost and strip-table integrity, and it is explicitly NOT
   confidentiality.** (a) 2.8 KB no client code reads, plus 400
   `Object.freeze` allocations and 400 `normalizeWord` calls at module init
   on the ritual's route. (b)
   `packages/core/src/contracts/daily-content.ts:146`'s termo row withholds
   *"the answer word, in any field"*; shipping the pool through a second
   channel leaves that row literally true and substantively hollow — the
   "second place for the same fact" ADR-0032 decision **4** refuses when it
   keeps `size` off the nonogram wire (ADR-0032:89-91 — decision 3 is the
   row-major bitmap encoding and makes no such argument). (c) ADR-0027:125-131 forbids the
   security register, and nothing in #27 rests on the client not holding
   the pool.

6. **The annotations ship with two gates, because a comment is not a
   mechanism.** `apps/web/scripts/route-client-js.mjs` gains the three
   accented canonicals in `FORBIDDEN` (`:115`) and one validation word
   (`zurro`) in `EXPECTED` (`:140`), so the negatives cannot go vacuous;
   and a new `packages/games/test/termo/bundle-markers.test.ts` proves
   those three are still in `TERMO_ANSWERS` and absent from
   `TERMO_VALIDATION_WORDS`. Two-way citation in both files, the pattern
   `packages/games/test/nonogram/bundle-markers.test.ts` already sets.

7. **`/termo` is not added to the 40 KB budget, and the shared
   `MAX_DELTA_BYTES` is not raised.** Termo's floor is +37.9 KB raw before
   one line of screen code, because ~36.4 KB of it is **content the ticket
   exists to ship**. The 40 KB constant
   (`apps/web/scripts/route-client-js.mjs:83`) was calibrated for routes
   whose whole delta is code, and raising it would simultaneously un-arm
   the tripwire for the three grid routes — the script's own header records
   that a motif leak is ~35 KB and lands near 69 KB. The script moves to
   **per-route budgets**, and `/termo`'s constant is set from the measured
   route rather than guessed here.

   **Closed at #27's step 6.** The step-6 performance review found `/termo`
   was the heaviest route in the app and the only play route gated by
   nothing, so the constant was set at **step 7** rather than the step 8 this
   decision named — a review finding is the earliest honest moment, and
   waiting would have merged the gap. `PER_ROUTE_BUDGET = { "/termo": 76 * 1024 }`
   sits beside the unchanged 40 KB default in
   `apps/web/scripts/route-client-js.mjs`, and `/termo` joins `BUDGETED`.
   Measured on the merge candidate: **+68.9 KB raw / +24.1 KB gzip over `/`**,
   which is ~9.3 % headroom — enough to absorb ordinary copy edits, tight
   enough that a second `packages/games` module reds it.

## Rejected

- **A client-computed Termo hint.** Structurally impossible: the answer is
  on no payload. Recorded so the impossibility is not re-derived.
- **A `POST /hint` endpoint for Termo.** ADR-0027's rejected list judges
  the shape *"the right shape for granted hints and the wrong shape for the
  free one"* — but on a premise Termo lacks, so the shape is not foreclosed
  here. What forecloses it is scope: a new authenticated route, a new
  contract, a new accounting surface and a new failure mode on the ritual's
  critical path, for an acceptance criterion that does not exist.
- **A `.placeholder` box in the hint grid area "for symmetry".**
  `apps/web/src/play/screen.module.css` is explicit that `.placeholder`
  exists so the **skeleton's** hint bar is at final dimensions — a
  pre-hydration affordance for a button that will exist. A permanent inert
  box for one that never will is the "dead share button"
  `conclusion-view.tsx` rejects by name.
- **Rendering the clock on the Termo screen for parity.** It would be the
  one number on screen that no statistic ever reflects, on a game whose
  elapsed time is mostly network latency.
- **Faking `elapsedMs` as `0`.** A false number in a write-once row
  ([ADR-0026](./0026-completions-are-write-once-rows-on-time-is-derived.md)
  decision 1).
- **Narrowing `hintsUsed` to `z.literal(0)` on the termo wire member.** The
  bound is a product rule, not a per-game one, so narrowing it would make a
  later hint a contract change.
- **Splitting `words.generated.ts` into two generated modules.**
  Structurally more robust — module granularity needs no annotation, as
  decision 5's measurement shows — and rejected on proportionality: it
  touches `renderTermoWordsModule`, the byte-identity staleness gate
  `packages/games/test/termo/word-list.test.ts:130-143` asserts against that
  renderer (plan 013 §3.4 — **not** ADR-0015, which requires a validation
  harness for the list's mechanical invariants and says nothing about byte
  identity), the renderer-independent anchor, `.prettierignore` and
  `.gitattributes`, i.e. surgery on the word-list harness, for 1.8 KB
  gzipped.
- **A `@miolos/games/termo/word-list` sub-barrel, or a deep import.**
  Vetoed outright by
  [ADR-0019](./0019-per-game-subpath-exports-in-packages-games.md).
- **Not shipping `isValidGuess` and validating guesses server-side only.**
  It would make "não está na lista" a round trip on every mistyped guess,
  which #27's AC calls out as instant, and it is the one thing on the Termo
  client that is public content by design.
- **Arguing any of decision 5 on confidentiality.** ADR-0027:125-131.

## Consequences

- **(a) The `hint` grid area and both timer slots have no occupant on
  `/termo`.** The 1fr `free` spacer that pins the hint button to the bottom
  of the sidebar pins nothing there. Whether the empty rows collapse
  cleanly at both bands is a browser fact, not a jsdom one, and is measured
  at implementation rather than asserted here. If either band shows a
  visible gap, the fix is Termo's own `grid-template-areas` override in its
  module — **never** an edit to the shared `screen.module.css` bands, which
  would touch three shipped screens.
- **(b) `/termo` is not a fourth surface for the timer digit-swing defect**
  ([ADR-0036](./0036-aligning-numerals-use-instrument-sans-not-fraunces.md)
  decision 5, issue #63), because it renders no `<TimerReadout/>`. #27 does
  not fix #63 and, by this decision, does not have to work around it.
- **(c) #67 is narrowed to one of its two fixes.** Its option (ii) — moving
  the mobile `hint` row above `board` in the shared `grid-template-areas` —
  would put an empty row between the title and the board on `/termo`.
  Option (i) (move the button after the board in the DOM, `grid-area: hint`
  on both bands) is now the only side-effect-free one. #67's owed tab-order
  test must accept a play screen with no hint button as a legal input.
- **(d) `play/grid-hint.ts` keeps exactly three consumers, permanently.**
  Its header's *"#27 … decides its hint separately"* is discharged: the
  decision is no hint, and the module's name stays honest for the reason it
  was chosen.
- **(e) The conclusion's stamp is widened for Termo**, under
  [ADR-0034](./0034-the-completion-celebration-renders-in-the-conclusion.md)
  decision 3's two rules — optional plain data, no functions or nodes,
  supplied only by a client component owning the local play record.
  `ConclusionResult` is still passed (the `result` branch gates on it),
  carrying `hintsUsed: 0` that nothing renders. The widening itself is
  [ADR-0043](./0043-the-conclusion-has-a-fourth-state-and-it-is-a-loss.md).
- **(f) The `/*#__PURE__*/` annotations are invisible to typecheck, lint
  and the test suite, and fragile to their own placement** — annotating
  only the outer `Object.freeze` was measured to leave the full 2.8 KB in
  the bundle. Decision 6's two gates are what make them a mechanism rather
  than a hope. A reviewer who deletes one "for tidiness" reds two suites.
- **(g) `apps/web/scripts/route-client-js.mjs` remains manual by design**
  (ADR-0027's amended consequence). A green CI still proves nothing about
  it, and decision 6's `packages/games` half is the only part that runs in
  CI.
- **(h) A `/*#__PURE__*/` on `TERMO_ANSWERS` changes nothing server-side.**
  `apps/api`'s answer selection imports it — decision 5's run-scoped
  eligible pool is `TERMO_ANSWERS` minus the used set
  ([ADR-0040](./0040-the-termo-daily-stores-the-drawn-answer.md)), so the
  binding stays live there; the annotation only permits elimination where
  nothing reads it.
- **(i) The `/termo` route's real First Load JS was unmeasured when this ADR
  was written, and is not any more.** Only the *floor* (+37.9 KB raw /
  +14.4 KB gzip) could be measured up front, by probing an existing route,
  because the screen's own code is unmeasurable until it exists — which is
  why decision 7 declined to guess the per-route constant.

  **Measured at #27's step 6**, on the merge candidate: `/termo` is
  **874.2 KB raw / 239.6 KB gzip**, i.e. **+68.9 raw / +24.1 gzip over `/`**.
  That reconciles with the floor rather than contradicting it — the floor is
  the *marginal* cost of the Termo library over an existing play route's
  baseline, not a delta over `/`. +68.9 ≈ the shared play-screen shell
  (~31 KB, in line with `/binairo`'s +33.0, `/nonogram`'s +36.8 and
  `/sudoku`'s +30.4) plus the ~37.9 KB library floor, of which ~36.4 KB is
  the validation dictionary the ticket exists to ship. The constant is set;
  see decision 7's closing block.
