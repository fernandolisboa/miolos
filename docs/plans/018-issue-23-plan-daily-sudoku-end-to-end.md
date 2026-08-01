# Implementation plan — Issue #23: Daily Sudoku end-to-end

Step 2 (Plan) of the eight-step flow. Point-in-time snapshot, planned against `origin/main` = 93b1a85 plus the merged #18 work (`a166401`); all paths are working-tree paths. Branch `feat/23-daily-sudoku-end-to-end` is already checked out and correct.

Direct prior art: [`docs/plans/017-issue-18-plan-play-the-daily-binairo.md`](./017-issue-18-plan-play-the-daily-binairo.md). Everything it decided that is not restated here still binds. Where this plan supersedes one of its decisions, it says so by name (§4 S13, §11.4).

---

## 0. Acceptance criteria → plan mapping

| # | AC (quoted from issue #23) | Build step (§17) | Where satisfied | Tests (§15) |
|---|---|---|---|---|
| 1 | "Production buffer holds validated future-dated Sudoku dailies alongside Binairo's, behind the same predicate helper" | 2, 2b, 3, 4 | §6 (content + response schemas, `ProjectedGame`, the `stripDailyContent` branch), §7.1 (`topUpSudokuBuffer`, both retry budgets, `maxDuration`), §7.2 (cron + buffer-depth contracts, fault isolation), §6.5 (the generic wall) | T-CORE-S1..S7, T-DB-S1..S5, T-API-S1..S8, T-API-S15, T-API-S16, T-WEB-S24, E2b, E3–E5 |
| 2 | "The Sudoku screen is designed against the design system and passes `npx impeccable detect`" | 8, 9, 10 | §12 (board arithmetic, box rules, keypad, both viewports, the two impeccable traps), §12.8 (**buffer seeded before any scan**, hardened preflight, workflow) | T-WEB-S25..S31, T-WEB-S34, E2b (precondition), E6, E10 |
| 3 | "Completion recorded once with on-time derivation; hub tile shows done/pending; conclusion chains to the next pending daily" | 2, 4, 7B, 9 | §7.3 (`storedSolution` dispatch), §6.3 (the request union), §8.2 (`solvedDigits`, without which there is no body to POST), §11 (day state, hub tile, conclusion chaining) | T-API-S9..S14, T-WEB-S14..S20, T-WEB-S23 |
| 4 | "Rules blurb, free hint, timer, offline-tolerant sync — at parity with Binairo" | 5, 6, 7A | §8 (client state model), §9 (record + sync, generalized), §10 (the hint), §12.4 (rules blurb at both viewports), §12.5 (the hint's visual payload), §13 (copy) | T-WEB-S1..S13, T-WEB-S27, T-WEB-S29, T-WEB-S32, T-WEB-S33 |
| — | Standing duty (ADR-0024 §5 ESLint wall, plan 017 §14) | 7A/8 | §14 — the wall must come out of this ticket **unweakened** | T-LINT-S1, T-LINT-S2 |

Every AC maps to at least one numbered build step in §17 and at least one named test in §15.

---

## 1. Scope boundary, stated once

**In:** the shared `apps/web/src/play/` layer (§5), the `/sudoku` play screen and `/sudoku/concluido` conclusion, the Sudoku top-up in the cron and its buffer-depth alerting, the daily/completion/cron contract widenings, `GET /daily/sudoku`, the one free hint, offline-tolerant sync at Binairo parity, the hub tile's device-local done/pending state, conclusion chaining to the next pending playable daily, three ADRs (§18).

**Out, explicitly, each with the issue that owns it:**

| Out of scope | Owner / reason |
|---|---|
| Server-truth done/pending, "X de 4" from the server, the streak, the PWA manifest | **#19** (M1: Hoje hub, streak, PWA manifest). §11.1 draws the line and justifies it against both issues' text. |
| **Pencil marks / candidate notes** | Decided out (§8.6). Surfaced to Fernando as a product decision (§16), follow-up filed at step 8. |
| **Peer highlight** (row/column/box of the selection, same-digit lighting) | Decided out (§8.7): no AC asks for it, it needs `rowOf`/`colOf`/`boxOf` which are not on the `@miolos/games/sudoku` barrel (widening it for an unasked feature is ADR-0019 churn), and it would be a sixth visual carrier on a board that already has five. |
| Undo | Same call as plan 017 D9; a selected cell plus `apagar` and digit-retap reach every state. |
| Statistics, histogram, personal best | **#29** |
| Share card | **#34** |
| Archive (`/arquivo/…`) and widening `ACCEPTED_DAYS_BACK` | **#31** |
| Free play | **#28** |
| The late-by-sync window (plan 017 D19) | **#58** — inherited unchanged, not re-decided here (§19.1) |
| The least-privilege `miolos_web` Neon role | **#59** — nothing in this plan may claim the grant exists (§19.2) |
| Rewarded-ad hint grants (`hint_grants` stays dormant) | a future monetization ticket; ADR-0027 names the seam |
| `nextSudokuDeduction` / technique-naming hints | out, same reasoning as plan 017 §10.4 for Binairo |
| Extracting the pointer-stroke machinery from `binairo/grid.tsx` | **#25** — Nonogram paints, Sudoku does not. Extracting a drag hook with no second consumer is exactly what ADR-0002's "once a second consumer exists" forbids (§5.3). |
| Dark mode, telemetry (**#33**), any ads SDK or new `AdSlot` placement | — |

**Never:** on-demand puzzle generation, a client-supplied completion instant, a stored `on_time`, a hint balance, a client-computed streak, a future-dated puzzle in any payload.

---

## 2. Read first (in this order)

1. `docs/adr/0004`, `0014`, `0017`, `0018`, `0019`, `0023`, `0024` (with its 2026-07-31 amendment), `0026`, `0027`, `0028`.
2. `docs/plans/017-issue-18-plan-play-the-daily-binairo.md` §8–§15 and **§20 in full** — 30 review findings and their dispositions. Every one of them is encoded in code this ticket moves; §19 lists the ones that are easiest to regress.
3. `packages/games/src/sudoku/index.ts` — the whole public surface, 33 lines. Never a deep import (ADR-0019).
4. `packages/core/src/contracts/daily.ts` — the strip table TSDoc is the contract this plan implements the sudoku row of.
5. `apps/api/src/publishing/service.ts` — the top-up loop this plan clones, and the TSDoc that sanctions cloning it.
6. `apps/web/src/binairo/{state,hint,play-record,sync,use-binairo-play}.ts` and `{play-view,grid,controls,conclusion-view}.tsx` — the modules §5 moves.
7. `DESIGN.md`, `PRODUCT.md`, `packages/ui/tokens.css`, and `docs/design/006-handoff-design-winner-atelie/f3..f6*.dc.html`. **There is no Sudoku reference frame.** §12 is the just-in-time design; F3/F4 are the sibling it must be defensible against.

---

## 3. Fixed orchestrator conventions (recorded, not re-litigable here)

- Shell preamble on every command: `source ~/.nvm/nvm.sh && nvm use default >/dev/null && …`.
- **This ticket adds nothing to `packages/games`.** The Sudoku engine shipped complete with #22 (`e02d82a`); ADR-0023's proof floors therefore have nothing to bind here. If implementation discovers a missing engine primitive, that is a separate ticket, not a quiet addition — the package's purity tests, `types: []` tsconfig and eslint block (ADR-0017) all stay untouched.
- **No new fast-check anywhere.** ADR-0017 scopes it to `packages/games`; the Sudoku hint test is table-driven over pinned seeds, exactly as T-WEB-11 was (plan 017 testability finding 6).
- `packages/ui` stays JSX-free (ADR-0002). The shared layer §5 creates lives in `apps/web/src/play/`.
- **No migration.** `daily_puzzles`, `completions` and `hint_grants` are already game-generic and their CHECK constraints already list `'sudoku'` (`packages/db/src/schema.ts:113`, `:168`). If implementation believes it needs one, something is being modelled wrong.
- **No new dependency.** `min-release-age=3` and `save-exact=true` therefore have nothing to bind.
- Turbo evidence is always `--force`; captured exit codes, never prose.
- Plan number **018**, ADR numbers **0029/0030/0031** reserved (§18). The `docs/README.md` "Current" row ships in the same commit as this file.

---

## 4. Fixed decisions (with rationale, one line each)

- **S1 — The Binairo gameplay client is extracted into a shared `apps/web/src/play/` layer NOW, as its own commit, before a line of Sudoku is written.** The **sole trigger** is a correctness argument, not a style one: `sync.ts` holds module-level singletons (`flushing`, `reminted`, `retryStep`, `memoryQueue`) guarding a **game-blind** `localStorage` queue (`listPendingRecords()` returns every game's records), so two copies mounted in one SPA session would each POST and each settle the other's records. ADR-0002 is cited here for **placement only**, and its clause is not a timing rule: "shared *web* components may live **there** once a second consumer exists" scopes `there` to `packages/ui` and `a second consumer` to a second consuming **package** — a rule about web-vs-native code sharing, which is that ADR's whole subject. So ADR-0002 fixes **where** this layer lives (`apps/web/src/play/`, not `packages/ui`, which has no second consuming app and stays JSX-free); it does not decide **when** to extract. → **ADR-0029**, §5.
- **S2 — What is shared is the non-visual layer, the conclusion, and the play screen's LAYOUT STYLESHEET — not the play component.** The seam is drawn at "CSS is shared, JSX composition is per game" (§5.2). A `<PlayShell>` taking eight node props would be a shallow module: the abstraction as wide as what it hides. The 350 tuned CSS lines, where all ten of plan 017's recorded frame deviations and four of its impeccable fixes live, are where duplication actually costs.
- **S3 — Sudoku's input model is cell-first: select a cell, then type or tap a digit.** Binairo's sticky paint mode does not generalize — there is no plausible "paint 7s by dragging" — and cell-first gives physical-keyboard `1`–`9` and Backspace for free, which at 81 cells matters. `PaintMode`, `paint-over` and the whole pointer-stroke machinery are Binairo's and stay there.
- **S4 — The board is a composite widget: one tab stop, roving focus, arrow keys — and no `role="grid"`.** `role="grid"` requires `role="row"` children, which a flat 81-item CSS grid cannot have without wrappers, and `display: contents` on a `role="row"` is the canonical accessibility-tree-removal bug. All 81 cells are `<button type="button">` inside a labelled `role="group"`; exactly one carries `tabindex="0"`. Givens are focusable (skipping them makes the caret jump unpredictably) and carry `aria-disabled="true"`. This **reverses plan 017 §8.2's deferral** for the new screen, deliberately: 81 ordinary tab stops is materially worse than 64, and a selection model makes the roving caret the same concept as the selection. → **ADR-0030**.
- **S5 — Pencil marks are out (§8.6), and the decision is surfaced to Fernando (§16).** The issue does not ask for them, the engine has zero support, a 3×3 mini-grid inside a 33px mobile cell is illegible, and they would double both the reducer and the persisted record. The honest counter-argument — a tier-5 Sunday needs naked triples and X-wing, which humans rarely do without notes — is real and is escalated rather than resolved by the agent.
- **S6 — Client cells carry `null` for empty; the engine's `0` sentinel is converted at exactly one boundary.** `SudokuCellValue = SudokuDigit | null`. The hint's "first empty" and the persisted `entries` then read identically across games, and no `entries[i] || fallback` can ever mistake a real value for absence. `givens` stays engine-native (`SudokuGrid`, `0` = empty) because it is fed straight to `solveSudoku`; `apps/web/src/sudoku/engine.ts` owns the merge (§8.2).
  **The `0`/`null` split has one sharp edge, ruled here rather than discovered:** the shared `countFilled` (moved to `play/progress.ts`, §5.2) tests `(given ?? entries[index] ?? null) !== null`. Fed a raw `SudokuGrid`, `0` is not nullish, so `given ?? entries[i]` short-circuits to `0` on every empty given and the counter reports **81 of 81 filled from the first paint** — a live wrong readout, since `{filled} de 81` ships in `.progressBar`/`.progressCard` (§12.4, §13.2). **Sudoku therefore passes `playableGivens(givens)` (§8.2, already memoized), never the raw grid.** `countFilled`'s signature is `(givens: readonly (number | null)[], entries: readonly (number | null)[]) => number` and its TSDoc says so; T-WEB-S25 asserts a fresh board reports `filled === clueCount`, not 81.
- **S7 — Local completion detection is `isSudokuSolved(merged)`, one call.** Unlike Binairo (where `isValidBinairoSolution` assumes completeness by type and needs a paired guard), Sudoku's predicate is complete **and** conflict-free in one. Plan 017 D12's argument transfers verbatim: the daily is uniquely solvable by construction (`countSudokuSolutions(givens, 2) === 1` is proved at generation), so a complete conflict-free grid **is** the solution. The server still re-judges.
- **S8 — Local validation is `getSudokuConflicts(merged)` on every entry change**, flattened into `ReadonlySet<number>` — the identical downstream shape Binairo's `derive` produces. Measured 0.009 ms on a tier-5 board (§19.6): no debounce, no worker. Presentation only (ADR-0004).
- **S9 — The hint is client-computed, `solveSudoku(givens)` memoized once per page, no endpoint.** ADR-0027 transfers with real numbers: `solveSudoku` on the hardest daily measures mean 0.057 ms / p95 0.25 ms / max 0.52 ms, the same order as `solveBinairo`'s 0.035 ms mean (§19.6). A server round-trip would buy zero confidentiality on a published board and would break the hint offline, which AC 4 requires. **No new ADR — ADR-0027's *argument* (a published board whose solution is client-recoverable from the published givens) transfers to Sudoku verbatim. It does NOT transfer to Termo**, whose public projection is `game, date` only and whose guesses are judged server-side (`packages/core/src/contracts/daily.ts` strip table), so the answer is never on the wire and a client-computed hint is structurally impossible there. **#27 decides Termo's hint separately**; nothing in this ticket may be read as having decided it.
- **S10 — `stripDailyContent`'s sudoku branch ships exactly the strip table's row**: public `game, date, givens, tier`; withheld `solution, seed, clueCount`. No `size` (unlike binairo, `SudokuPuzzle` carries none) and no `weekday` (the client derives it from the date). `tier` is redundant-but-mandated — the client can recompute it from `givens` in 0.46 ms and can derive it from the date alone — and the merged table is the contract, so it ships without relitigation, and it earns its keep as the `Nível` readout (§12.5).
- **S11 — The wall readers become generic in `game`**, with exactly one documented assertion inside `packages/db/src/published.ts` (§6.5), and **the three `apps/web` declarations that take `DailyPuzzleResponse` as their own parameter/prop type are narrowed in the same commit.** The generic wall is *necessary and not sufficient*: narrowing `getTodayDaily`'s return type fixes the **call sites** (`app/binairo/page.tsx`, `app/binairo/concluido/page.tsx`) but cannot reach a function body whose parameter is annotated with the union. Once §6.1 makes `dailyPuzzleResponseSchema` a two-member union, `const givens: BinairoGrid = daily.givens` at `state.ts:96` fails no matter what the caller passes. **The complete change set, enumerated so step 6 does not discover it:**
  | Site | Today | Becomes |
  |---|---|---|
  | `apps/web/src/binairo/state.ts:95` | `initPlayState(daily: DailyPuzzleResponse)` | `DailyBinairoResponse` |
  | `apps/web/src/binairo/use-binairo-play.ts:66` | `useBinairoPlay(daily: DailyPuzzleResponse)` | `DailyBinairoResponse` |
  | `apps/web/src/binairo/binairo-screen.tsx:24` | `readonly daily: DailyPuzzleResponse` | `DailyBinairoResponse` |
  | `apps/web/test/binairo-state.test.ts:1,19,30,32` | type annotations | `DailyBinairoResponse` |
  | `apps/web/test/binairo-page.test.tsx:7,29` | type annotations | `DailyBinairoResponse` |
  | `apps/web/test/binairo-screen.test.tsx:1,51` | type annotations | `DailyBinairoResponse` |

  `DailyBinairoResponse` is **already exported** from `packages/core/src/index.ts:38` — no new export is needed for it. The Sudoku siblings take `DailySudokuResponse` from the start. **Prohibited, explicitly:** a per-game component may never take `DailyPuzzleResponse` and narrow internally — that reintroduces the impossible branch this decision exists to delete. This lands with **build step 2** (§17), not step 6, so `pnpm typecheck` is never red across a commit boundary. **No new export from `packages/db`** — T-DB-9a/9b/9c/9d come out of this ticket byte-identical.
- **S12 — `topUpSudokuBuffer` is a named sibling of `topUpBinairoBuffer`, not a generic extraction.** The TSDoc at `service.ts:65-67` sanctions per-game-by-name explicitly, and the abstraction's third and fourth consumers would not fit it: Nonogram draws from a curated motif library (ADR-0021) and Termo from a curated word list (ADR-0015), neither of which is a seed→generate→weekday-validate loop. Extracting now would produce a generic with one more consumer and then break.
- **S13 — The Sudoku seed-retry budget is 2 per date AND 4 per run, and `apps/api/vercel.json` gains an explicit `maxDuration`.** `MAX_SEED_RETRIES_PER_DATE = 8` wraps an engine that already retries `SUDOKU_MAX_GENERATION_ATTEMPTS = 1200` internally; at the measured ~1.7 ms/attempt an exhausted cap is ~2 s, so eight of them is ~16 s **per date**. `MAX_SUDOKU_SEED_RETRIES_PER_DATE = 2` bounds one date at ~4 s. **The per-date bound is not the run bound** — the retry loop at `service.ts:98` is nested inside the per-date loop at `:84`, so the budget is spent once per uncovered date: at the default `bufferDepth` of 7 the theoretical worst case is ~28 s, and at `remoteConfigSchema`'s clamp ceiling of 30 it is ~120 s. That is why a **run-scoped** budget ships alongside it: `MAX_SUDOKU_SEED_RETRIES_PER_RUN = 4`, a counter decremented across the whole invocation, after which every remaining uncovered date goes straight to `failures` and the buffer-depth alert catches the shortfall on its next poll. **The run is therefore bounded at ~8 s of Sudoku CPU by construction, independent of `depth`.** Plan 011 §8.1 puts the residual cap-hit probability at ≈5e-7 per seed, so the realistic worst case is ~6 s and the run budget can only bite in a scenario that does not occur; it exists so the bound is a property of the code rather than of a probability. **This does not change Binairo's 8.** See §7.1 for the `maxDuration` decision.
- **S14 — `GET /daily/sudoku` ships as a literal route copy, not a `[game]` dynamic segment.** A dynamic segment saves 33 lines and buys an untrusted `params.game` reaching `eq(dailyPuzzles.game, …)` plus a 500-on-unimplemented-game hazard (`/daily/nonogram` would resolve, reach `stripDailyContent`, and throw `DailyProjectionUnsupportedError` uncaught) — precisely what the fail-closed dispatch exists to make impossible at the type level. Literal routes simply do not exist and Next 404s for free. Revisit at #25 when there are three.
- **S15 — `cronPublishResponseSchema` and `bufferDepthResponseSchema` are reshaped keyed BY GAME, and both stay strict.** `{ games: { binairo: …, sudoku: … } }` and `{ depths: { binairo, sudoku }, … }`. Keeping them `z.strictObject` preserves the property their own TSDoc claims — a new game must widen them in the same PR that adds it — which a `z.array(...)` or a `gameSchema`-keyed record would silently discard.
- **S16 — `shallow` is the OR across games.** The failure mode this exists to prevent is specific and silent: adding `depths.sudoku` while leaving `shallow` derived from binairo alone would *report* a drained Sudoku buffer and never *page* on it. `.github/workflows/buffer-alert.yml` reads `jq -r .shallow` and needs **no change** once this is right.
- **S17 — `playRecordSchema` becomes a discriminated union on `game`, and `v` STAYS `1`.** Bumping the version discards every stored record on deploy, and a discarded record with `pendingSync: true` is the only copy of a completion the server has not acknowledged — a lost streak day. The binairo member ships byte-identical. `readPlayRecord(game, date)` additionally **discards a record whose `game` does not match the key it was read from**, so a hand-edited store cannot feed a Binairo record into a Sudoku grid.
- **S18 — `sync.ts` stays exactly one module,** moved to `play/`; the queue, retry ladder, re-mint and settle machinery are genuinely game-generic and move verbatim, and **`buildBody` becomes the one per-game dispatch inside it.** The honest scoping matters because ADR-0029 records this module as shared: `buildBody` is grid-shaped in three places today (the `record.grid === undefined` early return, the fixed `{game,date,grid,elapsedMs,hintsUsed}` literal, and the "has no solved grid to post" log string), and **Termo's completion request carries guesses, not a grid**. So #27 adds a branch to `buildBody`, it does not add a second sync module. §9.2 shows the shape. See S1 for why one module is a correctness constraint.
- **S19 — `messages` is reshaped once, into `messages.games.<game>.{name,kicker,description,play,conclusion}`.** ADR-0018 makes `Messages` the migration contract, so its shape is a decision, not a detail; adding a fourth top-level `sudoku:`/`conclusaoSudoku:` block now guarantees four copies by #27. Hoje reads `messages.games[game]` too, which deletes the existing `hoje.games` duplication of name/kicker/description.
- **S20 — The hub's done/pending is DEVICE-LOCAL and monotone-safe: it can only understate.** A local `concluded` record means this device definitely solved it; absence means unknown and renders **pending**, which is also the cold-profile default, also what `impeccable detect` always scans, and also what a second device sees today. A false *pending* is invisible; a false *done* would not be. `streakCount` stays hardcoded `0` and is flagged in the PR — a streak is a cross-day server derivation ADR-0009 forbids the client from computing; "did this device finish today's Sudoku" is a fact the client owns. → **ADR-0031**, §11.
- **S21 — The conclusion CTA now points at the next pending playable daily, falling back to Hoje.** This **supersedes plan 017 §12.3's CTA row and deviation 9**, which pinned the CTA at `/` because no second play route existed and reserved `--accent-nonogram` for #25. With `/sudoku` live, AC 3's "chains to the next pending daily" is satisfiable honestly, and the generalization ("the target game's accent when it points at a game; solid ink when it points at Hoje") subsumes deviation 9's reservation rather than contradicting it.
- **S22 — `FORBIDDEN_DAILY_KEYS` gains `"clueCount"`.** It appears in no shipped payload, so `T-DB-7`, `T-API-12` and the binairo core leak scans keep passing unchanged; adding it is what makes the scan meaningful for the game whose content actually carries it. `packages/core/src/testing.ts`'s TSDoc names this as #23's duty.
- **S23 — Box separation is a widened gutter with a drawn 2px rule, not a box wrapper.** A `<div>` per 3×3 box would be a card inside a card (a DESIGN.md anti-reference, verbatim), and if it ever carried a `box-shadow` it would fire impeccable's `nested-cards` immediately (`isCardLikeFromProps` at `checks.mjs:227` returns card-like on computed shadow + radius; a 3×3 box holds >10 characters, so it is not skipped). The board is one flat 81-item CSS grid with explicit gutter tracks (§12.3).
- **S24 — `packages/ui` and `apps/web/src/types/css.d.ts` are unchanged.** `--accent` is already declared on csstype's `Properties` (`css.d.ts:10`) and already used inline by `app/page.tsx:83`; the shared stylesheet consumes it. No `AdSlot` placement is added — `adSlotPlacements` and its exactly-two-keys test stay untouched (plan 017 D23 stands).
- **S25 — No PGlite in `apps/web`** (plan 017 D33 stands). The `apps/web` ESLint import bans therefore stay absolute across `apps/web/**`, and §14's two config objects come out of this ticket unweakened.

---

## 5. The reuse architecture (S1/S2) — the central decision

### 5.1 The decision, and the two rejected alternatives

**Decided: extract now, into `apps/web/src/play/`, in its own commit, with the Binairo suite green and every assertion unchanged in *what it asserts*** — §5.5 enumerates the handful of places where *where it reads from* must change, and nothing beyond that list may move. Then Sudoku's diff is additive and reviewable.

| Alternative | Cost | Verdict |
|---|---|---|
| **A — extract everything, including a reducer generic over the cell type** | Buys ~100 more shared lines; costs a strategy-object reducer that must express both "tap cycles through three values, and a drag paints" and "select a cell, then type a digit, with roving focus". The abstraction would be wider than what it hides. | **Reject** |
| **B — duplicate into `src/sudoku/`, extract at #25** | (i) **Two `sync.ts` modules over one game-blind `localStorage` queue** → double POSTs, cross-settling, two retry ladders. A correctness bug, not a style objection. (ii) 935 duplicated lines of conclusion (tsx + css) that will diverge before #25. (iii) `readPlayRecord(date)` hardcodes `playRecordKey("binairo", date)` at line 113, so it must change signature *anyway* — `play-record.ts` cannot be cleanly duplicated either. (iv) #25 and #27 then face a 3-way and 4-way merge instead of a 2-way. | **Reject** |
| **C — extract the non-visual layer + the conclusion + the layout stylesheet; leave the reducer's input model, the board, the controls and the copy per game** | One prep commit touching ~14 source files, re-pointing imports in 7 test files (~2,580 lines, ~120 `it()` blocks) **and making the six harness edits in §5.5**. Risk is regressing plan 017 §20's 30 findings — mitigated because the extraction is **move + rename, not rewrite**: every moved body stays byte-identical except the enumerated signature changes (§5.2, §5.4, S11). | **Ship** |

### 5.2 Exact module boundaries

**Shared — `apps/web/src/play/`:**

| File | From | Change |
|---|---|---|
| `types.ts` | new | `PlayCore` (`date`, `timer`, `status`, `hydrated`, `pendingSync`, `now`), `HintState`, `LifecycleAction`, `ConclusionCopy` (**exactly what `conclusion-view.tsx` reads** — `messages.conclusion` plus the game's display name and kicker). There is deliberately **no** shared `PlayCopy`: the `play` bundles are per-game by construction — Binairo's carries sticky-mode button copy, Sudoku's carries `keypad.*`, `levelLabel` and `level(tier)` — and unifying them behind one type is the shallow abstraction S2 rejects for components |
| `timer.ts` | `binairo/state.ts` 40–44, 161–196, 218–224 | `TimerState`, `elapsedMs`, `applyTimerAction` — **verbatim**, both idempotence guards intact |
| `play-record.ts` | `binairo/play-record.ts` (184) | `playRecordKey(game: Game, …)`; `readPlayRecord(game, date)` + the game-mismatch discard (S17); schema → `discriminatedUnion("game", …)` keeping `v: 1` and the binairo member byte-identical; `ELAPSED_CAP_MS` hoisted here and imported by `sync.ts` (it is duplicated today at `play-record.ts:22` and `sync.ts:26`) |
| `sync.ts` | `binairo/sync.ts` (325) | `binairoCompletionRequestSchema` → `completionRequestSchema`, and `buildBody` becomes a `switch (record.game)` (§9.2). **Must remain one module** (S1/S18) |
| `grid-hint.ts` | `binairo/hint.ts` (66) | generic over `T` — **not** `T extends number` (§10.2). Named `grid-hint`, not `hint`, because the algorithm is grid-shaped and Termo's hint is an open question (S9). Zero engine coupling today — every import is already `import type` |
| `progress.ts` | `use-binairo-play.ts` 293–304 (`countFilled`, private today) | exported, widened to `(givens: readonly (number \| null)[], entries: readonly (number \| null)[])`. **Sudoku passes `playableGivens(givens)`, never the raw `SudokuGrid`** (S6) |
| `use-play-lifecycle.ts` | `use-binairo-play.ts` 98–243, 326–331 | the five effects, the three listeners, both clobber guards and the completion handoff, parameterized by `{ game, state, reduce, dispatch, buildRecord, persistDeps }` (§5.4) |
| `use-record-snapshot.ts` | `conclusion-view.tsx` 285–343 | the `useSyncExternalStore` + cached-snapshot + 1 s poll idiom, **keyed on `{game, date}`** (§19.4) |
| `day-state.ts` | new | `readDayState(date): Record<Game, DayEntry>` over the generalized records (§11.2) |
| — (test harness) | `apps/web/test/css-source.ts` | `stylesheet(name)` hardcodes `src/binairo/` at line 26–31 and **must** change: it becomes `stylesheet(relativePath: string)` resolved from `apps/web/`, so the same helper reads `src/play/screen.module.css`, `src/binairo/binairo-screen.module.css`, `src/sudoku/sudoku-board.module.css` **and** `app/page.module.css`. Every call site is re-pointed mechanically. See §5.5 for the assertion edits this forces |
| `conclusion-view.tsx` + `.module.css` | `binairo/conclusion-view.*` (343 + 592) | `--accent` custom property; `{game, date, copy: ConclusionCopy, result?}` props; `DayChip` reads each game's record; the CTA chains (S21); **the fold moves 1040 → 1140** so the shared layer has exactly one (§12.2) |
| `timer-readout.tsx` | `binairo/timer-readout.tsx` (33) | the aria label arrives as a plain `string` prop — no copy bundle |
| `screen.module.css` | the game-agnostic ~350 of `binairo-screen.module.css` (619) | **three** documented edits, no more: every `--accent-binairo` → `var(--accent)`; the single-column fold moves 1040 → 1140 (§12.2); the four per-game-varying values become custom properties with Binairo's current values as their fallbacks (§12.2). `.cellSkeleton` does **not** move — it is a `.cell` variant and stays in each game's board module |

**Per game, staying put:** the reducer and its action set, the engine adapter, the board component, the controls/keypad, the board-geometry stylesheet, the play composition (`play-view.tsx` + its skeleton), the screen root, and all copy. `binairo/grid.tsx` keeps the whole pointer-stroke machinery (§5.3).

### 5.3 What is deliberately NOT extracted

- **The pointer-stroke hook.** `binairo/grid.tsx`'s six refs, five handlers and `cellIndexAt` are already geometry-free and would extract with zero behavioural change — but **Sudoku does not drag**, so extracting now would create a shared module with exactly one consumer. That is plain YAGNI, not an ADR-0002 consequence (S1 corrects that citation): a shared module with one consumer is speculative, and #25's Nonogram board is its genuine second consumer.
- **A generic reducer.** See alternative A.
- **A `<PlayShell>` component.** See S2.

### 5.4 `usePlayLifecycle` — the contract

```ts
/** The lifecycle-relevant slice both reducers' states expose. */
export interface PlayCore {
  readonly date: string;
  readonly timer: TimerState;
  /**
   * The lifecycle's terminal predicate is `status !== "playing"` — "the game
   * is CLOSED", never "the grid is solved". `lost` is carried here from the
   * start because Termo (#27) has a second terminal state (six guesses
   * exhausted, ADR-0008 keeps `lost` Termo-only): under a
   * `"playing" | "solved"` union a Termo loss would never freeze the clock,
   * never write the completion and never leave the play view. Binairo and
   * Sudoku narrow this to `"playing" | "solved"` in their own state types;
   * neither gets more complex.
   */
  readonly status: "playing" | "solved" | "lost";
  readonly pendingSync: boolean;
  readonly now: number;
  readonly hydrated: boolean;
}

/** The actions the lifecycle dispatches. Both games' PlayAction unions include them. */
export type LifecycleAction =
  | { readonly type: "restore"; readonly record: PlayRecord | undefined; readonly now: number }
  | { readonly type: "tick"; readonly now: number }
  | { readonly type: "pause"; readonly now: number }
  | { readonly type: "resume"; readonly now: number };

export function usePlayLifecycle<S extends PlayCore>(input: {
  readonly game: Game;
  readonly state: S;
  /**
   * The game's own reducer. The `pagehide` path computes the paused snapshot
   * locally AND dispatches the same action; purity is what makes the two
   * agree, so the hook must use the real reducer, never a private copy.
   */
  readonly reduce: (state: S, action: LifecycleAction) => S;
  readonly dispatch: (action: LifecycleAction) => void;
  /**
   * Build the record for `state` at `now`. The ONE place a record is built.
   * `closed` is the terminal flag, not `solved`: a Termo loss is a closed
   * game that writes a completion with `outcome: "lost"`.
   */
  readonly buildRecord: (state: S, now: number, closed: boolean) => PlayRecord;
  /**
   * The game-specific slice whose change means "the record's CONTENT
   * changed" — `[givens, entries, hintsUsed]` for Binairo,
   * `[givens, entries, hint.used]` for Sudoku.
   *
   * This exists because the persist-on-change effect's dependency array is
   * game-specific AND deliberately EXCLUDES `state.now`: the `tick` reducer
   * returns a NEW state object every second while `timer`, `entries` and
   * `hintsUsed` keep their identities, which is exactly why `now` is absent
   * from `use-binairo-play.ts:216`'s deps today. A hook that only sees
   * `S extends PlayCore` cannot reproduce that on its own — depending on
   * `[state]` would fire a readPlayRecord + Zod parse + JSON.stringify +
   * setItem EVERY SECOND for every game, and depending only on
   * `[state.hydrated, state.status, state.date, state.timer]` would never
   * fire on an entry change, so a tab crash would lose the board.
   * `buildRecord` cannot rescue it either: it takes `state` as an argument,
   * so the caller memoizes it on `[]` and the effect would never re-run.
   *
   * INVARIANT, and the reason this is a named input rather than a comment:
   * `state.now` must NEVER enter `persistDeps`. T-WEB-S33 pins it — ten
   * `tick` dispatches must produce zero `setItem` calls.
   */
  readonly persistDeps: readonly unknown[];
}): void;
```

The two effects that consume it, spelled out so the mechanism is not re-invented:

```ts
  // persist-on-change
  useEffect(() => { … }, [game, state.hydrated, state.status, state.date, state.timer, ...persistDeps]);
  // completion write (its `queued` ref masks a re-fire, but the deps are the same shape)
  useEffect(() => { … }, [game, closedAndFrozen, state.date, ...persistDeps]);
```

`solvedAndFrozen` (`use-binairo-play.ts:96`) is renamed `closedAndFrozen` and becomes `status !== "playing" && timer.runningSince === null`; the timer-freeze gate at `:192` and the tick gate at `:179` test `status !== "playing"` the same way. **For Binairo those three edits are behaviour-identical** — its `status` union is `"playing" | "solved"`, so the two predicates coincide — which is what keeps step 6 behaviour-free.

It owns, verbatim from `use-binairo-play.ts`: the mount effect (`readPlayRecord` → `restore` → `prunePlayRecords` → `startCompletionSync`), `visibilitychange` pause/resume, `pagehide` synchronous persist, the `pageshow` handler **with its `visibilityState === "visible" && status === "playing"` gate** (finding `pageshow-resumes-timer-in-a-hidden-tab`), the initial resume derived from `visibilityState`, the 1 s tick interval, the solved-freeze, the persist-on-change effect, the completion write + `flushPendingCompletions(completion)` handoff with its `restoredConcluded`/`queued` refs (finding `completion-lost-when-localstorage-is-unavailable`), and `persistUnlessConcluded` (findings `in-progress-write-clobbers-a-queued-completion`, `pagehide-write-still-clobbers-a-queued-completion`).

That is five effects, three listeners and five recorded findings behind six values — a deep seam, not a shallow one.

### 5.5 The extraction's test-harness edits, enumerated

The extraction is behaviour-free in `src/`, but it is **not** assertion-free in `test/`: `apps/web/test/css-source.ts` is the only mechanism in the repo that can assert a layout rule at all, and it resolves stylesheets by a hardcoded directory. T-WEB-S32's "assertions unchanged in content" is true of *what* is asserted and false of *where it is read from*. The complete list, decided here rather than discovered at step 6:

| Site | Today | Becomes |
|---|---|---|
| `test/css-source.ts:26-31` | `stylesheet(name)` → `src/binairo/${name}` | `stylesheet(relativePath)` → `apps/web/${relativePath}`; the TSDoc drops "under `apps/web/src/binairo/`" |
| `test/binairo-screen.test.tsx:165-176` `GRID_AREA_CLASSES` | regex over `binairo-screen.module.css` | the **union** over `src/play/screen.module.css` and `src/binairo/binairo-screen.module.css`, deduped. Every `grid-area` block (`.topBar`, `.titleBlock`, `.statsCard`, `.hint`, `.board`) moves, so a single-sheet read yields `[]` and the anti-vacuity assertion at `:849-851` silently passes on nothing |
| `test/binairo-screen.test.tsx:156-163` `className(local)` | throws `binairo-screen.module.css has no .${local}` | looks in the game module first, then the shared one; the error names both |
| `test/binairo-screen.test.tsx:917` | `--board-mobile-max` from `bodyOf(MOBILE, ".page")` | read from the game module's own `.pageBinairo` block, which is where the custom property now lives (§12.2) |
| `test/binairo-screen.test.tsx:918-919` | `.grid` gap and `.gridCard` padding from `MOBILE` of the binairo sheet | `.grid` gap stays (per game); `.gridCard` padding comes from the **shared** sheet's mobile block |
| `test/conclusion-view.test.tsx:270` | `bodyOf(CSS, "@media (max-width: 1040px)")` | `1140px` — the shared conclusion folds with the shared play screen (§12.2) |

**Why the conclusion's fold moves too, stated rather than left implicit:** its own 1040 minimum is unrelated to any board, so 1140 folds it ~100px early. That cost is accepted because the alternative is worse in the one way a player can actually see it — the top bar swaps members at the fold (`.wordmark`/`.topDateLong` out, `.barKicker`/`.topDateShort` in), so at 1100px navigating `/sudoku → /sudoku/concluido` would change the bar's character mid-session. One shared layer, one fold.

---

## 6. `packages/core` changes

### 6.1 `src/contracts/daily.ts` — content and response schemas

`SudokuPuzzle` has exactly five fields — `givens`, `solution`, `tier`, `clueCount`, `seed` — and **no `size`, no `weekday`**. The strict content schema mirrors it exactly (ADR-0024 fail-closed):

```ts
/**
 * A written sudoku cell, 1-9. ONE definition, three consumers: the daily
 * content and response here, the completion request (§6.3) and the play
 * record (§9.1) all import it rather than re-declaring a nine-member union.
 */
export const sudokuDigitSchema = z.union([
  z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5),
  z.literal(6), z.literal(7), z.literal(8), z.literal(9),
]);
/** 0 = an empty cell to solve; 1–9 = a digit. */
const sudokuGivenCellSchema = z.union([z.literal(0), sudokuDigitSchema]);
/** A solved cell is never 0. */
const sudokuSolvedCellSchema = sudokuDigitSchema;
/** Mirrors SudokuTier: the highest house-ladder rung the puzzle requires. */
const sudokuTierSchema = z.union([
  z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5),
]);

export const sudokuDailyContentSchema = z.strictObject({
  givens: z.array(sudokuGivenCellSchema).length(81),
  solution: z.array(sudokuSolvedCellSchema).length(81),
  tier: sudokuTierSchema,
  clueCount: z.number().int(),
  seed: z.number().int().nonnegative(),
});
export type SudokuDailyContent = z.infer<typeof sudokuDailyContentSchema>;

export const dailySudokuResponseSchema = z.strictObject({
  game: z.literal("sudoku"),
  date: isoDateString,
  givens: z.array(sudokuGivenCellSchema).length(81),
  tier: sudokuTierSchema,
});
export type DailySudokuResponse = z.infer<typeof dailySudokuResponseSchema>;

export const dailyPuzzleResponseSchema = z.discriminatedUnion("game", [
  dailyBinairoResponseSchema,
  dailySudokuResponseSchema,
]);

/**
 * The games `stripDailyContent` can actually project. NOT `Game`: nonogram
 * and termo still throw `DailyProjectionUnsupportedError`, so a reader typed
 * over `Game` would type `getTodayDaily(db, "nonogram")` as
 * `Promise<undefined>` while it 500s at runtime. #25/#27 widen this in the
 * same PR that adds their projection — the same fail-closed extension
 * property §6.4's cron contracts have.
 */
export type ProjectedGame = DailyPuzzleResponse["game"];
```

**Literal unions, not `min`/`max`, for the cells.** The rejected rationale was that `SudokuGrid = readonly number[]` forces `number[]`; it does not — a literal union infers `(0|1|…|9)[]`, which is equally assignable to `readonly number[]`, and the binairo precedent at `daily.ts:8-9` uses literals for both the content and the response. One spelling, reused three times, also means only one place can drift.

The branch replacing the throw at `daily.ts:111-114`:

```ts
    case "sudoku": {
      const parsed = sudokuDailyContentSchema.parse(content);
      return dailySudokuResponseSchema.parse({
        game: "sudoku", date, givens: parsed.givens, tier: parsed.tier,
      });
    }
```

`nonogram` and `termo` keep throwing. The strip table's sudoku row updates its `Implemented` cell to `#23 (this file)`.

**Rejected alternative, recorded so it is not re-proposed at review:** replacing the exhaustive `switch` with a `Record<Game, projector>` mapped type would make the wall's generic narrowing (§6.4) assertion-free. It was rejected because it rewrites ADR-0024's own fail-closed dispatch in the same PR that adds a game to it, and the assertion it saves is one line covered by two tests.

### 6.2 `src/testing.ts`

`FORBIDDEN_DAILY_KEYS` becomes `["solution", "seed", "reveal", "answer", "clueCount"]` (S22).

### 6.3 `src/contracts/completion.ts` — the request union

```ts
/**
 * A submitted sudoku is COMPLETE — 0 means "empty" in SudokuGrid, so it is
 * excluded here for exactly the reason `null` is excluded from binairo's.
 * Imported from contracts/daily.ts, not re-declared (§6.1).
 */
import { sudokuDigitSchema } from "./daily";

export const sudokuCompletionRequestSchema = z.strictObject({
  game: z.literal("sudoku"),
  date: calendarDateString,
  grid: z.array(sudokuDigitSchema).length(81),
  elapsedMs: z.number().int().min(0).max(86_400_000),
  hintsUsed: z.number().int().min(0).max(1),
});
export type SudokuCompletionRequest = z.infer<typeof sudokuCompletionRequestSchema>;

export const completionRequestSchema = z.discriminatedUnion("game", [
  binairoCompletionRequestSchema,
  sudokuCompletionRequestSchema,
]);
```

`elapsedMs`/`hintsUsed` bounds are identical to binairo's and must stay identical (one free hint, `hintsUsed ≤ 1`). `date` is `calendarDateString`, never `isoDateString`.

**`grid` does not "generalize" — it becomes a union of array types**, `(0|1)[] | SudokuDigit[]`. Indexed reads stay fine (`number | undefined` under `noUncheckedIndexedAccess`); anything calling `.map`/`.every` on the un-narrowed union would need a discriminant check first. The route does neither. **Do not** unify them behind `z.array(z.number())` — that would let a binairo client post a `7` and a sudoku client post a `0`, destroying the "a submission is a COMPLETE grid" invariant both schemas exist to enforce.

### 6.4 `src/contracts/cron.ts` — reshaped, still strict (S15/S16)

```ts
export const cronPublishGameResultSchema = z.strictObject({
  generated: z.number().int().min(0),
  depth: z.number().int().min(0),
  failures: z.array(z.strictObject({ date: isoDateString, reason: z.string() })),
  /**
   * The message of a throw that ESCAPED this game's top-up, `null` on a
   * normal run. `failures[].date` is an `isoDateString` and must stay one,
   * so an aborted run cannot be reported through it (§7.2). One game
   * throwing must never stop the other's buffer from being topped up, and
   * the response body must still parse strictly when it happens.
   */
  error: z.string().nullable(),
});
export type CronPublishGameResult = z.infer<typeof cronPublishGameResultSchema>;

/**
 * Keyed BY GAME and strict on both levels: the extension-point property the
 * single-game shape had is preserved exactly — a new game must widen this in
 * the same PR that wires its top-up. An array of results or a gameSchema-keyed
 * record would silently accept anything and lose that.
 */
export const cronPublishResponseSchema = z.strictObject({
  games: z.strictObject({
    binairo: cronPublishGameResultSchema,
    sudoku: cronPublishGameResultSchema,
  }),
});

export const bufferDepthResponseSchema = z.strictObject({
  depths: z.strictObject({
    binairo: z.number().int().min(0),
    sudoku: z.number().int().min(0),
  }),
  threshold: z.number().int().positive(),
  /** TRUE when ANY game is below the threshold — see plan 018 S16. */
  shallow: z.boolean(),
});
```

`threshold` stays one scalar; `remoteConfigSchema`'s single `bufferDepth` knob is shared by all games and is not widened (per-game depth is ADR-weight and unmotivated).

### 6.5 `packages/db/src/published.ts` — the generic wall (S11)

```ts
export async function getTodayDaily<G extends ProjectedGame>(
  db: Db, game: G,
): Promise<Extract<DailyPuzzleResponse, { game: G }> | undefined>;

export async function getPublishedDaily<G extends ProjectedGame>(
  db: Db, game: G, date: string,
): Promise<Extract<DailyPuzzleResponse, { game: G }> | undefined>;
```

**`ProjectedGame`, not `Game`, and that is load-bearing.** With `G extends Game`, `Extract<DailyPuzzleResponse, { game: "nonogram" }>` evaluates to `never`, so `getTodayDaily(db, "nonogram")` types as `Promise<undefined>` — while `stripDailyContent` still throws `DailyProjectionUnsupportedError` for it at runtime the moment a nonogram row exists. A #25 implementer would get a page TypeScript says is always the unavailable branch and that 500s in production as soon as their cron top-up lands. That is exactly the hole S14 rejects the `[game]` dynamic segment to avoid; reopening it for the direct readers would make S14's argument false in the same PR. With `G extends ProjectedGame` the call **fails to compile** instead, and #25 widens the type in the same PR that adds its projection.

`getPublishedDailyWithSolution(db: Db, game: Game, …)` is **unchanged and stays keyed on `Game`** — it returns the raw row and never calls `stripDailyContent`, so it has no projection to be missing. Inside each narrowed reader, one documented narrowing:

```ts
  const projected = stripDailyContent(game, row.date, row.content);
  // Restating what stripDailyContent already PROVED at runtime: it parses
  // through the per-game response schema, whose `game` is `z.literal(game)`,
  // so the discriminator cannot disagree. TypeScript cannot follow a
  // discriminant through a generic type parameter, which is the only reason
  // this line exists. Pinned by T-DB-S3 (a game-scoped read never returns
  // another game's row) and T-DB-S4 (`game === "sudoku"` at runtime on every
  // seeded row shape), so the claim is machine-checked rather than asserted.
  return projected as Extract<DailyPuzzleResponse, { game: G }>;
```

**T-DB-S5 is deliberately NOT cited in that comment.** It compares `Object.keys(...).sort()` over module namespaces and is blind to any signature or runtime discriminator; citing it would be a comment claiming a guarantee the code lacks — the pattern plan 017 §20 caught three times.

**No export is added.** T-DB-9a/9b/9c/9d compare `Object.keys(...).sort()` and are blind to a signature change — they must come out byte-identical (§19.5). `wallPredicate` gains **no lower date bound** (ADR-0026 decision 6; the write-side bound is the route constant `ACCEPTED_DAYS_BACK`, unchanged at 1).

### 6.6 `packages/core/src/index.ts`

New exports, all of them, decided — no conditionals: `sudokuDigitSchema`, `sudokuDailyContentSchema`, `dailySudokuResponseSchema`, `type SudokuDailyContent`, `type DailySudokuResponse`, `type ProjectedGame`, `sudokuCompletionRequestSchema`, `type SudokuCompletionRequest`, `cronPublishGameResultSchema`, `type CronPublishGameResult`.

`cronPublishGameResultSchema` **is** exported: §7.2's route builds two of these values and would otherwise re-declare the shape inline, and `packages/db/src/published.ts` needs `ProjectedGame` for §6.5. `sudokuDigitSchema` is exported because `apps/web/src/play/play-record.ts` imports it (§9.1). `packages/core` has no export-list tripwire, so this is additive only.

---

## 7. `apps/api` changes

### 7.1 `src/publishing/service.ts` — `topUpSudokuBuffer` (S12/S13)

A named sibling of `topUpBinairoBuffer` with the same signature and the same return shape. Identical: `todaySaoPaulo`, the `existing` set, the `addDays`/`isoWeekdayOf` + `isWeekday` guard, `randomUint32`, the fail-closed content-schema `break`, `insertDailyPuzzle` with `ON CONFLICT DO NOTHING`, the `failures` accumulation, and the "a lost race still means the date is covered" semantics.

Four real deltas, and no others:

| Binairo | Sudoku |
|---|---|
| `generateBinairo({ seed, weekday })` | `generateDailySudoku({ seed, weekday })` |
| `catch … instanceof BinairoGenerationError` | `instanceof SudokuGenerationError` (fields `{ seed, criteria, attempts }`) |
| `validateBinairo(puzzle, weekday)` | `validateSudoku(puzzle, criteria)` — **it takes CRITERIA, not a weekday.** Compute `const criteria = sudokuCriteriaForWeekday(weekday)` once per date and pass it to the validator; `generateDailySudoku` does its own lookup |
| `MAX_SEED_RETRIES_PER_DATE = 8` | `MAX_SUDOKU_SEED_RETRIES_PER_DATE = 2` **and a run-scoped `MAX_SUDOKU_SEED_RETRIES_PER_RUN = 4`**, with S13's arithmetic in the comment |

`sudokuDailyContentSchema.safeParse(puzzle)` before insert; `game: "sudoku"` in `listBufferedDates`, `insertDailyPuzzle` and `bufferDepth`.

The run-scoped budget is a counter initialised once per `topUpSudokuBuffer` call and decremented on every seed attempt that does **not** cover its date. When it reaches zero, every remaining uncovered date is pushed to `failures` with `reason: "run seed-retry budget exhausted"` and the loop ends. Dates already covered are unaffected, the function still returns normally, and the buffer-depth alert catches the shortfall on its next poll. T-API-S15 pins it.

**CPU budget, measured on this machine (30 fresh seeds per weekday, §19.6):** generation mean 0.68 ms (Mon, tier 1) → 5.5 ms (Thu/Fri, tier 3) → 11.3 ms (Sat, tier 4) → **120.9 ms mean / 313 ms p95 / 346 ms max (Sun, tier 5)**. `SUDOKU_WEEKDAY_CRITERIA` maps exactly one weekday to tier 5, so a cold seven-day top-up costs ≈ **150 ms of CPU total**, plus ~0.5 ms of `validateSudoku` per candidate (`gradeSudoku` dominates it).

**The three bounds, stated separately because conflating them is how the previous draft got this wrong:**

| Bound | Value | Basis |
|---|---|---|
| Per exhausted seed | ~2 s | `SUDOKU_MAX_GENERATION_ATTEMPTS = 1200` × ~1.7 ms/attempt |
| Per **date** | ~4 s | `MAX_SUDOKU_SEED_RETRIES_PER_DATE = 2` |
| Per **run** | ~8 s | `MAX_SUDOKU_SEED_RETRIES_PER_RUN = 4` — **not** `depth × 4 s`, which would be ~28 s at the default depth of 7 and ~120 s at `remoteConfigSchema`'s clamp ceiling of 30 |

Residual cap-hit probability is ≈5e-7 per seed (plan 011 §8.1), so a run in which even two dates exhaust is ≈2.5e-13 — the run budget is a construction guarantee, not a scenario being designed for. The realistic run is ~2 s, dominated by Neon round-trips.

**`maxDuration` is set, not left to a platform default.** `apps/api/vercel.json` today is `{ "ignoreCommand": …, "crons": [ … ] }` — no `functions` block, which means the **platform default governs, not infinity**, and `.github/workflows/buffer-alert.yml` documents this project as Hobby-plan. A claim of "no change required" would be asserted against a limit the plan never read. This ticket therefore adds:

```json
  "functions": { "app/cron/publish/route.ts": { "maxDuration": 60 } }
```

sized well above the ~2 s realistic run and the ~8 s + binairo construction bound. **If the deploy rejects 60 on the current plan tier, lower it to that tier's documented ceiling and record the value and the rejection in the PR** — the point is that the number is explicit and verified, not that it is 60. Evidence: the deploy log, pasted at E3.

### 7.2 `app/cron/publish/route.ts` and `app/buffer-depth/route.ts`

- The cron calls both top-ups **serially, in a fixed order — binairo first, then sudoku** (Neon round-trips dominate, so concurrency buys nothing and doubles connection pressure; cheap game first, so a Sudoku CPU overrun can never starve Binairo). It emits **one log line per game** so the existing `{event:"cron-publish", game:…}` log query keeps working, builds the S15 body, and returns **500 when ANY game threw OR any game's post-run depth is below `effectiveThreshold(config.bufferDepth)`**.
- **Each top-up runs inside its own `try`/`catch`, and this is a decision, not a detail.** Neither `topUpBinairoBuffer` nor its sibling catches anything but its own `*GenerationError` (`service.ts:101-109` rethrows everything else), so `insertDailyPuzzle`, `bufferDepth`, `todaySaoPaulo` and the `RangeError` at `:93` all propagate. With two games composed serially and no isolation, **one game's transient Neon blip silently stops the other game's buffer from being topped up** — and because `BUFFER_ALERT_THRESHOLD = 4` against a default depth of 7, the victim drains one day per occurrence and pages only after three-plus consecutive days. The shape:

```ts
async function runTopUp(game, topUp): Promise<CronPublishGameResult> {
  try {
    const { generated, depth, failures } = await topUp(db, config.bufferDepth);
    return { generated, depth, failures, error: null };
  } catch (thrown) {
    // Depth is read separately so the strict body still parses and the
    // gate below still sees this game's real coverage. If THAT throws too
    // the database is gone, 0 forces the 500 and the alert.
    const depth = await bufferDepth(db, game).catch(() => 0);
    return { generated: 0, depth, failures: [], error: String(thrown) };
  }
}
```

- `/buffer-depth` reads both depths and derives `shallow` as the OR (S16). `.github/workflows/buffer-alert.yml` needs **no change**.

### 7.3 `app/completions/route.ts` — one hardcode, one helper

Everything else in this route is genuinely game-generic and is verified so: `warnIfGuardDegraded`, `isCrossSiteWrite`/403, the 415 gate, `requireUserId`/401, `completionRequestSchema.safeParse`/400, the idempotent short-circuit at line 147 (`getCompletion(db, userId, body.game, body.date)` — **it stays exactly where it is**, before the date bound, before the wall read and before the judge), `ACCEPTED_DAYS_BACK`, the wall read, `recordCompletion`, `errorResponse`/`completionResponse`.

The one hardcode is line 170. It becomes a **local** helper, exhaustive over the *request union's* discriminator rather than over `Game`, so #25/#27 get a compile error instead of a silent fallthrough:

```ts
/**
 * The stored solution for a submitted game. Deliberately local to this route
 * and keyed on CompletionRequest["game"], not Game: Termo has no grid, so a
 * core-level "get the solution" abstraction would be wrong within two tickets.
 * jsonb is untyped at the boundary: parsed, never cast.
 */
function storedSolution(
  game: CompletionRequest["game"],
  content: unknown,
): readonly number[] {
  switch (game) {
    case "binairo":
      return binairoDailyContentSchema.parse(content).solution;
    case "sudoku":
      return sudokuDailyContentSchema.parse(content).solution;
  }
}
```

The comparison at lines 179–189 **generalizes as written and is not touched**: `solution` becomes `readonly number[]`, `body.grid[index]` is `number | undefined`, and the constant-work property — every cell examined, no early exit — is preserved for free. The comment's #27/Termo rationale stands. `outcome: "won"` stays correct for Sudoku (`lost` is Termo-only, ADR-0008); a wrong Sudoku grid is a client bug or tampering → 422, no row.

Without the helper, a sudoku row reaching line 170 throws a `ZodError` → uncaught → **500**. It is unreachable only until §6.3 widens the request union, at which point it goes live in the same PR.

### 7.4 `app/daily/sudoku/route.ts` (new, S14)

A literal copy of `app/daily/binairo/route.ts` with `"sudoku"` in place of `"binairo"`, parsing the response against `dailySudokuResponseSchema` rather than the union — two Zod gates, one per enforcement point, and a sudoku row on a binairo path (or vice versa) fails loudly instead of succeeding. **While here, `app/daily/binairo/route.ts` is narrowed to `dailyBinairoResponseSchema` for the same reason**: with a real union, parsing against `dailyPuzzleResponseSchema` would now *accept* a mismatched row and lose a defence-in-depth assertion.

`apps/web` does not use either route (ADR-0028 D5 extends ADR-0014's direct read). They exist as plan 014 D7's consumer proof, as ADR-0024's per-`<game>` kill-switch surface, and as the production evidence step E7.

### 7.5 Not touched in `apps/api`

`src/session/*`, `src/cors.ts`, `app/session/route.ts`, `app/health`, `app/root`. `ACCEPTED_DAYS_BACK` stays `1` (#31 is its lever). `wallPredicate` gains nothing (#19.5).

---

## 8. Client state model for Sudoku (exact types)

`apps/web/src/sudoku/state.ts` — pure, no React, no DOM, no clock.

### 8.1 Types

```ts
import type { SudokuGrid, SudokuTier } from "@miolos/games/sudoku";
import type { HintState, LifecycleAction, PlayCore, TimerState } from "../play/types";

/** 1–9. `null` is the client's empty; the engine's 0 never reaches this type (S6). */
export type SudokuDigit = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export type SudokuCellValue = SudokuDigit | null;

export interface SudokuPlayState extends PlayCore {
  /** Engine-native: 0 = empty. Fed straight to solveSudoku, never converted. */
  readonly givens: SudokuGrid;
  /** 81 entries; always null at a given's index. */
  readonly entries: readonly SudokuCellValue[];
  /** The selected cell AND the roving-focus caret — one concept (S4). */
  readonly selected: number | null;
  readonly tier: SudokuTier;
  readonly hint: HintState;
  /** Recomputed on every entry change (S8); presentation only. */
  readonly violating: ReadonlySet<number>;
}

export type SudokuPlayAction =
  | LifecycleAction
  | { readonly type: "select"; readonly index: number }
  | { readonly type: "move-selection"; readonly rows: number; readonly columns: number }
  | { readonly type: "enter-digit"; readonly digit: SudokuDigit }
  | { readonly type: "clear-cell" }
  | { readonly type: "use-hint"; readonly solution: readonly SudokuDigit[] }
  | { readonly type: "mark-synced" };

/** The deterministic server snapshot: givens only, 00:00, hydrated: false. */
export function initSudokuPlayState(daily: DailySudokuResponse): SudokuPlayState;
export function sudokuPlayReducer(state: SudokuPlayState, action: SudokuPlayAction): SudokuPlayState;
```

`initSudokuPlayState` sets `selected: null` — the caret appears on first interaction, so the first paint carries no state the record might contradict (plan 017 D28 transfers).

### 8.2 `apps/web/src/sudoku/engine.ts` — the one conversion boundary (S6)

```ts
/** givens[i] !== 0 ? givens[i] : (entries[i] ?? 0) — the grid the engine sees. */
export function mergedGrid(givens: SudokuGrid, entries: readonly SudokuCellValue[]): SudokuGrid;

/** True where the player may write. `givens` is engine-native, so 0 means playable. */
export function isPlayable(givens: SudokuGrid, index: number): boolean;

/**
 * The engine's solution as digits, or null when the board is unsolvable.
 * Every cell of a solved grid is 1-9 by construction, so this narrows a
 * proved fact; it is written as an explicit loop rather than a cast so the
 * proof is in the code (CLAUDE.md "parsed, never cast").
 */
export function solutionDigits(givens: SudokuGrid): readonly SudokuDigit[] | null;

/** givens mapped to the hint's null-is-playable convention, memoized by the caller. */
export function playableGivens(givens: SudokuGrid): readonly (SudokuDigit | null)[];

/**
 * The MERGED grid narrowed to digits, or null when any cell is outside 1-9.
 * Sudoku's `buildRecord` writes `record.grid` only when this is non-null,
 * mirroring binairo's `input.solved && isSolvedGrid(merged)` guard
 * (`state.ts:214`, a real type predicate). Sudoku has no equivalent on the
 * engine barrel — `isSudokuSolved` returns a plain `boolean` — and
 * `mergedGrid` returns `SudokuGrid = readonly number[]`, which is NOT
 * assignable to the `readonly SudokuDigit[]` the §9.1 record schema infers.
 * Without this the offline queue would have no body to POST, so AC 3's
 * "recorded once" and AC 4's "offline-tolerant sync" would both dead-end —
 * and the only alternatives are a cast (forbidden) or an unplanned helper
 * invented at implementation time. An explicit loop, never a cast.
 */
export function solvedDigits(merged: SudokuGrid): readonly SudokuDigit[] | null;
```

`mergedGrid`'s output always satisfies `assertSudokuGrid` (length 81, integers 0–9) by construction, which matters because `getSudokuConflicts`, `isSudokuSolved`, `solveSudoku` and `countSudokuSolutions` all call it and all **throw a `TypeError`** on a malformed grid. The client must never hand them a partial or `undefined`-bearing array; that is what this module exists to guarantee, and T-WEB-S3 pins it.

### 8.3 Cell state machine

Per cell index `i`:

- `givens[i] !== 0` ⇒ **given**, immutable. `enter-digit` and `clear-cell` are no-ops on it; `select` still works (S4).
- `select` sets `selected = index` and nothing else.
- `move-selection` clamps to `[0,8]` on each axis independently and **does not wrap**: wrapping from column 9 to column 1 of the next row is disorienting on a boxed grid, and clamping makes the edges discoverable. From `selected === null` it selects index 0.
- `enter-digit` writes `digit` at `selected`, **unless the cell already holds that digit, in which case it clears** — a one-tap undo, mirroring Binairo's "re-tapping clears" (plan 017 D8). No-op when `selected === null` or the cell is a given.
- `clear-cell` sets `entries[selected] = null`.
- `use-hint` is unchanged in shape from Binairo's: capped at `hint.free`, no-op when the grid is closed or `nextHint` returns `null`, and sets `hint.lastIndex` for the highlight. **It does NOT move `selected`.** The caret is the player's; the highlight is the app's. Moving the caret onto the revealed cell would make the hinted cell *always* also the selected cell, and under §12.5's chromatic precedence that means the `hint-filled` state could never render at all — the one visual payload AC 4's free hint has. It would also yank the player's cursor away from wherever they were working. T-WEB-S7 asserts `selected` is unchanged by `use-hint`.

Every entry change recomputes `violating` from `new Set(getSudokuConflicts(merged))` and `status` from `isSudokuSolved(merged)` (S7/S8), and entering `solved` latches `pendingSync: true`. The timer freeze stays the hook's `pause` dispatch — a reducer may never read a clock.

### 8.4 Keyboard, exactly (S4)

Handled on the board container, so one listener serves 81 cells:

| Key | Action |
|---|---|
| `1`–`9` | `enter-digit` |
| `0`, `Backspace`, `Delete` | `clear-cell` |
| `ArrowUp/Down/Left/Right` | `move-selection` (±1 row / ±1 column), `preventDefault` so the page does not scroll |
| `Home` / `End` | first / last column of the current row |
| `Enter` / `Space` | nothing beyond the browser's native button activation, which is `select` |

Roving tabindex: exactly one cell carries `tabIndex={0}` (the selected one, or index 0 when `selected === null`); all others carry `tabIndex={-1}`. After `select`/`move-selection` — **and not after `use-hint`, which no longer moves the selection (§8.3)** — a layout effect focuses the newly selected cell, **only when focus is already inside the board**, so a hint press from the sidebar button does not steal focus away from it.

### 8.5 Local validation and completion

`getSudokuConflicts` flags only duplicate digits within a row, column or box — it has no "you can no longer finish from here" notion (that would be `solveSudoku(merged) === null`, which is deliberately **not** run per keystroke: it would tell a player their board is dead, which is a hint, not validation). Measured 0.009 ms typical / 0.24 ms worst on a full grid; `isSudokuSolved` 0.010 ms. Both run synchronously on every entry change, no debounce.

### 8.6 Pencil marks — decided out (S5)

Not shipped. The issue asks for "parity with Binairo", which has none; the engine exposes no candidate API (the ladder's bitmasks are local to `gradeInternal`); a 3×3 mini-grid inside a ~34px mobile cell is illegible; and notes would double the reducer's action set, the persisted record's shape (an 81×9 bitfield) and the a11y surface. **The counter-argument is real and is escalated, not buried:** Sunday's tier-5 daily requires naked/hidden triples and X-wing, which most solvers cannot execute without notes. §16 carries it to Fernando; the follow-up issue is filed at step 8 either way.

### 8.7 Peer highlight — decided out (S1 table)

Not shipped. `PEERS`, `rowOf`, `colOf`, `boxOf` exist in `packages/games/src/sudoku/board.ts` but are **not** on the subpath barrel, and a deep import is forbidden (ADR-0019). Widening the barrel for a feature no AC asks for is churn, and the board already carries five cell states (given, entered, selected, hinted, violating) — a sixth ambient wash would dilute all of them.

---

## 9. Persistence and offline sync

### 9.1 The record (S17)

`apps/web/src/play/play-record.ts`:

```ts
export const playRecordKey = (game: Game, date: string) =>
  `${STORAGE_PREFIX}${game}:${date}`;

// Imported from @miolos/core (§6.1/§6.6), not re-declared: one definition,
// three consumers — the daily contract, the completion request, and this.
import { sudokuDigitSchema } from "@miolos/core";

/** v STAYS 1 (S17). A bump discards every in-flight record, i.e. lost completions. */
export const sudokuPlayRecordSchema = z.strictObject({
  v: z.literal(1),
  game: z.literal("sudoku"),
  date: isoDateString,
  entries: z.array(z.union([sudokuDigitSchema, z.null()])).length(81),
  grid: z.array(sudokuDigitSchema).length(81).optional(),
  elapsedMs: z.number().int().min(0).max(ELAPSED_CAP_MS),
  hintsUsed: z.number().int().min(0).max(1),
  concluded: z.boolean(),
  pendingSync: z.boolean(),
  syncOutcome: z.enum(["pending", "recorded", "rejected"]),
});

export const playRecordSchema = z.discriminatedUnion("game", [
  binairoPlayRecordSchema,   // byte-identical to the shipped one
  sudokuPlayRecordSchema,
]);

/**
 * The record at (game, date), or undefined on absence, garbage, or a record
 * whose own `game` does not match the key it was found under — a hand-edited
 * store must never feed a 64-cell binairo record into an 81-cell sudoku grid.
 */
export function readPlayRecord(game: Game, date: string): PlayRecord | undefined;
```

Everything else in the module is already game-agnostic and moves verbatim: the `miolos:play:` prefix scan, the Safari-private-mode `storage()` guard, `parseAt`, `writePlayRecord`'s **two-sided** `elapsedMs` clamp (finding `elapsedms-clamp-is-one-sided`), `listPendingRecords()` (game-blind by design — this is *why* `sync.ts` is nearly generic), and `prunePlayRecords(keepDate)`.

Callers of `readPlayRecord` that gain a `game` argument: the lifecycle hook's mount effect, `persistUnlessConcluded`, and the conclusion's snapshot reader.

### 9.2 Sync

`apps/web/src/play/sync.ts`, one line changed (S18). Everything the file already does stays: `memoryQueue` keyed `${game}:${date}` and its two-sided clamp in `buildBody` (finding `memory-queue-record-bypasses-the-two-sided-clamp`), `TERMINAL_STATUSES = {400,403,404,415,422}`, `RETRY_DELAYS_MS = [2s,5s,15s,60s]`, the single 401 re-mint, `acceptResponse`'s `recorded: false` write-back, the five triggers, and the `flushing` guard.

`buildBody` becomes **the one per-game dispatch in the module** (S18). The queue, retry ladder, re-mint and settle machinery above it are genuinely generic; the body is not, and pretending otherwise is what would push #27 toward a second sync module:

```ts
/**
 * The POST body, built from the record ALONE and parsed before it leaves.
 * `undefined` means the record cannot produce one.
 *
 * This switch is the module's ONLY per-game branch, and it is deliberate:
 * a grid body is a grid body, but Termo's completion request carries
 * GUESSES, not a grid (#27), so it adds a non-grid case here rather than a
 * second sync module — which S1 rejects on a correctness argument.
 */
function buildBody(record: PlayRecord): string | undefined {
  switch (record.game) {
    case "binairo":
    case "sudoku":
      return gridBody(record);
  }
}

function gridBody(record: BinairoPlayRecord | SudokuPlayRecord): string | undefined {
  if (record.grid === undefined) {
    return undefined;
  }
  const parsed = completionRequestSchema.safeParse({
    game: record.game, date: record.date, grid: record.grid,
    elapsedMs: Math.min(Math.max(record.elapsedMs, 0), ELAPSED_CAP_MS),
    hintsUsed: record.hintsUsed,
  });
  return parsed.success ? JSON.stringify(parsed.data) : undefined;
}
```

`syncRecord`'s log string generalizes with it: `"has no solved grid to post"` → `"has no submittable result to post"`.

`startCompletionSync()` is registered twice today (the play hook and the conclusion) and the module-level guards make the overlap free. That stays true with N games **only while there is one module** (S1).

---

## 10. The one free hint

### 10.1 Where it is computed (S9)

Client-side, `solveSudoku(givens)` from `@miolos/games/sudoku`, memoized once per page in `useSudokuPlay`. `solveSudoku` returns `SudokuGrid | null`; the `null` branch is **defined, not assumed away** — the hint button renders its exhausted variant and `status` is unaffected (the omission of exactly this branch was plan 017's finding `issue-ac-10`). For a published daily `null` is unreachable by construction, which is why it is a UI fallback rather than an error.

Measured on this machine (30 fresh seeds per weekday, cold call after generation):

| weekday | tier | mean | p50 | p95 | max |
|---|---|---|---|---|---|
| Mon | 1 | 0.016 ms | 0.007 | 0.053 | 0.170 |
| Thu | 3 | 0.020 | 0.018 | 0.033 | 0.089 |
| Sat | 4 | 0.043 | 0.029 | 0.126 | 0.263 |
| **Sun** | **5** | **0.057** | 0.022 | 0.251 | **0.520** |

`solveBinairo` on its hardest weekday measures 0.035 ms mean in the same harness. **`solveSudoku` on the hardest daily is the same order of magnitude**, so ADR-0027's argument transfers verbatim with real numbers rather than by analogy: even a 10× slower low-end phone stays ≲ 5 ms for a once-per-page call, and there is no hint endpoint.

`gradeSudoku` measures ~0.46 ms and is **never** called on the client — the tier arrives on the wire (S10).

### 10.2 The shared `nextHint` — `apps/web/src/play/grid-hint.ts` (§5.2)

```ts
export interface Hint<T> {
  readonly index: number;
  readonly value: T;
  readonly kind: "correction" | "fill";
}

/**
 * Deterministic: same state in, same hint out. `null` is the empty cell in
 * all three arrays, so both games pass their own cell types unchanged —
 * binairo natively, sudoku through `playableGivens`/`solutionDigits` (§8.2).
 *
 * `T` is UNCONSTRAINED. The body uses only `!== null` and `!==` equality —
 * nothing numeric — so `T extends number` would pre-exclude a future
 * letter/character game for no reason the algorithm has.
 */
export function nextHint<T>(
  solution: readonly T[],
  givens: readonly (T | null)[],
  entries: readonly (T | null)[],
): Hint<T> | null;
```

**The module is named `grid-hint.ts`, not `hint.ts`**, so the shared layer's naming stays honest: this is the hint for a grid whose solution the client can recover from the published givens. Termo's answer is never on the wire, so it inherits neither this module nor ADR-0027's argument (S9).

The algorithm is unchanged: skip givens, return the **first row-major contradiction** (`kind: "correction"`), else the **first empty** (`kind: "fill"`), else `null`. A contradiction wins because it unblocks the mistake the player is actually stuck behind. The body moves byte-identical apart from the three `null` comparisons already being generic.

### 10.3 Accounting

`hint.used` goes 0 → 1, persisted in the record, reported as `hintsUsed` on the POST. **Not** a grant row. `hint_grants` stays dormant with its column-set tripwire (T-DB-20) untouched. `hints_used` remains self-reported and can never back a "sem dicas" medal (ADR-0027) — no comment in this ticket may claim otherwise.

---

## 11. Hub tile and conclusion chaining (S20/S21) — the #19 boundary

### 11.1 Where the line is, and why

Issue #19 (M1) AC 2 owns the hub verbatim: *"Hub shows date, per-game done/pending, 'X de 4', and the server-computed streak"*. Issue #23 AC 3 contains a strict subset: *"hub tile shows done/pending"*. #19 is unblocked (`blocked-by: #18`, merged) and by the milestone map is scheduled **before** #23. **Flagged for the orchestrator: running #19 first collapses this whole overlap into "add one key to the map #19 built."**

Given it was not run first, three options and the call:

| Option | Cost | Verdict |
|---|---|---|
| Defer the hub clause entirely to #19 | Zero double-build and the cleanest ownership — but #23 closes with an AC visibly unmet, the home screen says "0 de 4" with two playable games for however long #19 waits, and step 6's issue-adherence reviewer rejects on silence | **Reject** |
| Build the real authenticated endpoint here | Meets AC 3 literally, but #23 then designs a payload whose shape is #19's problem (it must carry the streak), #19 immediately widens and re-tests the same route, and #23's diff grows by an api route + a `@miolos/db/user` reader (with its export tripwire) + a contract + a client fetch + a skeleton state + ~4 test files. Highest double-build risk of the three | **Reject** |
| **Device-local, monotone-safe day state behind one seam** | ~1 file of data-source code that #19 replaces; the CSS variant, the copy and the components survive untouched | **Ship** |

Two facts make the third option not merely cheapest but *required*: **(a)** AC 3's second clause — "conclusion chains to the next pending daily" — is unimplementable any other way, because a conclusion reached offline structurally cannot call `apps/api`; the local reader gets built regardless and the hub just consumes it. **(b)** ADR-0014's Consequences say a user-specific fragment on a public page must call `apps/api` — which is exactly why this is **not** presented as user state: it is *device* state, and it can only understate (S20).

`streakCount` stays hardcoded `0`, flagged in the PR. The asymmetry is deliberate and stated rather than left for a reviewer to find: a streak is a cross-day derivation over server rows (ADR-0009); "did this device finish today's Sudoku" is a fact the device owns.

**The positive half of "and the streak counts it", stated because a descope-only answer under-reports what ships.** The sudoku completion row is written **game-generically** — `recordCompletion({ game, … })` (`packages/db/src/completions.ts:78`) and `getCompletion(db, userId, game, date)` (`:42`) take `game` as data, and `on_time` is derived in SQL at `:53`. Issue #19 defines the streak as consecutive days with at least one on-time completion over those rows, so a `game='sudoku'` row is counted by #19's derivation with **zero additional work**. What this ticket defers is the *display* of the streak, not its arithmetic — the day is already being made to count.

### 11.2 The seam

```ts
// apps/web/src/play/day-state.ts
export interface DayEntry {
  readonly concluded: boolean;
  readonly elapsedMs: number | undefined;
}

/**
 * What THIS DEVICE knows about `date`, read from the local play records.
 * Monotone-safe by construction (ADR-0031): a concluded record proves this
 * device solved it; absence proves nothing and renders as pending, which is
 * also the cold-profile default, also what `impeccable detect` always scans,
 * and also what a second device sees. #19 replaces this function's body with
 * the server payload; its callers do not change.
 */
export function readDayState(date: string): Readonly<Record<Game, DayEntry>>;
export function doneCount(state: Readonly<Record<Game, DayEntry>>): number;
```

Subscription reuses the shipped `useSyncExternalStore` idiom moved to `play/use-record-snapshot.ts` (`SERVER_SNAPSHOT = { hydrated: false }`, a cached snapshot for referential stability, a 1 s poll plus a `storage` listener). Nothing is reinvented.

### 11.3 Hoje

`apps/web/app/page.tsx` stays a server component. Two small `"use client"` children consume `useDayState(date)`: the meta line (`completedOfTotal`) and the game cards' CTA area. The per-game route map replaces the branch at line 101:

```ts
const playRoutes: Partial<Record<Game, Route>> = {
  binairo: routes.binairo,
  sudoku: routes.sudoku,
};
```

so #25/#27 add a key, not a branch, and `page.module.css`'s `.cta[href]` comment updates from "Binairo's CTA is the only live one so far (#18)" to name both.

**Done state, taken from the design system rather than invented** (DESIGN.md "Game card": *"done state is an outlined 'Feito' stamp chip (rotated −3deg) + tabular result, pending state is a solid accent button"*; F1:64 shows Sudoku done with `result: 'em 07:12'`, F2:63 mobile `'07:12'`).

**A done tile IS navigable — decided here, because #23 is the first ticket in which a tile can be done at all.** F1:35-37 draws the done state as a bare `<span>Feito</span>` inside `sc-if`, with no anchor. Following that literally makes the card inert, and since the archive is #31 and the stats link is deliberately href-less, a player who finishes Sudoku would have **no in-app route back to its own conclusion** — while `/sudoku` restores straight into it (T-WEB-S29). So the done state's chip-plus-result row is wrapped in `<Link href={playRoutes[game]}>` with `aria-label={messages.hoje.doneAria(name, elapsed)}`; the chip and result are visually unchanged from F1. Recorded as **§12.7 deviation 12**. T-WEB-S16 asserts a concluded sudoku card **is** a link and that its href is the play route.

**The CTA box is reserved at a fixed `min-height`, and the number is stated rather than measured later.** `.cta` today (`app/page.module.css:153-166`) has `padding: var(--space-3) 0` (12px) and `font: var(--text-button)` = `600 14px/1`, so its computed height is `12 + 14 + 12 = 38px` — and `min-height: var(--touch-target-min)` exists **only** inside the ≤768px block at `:321-324`. At desktop nothing reserves it, and the done state is a structurally different element (an outlined stamp chip plus a tabular result), so its height is not automatically equal. `.cta` therefore gains `min-height: 38px` at desktop with that arithmetic in a comment, **and the done variant reuses the same box** — identical by construction, not by measurement. T-WEB-S17 asserts the declaration through `stylesheet("app/page.module.css")` (§5.5), which is the mechanism that makes it assertable at all: jsdom has no layout, and `css-source.ts` could not read `app/` before this ticket.

### 11.4 The conclusion

- `DayChip`'s `const done = game === "binairo"` at `conclusion-view.tsx:244` becomes `dayState[game].concluded`, read through the same snapshot the view already owns.
- The **CTA chains** (S21): the first game in `DAY_GAMES` order that is playable (`playRoutes[game] !== undefined`) and not concluded gets the CTA; if none, it falls back to `routes.home` with today's copy. When it points at a game it takes **that game's accent** (F5's own treatment for a game-destination button); when it points at Hoje it keeps the solid-ink treatment (`--ink` / `--paper-desk` / `--shadow-sm --line`). This supersedes plan 017 §12.3's CTA row and deviation 9, which reserved `--accent-nonogram` for #25; the generalization subsumes the reservation.
- **`cachedSnapshot` is keyed `{game, date}`, not `date` alone** (§19.4) — a latent bug this ticket would otherwise introduce the moment two conclusion routes exist in one SPA session.
- The chips understate for the same reason the hub does: a player who solved Sudoku on another device sees `falta`. Stated, not hidden.

---

## 12. The Sudoku screen, designed just-in-time

There is no reference frame. This section is the design, defensible as a sibling of F3/F4 within the recorded system. Accent: **`--accent-sudoku: #2E4E7E`** (ink-blue), consumed as `var(--accent)` set inline on `.page` (S24). Accent alphas use `color-mix(in srgb, var(--accent) N%, transparent)`, never `rgba()` literals. Any px value with no token carries a comment naming its arithmetic.

### 12.1 File tree

```
apps/web/app/sudoku/page.tsx                   server, force-dynamic, reads the wall
apps/web/app/sudoku/concluido/page.tsx         server, force-dynamic (ADR-0028 D1/D2)
apps/web/src/sudoku/engine.ts                  the one conversion boundary (§8.2)
apps/web/src/sudoku/state.ts                   pure reducer + types (§8)
apps/web/src/sudoku/use-sudoku-play.ts         useReducer + usePlayLifecycle + the solution memo
apps/web/src/sudoku/sudoku-screen.tsx          "use client" — skeleton / play / conclusion swap
apps/web/src/sudoku/play-view.tsx              the play composition + PlaySkeleton
apps/web/src/sudoku/board.tsx                  81 cell buttons + the 4 rule divs + keyboard
apps/web/src/sudoku/keypad.tsx                 1–9 + apagar
apps/web/src/sudoku/sudoku-board.module.css    board geometry + keypad + cell states
                                               + `.pageSudoku` (the four per-game custom
                                                 properties, §12.2)
                                               + `.cellSkeleton` (a .cell variant, so it
                                                 cannot live in the shared sheet)
                                               + its OWN `@media (prefers-reduced-motion:
                                                 reduce) { .cell, .keypadDigit, .keypadErase
                                                 { transition: none } }` — CSS Modules hash
                                                 per file, so the shared block cannot reach
                                                 these classes. Not optional: DESIGN.md makes
                                                 a reduced-motion alternative law.
```

Shared chrome comes from `../play/screen.module.css`, `../play/timer-readout`, `../play/conclusion-view`.

### 12.2 The shared layout stylesheet (S2)

`apps/web/src/play/screen.module.css` is the agnostic half of today's `binairo-screen.module.css`, moved with **three** documented edits and no others: every `--accent-binairo` → `var(--accent)`, the single-column fold moves, and the four per-game-varying values become custom properties. It keeps `.page` (the `bar/title/stats/free/hint/board` named-area grid, including the **1fr `free` spacer row that pins `.hint` to the sidebar's bottom**), `.page a:hover`, `.topBar`, `.back`, `.wordmark`, `.topDate`, `.barKicker`, `.timerBar`, `.titleBlock`, `.titleKicker`, `.titleRow`, `.title`, `.progressBar`, `.rules`, `.statsCard`, `.tape`, `.statRow`, `.statLabel`, `.timerCard`, `.progressCard`, `.hint`/`.hintUsed`/`:active`/`:focus-visible`, `.board`, `.gridCard`, `.hintExplain`.

**`.cellSkeleton` does NOT move** (it is `.placeholder` in the earlier draft's list — the shipped class is `.cellSkeleton` at `binairo-screen.module.css:316-319`, and its own comment says *"every dimension still comes from .cell and .grid above"*, both of which stay per game). It is a `.cell` variant, so it lives in each game's board module. The `prefers-reduced-motion` block **splits**: the shared sheet keeps `.hint`, and each game's board module carries its own — `sudoku-board.module.css` gets `@media (prefers-reduced-motion: reduce) { .cell, .keypadDigit, .keypadErase { transition: none } }`. CSS Modules hash class names per file, so the shared block cannot reach a class declared in another module; leaving it implicit would silently drop a DESIGN.md requirement.

#### The per-game override mechanism — custom properties, never cascade order

`.gridCard`, `.statsCard` and `.tape` are shared **and** carry per-game values (Sudoku mirrors all three rotation signs, §12.4), and `--board-mobile-max` genuinely differs (347 vs 350). Declaring `.gridCard` in both `screen.module.css` and `sudoku-board.module.css` would resolve by **stylesheet injection order**, which Next does not guarantee — the most fragile mechanism available. So:

- the shared sheet reads `transform: rotate(var(--grid-card-rot, 0.4deg))`, `rotate(var(--stats-card-rot, -0.5deg))`, `rotate(var(--tape-rot, -3deg))` and `max-width: var(--board-mobile-max)`;
- each game's own module declares a **class carried alongside `screen.page` on the same element** — `.pageBinairo { --grid-card-rot: 0.4deg; --stats-card-rot: -0.5deg; --tape-rot: -3deg; --board-mobile-max: 347px; }`, `.pageSudoku { … -0.4deg; 0.5deg; 3deg; 350px; }`;
- the root is `className={`${screen.page} ${board.pageSudoku}`}`.

Binairo's current values are the fallbacks, so the extraction stays behaviour-free. Only one module ever sets each property, so there is no conflicting declaration and no cascade-order dependency, no `css.d.ts` change (S24 survives) and no inline style. `--board-mobile-max` moves out of the shared mobile `.page` block (`:540`) and is declared unconditionally on the per-game class — behaviour-free, because it is only ever *read* inside the mobile block; enumerated in §5.5 because a test reads it from there.

**No per-game padding or shadow property is needed**, because §12.7 deviations 2 and 3 are deleted: Sudoku adopts Binairo's mobile 10px `.gridCard` padding and 3px grid gap (§12.3). The mobile `box-shadow: 5px 5px 0 color-mix(… var(--accent) 20%, transparent)` at `:566-569` is already agnostic once the accent is.

**The fold moves 1040px → 1140px, for both games AND for the shared conclusion.** Binairo's shipped comment computes its own hard minimum as `80 + 330 + 72 + 478 + 80 = 1040`. Sudoku's board card is 546px wide (§12.3), so its minimum is `80 + 330 + 72 + 546 + 80 = 1108`. One fold value serving both must be ≥1108; 1140 leaves margin. Consequence, stated: **Binairo now folds to one column between 1041 and 1140px instead of staying two-column**, and `conclusion-view.module.css:428`'s own `@media (max-width: 1040px)` moves to 1140 with it (§5.5 lists the one test literal that changes). The conclusion has no board, so 1140 folds it ~100px early — accepted, because the shared layer must have exactly one fold: the top bar swaps members at it, so two different folds would change the bar's character mid-session when navigating `/sudoku → /sudoku/concluido` at 1100px. Both compositions are designed and correct in the band, and neither scanned viewport (1440×900, 390×844) is in it.

### 12.3 The 9×9 board — arithmetic written out

**Mechanism (S23):** one flat CSS grid of 81 cells with **explicit gutter tracks**, and per-cell `gridColumn`/`gridRow` computed from the index. Auto-placement would drop cells into the gutter tracks, so placement is explicit:

```ts
/** 0-based row/column → 1-based grid track, skipping the two gutter tracks. */
export const track = (index: number) => index + 1 + (index >= 3 ? 1 : 0) + (index >= 6 ? 1 : 0);
// cell n: gridColumn = track(n % 9), gridRow = track(Math.floor(n / 9))
```

`track` is a pure exported function with its own unit test (T-WEB-S26) — the deterministic half of the "fragile vs testable" trade the alternative (`nth-child` margins, which fight `grid-auto-rows` and break fluid tracks) loses.

Four `aria-hidden` **rule divs** occupy the gutter tracks, spanning the grid (`gridColumn: 4 / 5, gridRow: 1 / -1` and the three siblings). They make the 3×3 structure a drawn fact rather than one inferred from spacing — which matters because the cells sit on `--paper-desk` (#F7F2E9) inside a `--paper-card` (#FBF7EF) card, so an undrawn gutter is *lighter* than the cells and a weak separator at phone scale. They carry no border, no radius and **no `box-shadow`**, so `isCardLikeFromProps` returns false on its first guard and `nested-cards` cannot fire (S23).

**Their colour is `color-mix(in srgb, var(--ink) 50%, transparent)`, not `var(--line)`** — a full hierarchy step above the cell hairline, and this is the whole point of the mechanism. A 2px `--line` rule sitting between 1.5px `--line` cell borders is not a separator: at a box boundary the player would see `1.5px #D8D0C2 / gap / 2px #D8D0C2 / gap / 1.5px #D8D0C2` — three parallel same-colour hairlines, a ladder artefact rather than the printed-sudoku convention. Computed here, not recalled: `--ink` at 50% over `--paper-card` resolves to ≈`#8E8A84`, which is **3.21 : 1** against the card, against the `--line` hairline's **1.43 : 1**. The rule therefore clears WCAG 1.4.11's 3:1 floor for a meaningful non-text graphic while the hairlines stay deliberately quiet. DESIGN.md has no "strong line" token because no game needed one; the hierarchy is made from `--ink`, which is the palette DESIGN.md does give.

**Desktop (>1140px), cells 52px per DESIGN.md:50 verbatim:**

```
grid-template-columns: repeat(3, 52px) 2px repeat(3, 52px) 2px repeat(3, 52px);
grid-template-rows:    repeat(3, 52px) 2px repeat(3, 52px) 2px repeat(3, 52px);
gap: 4px;
```

With explicit gutter tracks the effective box separation is `gap + track + gap = 4 + 2 + 4 = 10px`, against a 4px intra-box gap — a 2.5× ratio, plus the drawn rule.

```
inner grid = 9×52 + 10×4 (ten gaps across eleven tracks) + 2×2 (gutter tracks)
           = 468 + 40 + 4 = 512px
card       = 512 + 2×16 (padding) + 2×1 (border) = 546px
two-column hard minimum = 80 + 330 + 72 + 546 + 80 = 1108px   → fold at 1140 (§12.2)
available board column at 1440 = 1440 − 160 − 330 − 72 = 878px ✔ (332px of slack)

vertical at 1440×900, WITHOUT a hint fired:
    44 (page padding-top) + 29 (topBar) + 32 (.board padding-top) + 546 (board)
  + 30 (keypad margin-top) + 52 (digit row) + 8 (keypad row-gap)
  + 44 (affordance + apagar row, §12.6) + 44 (page padding-bottom)
  = 829px ≤ 900 ✔ (71px of slack)
WITH .hintExplain shown: + var(--space-4) 16 + a 13px/1.5 line ≈ 20 → 865px ≤ 900 ✔
```

**Mobile (≤768px):** fluid tracks and a square board, the mechanism Binairo already ships.

```
.grid {
  grid-template-columns: repeat(3, minmax(0,1fr)) 2px repeat(3, minmax(0,1fr)) 2px repeat(3, minmax(0,1fr));
  grid-template-rows: <the same>;
  gap: 3px;                       /* effective box separation 3+2+3 = 8px, 2.67× the intra-box gap */
  aspect-ratio: 1;
}
/* .gridCard's width/max-width/padding all come from the SHARED sheet (§12.2);
   only --board-mobile-max is per game. */
--board-mobile-max: 350px;        /* = 390 − 2×20 page padding, the widest that fits */

cell at 390px = (350 − 2×10 padding − 2×1 border − 10×3 gaps − 2×2 gutters) / 9
              = (350 − 20 − 2 − 30 − 4) / 9 = 294 / 9 ≈ 32.7px
cell at 320px = (280 − 20 − 2 − 30 − 4) / 9 = 224 / 9 ≈ 24.9px
```

Both clear WCAG 2.2 AA 2.5.8's 24px-plus-spacing floor. **Mobile card padding and grid gap are Binairo's own 10px and 3px, not the 8px/2px an earlier draft proposed:** the 8px/2px pair bought back 1.6px of cell — invisible — at the cost of two more axes on which the two boards differ, a per-game override of a shared class, and a box separation squeezed to 6px, which is precisely what would make the box rule read as a ladder. Deviations 2 and 3 are therefore **deleted**, not merely recorded.

```
vertical at 390×844 = 20 + 44 (topBar) + 10 + 34 (h1) + 12 + 39 (2-line rules 13/1.5)
                    + 16 (.board padding-top) + 350 (board) + 20 (keypad margin)
                    + 178 (3×54 + 2×8, §12.6) + 14 + 50 (hint) + 24 = 811px ≤ 844 ✔
```

At 390×667 it scrolls by ~82px. Accepted and stated: Binairo's equivalent sum already scrolls by ~7px on that device, the page is a normal scrolling document, and shortening the board to avoid it would push cells below Binairo's legibility.

**≥44px touch targets are arithmetically impossible on a nine-column phone board:** `9 × 44 = 396px` exceeds the 350px available *before* any gap, gutter, padding or border. PRODUCT.md:39's rule governs chrome controls — the keypad buttons are 54px tall and ≥64px wide at every width down to 320 (§12.6) — and this is the same argument plan 017 §12.4 recorded for Binairo's 38px cells, a fortiori.

### 12.4 Component tree

```
<main .page .pageSudoku style={{"--accent":"var(--accent-sudoku)"}}>   shared screen.module.css + §12.2's per-game property class
  <header .topBar area:bar>
    <Link .back>              "← Hoje"
    <span .wordmark>          Fraunces italic 24px rotate(-1deg)      [>1140px]
    <span .barKicker>         "Números" 11px ls .14em uppercase       [≤1140px]
    <span .topDate>           long date 13px --ink-2                  [>1140px]
    <TimerReadout .timerBar/> Fraunces 20px tabular                   [≤1140px]
  <div .titleBlock area:title>
    <p .titleKicker>          "Números"                               [>1140px]
    <div .titleRow>           ← STRUCTURAL: the <h1> is its FIRST element child
      <h1 .title>             "Sudoku"   54px | 34px
      <span .progressBar>     "Médio · {filled} de 81"                [≤1140px]
    <p .rules>                15px/1.6 | 13px/1.5, both viewports (AC 4)
  <div .statsCard area:stats>  paper card, tape, rotate(+0.5deg)      [>1140px]
    <div .tape aria-hidden>    64×20 @ top:-10 left:32, rotate(+3deg)
    <div .statRow>  "Tempo"     <TimerReadout .timerCard/>
    <div .statRow>  "Progresso" <span .progressCard>
    <div .statRow>  "Nível"     <span .levelCard>   ← NEW, sudoku-only (§12.5)
  <button .hint area:hint>     solid accent; exhausted variant per plan 017 §10.5
  <section .board area:board>
    <div .gridCard>            rotate(var(--grid-card-rot)) = -0.4deg
      <Board/>                 role="group", 81 buttons + 4 rule divs
    <Keypad/>                  grid: digits track-aligned, .affordance + apagar share row 2
      <button .keypadDigit>×9  row 1, placed at track(n-1)
      <span .affordance>       row 2, columns 1/8                     [>1140px]
      <button .keypadErase>    row 2, columns 9/-1
    <p .hintExplain>           one line after a hint fires
```

**Rotation continuity, deliberately mirrored:** F1:64 gives the Sudoku hub tile `rot: 0.5deg` / `tapeRot: 3deg`, where Binairo's screen uses `.gridCard rotate(0.4deg)` / `.statsCard rotate(-0.5deg)` / `.tape rotate(-3deg)`. The Sudoku screen takes the **opposite signs** — `.gridCard rotate(-0.4deg)`, `.statsCard rotate(+0.5deg)`, `.tape rotate(+3deg)` — so the two screens read as different sheets from the same pad rather than as a copy.

**The `<h1>` is the first element child of `.titleRow`, and the kicker is a sibling of the WRAPPER, never of the heading.** Verified against `node_modules/impeccable/cli/engine/rules/checks.mjs`: `checkHeroEyebrow` (`hero-eyebrow-chip`, :407) and `collectKickerCandidates` (`kicker-above-heading`, :2500) both anchor on `h1.previousElementSibling` and both return on their first guard when it is null. At 1440 the h1 is 54px ≥ 48 and the 11px kicker at 0.16em tracks 1.76px ≥ 1.6, so branch A of the hero rule would fire; at 390 the h1 is 34px < 48, so the hero rule defers and the kicker rule fires instead. **No card wrapper, no `data-impeccable-allow-kickers` and no `display: none` saves either one** — only the structure does. The JSX carries the same comment the Binairo view does, ending *"Do not 'simplify' the wrapper away."* The `PlaySkeleton` variant carries it too.

### 12.5 Cell visual language, and the ink-blue problem

Measured WCAG contrasts (computed here, not recalled — `--accent-sudoku` relative luminance 0.0754):

| pair | ratio |
|---|---|
| `#2E4E7E` on `--paper-card` `#FBF7EF` | **7.84 : 1** |
| `#2E4E7E` on `--paper-desk` `#F7F2E9` | **7.51 : 1** |
| `#2E4E7E` vs `--ink` `#211D19` | **2.00 : 1** |
| (Binairo, for comparison) `--accent-binairo` vs `--ink` | 2.83 : 1 |

**Design consequence, not trivia:** in Binairo the given and entered numerals differ by 2.83:1; in Sudoku ink-blue against ink is only **2.00:1**, so at grid scale an entered digit reads *almost as ink*. The given/entered distinction therefore leans harder on its second and third carriers. Two responses, both shipped: given cells keep `--paper-tint` **unconditionally**, and the weight delta widens from Binairo's 600/500 to **600/450**. Reaching for a lighter blue was rejected — it would break the 4.5:1 body floor against desk paper.

**Two carriers, not one, and they must be able to co-render.** The board has a *chromatic* state (what the cell IS) and a *caret* state (where the player is). Collapsing them the way an earlier draft did — selection as an accent wash plus a full-strength accent border, ranked above `hinted` in a single `cellClassName` chain — makes the hint's own visual payload unreachable and strips the caret from a violating cell exactly while the player is fixing it. So:

**Chromatic state — exactly one class, precedence `violating > hint-filled > entered > given > empty`:**

| State | background | border 1.5px | color | weight | extra |
|---|---|---|---|---|---|
| empty | `--paper-desk` | `--line` | `--ink` | 400 | — |
| given | `--paper-tint` | `--line` | `--ink` | 600 | `aria-disabled="true"`, inert on activation |
| entered | `--paper-desk` | `color-mix(… var(--accent) 50%, transparent)` | `var(--accent)` | **450** | — |
| hint-filled | `color-mix(… var(--accent) 10%, var(--paper-desk))` | `var(--accent)` | `var(--accent)` | 600 | settles over `--duration-fast` |
| violating | `--paper-desk` | `--accent-app` | `--accent-app` | 500 | `box-shadow: inset 0 0 0 1.5px var(--accent-app)`; the violation rides in the composed accessible name, never `aria-invalid` (ARIA does not support it on `role=button`, and `jsx-a11y/role-supports-aria-props` reds the lint gate — the shipped Binairo comment records this) |

**Caret state — additive, never suppressed, and identical to the focus ring by construction:**

```css
.cellSelected,
.cell:focus-visible {
  /* Drawn INSIDE the 1.5px border, so it never crosses a 3px grid gap or a
     2px box rule — Binairo's `outline-offset: 2px` (binairo-screen.module.css:303)
     would extend 4px beyond the cell box and paint over both. */
  outline: 2px solid var(--accent);
  outline-offset: -3px;
}
```

One declaration block serves both, so ADR-0030's consequence (c) — *the focus ring and the selected state must never disagree* — holds **mechanically** rather than by discipline; roving tabindex already guarantees the focused cell is the selected one. Because the ring is an `outline` and the chromatic states are `background`/`border`/`color`/`box-shadow: inset`, a **violating + selected** cell renders the red fill, red border and red inset hairline **plus** the accent ring, and a **hint-filled** cell keeps its accent wash and accent numeral whether or not the caret is on it — which is what makes the free hint visible at all now that `use-hint` no longer moves the selection (§8.3).

`cellClassName` therefore returns *one chromatic class, optionally joined with `cellSelected`* — not one class total.

Cell type: Fraunces, `font-variant-numeric: tabular-nums`, 23px desktop / 18px mobile, `border-radius: var(--radius-cell)` (5px). `.grid { touch-action: manipulation }` — **not** `none`: Sudoku has no drag, and `none` would needlessly disable pinch-zoom over the board.

**The `Nível` readout** (S10): on desktop, a third `.statRow` in the sidebar card — `Nível` / one of `Fácil · Leve · Médio · Difícil · Puxado` for tiers 1–5, in the same 14px `--ink-2` treatment as `Progresso`. It uses public data (`tier` is on the wire), it is real signal players can act on, and it is the only readout Sudoku has that Binairo does not.

**On mobile it uses the slot that already exists**, rather than being dropped: `.progressBar` inside `.titleRow` (13px `--ink-2`, `binairo-screen.module.css:119-123`) renders `"Médio · 24 de 81"` — `progressShort(level, filled, total)` in §13.2. The rejected alternative was folding it into the **kicker**, which DESIGN.md does forbid (the kicker is scoped to game categories); `.progressBar` is not a kicker, so that scoping does not apply to it. Dropping it entirely was also rejected: mobile is the platform that matters most for a daily-puzzle app, and S10 leans on this readout to justify shipping `tier` over the wire at all — a desktop-only readout would make that justification half-true.

### 12.6 The keypad

`0`/`1`/`apagar`'s sticky-mode model does not transfer (S3): these are **commands**, not modes, so they are plain buttons with no `aria-pressed`.

**Desktop:** the digit row **shares the board's exact track template**, so digit *n* sits directly under column *n* and the box rhythm is legible twice.

```
.keypad {
  display: grid;
  grid-template-columns: repeat(3, 52px) 2px repeat(3, 52px) 2px repeat(3, 52px);
  grid-template-rows: 52px 44px;
  gap: 4px; row-gap: 8px;
  width: 512px;            /* = the board's inner grid width; 17px inset inside the 546px card */
  margin-top: 30px;
}
.keypadDigit { grid-row: 1; }                 /* placed at track(n-1), like the cells */
/* Row 2 has TWO explicit occupants and no auto-placement. The first two box
   blocks carry the affordance; the last one carries `apagar`, so the command
   sits on a box boundary and inherits the board's rhythm. */
.affordance  { grid-row: 2; grid-column: 1 / 8; }    /* 6×52 + 2 + 6×4 = 338px */
.keypadErase { grid-row: 2; grid-column: 9 / -1; }   /* 3×52 + 2×4  = 164px */
```

Digit buttons: 52×52, `1.5px solid var(--accent)`, `color: var(--accent)`, Fraunces 24px wt 600, `padding: var(--space-2)`, `box-shadow: var(--shadow-sm) color-mix(… var(--accent) 22%, transparent)`; `:active { transform: translate(1px,1px); box-shadow: 2px 2px 0 … }`. `apagar`: 164×44, `1.5px solid var(--line)`, `color: var(--ink-2)`, Instrument Sans 14px, `padding: var(--space-2) var(--space-3)`, and the **ink-tinted** `box-shadow: var(--shadow-sm) color-mix(in srgb, var(--ink) 10%, transparent)` — the one neutral shadow the frame set contains (F3:51/F4:37), a recorded DESIGN.md exception carried over deliberately because `apagar` is a neutral control, not a game-accent one.

The `.affordance` span (desktop only, 13px `--ink-2`) reads `messages.games.sudoku.play.keypad.affordance` — *"ou use o teclado: 1–9 para escrever, Backspace para apagar"*. It is the discoverability carrier for S4's whole keyboard model, so **it is placed explicitly, not left to auto-placement into an implicit third row** — the same fragility §12.3 rejects for the board. And a full-bleed 512px `apagar` was rejected on its own terms: it would give the lowest-priority control ten times the width of each primary digit key, which is the archetypal generic form footer, not Ateliê.

**Mobile (≤768px): four columns, three rows.** 5×2 does not work, and the reason is measurable rather than aesthetic.

```
.keypad {
  grid-template-columns: repeat(4, minmax(0,1fr));
  grid-template-rows: 54px 54px 54px;
  gap: 8px;
  width: 100%; max-width: var(--board-mobile-max);
  margin-top: var(--space-5);
}
.keypadErase { grid-row: 3; grid-column: 2 / -1; }
```

Rows are `1 2 3 4` / `5 6 7 8` / `9 apagar`. Arithmetic at both validated widths:

```
button at 390 = (350 − 3×8)/4 = 326/4 = 81.5 × 54px   ✔ ≥44 both axes
button at 320 = (280 − 3×8)/4 = 256/4 = 64   × 54px   ✔
apagar at 390 = 3×81.5 + 2×8 = 260.5 × 54px
apagar at 320 = 3×64   + 2×8 = 208   × 54px
keypad height = 3×54 + 2×8 = 178px  (§12.3's mobile budget)
```

**Why not 5×2.** A ten-slot 5×2 grid gives `apagar` one equal slot: `(350 − 4×8)/5 = 63.6px` at 390, `57.6px` at **360 — the most common Android viewport, which the earlier draft never checked** — and `49.6px` at 320. "apagar" at 14px Instrument Sans is ≈45px of advance, so with Binairo's precedent inline padding (`padding-inline: var(--space-3)`, `binairo-screen.module.css:613`) the content box is 39.6 / 33.6 / 25.6px: it overflows at every one of them. For comparison the shipped Binairo erase gets ~86px of box. The 4×3 layout clears the label at every width by a wide margin and needs no per-width special case.

**The blanket "non-zero padding on both axes" mandate is dropped for the keypad, with the gate cited.** `impeccable`'s `cramped-padding` is gated at `node_modules/impeccable/cli/engine/rules/checks.mjs:3152` on `textLen > 20 && rect.width > 100 && rect.height > 30` — a one-character digit and a six-character `apagar` can never reach it. The rule genuinely applies to `.hint` (*"Usar dica — 1 disponível"*, 24 chars), and it is kept there. The keypad's padding values above are stated for **optical** reasons — border-box, flex-centred labels — not as an impeccable requirement, and the plan states them rather than leaving them to the implementer.

The `width:100%; max-width: var(--board-mobile-max)` pair is the shipped `.controls` mechanism and exists for the shipped reason: shrink-to-fit inside `.board` resolves flex/grid ratios against a max-content row and produced sub-44px buttons on Binairo (finding `mobile-controls-shrink-to-fit-and-sub-44px-targets`). The `.affordance` is `display: none` there — a phone has no keyboard to advertise.

### 12.7 Frame deviations and design-system deviations, all recorded

There is no Sudoku frame, so these are deviations from **DESIGN.md and the F3/F4 sibling**, and each ships with its reason in the PR:

1. **Mobile cells are ~32.7px, not DESIGN.md:50's 38px.** Nine 38px cells alone are 342px of the 350px available, leaving 8px for every gap, gutter, both card paddings and both borders — the closest configuration misses by 4px even with zero card padding. **This is a genuine deviation and plan 017 §12.4's "not a deviation — 38px is the design system" sentence cannot be reused.** 32.7px clears WCAG 2.5.8 comfortably; the fluid-track fallback holds 24.9px down to 320px.
2. *(deleted — Sudoku uses Binairo's 3px mobile grid gap, §12.3)*
3. *(deleted — Sudoku uses Binairo's 10px mobile grid-card padding, §12.3)*
4. **The board carries two drawn 2px rules per axis, tinted `color-mix(in srgb, var(--ink) 50%, transparent)` (≈3.21:1 on card paper) rather than `var(--line)` (1.43:1)** — one hierarchy step above the cell hairlines, because a `--line` rule between `--line` borders is not a separator, it is a third hairline (§12.3). Nothing in DESIGN.md describes a box separator because no game needed one; this is the minimal on-brand answer (a ruled sheet), and it deliberately avoids the "card dentro de card" anti-reference (S23).
5. **The single-column fold moves 1040 → 1140px, for both games and for the shared conclusion** (§12.2).
6. **Entered digits are weight 450, not the system's 500**, because ink-blue against ink is only 2.00:1 (§12.5).
7. **A fifth cell state, `selected`,** which no existing screen has — required by S4's input model. It is a **caret** carrier (a 2px inset accent ring, shared verbatim with `:focus-visible`), deliberately not a chromatic one, so it composes with `violating` and `hint-filled` instead of suppressing them (§12.5).
8. **A `Nível` readout with two homes** — a third `.statRow` on desktop, folded into `.progressBar` as `"Médio · 24 de 81"` on mobile (§12.5).
9. **The keypad is a command row, not a sticky-mode row** (S3), and therefore carries no `aria-pressed`.
10. **Screen rotations mirror Binairo's signs** rather than repeating them (§12.4), delivered through the four custom properties in §12.2 rather than by overriding a shared class.
11. **The conclusion CTA takes the destination game's accent** when it points at a game (S21) — supersedes plan 017 deviation 9. Its copy follows F5:65's own register: `Fechar o dia — jogar Sudoku`, not a new colon-led label (§13.1).
12. **The hub's done tile is a link**, where F1:35-37 draws an inert `<span>Feito</span>`. Reason in §11.3: with the archive at #31, an inert done card leaves a player no in-app route back to the conclusion they just earned. The chip and result are visually unchanged.
13. **The desktop keypad's second row carries the affordance and `apagar` side by side** (338px / 164px on box boundaries) rather than a full-bleed 512px `apagar` — §12.6.

**Motion.** `.cell`, `.keypadDigit`, `.keypadErase` and `.hint` transition only `transform` and `box-shadow` over `var(--duration-fast) var(--ease-settle)` (never `width`/`height`/`padding`/`margin`, which fire impeccable's `layout-transition`), with `:active { transform: translate(1px,1px) }` and the shadow shrinking by the same 1px. **The `prefers-reduced-motion` alternative is declared in TWO places, named so it cannot be dropped:** `sudoku-board.module.css` carries `@media (prefers-reduced-motion: reduce) { .cell, .keypadDigit, .keypadErase { transition: none } }` for its own classes, and `play/screen.module.css` keeps the block for `.hint`. CSS Modules hash class names per file, so the shared block **cannot** reach Sudoku's classes — assuming it does is how DESIGN.md's law gets silently broken. The conclusion's `stamp-settle` keyframe is unchanged and shared. Recorded so a step-6 reviewer does not re-litigate it: `--ease-settle` is `cubic-bezier(0.2, 0.8, 0.3, 1.05)` and impeccable's `bounce-easing` fires only outside `[-0.1, 1.1]` (`checks.mjs:495-499`), so 1.05 is **inside** the allowed band; and no keyframe name may match `/bounce|elastic|wobble|jiggle|spring/i`.

### 12.8 impeccable

`.github/workflows/impeccable.yml` gains `/sudoku` and `/sudoku/concluido` in **three** places, kept in step: the preflight `for path in "/" "/binairo" "/binairo/concluido"` loop **and both** detect invocations. The file's own comment says so, and the preflight loop is the only thing that prevents a silent green — `impeccable detect` exits 0 on an unreachable URL, and the two new routes are database-backed exactly as the Binairo pair is.

`pnpm exec impeccable detect` (pinned `impeccable@3.4.0`), never bare `npx`; one-time `pnpm exec puppeteer browsers install chrome` locally because `~/.npmrc` sets `ignore-scripts=true`.

#### The buffer must be seeded BEFORE any scan, or AC 2 has no evidence

**This is the ticket's sharpest silent-green trap and it is not covered by the preflight as shipped.** `apps/web/app/sudoku/page.tsx` reads `getTodayDaily(getDb(), "sudoku")`. `daily_puzzles` holds only binairo rows today (`service.ts:69` ships `topUpBinairoBuffer` alone, and `/cron/publish` runs in **production** only), and the web **preview reads the same database** — `DATABASE_URL` on `miolos-web` is the integration-managed Neon URL across Production, Preview and Development (plan 017 §20 A1). So `getTodayDaily` returns `undefined`, `DailyUnavailable` renders a normal **HTTP 200**, the preflight's `case "200 $DEPLOYMENT_URL"*` accepts it, and `impeccable detect` scans the *"O Sudoku de hoje ainda não chegou"* card and passes green. AC 2 would be reported satisfied with evidence about a screen that is not the Sudoku screen.

Three closures, all required:

1. **E0 — seed the buffer from this branch's code, before step 10's scans.** Run `topUpSudokuBuffer(db, 7)` once against the real database from the local machine (`apps/api`, `tsx`, `createPublishingDb(process.env.DATABASE_URL_UNPOOLED)`). Same code path, same `sudokuDailyContentSchema` gate, same `ON CONFLICT DO NOTHING`, so it is idempotent and the rows are exactly the ones the post-merge cron would have written. It is safe **before** merge because nothing in production reads `game='sudoku'` yet: `/sudoku` does not exist in the deployed web app (404), and `/daily/sudoku` does not exist in the deployed api. Paste the returned `{generated, depth, failures}`.
   **Not** the api preview's `/cron/publish`: `CRON_SECRET` is scoped to **Production only** on `miolos-api` (`vercel env ls`), so a preview invocation returns 401. Verified, not assumed.
2. **Harden the preflight so a 200 alone can no longer pass.** The loop keeps its status check and adds a content assertion per path, because "reachable" was never the property that mattered — "rendered the thing we are about to scan" is:
   - `/sudoku` and `/binairo` → body contains `data-play-state=` (the attribute `PlayView` already sets, `play-view.tsx:33`)
   - `/sudoku/concluido` and `/binairo/concluido` → body contains `data-conclusion-state=`
   `curl` already writes the body; the loop greps it instead of discarding it to `/dev/null`.
3. **E4 moves ahead of E10** (§16), and its expected output changes: with E0 done, the post-merge cron reports `sudoku: { generated: 0, depth: 7 }` — coverage already in place — not `generated: 7`. Stated so the real output is not read as a failure.

**Residuals, disclosed rather than discovered by a reviewer:**
- **Content availability, not merely profile state, is a precondition of the scan.** That is what E0 and the hardened preflight exist for; it is listed first because it is the one this plan nearly missed.
- The **populated** conclusion cannot be URL-scanned (it renders from a solved local record; Puppeteer launches a clean profile). CI covers the "ainda não concluído" state, which the shared conclusion already specifies in full. Compensating: a file-mode run (`pnpm exec impeccable detect apps/web/app apps/web/src`) pasted in the PR, plus the jsdom smoke tests.
- The **done hub tile** is likewise unscannable for the same reason, and the cold profile always scans the pending hub — which is what S20's monotone-safety makes correct rather than merely convenient.
- `.impeccable/config.json` wildcard-ignores `low-contrast` and `cream-palette` for **`http://localhost:*` and `https://miolos-*.vercel.app/**` only**. `https://miolos.app/**` matches neither pattern, so a scan of the **production** host would report both rules red for reasons already dismissed in PR #40 — which is why E10 scans the preview deployment CI itself scanned, not production (§16). The two rules are blind on the scanned hosts, so the §12.5 and §12.3 contrast figures are *our* evidence, not CI's. Any new by-design finding gets a **value-level** entry with a written reason — never a new wildcard, and never a new host pattern added just to silence a production run.

---

## 13. i18n — the complete string inventory (S19)

### 13.1 The reshape

`messages.binairo` and `messages.conclusao` are game-specific blocks sitting at the top level. They become:

```ts
export const messages = {
  meta: { … },                      // unchanged
  brand: { wordmark },              // unchanged
  hoje: {                           // hub chrome ONLY; games move out
    // `hoje.wordmark` (messages.ts:38-40) was a deliberate alias of
    // brand.wordmark "while the migration finishes". This is that finish:
    // app/page.tsx:57 re-points to `messages.brand.wordmark` and the alias
    // is DELETED in the same commit (build step 5), with the hub smoke
    // test's assertion re-pointed identically. Omitting this line breaks
    // the hub.
    completedOfTotal, streak, playCta, playCtaShort, links,
    done: "Feito",
    doneResultLong: (elapsed: string) => `em ${elapsed}`,
    doneResultShort: (elapsed: string) => elapsed,
    doneAria: (game: string, elapsed: string) => `${game} concluído em ${elapsed}`,
  },
  play: {                           // shared play chrome
    back: "← Hoje",
    backAria: "Voltar para Hoje",
    timerLabel: "Tempo",
    timerAria: (elapsed: string) => `tempo decorrido: ${elapsed}`,
    progressLabel: "Progresso",
  },
  conclusion: {                     // shared conclusion chrome (was `conclusao`)
    back, backAria, stampLabel: "Concluído",
    hints: (used: number) => (used === 0 ? "sem dicas" : "com 1 dica"),
    sync: { pending, rejected },    // verbatim
    dayCard: { title, missing, games: { … } },   // verbatim
    ctaHome: "Fechar o dia — voltar para Hoje",
    // F5:65's own phrasing for this exact button — "Fechar o dia — jogar
    // Nonogram". Both CTA variants keep the "Fechar o dia" anchor and one
    // register; a colon-led label appears nowhere else in the copy deck.
    ctaNext: (game: string) => `Fechar o dia — jogar ${game}`,
    stats: "Ver estatísticas",
    notYet: { body: "O resumo aparece assim que a grade fechar." },
  },
  games: {
    termo: { kicker, name, description },        // hub-only for now
    sudoku: { … },                               // §13.2
    nonogram: { kicker, name, description },
    binairo: { kicker, name, description, play: { … }, conclusion: { … } },
  },
} as const;
```

Hoje reads `messages.games[game]`, which **deletes** the existing duplication of name/kicker/description under `messages.hoje.games`. Every existing web test updates by mechanical rename; no assertion changes meaning.

### 13.2 New pt-BR copy for Sudoku (exact syntax)

```ts
    sudoku: {
      kicker: "Números",
      name: "Sudoku",
      description: "De 1 a 9, sem repetição, no clássico 9×9.",
      play: {
        title: "Sudoku",
        // Every clause is a rule the engine actually enforces (the binairo
        // deviation-1 precedent: never teach a rule that is not checked).
        rules:
          "Preencha a grade de 1 a 9. Cada linha, cada coluna e cada bloco de 3×3 tem os nove dígitos, sem repetir nenhum.",
        progressLong: (filled: number, total: number) => `${filled} de ${total} células`,
        // The mobile `.progressBar` slot carries the level too (§12.5), so
        // the difficulty is not desktop-only: "Médio · 24 de 81".
        progressShort: (level: string, filled: number, total: number) =>
          `${level} · ${filled} de ${total}`,
        levelLabel: "Nível",
        level: (tier: 1 | 2 | 3 | 4 | 5) =>
          ({ 1: "Fácil", 2: "Leve", 3: "Médio", 4: "Difícil", 5: "Puxado" })[tier],
        boardAria: "grade do Sudoku, 9 por 9",
        cellAria: (row: number, column: number, value: number | null) =>
          `linha ${row}, coluna ${column}: ${value === null ? "vazia" : value}`,
        cellGivenAria: (row: number, column: number, value: number) =>
          `linha ${row}, coluna ${column}: ${value}, célula fixa`,
        cellInvalidAria: (row: number, column: number, value: number | null) =>
          `${cellAriaSudoku(row, column, value)} — esta célula repete um número`,
        keypad: {
          erase: "apagar",
          digitAria: (digit: number) => `escrever ${digit}`,
          eraseAria: "apagar a célula selecionada",
          affordance: "ou use o teclado: 1–9 para escrever, Backspace para apagar",
        },
        hint: {
          available: "Usar dica — 1 disponível",
          used: "Dica usada",
          explain: {
            correction: "Corrigimos um número que não fecha com as regras.",
            fill: "Preenchemos uma célula para você.",
          },
        },
        unavailable: {
          title: "O Sudoku de hoje ainda não chegou.",
          body: "Alguma coisa saiu do lugar por aqui. Tente de novo daqui a pouco — o puzzle de hoje é o mesmo para todo mundo.",
          cta: "Voltar para Hoje",
        },
      },
      conclusion: {
        title: "Sudoku",
        kicker: "Números",
        stampAria: (elapsed: string, hints: number) =>
          `Sudoku concluído em ${elapsed}, ${hints === 0 ? "sem dicas" : "com 1 dica"}`,
        notYet: {
          title: "Você ainda não concluiu o Sudoku de hoje.",
          cta: "Jogar o Sudoku de hoje",
        },
      },
    },
```

Binding on the implementer, exactly as plan 017 §13.1 states: the em dash `—` and the arrow `←` are load-bearing copy; every `aria-*` string is composed **here**, never joined in a component (ADR-0018 makes `Messages` the migration contract); interpolation is a plain arrow function returning a template literal — there is no ICU runtime and none is being added. The `cellInvalidAria` composition hoists its base like the shipped `cellAria` does.

### 13.3 `apps/web/src/i18n/routes.ts`

```ts
export const routeSlugs = {
  archive: "arquivo", freePlay: "modo-livre", stats: "estatisticas",
  binairo: "binairo", sudoku: "sudoku", conclusion: "concluido",
} as const;

export const routes = {
  home: "/",
  binairo: `/${routeSlugs.binairo}`,
  binairoConclusion: `/${routeSlugs.binairo}/${routeSlugs.conclusion}`,
  sudoku: `/${routeSlugs.sudoku}`,
  sudokuConclusion: `/${routeSlugs.sudoku}/${routeSlugs.conclusion}`,
} as const;
```

`as const` is required: Next 16's typed routes reject a `string`-returning function in a `<Link href>`. The `src/i18n` barrel stays the single import surface (ADR-0018).

`DailyUnavailable` takes its copy as a prop (`apps/web/src/components/daily-unavailable.tsx`'s own TSDoc names #23 as the extension point) and keeps its `<h1>`-is-first-child comment.

---

## 14. The ESLint duty — unchanged, and that is the point

No new config object is added. The existing two (`apps/web/**` import bans; `apps/web/{app,src}/**` table-name literals) already cover every new file by glob.

**The landmine, restated because it is one edit away:** ESLint flat config **replaces** a rule's whole configuration when a later object sets the same rule id — it does not merge. If anything in this ticket adds a third `apps/web`-scoped object setting `no-restricted-syntax`, it **must repeat all five selectors** (`webDynamicDbImport`, `webComputedDynamicImport`, `webRequireCall` and the two table-literal selectors) or it silently reopens the doors for exactly the files holding the credential. Pinned red by T-LINT-4/4b/4c.

Two live constraints on this ticket's code:
- **Any lazy-load of the Sudoku board must use a plain string-literal specifier.** `dynamic(() => import("../sudoku/board"))` is fine; a computed specifier is a lint error under `ImportExpression[source.type!="Literal"]`.
- `apps/web/src/db.ts` keeps `import "server-only";` as its **first line** (source tripwire T-WEB-23).

T-LINT-S1/S2 (§15) assert the wall still fires from an `apps/web/src/sudoku/**` path and from an `apps/web/src/play/**` path — the two new directories.

---

## 15. Test plan (named)

House patterns honoured: one PGlite per **file** via `createTestDb()`, in `packages/db` and `apps/api` only (no PGlite in `apps/web`, plan 017 D33); route handlers invoked as plain functions with a `NextRequest`; every web assertion goes through `messages.*`, never a literal; no `as` in tests; no vitest globals.

**Mocking in `apps/api`, corrected:** `vi.mock("../src/db", …)` is not the only mock — `apps/api/test/completions.test.ts:48-58` already partial-mocks `@miolos/db/publishing` with `importOriginal`, spreading the original and wrapping one export. That is the sanctioned second pattern and T-API-S7 uses it (below).

**Timeouts — the rule is widened, because vitest's 5 000 ms default is the real constraint here and `apps/web/vitest.config.ts` sets no `testTimeout`:**
- Any new **PGlite-backed** file carries `beforeAll(async () => { … }, 30_000)` with the `1.2 s × 4 + margin` arithmetic in a comment.
- **`apps/api/test/cron-publish.test.ts` gains the same `30_000` on its `beforeAll`** (it has none today, `:51`) **and an explicit per-test timeout on every `it()` that triggers a top-up**, which every one of them now does for two games. Measured here: one 7-day sudoku top-up costs 21–118 ms across five runs (a 5.6× spread from the same code, because the seed is random), local p95 ≈ 0.5 s ⇒ ~2 s on CI; `30_000` leaves honest margin.
- **Any test file that calls `generateDailySudoku` carries an explicit trailing timeout**, following `packages/games/test/sudoku/generate.test.ts`'s `}, 240_000)` / `}, 60000)` precedent. This is the lesson commit `271a935` already paid for; the rule is no longer scoped to PGlite files, because the heaviest new test in this ticket touches no database.

**No `fc.assert` anywhere in `apps/web`** (ADR-0017, §3). Where a test row below reads as a universal claim, the enumeration it must actually assert is written out.

**The async-server-component rule stands:** `@testing-library/react` cannot render an `async` server component, so `app/sudoku/page.tsx` and `app/sudoku/concluido/page.tsx` are thin async shells (`getTodayDaily` + branch) covered by `await SudokuPage()` plus prop assertions and a `renderToStaticMarkup` leak scan; all composition lives in synchronous components tests render directly.

| ID | File | Proves | AC | Seam / kind |
|---|---|---|---|---|
| T-CORE-S1 | `packages/core/test/daily-contract.test.ts` | `stripDailyContent("sudoku", …)` over **real `generateDailySudoku` output for all 7 weekdays** strict-parses and carries `game, date, givens, tier` and nothing else | 1 | unit |
| T-CORE-S2 | `…/daily-contract.test.ts` | the projection's keys, run through `collectKeys`, contain **no** `FORBIDDEN_DAILY_KEYS` — including the newly-added `clueCount`. **The "throws for sudoku (fail-closed until #23)" test is replaced, not deleted silently**; nonogram/termo keep theirs | 1 | unit |
| T-CORE-S3 | `…/daily-contract.test.ts` | `sudokuDailyContentSchema` round-trips a generated puzzle, rejects an unknown field (ADR-0024 drift), rejects a missing `solution`, rejects a `0` in `solution`, rejects an 80- and an 82-length grid | 1 | unit |
| T-CORE-S4 | `…/daily-contract.test.ts` | `dailySudokuResponseSchema` rejects a payload smuggling `solution` or `clueCount` (strictObject proof) | 1 | unit |
| T-CORE-S5 | `packages/core/test/completion-contract.test.ts` | `sudokuCompletionRequestSchema` rejects an extra key, an 80-length grid, a **`0` cell** (a submission is a COMPLETE grid), a negative/over-cap/non-integer `elapsedMs`, and `hintsUsed: 2` | 3 | unit |
| T-CORE-S6 | `…/completion-contract.test.ts` | sudoku's key set is exactly the five audited fields; the `no variant declares an instant-shaped key` sweep covers the new variant. **`rejects a game the union does not carry yet` is rewritten to `game: "nonogram"`** — with `sudoku` in the union it would still return `false`, but for the wrong reason (a 64-cell 0/1 grid is not a valid sudoku), i.e. a test proving nothing | 3 | unit |
| T-CORE-S7 | `packages/core/test/cron-contract.test.ts` (new) | `cronPublishResponseSchema` and `bufferDepthResponseSchema` accept both games and **reject a third game key** — the extension-point property survives the reshape | 1 | unit |
| T-DB-S1 | `packages/db/test/published.test.ts` | a **future-dated** sudoku row is invisible to `getTodayDaily`/`getPublishedDaily`; a **killed** sudoku row likewise — the wall, proved for the second game, using a hand-built `sudokuContentFixture()` in `test/fixtures.ts` (which keeps its zero `@miolos/games` dependency) | 1 | integration, PGlite |
| T-DB-S2 | `…/published.test.ts` | a published sudoku row projects to `{game,date,givens,tier}` and its `collectKeys` carries no `FORBIDDEN_DAILY_KEYS` | 1 | integration |
| T-DB-S3 | `…/published.test.ts` | `getTodayDaily(db, "sudoku")` does **not** return a binairo row published for the same date, and vice versa | 1 | integration |
| T-DB-S4 | `…/published.test.ts` | **the generic narrowing is real, not asserted**: the value returned for `"sudoku"` has `game === "sudoku"` at runtime for every seeded row shape | 1 | integration |
| T-DB-S5 | `…/published.test.ts` | **T-DB-9a/9b/9c/9d come out byte-identical** — no export was added to any surface (§19.5) | 1 | unit, tripwire |
| T-API-S1 | `apps/api/test/cron-publish.test.ts` | an empty database tops up to depth 7 for **both** games with correctly-dated, schema-valid content; the sudoku rows' `content` parses `sudokuDailyContentSchema` and every one validates against `sudokuCriteriaForWeekday(isoWeekdayOf(date))`. The three existing deep-equals on `{game:"binairo",…}` are rewritten to the S15 shape | 1 | integration, PGlite |
| T-API-S2 | `…/cron-publish.test.ts` | a second run generates nothing for either game (idempotent reconciliation) | 1 | integration |
| T-API-S3 | `…/cron-publish.test.ts` | a partial buffer tops up without touching existing rows of either game | 1 | integration |
| T-API-S4 | `…/cron-publish.test.ts` | **500 when EITHER game is below the effective threshold**, 200 when both are healthy, and a tuned-low `bufferDepth` is healthy for both (A3) | 1 | integration |
| T-API-S5 | `apps/api/test/buffer-depth.test.ts` | `depths` carries both games; **binairo at 7 and sudoku at 0 reports `shallow: true`** (S16's named failure mode); both at 7 reports false. The four existing deep-equals are rewritten | 1 | integration |
| T-API-S6 | `apps/api/test/daily-sudoku.test.ts` (new) | `GET /daily/sudoku` returns the stripped projection with no forbidden key, 404s on an unpublished/killed/absent day, exports `dynamic === "force-dynamic"`, and **parses against `dailySudokuResponseSchema`** so a binairo row on this path fails | 1 | integration |
| T-API-S7 | **`apps/api/test/publishing-service.test.ts` (new file, decided — not the cron file)** | `topUpSudokuBuffer` records a `failures` entry rather than aborting when generation is forced to fail, and the run continues. Mechanism, decided: `vi.mock("@miolos/games/sudoku", async (importOriginal) => ({ ...actual, generateDailySudoku: () => { throw new actual.SudokuGenerationError(…) } }))` — spreading the original so `SudokuGenerationError` stays the **real** class for the `instanceof` branch. Its own `createTestDb()` and `beforeAll(…, 30_000)`; a file-wide mock of the engine must not leak into the cron suite | 1 | integration, PGlite |
| T-API-S8 | `…/cron-publish.test.ts` | the log line is emitted **once per game** and carries the `{event:"cron-publish", game}` shape the existing log query depends on | 1 | integration |
| T-API-S15 | `…/cron-publish.test.ts` | **fault isolation (§7.2)**: with binairo's `insertDailyPuzzle` forced to reject, sudoku still reaches depth 7, the response body still parses `cronPublishResponseSchema` with `games.binairo.error` non-null, and the status is 500 | 1 | integration |
| T-API-S16 | `apps/api/test/publishing-service.test.ts` | **the run-scoped budget (S13)**: with generation forced to fail every time, a depth-7 run spends at most `MAX_SUDOKU_SEED_RETRIES_PER_RUN` attempts in total and the remaining dates land in `failures` with the run-budget reason — the bound is a property of the code, not of a probability | 1 | integration |
| T-API-S9 | `apps/api/test/completions.test.ts` | a valid **sudoku** grid for today ⇒ 200, `recorded: true`, `onTime: true`; the response parses `completionResponseSchema`. Existing helpers (`seedDaily`, `completionBody`, `wrongGrid`) gain a game parameter rather than being forked | 3 | integration, PGlite |
| T-API-S10 | `…/completions.test.ts` | replaying the identical sudoku request ⇒ 200 `recorded: false` with the **stored** values, `completed_at` unchanged | 3 | integration |
| T-API-S11 | `…/completions.test.ts` | a **different** sudoku grid replay returns the stored record and **never reaches the judge** (a spy on `getPublishedDailyWithSolution` records zero calls) — the short-circuit still precedes the wall read for the second game | 3 | integration |
| T-API-S12 | `…/completions.test.ts` | a wrong sudoku grid ⇒ 422 `grid-mismatch`, no row; a future date ⇒ 404; a killed puzzle ⇒ 404; a date two days old ⇒ 404 (`ACCEPTED_DAYS_BACK`, unchanged) | 3 | integration |
| T-API-S13 | `…/completions.test.ts` | **on-time derivation for sudoku**: a completion against SP-yesterday's published puzzle ⇒ `onTime: false`, against SP-today ⇒ `true` (no clock fake); plus the faked-clock boundary with **two distinct identities** — a same-user replay hits `ON CONFLICT DO NOTHING` and re-reads the original `completed_at`, so a single-identity version asserts `true` twice | 3 | integration, faked `Date` only |
| T-API-S14 | `…/completions.test.ts` | **posting a sudoku body while the stored row is binairo (and vice versa) never 500s** — `storedSolution` dispatches on `body.game` and the wall read is game-scoped, so the mismatch is a 404, not a `ZodError` | 3 | integration |
| T-WEB-S1 | `apps/web/test/sudoku-state.test.ts` | `initSudokuPlayState` produces `hydrated: false`, `selected: null`, empty entries, `00:00`, and `violating` empty on a real generated daily | 4 | unit, pure |
| T-WEB-S2 | `…/sudoku-state.test.ts` | `enter-digit` writes at `selected`; re-entering the same digit clears; a given is never written; `clear-cell` clears; all are no-ops with `selected === null` | 4 | unit |
| T-WEB-S3 | `…/sudoku-state.test.ts` | **the merged grid always satisfies the engine's guard**: `getSudokuConflicts(mergedGrid(...))` and `isSudokuSolved(...)` never throw (they call `assertSudokuGrid`) over a **fixed enumerated list** of write/clear sequences — empty board, fully filled, filled-then-cleared, writes attempted on givens, an out-of-range `selected`, and duplicate digits in a row/column/box. **No `fc.assert`** (ADR-0017, §3) | 4 | unit |
| T-WEB-S4 | `…/sudoku-state.test.ts` | `violating` appears the moment a duplicate lands in a row, a column **and** a box (three cases), and clears when it is removed; a violating grid is never blocked from further entry | 4 | unit |
| T-WEB-S5 | `…/sudoku-state.test.ts` | `status` flips to `solved` only on a complete conflict-free grid; a full-but-wrong grid stays `playing`; entering `solved` latches `pendingSync` exactly once | 3,4 | unit |
| T-WEB-S6 | `…/sudoku-state.test.ts` | `move-selection` clamps at all four edges and never wraps; `Home`/`End` land on the row's first/last column; from `null` it selects index 0 | 2,4 | unit |
| T-WEB-S7 | `…/sudoku-state.test.ts` | `use-hint` is capped at one, sets `hint.lastIndex`, **leaves `selected` unchanged** (§8.3 — the caret is the player's), and is a no-op once solved or once `nextHint` returns `null` | 4 | unit |
| T-WEB-S8 | `apps/web/test/sudoku-engine.test.ts` | `track(i)` maps 0..8 → 1,2,3,5,6,7,9,10,11 (the gutter-track placement, §12.3); `mergedGrid` maps `null → 0` and preserves givens; `solutionDigits` returns 81 digits for a real daily and `null` for an unsolvable grid; `playableGivens` maps `0 → null`; **`solvedDigits` returns 81 digits for a solved merged grid and `null` when any cell is 0** (the guard `buildRecord` writes `record.grid` behind, §8.2) | 2,4 | unit |
| T-WEB-S9 | `apps/web/test/grid-hint.test.ts` | `nextHint` prefers a contradiction over an empty cell, is row-major deterministic, returns `null` on a complete correct grid — **for both games**, over all seven weekday puzzles | 4 | unit, pure |
| T-WEB-S10 | `…/grid-hint.test.ts` | `nextHint`'s value always equals `solveSudoku(givens)` at that index, table-driven over **7 weekdays × 5 in-file pinned seeds for weekdays 1–5 and 3 for weekdays 6–7** (no fast-check, ADR-0017), with a trailing `}, 120_000)`. **The seed counts are a decision, not a default:** measured here, 20 seeds cost 17/22/17/106/93/208/**3425** ms for weekdays 1–7 (3 888 ms total), and CI runners are ~3–4× slower (commit `271a935`), so the earlier 7×20 table was 12–16 s against vitest's 5 000 ms default — dead on CI. The chosen table is ≈0.6 s local / ≈2.4 s on CI | 4 | unit, pure |
| T-WEB-S11 | `apps/web/test/play-record.test.ts` (renamed from `binairo-play-record`) | a sudoku record round-trips including `grid`; a binairo record still parses **byte-identically at `v: 1`**; a record whose `game` disagrees with its key parses to `undefined` (S17); the two-sided `elapsedMs` clamp holds; `prunePlayRecords` drops only older *synced* records of any game | 4 | unit, jsdom localStorage |
| T-WEB-S12 | `apps/web/test/play-sync.test.ts` (renamed from `binairo-sync`) | **with no play screen mounted**, a seeded sudoku record POSTs a body that parses `sudokuCompletionRequestSchema` and is built from `record.grid` alone; **a queue holding one record of each game posts both, once each** (the one-module property, S1/S18) | 4 | jsdom, `vi.stubGlobal("fetch")` |
| T-WEB-S13 | `…/play-sync.test.ts` | the terminal/non-terminal classification, the single 401 re-mint, the bounded retry ladder and the `recorded: false` write-back all still hold — **the moved module's behaviour is unchanged** | 4 | jsdom |
| T-WEB-S14 | `apps/web/test/day-state.test.ts` (new) | `readDayState` marks a game done only from a `concluded` record for that exact date; an absent, a garbage, a wrong-game and a `concluded: false` record all read pending; `doneCount` counts what is done | 3 | unit, jsdom localStorage |
| T-WEB-S15 | `…/day-state.test.ts` | **monotone safety, asserted** (ADR-0031) over the **five enumerated inputs T-WEB-S14 names** — absent, garbage, wrong-game, `concluded: false`, wrong date — each producing `concluded: false`. Stated as an enumeration, not a universal, so it cannot be reached for with `fc.assert` | 3 | unit |
| T-WEB-S16 | `apps/web/test/hoje.smoke.test.tsx` | with no records, all four cards render pending and **exactly the games in the route map are linked** (asserted from the map, not from a hardcoded count — this replaces `links only the Binairo card`); with a concluded sudoku record, the sudoku card renders the `Feito` chip and its tabular result, **and that done card IS a link whose href is `routes.sudoku`** (§11.3, deviation 12); the meta line reads `1 de 4 concluídos` | 3 | jsdom |
| T-WEB-S17 | `…/hoje.smoke.test.tsx` | the pre-hydration paint renders every card pending, `localStorage`/`Date.now` are untouched during render, **and `.cta` declares `min-height: 38px` at desktop with the done variant reusing the same box** — read through `stylesheet("app/page.module.css")` (§5.5), since jsdom has no layout and `css-source.ts` could not reach `app/` before this ticket | 2,3 | jsdom + CSS text |
| T-WEB-S18 | `apps/web/test/conclusion-view.test.tsx` | chips read per-game records: with binairo concluded and sudoku not, binairo shows its time and sudoku shows `falta`; with both, both show times | 3 | jsdom |
| T-WEB-S19 | `…/conclusion-view.test.tsx` | **the CTA chains**: from the binairo conclusion with sudoku pending it links to `routes.sudoku` with the `ctaNext` copy; with every playable game done it falls back to `routes.home` with `ctaHome` | 3 | jsdom |
| T-WEB-S20 | `…/conclusion-view.test.tsx` | **the snapshot cache is keyed on `{game, date}`**: rendering the binairo conclusion then the sudoku conclusion for the same date shows each game's own record, never the first one's (§19.4) | 3 | jsdom |
| T-WEB-S21 | `apps/web/test/sudoku-page.test.tsx` | both segments export `dynamic === "force-dynamic"`; with `getTodayDaily` mocked to `undefined` each renders the unavailable screen with **Sudoku's** copy | 1,2 | config-as-data, `vi.mock("@miolos/db")` |
| T-WEB-S22 | `…/sudoku-page.test.tsx` | the props crossing into the client tree are **exactly** `{game,date,givens,tier}` (key set asserted), and the leak scan is the shipped **two-part** one from `binairo-page.test.tsx:136-141`: `collectKeys(elementSchema.parse(await SudokuPage()).props)` for the RSC payload — Flight serializes every prop crossing into a client component, so the props object is what the scan must cover — **plus** `expect(renderToStaticMarkup(element)).not.toContain(forbidden)` for the markup. `collectKeys` over an HTML *string* returns an empty set and would make every assertion vacuously true | 1 | integration |
| T-WEB-S23 | `…/sudoku-page.test.tsx` | `/sudoku/concluido` derives its date from `getTodayDaily(...).date` and not from the client clock (wall returns `2026-07-30` with `Date` faked to `2026-08-05`); both pages call `getTodayDaily` and nothing else on the mocked `@miolos/db` | 1,3 | integration |
| T-WEB-S24 | `…/sudoku-page.test.tsx` | `getTodayDaily` is called with `"sudoku"`, and the screen receives a response whose `game` is `"sudoku"` — the generic narrowing at the consumer | 1 | integration |
| T-WEB-S25 | `apps/web/test/sudoku-screen.test.tsx` | the rules blurb renders through `messages.games.sudoku.play.rules` and names rows, columns **and** 3×3 blocks; 81 cells render; givens are `aria-disabled` and carry the given aria; two timer nodes and two progress nodes render (the media-query pairs); **a fresh board's progress readout is `clueCount de 81`, never `81 de 81`** — the S6 `0`-is-not-nullish trap, which only `playableGivens` prevents | 2,4 | jsdom |
| T-WEB-S26 | `…/sudoku-screen.test.tsx` | **the impeccable structural guard**: `h1.previousElementSibling === null` and the `<h1>` is the first element child of its wrapper — in `PlayView`, in `PlaySkeleton`, in `DailyUnavailable` and in the conclusion | 2 | jsdom |
| T-WEB-S27 | `…/sudoku-screen.test.tsx` | selecting a cell then pressing keypad `7` writes 7; pressing `7` again clears; `apagar` clears; a given never changes; the hint button fills one cell, becomes the exhausted variant, and a second press does nothing | 4 | jsdom, `fireEvent` |
| T-WEB-S28 | `…/sudoku-screen.test.tsx` | **the keyboard model** (S4): exactly one cell has `tabIndex 0`; arrows move it and clamp at the edges; `1`–`9` write; `0`/`Backspace`/`Delete` clear; `Home`/`End` jump; arrow keys `preventDefault`; the container carries `role="group"` and an accessible name and **no `role="grid"`** | 2,4 | jsdom |
| T-WEB-S29 | `…/sudoku-screen.test.tsx` | entering `solved` swaps `PlayView` for `ConclusionView` **in place** with `next/navigation`'s `push`/`replace` asserted never called (the offline guarantee); mounting with a `concluded` record restores straight into the conclusion, the timer never starts and no POST is issued | 3,4 | jsdom |
| T-WEB-S30 | `…/sudoku-screen.test.tsx` | **no hydration mismatch**: the first render shows a givens-only board, `00:00`, no selection and no record-derived content, with `localStorage`/`Date.now` spies asserted untouched before effects flush | 2,4 | jsdom |
| T-WEB-S31 | `…/sudoku-screen.test.tsx` | `PlaySkeleton` **occupies the same boxes as the hydrated screen** — the same comparison `binairo-screen.test.tsx:834-856` makes, not a measurement jsdom cannot take: the stats card (three rows), the hint bar, the 81-cell board and **all three keypad rows** are present as `aria-hidden` placeholders, and `occupantsIn(skeleton)` equals `occupantsIn(hydrated)` with the anti-vacuity `arrayContaining` guard (finding `play-skeleton-is-not-at-final-dimensions`) | 2 | jsdom |
| T-WEB-S32 | `apps/web/test/binairo-*.test.*` (all) | **the extraction changed no Binairo behaviour**: the whole #18 suite passes with every assertion unchanged **in what it asserts**. What does change is enumerated in §5.5 and nothing else — `css-source.ts`'s signature, `GRID_AREA_CLASSES` becoming a two-sheet union, `className()`'s two-module lookup, `--board-mobile-max`'s source block, `.gridCard` padding's source sheet, the conclusion's `1040px` literal, and the `DailyBinairoResponse` annotations from S11 | 4 | regression |
| T-WEB-S33 | `apps/web/test/play-lifecycle.test.tsx` (new) | **`state.now` is not in `persistDeps` (§5.4)**: ten `tick` dispatches through a mounted `usePlayLifecycle` produce **zero** `setItem` calls, while one entry change produces exactly one. The single most regressible property of the whole extraction — depending on `[state]` would write a full parse-and-serialize cycle every second, for both games | 4 | jsdom, `localStorage` spy |
| T-WEB-S34 | `apps/web/test/sudoku-screen.test.tsx` | **the mobile arithmetic, guarded in CSS text** (jsdom has no layout, so §12.3/§12.6's numbers are otherwise unasserted — the port of `binairo-screen.test.tsx:889-961` this ticket owes): read `sudoku-board.module.css` through the extended `css-source` helper and re-derive the mobile cell at 390 and 320 (≥24px both), both keypad axes at 390 and 320 (≥ `token("--touch-target-min")`), and the desktop `.keypad` `width: 512px` equal to the board's inner grid width | 2 | CSS text |
| T-LINT-S1 | `apps/web/test/eslint-db-wall.test.ts` | the import bans and the table-literal selectors fire from an `apps/web/src/sudoku/**` path and from an `apps/web/src/play/**` path | duty | unit, ESLint API |
| T-LINT-S2 | `…/eslint-db-wall.test.ts` | a clean sudoku file (importing `getTodayDaily` from `@miolos/db` and `solveSudoku` from `@miolos/games/sudoku`) reports **zero** — the rules are not blanket bans | duty | unit |

Kinds: **unit** = pure functions, no DOM, no DB. **integration** = a real PGlite running the committed migrations, or a route handler invoked as a function. **No property tests are added** (§3).

---

## 16. Branch, commits, PR, rollout

**Branch:** `feat/23-daily-sudoku-end-to-end` (already correct), rebased on freshly pulled `main` before the step-6 gate run.

**Commits** (Conventional, English, each pre-commit-green):

1. `docs: add the daily-sudoku plan (018) for #23`
2. `docs: ADR-0029 (shared play layer), ADR-0030 (grid keyboard model), ADR-0031 (device day state)` — **before implementation**, per CLAUDE.md
3. `feat(core): sudoku daily, completion and per-game cron contracts`
4. `feat(db): narrow the wall readers to the requested game`
5. `feat(api): buffer, judge and publish the daily sudoku`
6. `refactor(web): extract the shared daily-play layer into src/play` — **behaviour-free; the Binairo suite is green and its assertions unchanged**
7. `feat(web): sudoku play state, engine adapter and the free hint`
8. `feat(web): the sudoku board, keypad and play screen`
9. `feat(web): device-local day state, live hub tiles and conclusion chaining`
10. `ci: scan the sudoku routes with impeccable`

**Verification (evidence rule — paste real output), from the repo root:**

```sh
source "$HOME/.nvm/nvm.sh" && nvm use
pnpm install
pnpm typecheck --force
pnpm lint
pnpm test --force                       # full suite, uncached
pnpm build                              # + /sudoku's First Load JS figure (§19.3)
pnpm exec impeccable detect apps/web/app apps/web/src                  # file mode

# E0 (§12.8) — seed the sudoku buffer with THIS BRANCH's code, before any scan.
# Without it /sudoku renders DailyUnavailable, returns 200, and detect passes
# green on the wrong screen. Idempotent: ON CONFLICT DO NOTHING.
pnpm --filter @miolos/api exec tsx -e "…topUpSudokuBuffer(createPublishingDb(process.env.DATABASE_URL_UNPOOLED), 7)…"

# 200 AND the right screen — a 200 alone is what E0 exists to disqualify.
curl -sSL '<preview>/sudoku'           | grep -q 'data-play-state='
curl -sSL '<preview>/sudoku/concluido' | grep -q 'data-conclusion-state='
pnpm exec impeccable detect <preview>/ <preview>/binairo <preview>/binairo/concluido \
  <preview>/sudoku <preview>/sudoku/concluido --viewport 1440x900
pnpm exec impeccable detect <same five URLs> --viewport 390x844
```

**PR skeleton:** `Closes #23.` → **What changed** (one bold-package bullet per workspace, plus an explicit "not touched" paragraph naming `packages/games`, `packages/ui`, `adSlotPlacements`, `clientSchema`, the root `@miolos/db` export list, `wallPredicate`, `ACCEPTED_DAYS_BACK`, `hint_grants` and the migration directory) → **Verification** (every output above inline, plus a deliberate-violation `pnpm lint` run) → **Implementation notes** → **Design deviations** (§12.7's eleven live entries — 1, 4–13 — each with its reason and its arithmetic) → **Step-8 rollout** checkboxes → **Decisions surfaced (FYI)**: S1's extraction, S3/S4's input and keyboard model, S13's two retry budgets and the new `vercel.json` `maxDuration`, S20's device-local day state and the still-hardcoded `streakCount` — **with the positive half stated: the sudoku completion row is written game-generically with SQL-derived `on_time`, so #19's derivation counts the day unchanged; only the streak's *display* is deferred, not its arithmetic** (§11.1) — S21's CTA supersession of plan 017 deviation 9, §12.2's fold moving for Binairo and for the conclusion too, deviation 12 (the done hub tile is a link where F1 draws an inert span), and §12.8's impeccable residuals including that E10 scans the preview rather than production.

**Decisions needed from Fernando — one, and it must not be merged past silently:**

> **Pencil marks on the Sunday Sudoku (S5/§8.6).** #23 ships without notes: the issue asks for parity with Binairo, which has none, and notes are a large feature (reducer, persistence, rendering, a11y, 34px mobile cells). But `SUDOKU_WEEKDAY_CRITERIA` maps Sunday to **tier 5**, which by the house ladder requires naked/hidden triples and X-wing — techniques most solvers cannot execute without candidate notes. So one day a week may ship a daily that a motivated player cannot reasonably finish, on the day the streak matters most. Three real options:
>
> 1. **Ship as planned and file notes as a follow-up.** What this plan implements.
> 2. **Ship as planned and lower the Sunday tier** to 4 in `SUDOKU_WEEKDAY_CRITERIA` — a one-line `packages/games` change with its own test, but it edits the spec's published difficulty ramp.
> 3. **Add notes to #23.** Roughly doubles the client state model, the record schema and the board's rendering and a11y surface.
>
> Nothing else in the plan blocks on this: the reducer, the record and the screen are identical under options 1 and 2, and option 3 is additive to all three.

**Step-8 production rollout, in order, evidence pasted into the PR/issue:**

- **E1.** No infrastructure work. `DATABASE_URL` is present on both Vercel projects across all environments; **do not rotate it** (plan 017 §20 A1). The least-privilege `miolos_web` role remains #59's work, and nothing in this PR may claim it exists.
- **E2.** **No migration.** Confirm with `psql "$DATABASE_URL_UNPOOLED" -c "\d daily_puzzles" -c "\d completions"` that the game CHECK constraints already list `'sudoku'`, and paste it.
- **E2b.** *(new — the AC 2 precondition, §12.8.)* Run E0's seeding **before** step 10's scans and paste `{generated, depth, failures}`. It is safe pre-merge because nothing deployed reads `game='sudoku'` yet. `CRON_SECRET` is **Production-only** on `miolos-api` (verified with `vercel env ls`), so the api *preview*'s `/cron/publish` returns 401 and is not the mechanism.
- **E3.** Merge → both projects auto-deploy. Paste the `miolos-api` deploy log line confirming `maxDuration` was accepted (§7.1); if it was rejected, paste the rejection and the value it was lowered to.
- **E4.** Trigger the cron manually (`curl -H "Authorization: Bearer $CRON_SECRET" https://api.miolos.app/cron/publish`) and paste the body. **Expected with E2b done: `sudoku: { generated: 0, depth: 7, failures: [], error: null }`** — coverage already in place — and binairo likewise. `generated: 0` here is the success case, not a failure.
- **E5.** `curl https://api.miolos.app/buffer-depth | jq` ⇒ both depths 7, `shallow: false`.
- **E6.** `curl https://api.miolos.app/daily/sudoku | jq 'has("solution"), has("clueCount"), has("seed")'` ⇒ `false false false`.
- **E7.** Load `https://miolos.app/sudoku` in a real browser; solve it; confirm the conclusion renders **in place**, that the hub tile turns `Feito`, that the conclusion's CTA points at the remaining pending daily, and that `select * from completions where game='sudoku'` shows exactly one row with `on_time` deriving true.
- **E8.** Replay the POST with `curl` (same cookie) ⇒ 200 `recorded: false`, `completed_at` unchanged.
- **E9.** Offline drill: load `/sudoku`, kill the network, finish, confirm the conclusion renders in place with the pending sync line, restore the network, confirm the row appears without a reload.
- **E10.** `pnpm exec impeccable detect` against the **preview deployment** URLs at both viewports — the same host CI scans — plus the CI job link for the merge commit; paste both outputs. **Not production:** `.impeccable/config.json` scopes its two wildcard `ignoreValues` to `http://localhost:*` and `https://miolos-*.vercel.app/**`, and `https://miolos.app/**` matches neither, so a production scan would come back red on `low-contrast` and `cream-palette` for reasons already dismissed in PR #40. Widening the ignore to a third host to silence that is explicitly **not** the fix (§12.8, landmine 14).
- **E11.** File the follow-ups this plan owes: the pencil-marks decision (per Fernando's call at §16) and `nextSudokuDeduction`.
- **E12.** Close #23 quoting E2–E11 against the four ACs.

---

## 17. Build order

Steps 3 and 4 touch disjoint workspaces and run in parallel. Step 6 is the extraction and must land **alone**, green, before 7.

| # | Step | Files | Parallel? | TDD |
|---|---|---|---|---|
| 1 | **ADRs 0029 / 0030 / 0031** — written first, because steps 5–9 hard-code the decisions they carry | `docs/adr` | — | — |
| 2 | `packages/core`: `contracts/daily.ts` (schemas + `ProjectedGame` + the sudoku branch + the strip-table row), `contracts/completion.ts`, `contracts/cron.ts`, `testing.ts`, barrel | core | after 1 | **yes** — T-CORE-S1..S7 first |
| 2b | **S11's `apps/web` narrowing, in the same commit as 2 so typecheck is never red across a boundary**: `initPlayState`, `useBinairoPlay` and `BinairoScreenProps.daily` take `DailyBinairoResponse`; the three test files' annotations follow. Widening `dailyPuzzleResponseSchema` into a real union breaks these three **parameter/prop declarations**, which no change to `getTodayDaily`'s return type can reach | core + web (src/binairo, test) | with 2 | mechanical; typecheck is the gate |
| 3 | `packages/db`: the generic wall narrowing, `test/fixtures.ts`'s `sudokuContentFixture()` | db | ∥ 4, after 2 | **yes** — T-DB-S1..S5 first |
| 4 | `apps/api`: `topUpSudokuBuffer` (both retry budgets), cron route **with per-game fault isolation**, buffer-depth route, `storedSolution`, `app/daily/sudoku/`, narrowing `app/daily/binairo/`, **`vercel.json`'s `functions.maxDuration`** (§7.1), the `cron-publish.test.ts` timeouts (§15) | api | ∥ 3, after 2 | **yes** — T-API-S1..S16 first |
| 5 | `apps/web` i18n: the `messages` reshape (S19) **including `app/page.tsx` re-pointing to `messages.brand.wordmark` and deleting the `hoje.wordmark` alias**, `routes.ts`, `DailyUnavailable`'s copy prop | web (src/i18n, src/components, app/) | after 2 | mechanical; existing tests re-point |
| 6 | **The `src/play/` extraction** — move + rename only, no new behaviour. Lands as its own commit with `pnpm test --force` green and every Binairo assertion unchanged **in what it asserts**; §5.5's harness edits are the enumerated exception, and S11's signature change already landed at 2b | web (src/play, src/binairo, test/) | after 5 | **regression-first** — T-WEB-S32 + T-WEB-S33 are the gate |
| 7A | `apps/web` Sudoku logic: `engine.ts` (incl. `solvedDigits`), `state.ts`, `use-sudoku-play.ts` | web (src/sudoku) | ∥ 7B | **yes, strictly** — pure functions; T-WEB-S1..S10 first |
| 7B | `apps/web` day state: `play/day-state.ts`, `play/use-record-snapshot.ts` keyed `{game,date}`, the conclusion's **`DayChip` only** | web (src/play) | ∥ 7A | **yes** — T-WEB-S14, S15, S18, S20 first |
| 8 | `apps/web` screens: `board.tsx`, `keypad.tsx`, `play-view.tsx` + skeleton, `sudoku-screen.tsx`, `sudoku-board.module.css`, `play/screen.module.css`'s fold move + custom properties, both `app/sudoku/*/page.tsx` shells | web | after 6+7A | smoke tests after (T-WEB-S21..S31, S34) — UI composition is not TDD-shaped |
| 9 | Hoje + the conclusion's **CTA chaining**: the route map, the two client children, `page.module.css`'s done chip and `.cta` `min-height`. **The CTA renders a link to `/sudoku`, so it must land after step 8 creates the route** — this is the ordering §16's commit list already has (commit 9 after commit 8) and the earlier draft's 7B contradicted | web (app/, src/play) | after 7B **and** 8 | yes — T-WEB-S16, S17, S19 |
| 10 | impeccable workflow (three places, **plus the preflight's content assertion**, §12.8), **E0's buffer seeding**, full gate, both detect modes, the deliberate-violation lint run | — | after 9 | — |

---

## 18. New ADRs (declared here, written at build step 1)

`docs/README.md` lists `adr/` as a directory, not per-file rows, so no README row is owed for these — only this plan's own row, which ships in commit 1.

- **ADR-0029 — "Shared daily-play code lives in `apps/web/src/play/`; the board and its input model stay per game."** The seam (§5.2) and the **correctness** reason `sync.ts` must be exactly one module (two copies over one game-blind `localStorage` queue double-POST and cross-settle). **Context must cite ADR-0002 for PLACEMENT only** — "there" is `packages/ui` and "a second consumer" is a second consuming package, in an ADR about web-vs-native code sharing — and must **not** present it as a timing rule; the trigger for extracting now is the `sync.ts` singleton argument alone (S1). **Consequences must include:** (a) `packages/ui` is unchanged and stays JSX-free — this layer is `apps/web`-internal by construction; (b) the shared boundary is "CSS and the non-visual layer are shared, JSX composition is per game", and a `<PlayShell>` taking node props was rejected as a shallow module; (c) the pointer-stroke machinery is **not** extracted until #25 gives it a second consumer — plain YAGNI, not an ADR-0002 consequence; (d) `playRecordSchema` may never bump `v` — a bump discards in-flight completions; (e) **the lifecycle's terminal predicate is "the game is CLOSED", not "the grid is solved"** — `PlayCore.status` carries `lost` from the start, `buildRecord`'s flag is `closed`, and a Termo loss (#27) is a closed game that writes a completion with `outcome: "lost"` (ADR-0008 keeps `lost` Termo-only); (f) the module's genericity is scoped to the **queue, retry, re-mint and settle machinery** — `buildBody` is the one per-game dispatch inside `sync.ts` and #27 adds a non-grid branch to it rather than a second module; (g) `play/grid-hint.ts` is the shared hint **for grid games whose solution is client-recoverable from published givens**; ADR-0027's argument does not transfer to Termo, whose answer is never on the wire, and #27 decides its hint separately; (h) there is no shared `PlayCopy` — the per-game `play` copy bundles are structurally different by construction and only the conclusion's copy is unified (`ConclusionCopy`).
- **ADR-0030 — "Grid games are composite widgets: one tab stop, roving focus, no `role=grid`."** Why `role="grid"` is unavailable (it requires `role="row"` children, and `display: contents` on a row is the canonical a11y-tree-removal bug), what ships instead (a labelled `role="group"`, 81 buttons, one `tabindex="0"`, arrows/Home/End, givens focusable and `aria-disabled`), and that this **reverses plan 017 §8.2's deferral** for grid games from #23 onward. **Consequences must include:** (a) #25's Nonogram board (≥15×15) and #28's free play inherit this, not 225 tab stops; (b) Binairo's shipped 64-tab-stop grid is left as-is in this ticket and its retrofit is a follow-up, so the repo carries both models until then — stated rather than implied; (c) selection and focus are the same concept, so the focus ring and the selected state must never disagree — enforced **mechanically**, by `.cellSelected` and `.cell:focus-visible` sharing one declaration block (§12.5), not by discipline; (d) the caret is an **additive** carrier: it never suppresses a chromatic cell state, because a cell that breaks a rule must keep saying so while it is the caret, and a revealed hint must stay visible whether or not the caret is on it.
- **ADR-0031 — "Per-device day state is a local, monotone-safe affordance; server truth arrives with #19."** What the client may assert about completion, the monotone property (a local `concluded` record proves done; absence proves nothing and renders pending), and why this does **not** widen ADR-0014's direct-read scope (it is device state read from `localStorage`, not a user-specific server fragment). **Consequences must include:** (a) the streak stays server-computed and `streakCount` stays `0` until #19 — the asymmetry is deliberate; (b) `hints_used`-style self-reporting rules apply: this state can never back a medal or a streak; (c) #19 replaces `readDayState`'s body and nothing else, and when it does, the local reader stays as the offline fallback the conclusion needs.

Everything else here is plan-level and recorded in code TSDoc: S3, S6–S8, S10–S19, S21–S25.

---

## 19. Risks and landmines (carry into implementation)

1. **The extraction is move + rename, never rewrite.** Every moved body stays byte-identical except the enumerated signature changes (§5.2). It lands as its own commit with the Binairo suite green and its assertions unchanged in content (T-WEB-S32). The 30 findings in plan 017 §20 are encoded in those bodies; a "tidy-up while moving" is how they come back.
2. **`sync.ts` must remain exactly one module.** Module-level `flushing`/`reminted`/`retryStep`/`retryTimer`/`memoryQueue` guard a **game-blind** `localStorage` queue (`listPendingRecords()` returns every game's records). Two copies mounted in one SPA session each POST and each settle the other's records.
3. **`readPlayRecord(date)` hardcodes `playRecordKey("binairo", date)` at line 113.** A Sudoku screen calling the current signature restores a Binairo board into an 81-cell grid. The arity change is not optional, and the game-mismatch discard (S17) is the second half of the fix.
4. **`cachedSnapshot` in `conclusion-view.tsx` is keyed on `date` alone** (lines 299–315). With two conclusion routes in one SPA session, `/binairo/concluido → /sudoku/concluido` returns the Binairo snapshot. This is a latent bug **this ticket introduces** if the key is not widened to `{game, date}`. T-WEB-S20.
5. **The tripwires bite deliberately.** T-DB-9a/9b/9c/9d and the `@miolos/db/user` export tripwire must come out of this ticket **byte-identical**. If one needs editing, something was added to the wrong surface — the generic wall (S11) is a *signature* change and those tests compare `Object.keys(...).sort()`.
6. **Measured numbers this plan designs against** (Node v24.18.1 on this machine, 30 fresh seeds per weekday, `packages/games/node_modules/.bin/tsx`): generation mean 0.68 / 5.5 / 11.3 / **120.9** ms for tiers 1/3/4/5, max 346 ms; `solveSudoku` mean 0.016–0.057 ms, max 0.52 ms; `getSudokuConflicts` mean 0.009 ms; `isSudokuSolved` mean 0.010 ms; `gradeSudoku` ~0.46 ms (cron only, never in a reducer). CI runners are ~3–4× slower — none of these is near a budget, but do not re-derive them from memory.
7. **`@miolos/games/sudoku` in the client bundle.** The barrel re-exports `generateSudoku`, `generateDailySudoku`, `gradeSudoku` (the ~13 KB technique ladder), `validateSudoku` and the criteria tables; the play screen calls only `solveSudoku`, `getSudokuConflicts` and `isSudokuSolved`. `sideEffects: false` is declared and the package is pure, so it should tree-shake. **Measure `/sudoku`'s First Load JS in `pnpm build` and paste it.** If the generator or the grader lands in the bundle, the sanctioned fix is making the existing barrel tree-shakeable — **not** a `./sudoku/play` sub-barrel and **not** a deep import (ADR-0019 fixes the exports map at one subpath per game and makes `src/<game>/index.ts` the public API). If it genuinely cannot be fixed, record the measured cost and file a follow-up.
8. **Every engine entry point calls `assertSudokuGrid` and throws `TypeError`** on a grid that is not 81 integers in 0–9. `mergedGrid` is the guarantee that this never happens (§8.2, T-WEB-S3). `solveSudoku` returning `null` must have a defined branch — the omission of exactly this was plan 017's finding `issue-ac-10`.
9. **Async server components cannot be rendered by RTL.** The shell/presentational split is not optional; discovering it at test-writing time is a rewrite.
10. **CSS Modules compile in css-loader `pure` mode.** A bare type selector (`a:hover`, `button`, `p`) either fails the build or leaks globally. Every rule in both new modules anchors on a local class, including `.page a:hover { color: var(--accent); }`.
11. **`display: contents` cannot move a node across subtrees** — the responsive reflow stays a named-area CSS grid with duplicated readout nodes. It is also why `role="grid"` is unavailable (S4).
12. **The two impeccable structural traps stay closed:** `h1.previousElementSibling === null` via the `.titleRow` wrapper in *four* places (play view, skeleton, unavailable, conclusion), and no keyframe name matching `/bounce|elastic|wobble|jiggle|spring/i`. `--ease-settle`'s 1.05 is inside impeccable's `[-0.1, 1.1]` band — recorded so a reviewer does not challenge the token.
13. **`impeccable detect` exits 0 on an unreachable URL — and passes green on the WRONG screen when the URL is reachable but empty.** `/sudoku` with no published sudoku row renders `DailyUnavailable` at HTTP **200**, which the shipped preflight accepts. Both new routes go in the preflight loop *and* both detect invocations, the preflight asserts `data-play-state=` / `data-conclusion-state=` in the body rather than only the status, **and the buffer is seeded first (E0/E2b, §12.8)**. A 200 alone is not evidence; it is the failure mode.
14. **`impeccable detect` is a policy gate, not a required check** (`gate` is the only required context on `main`), but CLAUDE.md makes a red detect block the merge. New by-design findings get a **value-level** entry in `.impeccable/config.json` with a written reason, never a new wildcard. `low-contrast` and `cream-palette` are already wildcard-ignored on the scanned hosts, so they will pass green regardless — §12.5's figures are the real evidence.
15. **`turbo` runs in `envMode: strict`.** Nothing new is needed here; anything that appears must go in `tasks.build.env` or it is stripped from the build.
16. **`.returning()` must be bare** on the union `Db` type — three landed occurrences already. This ticket adds no DB writer, so it should never come up; if it does, something is being built in the wrong place.
17. **A missing `docs/README.md` row has been a blocking review finding six times.** It ships in commit 1.
18. **Do not ship the `.dc.html` frames or `support.js`.** Visual specs, zero production relevance.
19. **The fold moving 1040 → 1140 changes Binairo's rendering** between 1041 and 1140px. Deliberate (§12.2), stated in the PR, and outside both scanned viewports — which means CI will not catch a mistake here. Check it by hand at 1100px once.
20. **Two follow-ups are inherited, not re-decided:** **#58** (a completion synced after the SP rollover derives as late) — Sudoku inherits the identical window through the same route and the same SQL; do not implement a grace and do not widen `ACCEPTED_DAYS_BACK`. **#59** (the least-privilege `miolos_web` Neon role) — the only duty is negative: no document, comment or PR body in this ticket may say or imply the database grant exists. ADR-0026 still claims exactly one shipped enforcement point, the module-graph wall.
21. **`state.now` must never enter `persistDeps`** (§5.4). The single most regressible property of the extraction: including it writes a `readPlayRecord` + Zod parse + `JSON.stringify` + `setItem` cycle **every second**, for every game; omitting `persistDeps` altogether means an in-progress board is only persisted on pause/resume and a tab crash loses it. T-WEB-S33 pins it.
22. **`countFilled` and the `0`/`null` split.** `(given ?? entries[i] ?? null) !== null` reports 81 of 81 filled on a fresh Sudoku board from the first paint, because `0` is not nullish. Sudoku passes `playableGivens(givens)`, never the raw `SudokuGrid` (S6). T-WEB-S25 pins it.
23. **`CRON_SECRET` is Production-only on `miolos-api`** (`vercel env ls`, verified 2026-08-01). Triggering a *preview* deployment's `/cron/publish` returns 401 — E0 seeds the buffer by running the branch's own `topUpSudokuBuffer` locally instead. `DATABASE_URL` **is** on Preview, which is why the preview renders db-backed pages at all, and why preview and production read the same rows.
24. **CSS Modules hash per file, so a shared rule cannot be overridden by a per-game rule of the same name** — resolution would fall to stylesheet injection order, which Next does not guarantee. Every per-game value in `play/screen.module.css` is a **custom property** set by a per-game class on the same element (§12.2), and each game's board module carries its own `prefers-reduced-motion` block. The same hashing is why `apps/web/test/css-source.ts` must gain a path argument (§5.5).
25. **Vitest's default per-test timeout is 5 000 ms and no config in this repo raises it.** Any test that calls `generateDailySudoku` carries an explicit trailing timeout; a Sunday board alone is ~171 ms per seed locally and CI is ~3–4× slower (commit `271a935`). §15 states the rule and the seed counts.

---

## 20. Review findings and dispositions (step 3 → step 4)

Five adversarial reviewers rejected the step-2 draft. Every finding below is either **fixed in this plan** or **dismissed with a written reason** — CLAUDE.md forbids dismissal by silence. Load-bearing claims were re-checked against the working tree before being written in; where a reviewer was wrong, the refuting evidence is given.

### Architecture

| # | Sev | Finding | Disposition |
|---|---|---|---|
| A1 | BLOCKING | `usePlayLifecycle`'s inputs cannot reproduce the persist effect's game-specific, `now`-excluding dependency array | **Fixed.** §5.4 gains a fifth input `persistDeps`, spells both effects' dep arrays, and carries the "`state.now` must never enter it" invariant in TSDoc. New named test **T-WEB-S33** (ten ticks ⇒ zero `setItem`); landmine 21. Verified: `use-binairo-play.ts:216` deps are `[hydrated, status, date, givens, entries, timer, hintsUsed]`, and `state.ts:161-164`'s `tick` returns a new object every second — the reviewer's reading is exactly right. |
| A2 | BLOCKING | `PlayCore.status: "playing" \| "solved"` breaks at Termo's second terminal state | **Fixed.** `status` becomes `"playing" \| "solved" \| "lost"`, all three lifecycle gates test `status !== "playing"`, `solvedAndFrozen` → `closedAndFrozen`, `buildRecord`'s flag → `closed`. ADR-0029 consequence (e) records the terminal predicate as "the game is closed". Behaviour-identical for Binairo, so step 6 stays behaviour-free. |
| A3 | MAJOR | S18's "exactly one line changed" is false — `buildBody` is grid-shaped in three places | **Fixed.** S18 restated; §9.2 shows the `switch (record.game)` + `gridBody` split and the generalized log string; ADR-0029 consequence (f) scopes the module's genericity to the queue/retry/settle machinery. |
| A4 | MAJOR | `nextHint<T extends number>` is over-constrained; S9's "ADR-0027 already decided this for all games" is false for Termo | **Fixed, both halves.** `nextHint<T>` unconstrained (verified: `hint.ts:39-66` uses only `!== null` and `!==`); the module is renamed `play/grid-hint.ts`; S9's last sentence rewritten; ADR-0029 consequence (g) records it. Test file renamed to `grid-hint.test.ts`. |
| A5 | MAJOR | S6's "`countFilled` reads identically across games" is false — `0` is not nullish | **Fixed.** S6 rules it explicitly, `countFilled` moves to `play/progress.ts` with a widened signature and Sudoku passes `playableGivens(givens)`; §5.2 gains the row; T-WEB-S25 asserts `filled === clueCount`; landmine 22. |
| A6 | MAJOR | S11 names two breaking lines and misses `binairo-screen.tsx`; all three are parameter/prop annotations | **Fixed.** S11 now carries the full six-site table (3 source + 3 test files), the explicit prohibition on narrowing internally, and lands as **build step 2b** so typecheck is never red across a boundary. Verified by grep: exactly three source declarations. |
| A7 | MAJOR | S1 and §5.3 misread ADR-0002's "second consumer" clause as a timing rule | **Fixed.** S1 restated as a placement claim with the `sync.ts` singleton as the sole trigger; §5.3 replaced with a plain YAGNI statement; ADR-0029's Context spec updated. Verified against ADR-0002's Decision paragraph. |
| A8 | MINOR | S13's ~4 s is a per-date bound presented as the run bound | **Fixed, and gone further.** §7.1 tabulates all three bounds, adds `MAX_SUDOKU_SEED_RETRIES_PER_RUN = 4` so the run bound is ~8 s **by construction**, and sets an explicit `functions.maxDuration` in `apps/api/vercel.json` with a stated fallback if the plan tier rejects the value. T-API-S16. |
| A9 | MINOR | `PlayCopy` cannot cover two structurally different play bundles | **Fixed.** Renamed `ConclusionCopy`, typed as what `conclusion-view.tsx` reads; §5.2 states the `play` bundles are per-game by construction; `timer-readout` takes a plain `string`. ADR-0029 consequence (h). |

### Correctness — server

| # | Sev | Finding | Disposition |
|---|---|---|---|
| C1 | BLOCKING | Same as A6 | **Fixed with A6.** The reviewer is right that the generic wall is necessary-not-sufficient; S11 now says so in those words. |
| C2 | MAJOR | No fault isolation or ordering between the two top-ups | **Fixed.** §7.2 specifies a per-game `try`/`catch`, a fixed binairo-then-sudoku order, a separate `bufferDepth` read on the failure path, and 500-on-throw-or-shallow. The strict body needed a place to put the message: `cronPublishGameResultSchema` gains `error: z.string().nullable()` rather than smuggling `"*"` through `failures[].date`, which is an `isoDateString`. T-API-S15. |
| C3 | MAJOR | Same as A8, plus "no `maxDuration`" ≠ unbounded | **Fixed with A8.** Both the arithmetic and the mitigation are decided by name. |
| C4 | MAJOR | T-WEB-S10's 140 generations blow vitest's 5 000 ms default | **Fixed.** §15's timeout rule is widened from "PGlite-backed" to "any file calling `generateDailySudoku`"; T-WEB-S10 drops to 5 seeds for weekdays 1–5 and 3 for weekdays 6–7 with a trailing `}, 120_000)` and the measured arithmetic; `cron-publish.test.ts` gains `beforeAll(…, 30_000)` and per-`it` timeouts. Verified: only `apps/web/vitest.config.ts` exists and sets no `testTimeout`. |
| C5 | MAJOR | `getTodayDaily<G extends Game>` types an unprojected game as `Promise<undefined>` while `stripDailyContent` throws | **Fixed.** `ProjectedGame = DailyPuzzleResponse["game"]` added to `contracts/daily.ts` and the barrel; both readers constrained to it; `getPublishedDailyWithSolution` explicitly left on `Game`. §6.5 states why, tying it back to S14's own argument. |
| C6 | MINOR | The `min`/`max` rationale is false; three spellings of "a sudoku cell"; §6.6 hedges an export | **Fixed.** One `sudokuDigitSchema` in `contracts/daily.ts`, imported by the completion contract and the play record; the false rationale replaced. §6.6 lists every export unconditionally, including `cronPublishGameResultSchema`, `CronPublishGameResult`, `ProjectedGame` and `sudokuDigitSchema`. |

### Issue / AC adherence

| # | Sev | Finding | Disposition |
|---|---|---|---|
| I1 | BLOCKING | AC 2 has no obtainable evidence: the preview scan hits `DailyUnavailable` at 200 and passes green | **Fixed, with one correction to the reviewer.** §12.8 gains the buffer-seeding step (E0/E2b), the hardened preflight (`data-play-state=` / `data-conclusion-state=` in the body, not only the status), and E4 restated. **The reviewer's proposed mechanism does not work:** `CRON_SECRET` is scoped to **Production only** on `miolos-api` (`vercel env ls`, pasted at landmine 23), so the api preview's `/cron/publish` returns 401. E0 runs the branch's own `topUpSudokuBuffer` against the database instead — same code path, same validation, idempotent, and safe pre-merge because nothing deployed reads `game='sudoku'`. |
| I2 | MAJOR | Same as D1 | **Fixed with D1.** |
| I3 | MAJOR | Nothing can produce the sudoku record's `grid` | **Fixed.** §8.2 gains `solvedDigits(merged)`; §9.1/§5.4 state that `buildRecord` writes `grid` only when it is non-null; T-WEB-S8 asserts it. Verified: `isSudokuSolved` returns `boolean`, not a type predicate, unlike binairo's `isSolvedGrid`. |
| I4 | MAJOR | Same as A6/C1 | **Fixed with A6.** |
| I5 | MAJOR | Whether a done hub tile is navigable is undecided | **Fixed by deciding (b).** The done chip-plus-result row is wrapped in `<Link href={playRoutes[game]}>`; recorded as **deviation 12**; T-WEB-S16 asserts it. Reason stated: with the archive at #31, an inert card leaves no in-app route back to the conclusion the player just earned. |
| I6 | MINOR | The `messages` reshape drops `hoje.wordmark`, which `page.tsx:57` reads | **Fixed.** §13.1 carries the migration line; build step 5 owns it. |
| I7 | MINOR | Same as A8 | **Fixed with A8.** |
| I8 | MINOR | Same as C6's third clause | **Fixed with C6.** |
| I9 | MINOR | "and the streak counts it" answered only negatively | **Fixed.** §11.1 and the PR skeleton now state the positive half with its evidence (`completions.ts:42/53/78`). |
| I10 | MINOR | §17 lands the CTA chaining before the route it links to exists; §16 has the opposite order | **Fixed by aligning §17 to §16.** 7B keeps `day-state`, the snapshot keying and `DayChip`; the CTA chaining moves to step 9, which is gated on 7B **and** 8. T-WEB-S19 moves with it. |

### Design

| # | Sev | Finding | Disposition |
|---|---|---|---|
| D1 | BLOCKING | Shared `.gridCard`/`.statsCard`/`.tape` carry per-game values with no stated override mechanism; CSS Modules hash per file | **Fixed.** §12.2 specifies custom properties (`--grid-card-rot`, `--stats-card-rot`, `--tape-rot`, `--board-mobile-max`) with Binairo's values as fallbacks, set by a per-game class on the same element — no cascade-order dependency, no `css.d.ts` change, no inline style. `.cellSkeleton` moves out of the shared list. Adopting D8 removes the padding and shadow cases entirely. Landmine 24. |
| D2 | BLOCKING | The mobile keypad's `apagar` does not fit its slot, and 360px was never checked | **Fixed, with a different layout than proposed.** §12.6 switches mobile to **4 columns × 3 rows** (`1234 / 5678 / 9 + apagar spanning 2/-1`), which has no empty slot, gives 81.5×54 buttons at 390 and 64×54 at 320, and 260px of `apagar` at 390. The blanket non-zero-padding mandate is dropped for the keypad with `checks.mjs:3152`'s actual gate cited (`textLen > 20 && width > 100 && height > 30` — a 6-char label can never fire it) and kept for `.hint`, whose label is 24 chars. Padding values are stated. §12.3's mobile budget restated at **811 ≤ 844**. |
| D3 | BLOCKING | The free hint has no visual payload: it is always also the selected cell, and the two states differ by a 2% wash | **Fixed, all three edits.** `use-hint` no longer moves `selected` (§8.3, T-WEB-S7); §12.5 splits **chromatic** state (one class, `violating > hint-filled > entered > given > empty`) from an **additive caret ring**; the precedence sentence is rewritten and the violating+selected rendering is stated. ADR-0030 consequence (d). |
| D4 | MAJOR | The box rule is the same colour as the cell hairline — a ladder, not a separator | **Fixed.** §12.3 specifies `color-mix(in srgb, var(--ink) 50%, transparent)`, computed here at **3.21 : 1** against card paper versus `--line`'s **1.43 : 1**, clearing WCAG 1.4.11's 3:1 floor. Deviation 4 rewritten with the numbers. |
| D5 | MAJOR | `.affordance` has no grid placement; a 512px full-bleed `apagar` is a generic form footer; the budget counts neither it nor `.hintExplain` | **Fixed.** §12.6 places both explicitly on row 2 (`1 / 8` and `9 / -1`, i.e. 338px and 164px on box boundaries); §12.4's tree gains the span; §12.3 restates the desktop budget as **829 without a hint / 865 with `.hintExplain`**, both ≤ 900. Deviation 13. |
| D6 | MAJOR | The 81 cells' focus ring is unspecified, and Binairo's `outline-offset: 2px` breaks geometrically here | **Fixed.** §12.5 declares `.cellSelected, .cell:focus-visible { outline: 2px solid var(--accent); outline-offset: -3px }` — one block, so ADR-0030 (c) holds mechanically — and states what a violating focused cell renders. |
| D7 | MINOR | `ctaNext` invents copy in a register found nowhere else | **Fixed.** `Fechar o dia — jogar ${game}`, F5:65's own phrasing. Recorded in deviation 11. |
| D8 | MINOR | The 8px/2px mobile pair buys 1.6px of cell for two extra deviations | **Fixed by adopting Binairo's 10px/3px.** Cell is 32.7px at 390 and 24.9px at 320, both clearing WCAG 2.5.8. **Deviations 2 and 3 are deleted.** This also removes the padding override D1 was partly about and gives the box rule 3px of air on each side. `binairo-screen.test.tsx`'s `expect(cell).toBe(38)` is unaffected. |
| D9 | MINOR | `prefers-reduced-motion` is stated without a location and the shared block cannot reach Sudoku's classes | **Fixed.** §12.7's Motion paragraph and §12.2 name both locations; `sudoku-board.module.css` carries its own block. Landmine 24. |
| D10 | MINOR | `Nível` is desktop-only, so mobile never learns the difficulty | **Fixed by using the existing mobile slot.** `.progressBar` renders `"Médio · 24 de 81"` via `progressShort(level, filled, total)` (§13.2). The rejected kicker alternative is named with the reason DESIGN.md forbids it and why `.progressBar` is not a kicker. Deviation 8 restated. |
| D11 | MINOR | The hub CTA box is only reserved below 768px | **Fixed.** §11.3 states the number and its arithmetic (`12 + 14 + 12 = 38px` from `padding: var(--space-3) 0` and `--text-button: 600 14px/1`), requires the done variant to reuse the box, and T-WEB-S17 asserts the declaration through the extended `css-source` helper. |

### Testability and risk

| # | Sev | Finding | Disposition |
|---|---|---|---|
| T1 | BLOCKING | Same as C4 | **Fixed with C4.** |
| T2 | BLOCKING | The extraction breaks `css-source.ts`, `GRID_AREA_CLASSES`, `className()` and the `--board-mobile-max` read; T-WEB-S32 claims otherwise | **Fixed.** New **§5.5** enumerates all six harness edits with the decided mechanism (`stylesheet(relativePath)` resolved from `apps/web/`, which also unlocks `app/page.module.css` for D11/T7); §5.2 lists the file; T-WEB-S32 restated as "unchanged in **what it asserts**", with §5.5 as the enumerated exception. |
| T3 | MAJOR | The conclusion's own 1040 fold is never decided | **Fixed by moving it to 1140.** §12.2 and §5.5 state the decision, the cost (~100px early fold) and the reason it wins: the top bar swaps members at the fold, so two folds would change the bar's character mid-session at 1100px. `conclusion-view.test.tsx:270`'s literal is enumerated. |
| T4 | MAJOR | T-API-S7's file and mechanism are both open, and §15's "only mock in api" is factually wrong | **Fixed.** T-API-S7 pins `apps/api/test/publishing-service.test.ts` (new, own `createTestDb()` + `beforeAll(…, 30_000)`) and the `importOriginal`-spread mock, so `SudokuGenerationError` stays the real class. §15's preamble corrected — verified at `completions.test.ts:48-58`. |
| T5 | MAJOR | The cron suite's runtime becomes heavy-tailed with no timeout | **Fixed with C4.** §15 names `cron-publish.test.ts` explicitly, `beforeAll` and per-`it`, with the measured spread. |
| T6 | MAJOR | No test guards §12.3/§12.6's mobile arithmetic | **Fixed.** New **T-WEB-S34** re-derives the cell and keypad arithmetic from `sudoku-board.module.css` text at 390 and 320 and pins the desktop keypad width. T-WEB-S31 restated as the box-occupancy comparison jsdom can actually make. |
| T7 | MAJOR | T-WEB-S17 asserts a height no available mechanism can read | **Fixed with T2/D11.** `stylesheet("app/page.module.css")` is the named mechanism. |
| T8 | MAJOR | E10 scans production, which none of the config's ignore patterns match | **Fixed.** E10 is scoped to the preview deployment plus the CI job link, with the reason stated and the "don't add a third host pattern" rule made explicit in §12.8 and landmine 14. Verified against `.impeccable/config.json`. |
| T9 | MINOR | T-WEB-S3 and T-WEB-S15's universal wording invites `fc.assert` | **Fixed.** Both rows now spell the enumeration; §15's preamble states "no `fc.assert` anywhere in `apps/web`" and that universal-sounding rows carry their enumeration. |
| T10 | MINOR | T-WEB-S22's `collectKeys` over markup is vacuous | **Fixed.** Restated as the shipped two-part scan (`elementSchema.parse(...).props` **and** `renderToStaticMarkup`), matching `binairo-page.test.tsx:136-141`. |
| T11 | MINOR | Two open choices | **Fixed with C6 and T4.** |
| T12 | MINOR | The narrowing comment cites T-DB-S5, which is blind to it | **Fixed.** §6.5's comment cites T-DB-S3 and T-DB-S4 only, and the plan states why T-DB-S5 is excluded. |

**Nothing was dismissed.** All five reviewers' blocking and major findings are fixed; one (I1) is fixed by a different mechanism than proposed, because the proposed one was checked against `vercel env ls` and does not work.

### Follow-through on the reviewers' own errors

- **I1's proposed fix** relied on `CRON_SECRET` being available to preview deployments. It is Production-only. Recorded as landmine 23 so #25/#27 do not repeat the assumption.
- **D2's proposed 3-row 5-column layout** leaves an empty grid slot next to digit 9. Replaced with a 4-column layout that has none and gives larger targets at every width; the reviewer's vertical-budget concern is honoured (811 ≤ 844).
- **A2's alternative** (`status: "playing" | "closed"` plus a per-game `outcome`) was not taken: `"playing" | "solved" | "lost"` keeps the existing binairo literals untouched, so step 6 stays a pure move, and `PlayCore` is still the single place the terminal predicate is defined.
