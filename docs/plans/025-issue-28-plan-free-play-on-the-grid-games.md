# Implementation plan — Issue #28: Free play on the grid games

**Issue:** [#28](https://github.com/fernandolisboa/miolos/issues/28) — M2's last ticket. Blocked by #25 (closed). Blocks #37.
**Governing ADRs:** [ADR-0011](../adr/0011-free-play-is-generated-on-the-client.md) (free play is generated on the client), [ADR-0008](../adr/0008-completion-and-streak-semantics-across-play-modes.md) rule 5 (records nothing server-side), [ADR-0005](../adr/0005-all-content-is-free.md) (constraints on free play), [ADR-0019](../adr/0019-per-game-subpath-exports-in-packages-games.md) (per-game splitting), [ADR-0013](../adr/0013-canonical-domain-and-pt-br-routes.md) (pt-BR route slugs).
**Proposed ADRs:** ADR-0046 and ADR-0047 — full drafts in Appendices A and B, created as real files at implementation time.
**Snapshot:** written against `main` at `166767a`. Point-in-time; where a later ADR disagrees, the ADR wins.

The hard part of this ticket is not generation — the three engines are done, property-tested, and pure. The hard part is **proving the negatives**: three of the five acceptance criteria assert that nothing happened. Section 9 is the heart of this plan.

---

## Table of contents

- §0. Acceptance criteria → plan mapping
- §1. Scope boundary
- §2. Read first
- §3. Fixed decisions (D1–D13)
- §4. What already exists — the seams, verified
- §5. Routes, `routes.ts` and the #75 fold-in
- §6. The free-play module — file by file
- §7. The screens — states, design, i18n copy
- §8. The hub entry point
- §9. **Proving the negatives** — the evidence plan per AC
- §10. The bundle-check rework — route-scoped markers
- §11. Gates and CI — impeccable, budgets, the ritual
- §12. Test plan and reserved ids
- §13. What cannot be verified in this environment
- §14. Out of scope
- §15. Deviation / risk register
- §16. Commit and PR plan
- §17. Exit criteria (mapped to handoff 024 §8)
- Appendix A. Draft ADR-0046
- Appendix B. Draft ADR-0047

---

## 0. Acceptance criteria → plan mapping

| AC | Claim | Where the plan discharges it |
|---|---|---|
| 1 | Free-play puzzles are generated client-side; the network tab shows no free-play requests, and no server rows are written | §6 (generation in the browser), §9.1 (ESLint wall + zero-fetch tests + the `POST /session` position, D3), §13 (what stands in for a live network tab) |
| 2 | Streak, stats and medals demonstrably untouched by any amount of free play | §9.2 (no `POST /completions` possible; `localStorage` keyspace unchanged; structural no-rows argument), §13 |
| 3 | Termo does not appear in free play | §9.3 (compile-level exclusion, route absence, ESLint ban, global bundle markers) |
| 4 | With the page loaded and the network cut, free play keeps working | §9.4 (fetch-rejecting jsdom harness + documented step-8 browser ritual) |
| 5 | Entry point and screens fit the design system; `npx impeccable detect` green | §7, §8, §11.1 (four new URLs × two viewports, three `impeccable.yml` edits, positive controls) |

---

## 1. Scope boundary

**In scope**

- Four new routes: `/modo-livre` (index) and `/modo-livre/{binairo,sudoku,nonogram}` (D1).
- A new `apps/web/src/free-play/` module: game catalog, level→weekday mapping, seed picking, three thin per-game hooks, three screens, one solved card (§6).
- The hub's "Modo livre" anchor becomes a real link (§8).
- The #75 `playRoutes` totalisation, folded in as the branch's first commit (D9).
- A new ESLint wall for the free-play directories, with probe tests (§9.1).
- The `route-client-js.mjs` rework to route-scoped forbidden sets (§10, ADR-0047) — mandatory; the current global scan fails by design once free play ships.
- `impeccable.yml` extended in its three URL lists (§11.1).
- ADR-0046 and ADR-0047 as real files; a one-row amendment to `CONTEXT.md`'s Motif entry (§6.4); a one-line amendment pointer added to `docs/adr/0033-the-nonogram-reveal-ships-no-name.md` naming ADR-0047 as the amender of its bundle clause (§6.4, §16 commit 7).

**Out of scope** — see §14 for the full list with reasons.

**Not touched at all:** `packages/games` (zero changes — free play is the case its architecture was built for, and it is ready as-is), `packages/db`, `packages/core`, `apps/api` (no new route, no migration — free play writes nothing, handoff 024 §3). Any diff in these directories at step 6 is a finding by itself, with two named exceptions: the comment-only touch of `packages/games/test/{nonogram,termo}/bundle-markers.test.ts` headers if their wording pins the old global-scan semantics (§10.5), and nothing else.

---

## 2. Read first (in this order)

1. `CLAUDE.md` — verification gates and project invariants.
2. [`docs/handoffs/024-handoff-m2-free-play-the-last-ticket.md`](../handoffs/024-handoff-m2-free-play-the-last-ticket.md) — §2 (the four existing seams), §3 (landmines), §8 (exit criteria).
3. ADR-0011, ADR-0008, ADR-0005, ADR-0019, ADR-0023, ADR-0013, ADR-0002.
4. `CONTEXT.md` — this plan uses its verbs exactly: **Free play / Modo livre**, **Daily**, **Completion (on time)**, **Hint / Dica**, **Motif**.
5. `apps/web/src/play/use-play-lifecycle.ts` and `apps/web/src/play/sync.ts` — the two modules free play exists to *not* import.
6. `apps/web/test/eslint-db-wall.test.ts` and `apps/web/scripts/route-client-js.mjs` — the two shipped precedents for mechanising a negative.

---

## 3. Fixed decisions

Each decision below is settled here so step 5 implements rather than re-litigates. D2, D7 and D8 are product-visible; they are recorded in ADR-0046 and **Fernando can override any of them in the PR without blocking** — each names its cheapest reversal.

### D1 — Routes: `/modo-livre` index plus three literal game segments

`/modo-livre`, `/modo-livre/binairo`, `/modo-livre/sudoku`, `/modo-livre/nonogram`. Literal segments, not a `[game]` dynamic segment.

The daily routes are literal for a wall-safety reason that does not transfer — `apps/web/app/sudoku/page.tsx:22-26` refuses to put an untrusted `params.game` in front of the published-puzzle wall, and free play has no wall — but literal segments earn their place here on three other grounds:

- **Per-game code-splitting is the route boundary.** ADR-0011 consequence: "Code-split per game so the Sudoku generator doesn't ride along on the Binairo page." ADR-0019 gives each generator its own subpath export; a literal page per game means Next's route-level splitting does the rest, with no `next/dynamic` (a pattern `apps/web` does not use anywhere today, verified by grep).
- **Typed routes stay literal.** `routes` is an `as const` object of template literals (`apps/web/src/i18n/routes.ts:35-45`) because Next 16's typed `<Link href>` requires literal types (`routes.ts:26-30`). A dynamic segment would reintroduce the function-returning-string shape the file's own comment rejects.
- **impeccable and the preflight enumerate URLs** (`.github/workflows/impeccable.yml:76,143-154,163-174`); a fixed set of literal routes is what that machinery scans.

There is **no `/modo-livre/termo` route, and no `app/modo-livre/termo/` directory** — Next answers 404 by absence, which is the correct behavior, and §9.3 asserts the absence mechanically.

**Static, not `force-dynamic`.** The daily pages are `force-dynamic` because a cached page would serve yesterday's puzzle (`apps/web/app/binairo/page.tsx:9-13`). Free-play pages fetch nothing and read no date, so they take Next's static default — which is itself a small structural proof of AC 1 (a static page has no server data dependency to leak) and gives the CDN the whole page. The pre-hydration HTML renders the generating skeleton with its `data-play-state` marker (§7.4), so the preflight's grep is satisfied by the static shell.

### D2 — Difficulty: a three-level picker mapped onto the weekday ramps

`packages/games` has no free-play difficulty concept; every generator takes `{seed, weekday}` with `Weekday = 1..7` runtime-guarded (`packages/games/src/binairo/generate.ts:74-89`, `sudoku/generate.ts:159-172`, `nonogram/generate.ts:23-40`). The weekday IS the difficulty axis, Monday easiest → Sunday hardest, in all three engines (`binairo/validate.ts:23-33`, `sudoku/criteria.ts:27-37`, `nonogram/difficulty.ts:31-42`).

**Decision: free play exposes a three-level picker — Leve / Médio / Difícil — mapped to weekdays 1 / 4 / 7.** Rationale:

- **Three levels, not seven.** The full 1..7 ramp is an implementation detail wearing a UI: "quinta-feira de Binairo" means nothing outside the daily ritual, and seven pt-BR labels for adjacent tiers is choice overload for the least ceremonial mode. Three levels is the vocabulary every casual puzzle product already taught this audience.
- **1/4/7, the ramp's endpoints and middle,** give the widest legible spread: Nonogram Leve is the whole 5×5 class, Médio the easy 10×10 band, Difícil the hard 15×15 band (`nonogram/difficulty.ts:34-41`); Sudoku maps to tiers 1/3/5 (`sudoku/criteria.ts:30-36`); Binairo runs from tier-1-generous-givens to tier-2-minimum-givens (`binairo/validate.ts:26-32`).
- **Random weekday per puzzle** (rejected): difficulty roulette; a player who wants an easy one cannot ask for it. **Fixed mid-week** (rejected): buries the 15×15 Nonogram and tier-5 Sudoku that already exist and are the mode's depth.
- The picker lives **on each game screen** (a three-chip control, default **Médio**), not on the index and not in the URL. No query param keeps the pages fully static, keeps level switching offline-instant, and forecloses nothing — a future shareable-seed link (ADR-0011, noted-not-scheduled) would carry `{game, seed, weekday}` and can add its own param then.
- pt-BR labels are new copy in `messages.ts` (§7.5). "Nível" is already the shipped word for difficulty on the Sudoku screen (`levelLabel`, `messages.ts:383`), so the picker's group label reuses it — no new vocabulary. `CONTEXT.md` needs no new term: "Leve/Médio/Difícil" are UI copy, and the code identifier is `FreePlayLevel`.

**Override cost if Fernando disagrees:** the mapping is one 3-entry constant (`LEVEL_WEEKDAYS`, §6.1) and three message strings; switching to seven levels or different weekday picks is a one-file change plus copy.

### D3 — `POST /session` stays; AC-1's evidence is phrased precisely around it

`<SessionBootstrap/>` is mounted unconditionally in the root layout (`apps/web/app/layout.tsx:43`) and fires `POST /session` once per page load on every route (`apps/web/src/session/bootstrap.ts:180`), the hub included. **Decision: leave it.** It is route-agnostic identity bootstrap, not a free-play request — suppressing it on free-play routes would be layout surgery (a route-group split of the root layout) to hide a request the hub makes anyway, and would break the ordinary flow of a player who lands on `/modo-livre` first and then plays the daily (their session would mint late, on navigation, through a path nothing tests).

The AC-1 evidence is therefore stated, in tests and in the PR, as: **no request originates from any free-play module — zero fetches during generate → play → solve → next — and the only request on a free-play page load is the layout-level session mint that every route carries.** The jsdom tests in §9.1 mount the free-play screens *without* the layout, so their assertion is literally zero fetch calls; the step-8 browser ritual (§13) observes, in the Fetch/XHR filter, the one `POST /session` on load and nothing after (document/asset/RSC-payload rows are the page load itself, not fetches).

### D4 — Seeds: `crypto.getRandomValues`, one uint32 per puzzle, not user-visible in v1

The client picks the seed (ADR-0011 decision). `pickSeed()` draws one uint32 via `crypto.getRandomValues(new Uint32Array(1))` — the same source the server uses for daily seeds, available in every supported browser and in jsdom, and the whole uint32 domain is exactly what the generators alias to (`seed >>> 0`, e.g. `binairo/generate.ts:78`). Never `Math.random()`: determinism-bearing randomness in this codebase flows from named sources.

"**Mais um**" (next puzzle) draws a fresh seed at the same level. The screen state keeps `{seed, weekday}` for the current puzzle, so a future shareable-seed feature is a rendering away — but no seed is displayed, no URL carries one, and no share affordance ships (ADR-0011 marks it noted-not-scheduled; scope-creeping it in is exactly what §14 excludes).

### D5 — Sudoku generation cost: generate in an effect, retry on exhaustion, no Web Worker

`generateDailySudoku` retries up to 1200 attempts internally and an exhausted seed costs ~2s of CPU (`packages/games/src/sudoku/generate.ts:120-127`; the publishing side measured it, `apps/api/src/publishing/service.ts:204-214`). The typical case is tens of milliseconds, but the worst case blocks the main thread. Decision, in three parts:

1. **All three games generate inside a mount/level-change/next-puzzle effect, never during render and never on the server.** This is forced anyway: the seed is random, so generating during SSR or the first render would make the server HTML and the client hydration disagree — the same "nothing runs during render" discipline the daily screens already hold (plan 017 D28, `apps/web/src/play/use-play-lifecycle.ts:8-11`). The first paint is a **generating skeleton** (§7.4); the effect then generates and swaps the board in. For Binairo (~7ms) and Nonogram (sub-ms after the one-time ~30ms pool build) the skeleton is one frame; for Sudoku it is honest feedback.
2. **On `SudokuGenerationError`, retry with a fresh seed, up to 3 seeds, then show an error card** with "Tentar de novo". This is the publishing precedent (fresh seed on exhaustion) moved client-side. The generating skeleton is static text, not an animated spinner — a synchronous generation burst would freeze an animation and the design system prefers stillness anyway (`prefers-reduced-motion` posture, DESIGN.md).
3. **No Web Worker.** It would be the repo's first worker: a new build surface, a new test seam, and a structured-clone boundary, purchased against a worst case that is rare (exhausted seeds are the 1200-attempt tail), bounded (~2s), and mitigated by the retry ladder. Named in §15 as the escalation path if step-8 measurement on a real phone says otherwise.

The generating skeleton paints before the effect runs (React commits, then effects fire), so the block never hides the feedback. The hook takes the generator as an injectable parameter defaulting to the real one, so the retry ladder is testable without manufacturing a genuinely exhausted seed (§12).

### D6 — No persistence: a free-play session is ephemeral

Free play writes **nothing** to `localStorage` — no new namespace, no reuse of `miolos:play:<game>:<date>` (`apps/web/src/play/play-record.ts:29,52-53`), nothing `day-state.ts` reads. Reload loses the in-progress board and generates a fresh puzzle.

Defense: the offline AC requires only that the *loaded page* keeps working, not that a session survives reload. Free-play puzzles are infinite — nothing scarce is lost with one. And ephemerality makes AC 2's client-side half maximally provable: the keyspace assertion in §9.2 is "**`localStorage` is byte-identical before and after a full free-play session**", which is a far stronger instrument than "no writes under the daily prefix". A persistence namespace would also drag in schema, Zod, versioning and pruning — a real slice of the play-record machinery — for a convenience nobody asked for. If it is ever wanted, it is an additive later ticket.

### D7 — One free hint per free-play puzzle, no extras affordance

The grid games' hint is pure client logic (`apps/web/src/play/grid-hint.ts:52-79`) and the daily grants one free hint per grid puzzle, embedded in the reducers' initial state (`hint: { free: 1, … }`, `apps/web/src/binairo/state.ts:78`). Free play keeps it: the hint arrives for free by reusing the reducers, it records nothing, and removing it would mean forking the state modules to delete a feature. For **Binairo and Sudoku** the generator output carries the full `solution`, so their free-play hooks feed `nextHint` directly — no solver call needed (Binairo's daily hook memoizes `solveBinairo`, `use-binairo-play.ts:79`; free play passes the generator's solution instead, Sudoku's narrowed per §6.2). **Nonogram needs no solution plumbing at all:** its `use-hint` action is a bare verb (`apps/web/src/nonogram/state.ts:100`) and the state derives its own `solution` from the clues via `solutionMarks` inside `initNonogramPlayState` (`state.ts:116-124`) — solved-detection and the hint both come from clues alone.

What free play does **not** get: any "extra hints" affordance. Hint grants are day-scoped, server-recorded rows expiring at rollover (ADR-0006; CONTEXT.md "Hint"), and free play must not touch that system. The free-play screens render the hint button in its two shipped states (available / used) and nothing else.

### D8 — No timer

The daily timer exists to stamp a result: it feeds the play record, the conclusion stamp, and eventually the time statistics. Free play records nothing, so a clock would measure a value with no destination — and rendering one invites "where did my time go" the moment the answer is "nowhere, by design". The free-play screens render **no `<TimerReadout/>`** and never dispatch `resume`, so the reducers' timer stays `{accumulatedMs: 0, runningSince: null}` forever — inert state, not removed state, which is what keeps the reducers reusable unmodified. The stats card slot shows progress and the level instead (§7.2).

**Override cost:** `<TimerReadout/>` (`apps/web/src/play/timer-readout.tsx`) plus a `resume` dispatch on mount is an afternoon; nothing forecloses it.

### D9 — #75 is folded in, as the branch's first commit

[#75](https://github.com/fernandolisboa/miolos/issues/75) totalises `playRoutes` from `Readonly<Partial<Record<Game, Route>>>` to `Readonly<Record<Game, Route>>` and deletes the two dead branches the `Partial` still forces: `apps/web/app/hub-day-state.tsx:84-97` (the `route === undefined` arm, whose own comment says "totalising the map is #75") and the `route !== undefined` narrowing in `nextPendingDaily` (`apps/web/src/play/conclusion-view.tsx:522-531`). Handoff 024 §5 says before-or-with, not after.

**Decision: with, as a separate first commit** (`refactor(web): totalise playRoutes to Record<Game, Route> (#75)`) on the #28 branch, and the PR closes both issues. Reasoning: a separate PR would spend a full eight-step cycle on a ~30-line refactor; but the two tickets do touch the same lines (#28 edits the hub and adds a fifth route shape to `routes.ts`), and two reshapes of the same lines inside one commit is how a step-6 loop starts. A clean first commit gives reviewers a reviewable boundary: everything after it lands on the totalised shape, and #28's own `freePlayRoutes` map is born total (`Record<FreePlayGame, Route>`, §5.2) with no dead branch ever existing.

### D10 — The bundle-check rework is route-scoped, and it is not optional

`route-client-js.mjs` greps **every** chunk under `.next/static/chunks` for a single global `FORBIDDEN` list (`apps/web/scripts/route-client-js.mjs:297-312,175-189`). Free play legitimately ships the Nonogram motif library (curated pt-BR names included — they are data in `motifs-*.ts`, and `generateNonogram` returns `reveal.name`, `packages/games/src/nonogram/generate.ts:49-56`) and the generator output keys `givensCount`/`requiredTier`/`clueCount` (`binairo/generate.ts:126-128`, `sudoku/types.ts:29-31`) into free-play chunks. The current script therefore **fails by design** on the first free-play build. §10 specifies the rework: markers get a scope (globally-forbidden vs daily-scope-forbidden), chunks get an attribution (daily / free-play-only / unattributed-fails-closed), and every scope keeps a positive control. This **amends ADR-0033**, not merely reinterprets it: decision 1's "not by shipping the motif library into the bundle" clause and consequence (d)'s "no motif name may reach `apps/web`" premise narrow to daily-route and shared chunks — ADR-0047 carries the amendment in its Amends header (Appendix B), and ADR-0033's payload/response guarantees and the daily-chunk tripwire stay intact, unweakened. Full semantics in §10; recorded as ADR-0047.

### D11 — The negatives are proved by instruments, each with a positive control

Settled as the whole of §9. The instruments: a new ESLint wall with probe tests (T-LINT-S9…S20 reserved), zero-fetch and fetch-rejecting jsdom harnesses (T-WEB range), a `localStorage` keyspace snapshot assertion, compile-level Termo exclusion, route-absence assertions, the route-scoped bundle markers, and the impeccable preflight. Every "asserts an absence" test is paired with a control that proves the instrument fires — the `eslint-db-wall.test.ts` discipline (every red probe beside a clean probe) and `route-client-js.mjs`'s `EXPECTED` discipline, applied uniformly.

### D12 — Bundle budgets: new routes enter `BUDGETED` with measured-at-step-8 ceilings; no daily budget moves

Provisional expectations, to be replaced by measurement (§11.2): `/modo-livre` rides the 40KB default with room to spare (it is cards and links); `/modo-livre/binairo` and `/modo-livre/sudoku` land near their daily siblings (33.0 / 30.4 KB, `route-client-js.mjs:29-31`) plus generator-side code the dailies do not ship, minus the sync/lifecycle machinery they do — the 40KB default is the target and a small override is acceptable if measurement says so; `/modo-livre/nonogram` **will need an override**: the motif library is ~35KB minified (`route-client-js.mjs:36-37`), so ~75-85KB is expected. That override is justified exactly the way `/termo`'s 76KB is (`route-client-js.mjs:93-117`): the heavy content *is* the feature, and the shared 40KB must not be raised to fit it, because the default is what arms the motif tripwire for the three **daily** grid routes. Ceilings are set at step 8 as measured + ~10%, each with a justifying comment in `PER_ROUTE_BUDGET`.

### D13 — `routes.ts` naming: four literal entries plus a total `freePlayRoutes` map

`routeSlugs.freePlay` already exists (`routes.ts:10`). New entries follow the shipped `as const` pattern exactly (§5.2): `routes.freePlay`, `routes.freePlayBinairo`, `routes.freePlaySudoku`, `routes.freePlayNonogram`, each a template literal over `routeSlugs`, so `Route` stays a union of literals and typed `<Link href>` keeps working. Beside `playRoutes` (total after D9), a new `freePlayRoutes: Readonly<Record<FreePlayGame, Route>>` map — total from birth, keyed by the free-play game type whose definition is itself AC-3 evidence (§9.3).

---

## 4. What already exists — the seams, verified

Every row re-verified against the working tree at `166767a`; nothing here is rebuilt.

| Seam | Where | State |
|---|---|---|
| Route slug `modo-livre` | `apps/web/src/i18n/routes.ts:10` | Slug only; no `routes` entry, no page |
| Label "Modo livre" | `apps/web/src/i18n/messages.ts:154` | Rendered as an href-less `<a>` on the hub (`apps/web/app/page.tsx:130`) |
| The `free` grid row | `apps/web/src/play/screen.module.css:48,266-268` | A 1fr **spacer** in the ≥1141px play-screen grid, documented as element-less; the name is a coincidence — see §8: it stays a spacer |
| `generateBinairo({seed, weekday})` | `packages/games/src/binairo/generate.ts:74-140` | ~7ms; throws `BinairoGenerationError` after 64 attempts; output has `givens`, `solution`, `givensCount`, `requiredTier` |
| `generateDailySudoku({seed, weekday, maxAttempts?})` | `packages/games/src/sudoku/generate.ts:159-172` | Heavy tail (D5); frozen output has `givens`, `solution`, `tier`, `clueCount` |
| `generateNonogram(seed, weekday)` — **positional args** | `packages/games/src/nonogram/generate.ts:23-70` | Sub-ms; output has `clues` (engine-shaped) and `reveal: {motifId, name, mirrored, solution}` |
| Pure per-game reducers + init | `apps/web/src/binairo/state.ts:68-85`, `sudoku/state.ts:102`, `nonogram/state.ts:116-117` | Each init takes its `Daily*Response` shape; `restore` with `record: undefined` just sets `{now, hydrated: true}` (`binairo/state.ts:267-274`) — the exact hydration free play needs, no new action required |
| Presentational components | `binairo/grid.tsx` + `controls.tsx`, `sudoku/board.tsx` + `keypad.tsx`, `nonogram/board.tsx` + `controls.tsx` | Take state + callbacks; no lifecycle coupling |
| Shared chrome | `play/screen.module.css`, `play/accent.ts` (`accentVars`), `grid-hint.ts` | All reusable as-is |
| The one completion writer | `apps/web/src/play/use-play-lifecycle.ts:231-246` → `sync.ts` | Free play must never import either (§9.1) |
| The daily record store | `play/play-record.ts:52-53` (`miolos:play:<game>:<date>`), read by `play/day-state.ts` | Free play must never write it (D6, §9.2) |
| Zero streak/stats server surface | `apps/web/app/page.tsx:82` (`const streakCount = 0`); `apps/api/app` holds only route.ts, health, session, daily/*, completions, buffer-depth, cron/publish, termo/guess | "Untouched" reduces to "no POST and no local writes" (§9.2) |
| First client consumer | grep: no `generate*` import anywhere in `apps/web` | Free play is the generators' first browser consumer; ADR-0011 pays out here |

---

## 5. Routes, `routes.ts` and the #75 fold-in

### 5.1 Commit 1 — #75, verbatim scope

- `routes.ts:65`: `playRoutes` becomes `Readonly<Record<Game, Route>>`; the doc comment's "#75 totalises" paragraphs (`routes.ts:53-64`) are rewritten to past tense.
- `hub-day-state.tsx:84-97`: delete the `route === undefined` arm; `route` is now `Route`, not `Route | undefined`.
- `conclusion-view.tsx:522-531`: `nextPendingDaily` drops the `route !== undefined` narrowing and any `?? routes.home` residue; the loop body becomes a status check alone.
- The hub comment at `app/page.tsx:118-122` loses its "#75 totalises the map" sentence.
- No behavior change; the existing suites are the regression net. `pnpm typecheck` is the proof the dead branches were dead.
- **#75's own acceptance criterion, discharged by name:** issue #75 requires "T-WEB-S16's 'follows playRoutes' property preserved or explicitly retired with a reason". It is **preserved**: the describe (`apps/web/test/hoje.smoke.test.tsx:199`) keeps its id and its map-driven assertion — every game's CTA href follows `playRoutes[game]`. Only its `route === undefined` arm (`hoje.smoke.test.tsx:213-216`) goes unreachable once the map is total, and that arm is deleted in this commit without weakening the property (with a total map there is no dead-href case left to assert). The PR text states this explicitly so #75's AC is discharged on the record, not by implication.

### 5.2 Commit 2+ — the free-play additions to `routes.ts`

```ts
export const routes = {
  // …existing nine entries unchanged (routes.ts:35-45)…
  freePlay: `/${routeSlugs.freePlay}`,
  freePlayBinairo: `/${routeSlugs.freePlay}/${routeSlugs.binairo}`,
  freePlaySudoku: `/${routeSlugs.freePlay}/${routeSlugs.sudoku}`,
  freePlayNonogram: `/${routeSlugs.freePlay}/${routeSlugs.nonogram}`,
} as const;

/** Where each free-play game lives. Total over FreePlayGame BY TYPE:
 *  adding termo here is a compile error, not a review catch (ADR-0046). */
export const freePlayRoutes: Readonly<Record<FreePlayGame, Route>> = {
  binairo: routes.freePlayBinairo,
  sudoku: routes.freePlaySudoku,
  nonogram: routes.freePlayNonogram,
};
```

`FreePlayGame` is imported from the free-play catalog (§6.1). Note the deliberate asymmetry with the daily pattern: `playRoutes` is keyed by `Game` (all four), `freePlayRoutes` by `FreePlayGame` (three) — the type system carries the Termo exclusion (§9.3).

### 5.3 The four pages

- `apps/web/app/modo-livre/page.tsx` — server component, static, no `dynamic` export. Renders the index (§7.1). No db import, no fetch — there is nothing to fetch.
- `apps/web/app/modo-livre/binairo/page.tsx`, `…/sudoku/page.tsx`, `…/nonogram/page.tsx` — each a two-line server shell rendering its client screen, mirroring the daily shells' thinness (`app/binairo/page.tsx:26-32`) minus the db read. Route-level splitting keeps each generator on its own page (D1).
- **No `app/modo-livre/termo/` directory, ever.** Asserted by T-WEB (§9.3).

---

## 6. The free-play module — file by file

New directory `apps/web/src/free-play/`. Its import discipline is the subject of the wall in §9.1: it may import `@miolos/games/{binairo,sudoku,nonogram}`, the per-game `state.ts` reducers and presentational components, `play/grid-hint.ts`, `play/accent.ts`, `play/screen.module.css`, `play/progress.ts`, and `i18n` — and may **not** import `play/sync.ts`, `play/play-record.ts`, `play/use-play-lifecycle.ts`, `play/day-state.ts`, `play/use-record-snapshot.ts`, `play/conclusion-view.tsx`, `termo/guess-client.ts`, `session/bootstrap.ts`, `components/session-bootstrap.tsx`, the three daily hooks (`binairo/use-binairo-play.ts`, `sudoku/use-sudoku-play.ts`, `nonogram/use-nonogram-play.ts`), the three daily screen roots (`binairo/binairo-screen.tsx`, `sudoku/sudoku-screen.tsx`, `nonogram/nonogram-screen.tsx`), anything `@miolos/db`, or `@miolos/games/termo`. The hooks, screens and `conclusion-view` are banned because `no-restricted-imports` is **not transitive**: a free-play file importing `use-binairo-play` would reach `use-play-lifecycle` and `sync.ts` through a door the direct bans never see.

### 6.1 `free-play/catalog.ts`

```ts
import { GAMES, type Game } from "@miolos/core";
import type { Weekday } from "@miolos/games";

/** The grid games. Termo is excluded by PROJECT INVARIANT (CLAUDE.md;
 *  ADR-0005: its answer list is finite curated content and free play
 *  would burn it). The `satisfies` clause makes adding it a type error. */
export const FREE_PLAY_GAMES = ["binairo", "sudoku", "nonogram"] as const
  satisfies readonly Exclude<Game, "termo">[];

export type FreePlayGame = (typeof FREE_PLAY_GAMES)[number];

export const FREE_PLAY_LEVELS = ["leve", "medio", "dificil"] as const;
export type FreePlayLevel = (typeof FREE_PLAY_LEVELS)[number];

/** ADR-0046: the ramp's endpoints and middle (D2). */
export const LEVEL_WEEKDAYS: Readonly<Record<FreePlayLevel, Weekday>> = {
  leve: 1,
  medio: 4,
  dificil: 7,
};

/** One uint32 from the platform CSPRNG — the client picks the seed (ADR-0011). */
export function pickSeed(): number {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  // noUncheckedIndexedAccess (tsconfig.base.json:10) types buffer[0] as
  // number | undefined; index 0 of a length-1 typed array always exists,
  // so the fallback is unreachable and only keeps the type honest.
  return buffer[0] ?? 0;
}
```

`GAMES` is imported so the catalog test can assert set equality (`FREE_PLAY_GAMES` = `GAMES` minus `termo`) rather than trusting the literal (§9.3). The root `@miolos/games` barrel legally exposes `Weekday` (ADR-0019: shared substrate only).

### 6.2 The three hooks — `use-free-binairo.ts`, `use-free-sudoku.ts`, `use-free-nonogram.ts`

Each hook owns one game's generation state machine and returns the same shape its daily sibling returns minus lifecycle/timer members. Common structure (Binairo as the model):

- **Generation state:** `{ phase: "generating" } | { phase: "ready"; puzzle } | { phase: "failed" }`, held in `useState`, driven by an effect keyed on `[level, run]` where `run` is a counter "Mais um" increments. The effect calls `pickSeed()` then the generator with `LEVEL_WEEKDAYS[level]`. Never during render, never on the server (D5.1).
- **Sudoku only:** the effect wraps the call in the 3-seed retry ladder (D5.2), catching `SudokuGenerationError` — and only that error — per attempt. The generator function is an injectable parameter defaulting to `generateDailySudoku` so the ladder is testable (§12).
- **Board state:** once `phase === "ready"`, an inner component (§6.3) initialises the game's own reducer from a synthetic response-shaped object. **A bare object literal over the generator output does not typecheck under strict mode**, and the plan specs the adapter per game rather than leaving step 5 to discover it: the Zod-inferred response types are *mutable* arrays with *narrowed* domains (`DailyBinairoResponse.givens: (0|1|null)[]`, `daily.ts:118-123`; `DailySudokuResponse.givens` a mutable 0–9-union array, `daily.ts:166-171`; `DailyNonogramResponse.clues.size: 5|8|10|15`, `daily.ts:212-241`), while the generator outputs are *readonly* and *wider* (`BinairoPuzzle.givens: readonly BinairoCell[]`; `SudokuPuzzle.givens/solution: readonly number[]` — plain `number`, not the digit union, by documented design, `sudoku/types.ts:17`; `NonogramPuzzle.clues.size: number`).

  **The adapter is one `parse` per puzzle through the client-importable response schema** — all three games, uniformly, which is also the letter of the "Zod at every boundary" gate (the generator output crosses into the daily-shaped reducer layer here):
  - Binairo: `dailyBinairoResponseSchema.parse({ game: "binairo", date: FREE_PLAY_DATE, size: 8, givens: puzzle.givens })` → `initPlayState` (`binairo/state.ts:68`). A hand-rolled `[...puzzle.givens]` spread would typecheck too, but it would leave Binairo the odd one out and skip the boundary parse for no saving.
  - Sudoku: `dailySudokuResponseSchema.parse({ game: "sudoku", date: FREE_PLAY_DATE, givens: puzzle.givens, tier: puzzle.tier })` → `initSudokuPlayState` (`sudoku/state.ts:102`) — the parse is what narrows `readonly number[]` to the mutable digit-union array for free.
  - Nonogram: `dailyNonogramResponseSchema.parse({ game: "nonogram", date: FREE_PLAY_DATE, size: puzzle.size, clues: puzzle.clues })` → `initNonogramPlayState` (`nonogram/state.ts:116`) — narrows `size: number` to `5|8|10|15` and returns mutable clue-array copies; the schema's `size === clues.size` refine holds by construction, both fields coming off one puzzle.
  - Sudoku's hint additionally needs the **solution** narrowed: `{ type: "use-hint", solution }` takes `readonly SudokuDigit[]` (`sudoku/state.ts:90`) and the generator hands `readonly number[]`. The hook parses it once per puzzle with `z.array(sudokuDigitSchema).length(81)` — `sudokuDigitSchema` is exported from `@miolos/core` (`packages/core/src/index.ts:39`), the `play/play-record.ts` precedent.

  **Can the parse reject?** Not for a correct engine: the schemas assert exactly the invariants the generators prove by property test (ADR-0023) — lengths 64/81, cell domains, size within criteria, clue-line counts equal to size. If one ever throws, that is an engine-contract regression and it must surface, not be re-rolled: the effect's catch-all routes any non-`SudokuGenerationError` throw to `phase: "failed"` and the §7.4 error card. Only `SudokuGenerationError` buys a fresh seed (D5.2).

  `FREE_PLAY_DATE = "1970-01-01"` — a named sentinel with a comment. The `date` field exists because the daily inits require it; in free play it is rendered nowhere, keys no storage (D6), and reaches no wire. It parses cleanly (`isoDateString` is a format check, not a calendar policy); the sentinel is honest about being inert.
- **Hydration:** on mount the inner component dispatches `{ type: "restore", record: undefined, now: Date.now() }`, which every reducer answers with `{...state, now, hydrated: true}` (`binairo/state.ts:267-274` and siblings) — the shipped path for "no stored record", reused rather than a new action. No `resume` is ever dispatched (D8), so the timer stays inert.
- **Hint:** Binairo/Sudoku: `revealHint` mirrors the daily hook's (`use-binairo-play.ts:109-127`) but takes the solution from the generator output (`puzzle.solution`; Sudoku's narrowed to the digit union per the adapter above) instead of a solver memo. Nonogram: dispatch the bare `{ type: "use-hint" }` verb (`nonogram/state.ts:100`) — the state already carries its clue-derived `solution` (D7); there is no "feed `nextHint` the `reveal.solution`" seam and none is needed. One free hint (D7).
- **Solved:** the reducers already derive `status: "solved"` from the board; the screen swaps to the solved card (§7.3) on it — no navigation, exactly the daily's swap-in-place trick (`binairo-screen.tsx:11-15`) that makes finishing offline work.

### 6.3 The three screens — `binairo-free-screen.tsx`, `sudoku-free-screen.tsx`, `nonogram-free-screen.tsx`

Client components (`"use client"`), one per page. Composition per screen:

- Outer: level picker + generation phase switch (generating skeleton / error card / board).
- Inner `…FreeBoard` component, mounted with `key={`${seed}:${level}`}` so "Mais um" and level switches remount and re-init the reducer cleanly — React's own reset semantics instead of a hand-rolled reset action.
- Board area reuses the game's shipped presentational pair (`Grid`+`Controls` / `Board`+`Keypad` / `Board`+`Controls`) and the shared `screen.module.css` grid, with the free-play chrome differences of §7.2.
- A small shared `free-play/solved-card.tsx` renders the solved state (§7.3).

### 6.4 The Nonogram name rule

Free play necessarily ships the motif library in its chunk (D10) — but **the motif name stays non-user-facing**. The solved card shows the painted picture (CONTEXT.md "Picture" — the client-rendered payoff) and never `reveal.name` or `reveal.motifId`.

This contradicts two documents, and both are amended on the record rather than talked around:

- **ADR-0033 is amended, not untouched.** Its decision 1 says the name never reaches the client "not by shipping the motif library into the bundle", its Rejected list rejects shipping the motif tables, and its consequence (d) rests on "no motif name may reach `apps/web`". Free play ships the library, so ADR-0047 carries an **Amends** header narrowing decision 1's bundle clause and consequence (d) to daily-route and shared chunks (Appendix B), and commit 7 adds the reciprocal one-line amendment pointer to `docs/adr/0033-the-nonogram-reveal-ships-no-name.md` itself. What ADR-0033 guarantees about the **wire** — no name in any daily payload or completion response, `FORBIDDEN_DAILY_KEYS` — is untouched, and §10 keeps the tripwire armed for daily and shared chunks. ADR-0033's Rejected entry was arguing against shipping the tables *to name the daily reveal*; free play ships them *to generate*, and still never names.
- **CONTEXT.md's Motif row is rewritten, not appended to.** The row currently opens "Server-side only: never user-facing…" — appending a free-play sentence would leave the lead clause contradicting its own tail. The amended row (a living-doc edit `docs/agents/domain.md` permits, recorded by ADR-0046):

  > | **Motif** | — | An entry in the Nonogram picture library inside `packages/games`. Never user-facing: its name and id reach no client payload and are rendered nowhere; since ADR-0046/ADR-0047 the library rides the free-play chunk (generation needs the tables), while daily-route and shared chunks stay motif-free. |

### 6.5 What free play deliberately does not have

No `<ConclusionView/>` (it is daily-coupled: day state, chaining CTA, completion stamp — `conclusion-view.tsx` imports `day-state.ts`, which is behind the wall). No `<AdSlot/>` on the game screens (the daily play screens carry none either; the hub's two slots are untouched). No `use-pointer-stroke` changes — it is presentational input plumbing and free play reuses it through the boards. No push, no telemetry, no service worker.

---

## 7. The screens — states, design, i18n copy

Design is executed against the living system (`PRODUCT.md`, `DESIGN.MD`, `packages/ui/tokens.css`): paper on paper, hard single-color offset shadows, washi tape per game, static rotations, per-game accents via `accentVars(game)` (`play/accent.ts`) — Sudoku ink-blue, Nonogram terracotta, Binairo moss-green. Accent never colours text (ADR-0041). 44px touch targets. The free-play screens are the daily play screens' siblings, not a new dialect: same grid chrome, same board cards, same hint bar.

### 7.1 `/modo-livre` — the index

Masthead (wordmark, back to Hoje), a title block ("Modo livre" as the `h1`, Fraunces italic per the type system), a one-line lead that states the mode's contract in product voice, and **three game cards** — Binairo, Sudoku, Nonogram — each with its washi tape, accent, kicker and name reused from `messages.games.<game>` (`messages.ts` game sections), each a real `<Link>` to `freePlayRoutes[game]`. Termo has no card and no mention. Marker: `data-free-play="index"` on the `<main>` (§11.1).

### 7.2 The play composition, free-play variant

Reuses `screen.module.css`'s named-areas grid. Differences from the daily composition (`binairo/play-view.tsx:45-141` as reference):

- **Top bar:** back link targets `routes.freePlay` (not home); the date slot renders the mode label instead of a date (free play has no date); **no timer readout** in either position (D8).
- **Stats card:** row 1 = progress (the shipped `progressLong` copy), row 2 = "Nível" + the current level's label. Sudoku keeps its tier row semantics via the level itself.
- **Level picker:** three chips above the board area, `role="radiogroup"` with `aria-label` = "Nível", the active chip carried by geometry + ink (never accent-as-text, ADR-0041). Switching levels regenerates immediately (remount by key, §6.3).
- **Hint bar:** identical to the daily's two-state button (`play-view.tsx:110-119`).
- **CTA row:** "Mais um" appears on the solved card only (§7.3), not during play — abandoning mid-board is the level picker or back link.
- `data-play-state` marker: `"skeleton"` pre-hydration is not needed (no record to wait for — there is no D28 restore problem because there is no record); the static HTML and first client paint both show `data-play-state="generating"`, then `"playing"`, then the solved card's own marker. All values keep the `data-play-state=` grep satisfied (§11.1).

### 7.3 The solved card

In-place swap on `status === "solved"` (§6.2). A paper card in the game's accent: stamp-style "Resolvido!", the Nonogram's painted picture where applicable (name withheld, §6.4), then two actions — primary "Mais um" (fresh seed, same level), secondary "Voltar ao Modo livre" — and a quiet third link to Hoje. Marker: `data-play-state="solved"`. No elapsed time (D8), no completion language: **Conclusão** is a daily verb (CONTEXT.md) and never appears in free-play copy.

### 7.4 The generating and error states

- Generating: the board card at final dimensions (the `PlaySkeleton` discipline — reserve the boxes, blank the values, `binairo/play-view.tsx:179` onward) with a static line "Preparando o puzzle…". No spinner (D5.2).
- Error (Sudoku's 3-seed exhaustion, and the other games' generator errors, unreachable in practice but typed): a card with title, one-sentence body, and "Tentar de novo" re-running the effect with fresh seeds. Never an empty screen.

### 7.5 New strings in `messages.ts`

All new copy in a top-level `freePlay` section (shared-chrome position; game names/kickers reused from `games.<game>`, never duplicated — the plan 018 S19 rule). Composed accessible names live in the module, never joined at call sites (ADR-0018). Draft copy (Fernando owns final wording in the PR):

```
freePlay: {
  title: "Modo livre",
  lead: "Puzzles infinitos, gerados aqui no seu aparelho. Nada daqui conta para a sequência nem para as estatísticas.",
  backToIndexAria: "Voltar ao Modo livre",
  modeTag: "Modo livre",
  level: {
    label: "Nível",
    leve: "Leve",
    medio: "Médio",
    dificil: "Difícil",
    aria: (level: string) => `Nível: ${level}`,
  },
  generating: "Preparando o puzzle…",
  error: {
    title: "Não deu para gerar este puzzle.",
    body: "Aconteceu um imprevisto por aqui. Tente de novo — é tudo gerado no seu aparelho.",
    retry: "Tentar de novo",
  },
  solved: {
    stamp: "Resolvido!",
    again: "Mais um",
    backToIndex: "Voltar ao Modo livre",
    backHome: "Voltar para Hoje",
  },
},
```

The hub's existing `hoje.links.freePlay` (`messages.ts:154`) is reused untouched for the entry link.

---

## 8. The hub entry point

`apps/web/app/page.tsx:128-132` renders three href-less `<a>` elements. **Change exactly one:** "Modo livre" becomes `<Link className={styles.secondaryLink} href={routes.freePlay}>` — Arquivo and Estatísticas stay href-less anchors (their routes are #31 and #29/#31; a dead href is fake navigation, the shipped rule at `hub-day-state.tsx:91`). Visual delta is zero by design; the link inherits the existing `secondaryLink` style, and `impeccable detect` on `/` re-verifies the hub.

**The `free` grid row stays a spacer.** `screen.module.css:48` names a `free` area in the ≥1141px play-screen grid and `:266-268` documents it as an element-less 1fr spacer that pins the hint button to the sidebar's bottom. It is part of the **daily play screens'** layout, does not exist at ≤1140px, and putting a free-play promo inside the daily Sudoku screen would be cross-mode advertising inside a focused surface. The name is a coincidence; the handoff (024 §2) explicitly warns against reading it as a promise. Decision: untouched.

---

## 9. Proving the negatives

The evidence plan, per AC. Structure of every proof: **(instrument) + (positive control proving the instrument fires) + (honest residue named in §13)**. A test that asserts an absence passes against broken code unless the instrument is itself tested — this section exists so step 5 builds the controls with the features, not after them.

### 9.1 AC 1 — no free-play requests

**Instrument 1: the free-play ESLint wall.** A new config object in `eslint.config.mjs`, globbed to `apps/web/src/free-play/**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}` and `apps/web/app/modo-livre/**/*.<same>` (the shared `webWallExtensions`, `eslint.config.mjs:19`).

**The flat-config trap governs the whole design** (`eslint.config.mjs:292-298,347-354`): flat config REPLACES a rule's entire configuration per matching file — it never merges. Free-play files already fall inside wall object (1) (`:194-330`, all of apps/web) and wall object (2) (`:331-374`, src+app). A new object setting `no-restricted-imports`/`no-restricted-syntax` for free-play files therefore SILENTLY DELETES both existing walls for exactly those files unless it repeats them. So:

- Extract object (1)'s `patterns` and `paths` arrays and object (2)'s two table-name selectors into named module-level constants (the shape `webDynamicDbImport` etc. already model, `:23-73`), consumed by the existing objects **unchanged in effect** — a pure refactor whose no-op-ness the existing probe suite (`eslint-db-wall.test.ts`) already pins.
- The free-play object, placed **after** object (2), configures:
  - `no-restricted-imports`: the shared patterns + paths, **plus** groups banning by specifier and by relative-path shape: `**/play/sync`, `**/play/play-record`, `**/play/use-play-lifecycle`, `**/play/day-state`, `**/play/use-record-snapshot`, `**/play/conclusion-view`, `**/termo/guess-client`, `**/session/bootstrap`, `**/components/session-bootstrap` (the layout's actual mount point is `apps/web/src/components/session-bootstrap.tsx` — the bare `**/session/bootstrap` pattern does not match it; both are banned), `**/binairo/use-binairo-play`, `**/sudoku/use-sudoku-play`, `**/nonogram/use-nonogram-play`, `**/binairo/binairo-screen`, `**/sudoku/sudoku-screen`, `**/nonogram/nonogram-screen` (the daily hooks and screen roots reach `use-play-lifecycle`/`sync`/`conclusion-view`/`day-state` one hop in — `no-restricted-imports` is per-file, not transitive, so every known indirect door is named), `@miolos/db`, `@miolos/db/*` (all of db — stricter than the app-wide wall, which permits the wall-safe root entry; free play has no legitimate db surface at all), `@miolos/games/termo`, `@miolos/games/termo/*`, `**/packages/games/src/termo`, `**/packages/games/src/termo/**`. Message cites ADR-0011/ADR-0008/ADR-0046.
  - `no-restricted-syntax`: the four shared selectors (`:23-73`) + the two table-name selectors (`:359-371`) + one new `ImportExpression > Literal` selector whose regex alternates over the banned module shapes above (dynamic-import evasion; computed specifiers are already banned app-wide by `webComputedDynamicImport`, which the object repeats).

**Instrument 2: the zero-fetch session test.** Per game, a jsdom test in the `play-sync.test.ts:145-166` pattern: `vi.stubGlobal("fetch", vi.fn())`, render the free-play screen directly (no layout, so no session mint in frame — D3), drive a full **generate → play → solve → hint → "Mais um"** session with a pinned seed (the hooks accept an injectable `pickSeed` for determinism; the solution to key in comes from calling the generator with the same `{seed, weekday}` in the test — determinism is the proved engine invariant, ADR-0023), then `expect(fetchMock).not.toHaveBeenCalled()`.

**Positive controls:**
- Wall probes (T-LINT-S9…, §12): every banned import probed red **from a free-play fake path**, and the same import probed **clean from a daily path** (`apps/web/src/binairo/...`) — proving the ban is scoped, not accidentally global. Glob-construction probes at `apps/web/src/free-play/<file>` and `apps/web/app/modo-livre/<segment>/page.tsx` (the T-LINT-S3 analogue).
- **Replacement-regression controls, the ones this wall most needs:** a `@miolos/db/publishing` import probe and a `daily_puzzles` string-literal probe, both at free-play fake paths, must fire **with the pre-existing wall messages** — proving the new object repeated the old walls instead of replacing them with less.
- Fetch-instrument control: in the same test file, a deliberate `fetch("…")` in a helper (or rendering a component that fetches) shows the mock records calls — the instrument is live before the absence is trusted.

**No server rows** is carried by AC 2's argument (§9.2), since rows without requests would need an endpoint that does not exist.

### 9.2 AC 2 — streak, statistics distributions and medals untouched

There is no client-side streak arithmetic to protect: the hub's streak is hardcoded `0` (`app/page.tsx:82`), and no stats/streak/medal route exists in `apps/api/app` (§4 table). Server-side, the only mutation a play screen can cause is `POST /completions`, owned solely by `use-play-lifecycle.ts:231-246` + `sync.ts`. Client-side, the hub's "X de 4" and per-card chips read the `miolos:play:<game>:<date>` records through `day-state.ts`. So "untouched" decomposes into three proofs:

1. **No `POST /completions` is constructible from free play** — stated at its true strength: the wall bans the import graph's **named** doors, direct (`sync`, `use-play-lifecycle`) and the known indirect ones (the daily hooks, screen roots, `conclusion-view` — §9.1 instrument 1), but `no-restricted-imports` is not transitive, so an unnamed future door is possible in principle. The **closing instruments** are runtime: the zero-fetch session test shows no request of any kind, and the keyspace assertion (item 2) closes the local half.
2. **The `localStorage` keyspace is byte-identical across a free-play session** (T-WEB, §12): the test seeds a realistic daily record under `miolos:play:binairo:<today>` plus an unrelated key, snapshots ALL `{key: value}` pairs, runs the full free-play session of §9.1, and asserts deep equality of the entire keyspace — not merely "no new `miolos:play:*` keys", because D6's claim is *zero writes*, and the stronger assertion costs nothing. Positive control in-file: a helper that calls `writePlayRecord` visibly changes the snapshot, so an accidentally-frozen mock storage cannot fake the pass.
3. **No server rows, structurally:** the `completions` table is written by exactly one route (`apps/api/app/completions`), reached by exactly one client module (`sync.ts`), which free play cannot import (wall) and never calls (zero-fetch). `apps/api` has no diff in this PR (§1), so no new write path exists either. What this environment cannot do — count production rows before and after — is named in §13 with its substitute.

Medals do not exist yet in any form; the PR states this plainly rather than claiming a vacuous proof over absent code, and notes the standing obligations parked on #19/#29 (handoff 024 §5) are untouched by this ticket.

### 9.3 AC 3 — Termo does not appear in free play

Layered, from compile time outward:

1. **Type-level:** `FREE_PLAY_GAMES … satisfies readonly Exclude<Game, "termo">[]` (§6.1) and `freePlayRoutes: Record<FreePlayGame, Route>` (§5.2) — adding a Termo entry to either is a red typecheck, not a review catch.
2. **Set-equality test** (T-WEB): `FREE_PLAY_GAMES` equals `GAMES` minus `"termo"` exactly — derived from `@miolos/core`'s own `GAMES`, so a fifth game arriving forces a conscious decision here rather than a silent gap (the `T-LINT-S7` self-verifying-list pattern).
3. **Route absence** (T-WEB): `fs` assertion that `apps/web/app/modo-livre/` contains exactly `{page.tsx, binairo, sudoku, nonogram}` — the 404 for `/modo-livre/termo` is then Next's by construction (no segment, no route). The index-render test additionally asserts exactly three card links, none containing the string "Termo".
4. **Import wall:** `@miolos/games/termo` (+ deep path + dynamic literal) banned from free-play directories with probes (§9.1). The root barrel cannot leak it either — `packages/games/test/{binairo,termo}/exports.test.ts` already prove the barrel exposes no game content.
5. **Bundle:** the Termo answer markers `então`/`mamãe`/`época` stay **globally forbidden** in every chunk, free-play chunks included, and `zurro` (the validation-dictionary control) becomes **forbidden in every `/modo-livre*` route's first-load chunk set**, scanned per route and shared chunks included — a Termo library riding into a free-play page is a leak even though it is public content for `/termo`, and a scan over `freeOnlyChunks` alone would pass vacuously if webpack hoisted the dictionary into a chunk shared with `/termo` (§10.2).

### 9.4 AC 4 — offline once loaded

**Instrument:** the §9.1 session test re-run with `fetch` stubbed to **reject** (`vi.fn().mockRejectedValue(new TypeError("Failed to fetch"))` — the network-cut shape) rather than merely record: generate → play → hint → solve → "Mais um" must complete identically, and the rejecting mock must show zero calls (a call would surface as an unhandled rejection regardless). This proves the property that matters: no free-play code path *awaits the network*, cut or not.

**Positive control:** the same rejecting stub applied to a code path that does fetch (e.g. invoking `flushPendingCompletions` from the daily layer in a control test) demonstrably fails/records — the stub is not inert.

**Honest residue:** jsdom cannot prove a real browser's offline mode (no real network stack, no cache behavior). The step-8 ritual in §13 covers it in a real browser, and the PR reports it as a manual verification with its transcript, per the evidence rule.

### 9.5 AC 5 — design gates

Not a negative, but gated identically: §11.1 (impeccable × 4 URLs × 2 viewports with `--no-config` positive controls beside every local scan; `impeccable.yml` extended in its three lists), §11.2 (budgets). Contrast: `low-contrast`/`cream-palette` are wildcard-ignored in `.impeccable/config.json`, so **a green scan is not contrast evidence** (handoff 024 §5 re #51) — the level-picker chips and solved-card ink get hand-computed contrast arithmetic in the PR, the #25/#27 precedent.

---

## 10. The bundle-check rework — route-scoped markers (ADR-0047)

### 10.1 Why the current script fails by design after #28

`route-client-js.mjs:297-312` greps every `.js` under `.next/static/chunks` for one global `FORBIDDEN` list (`:175-189`). Free play legitimately ships, in free-play chunks only: the four motif names + `sitting-cat` (motif library data — `generateNonogram` needs the tables), and `motifId`/`givensCount`/`requiredTier`/`clueCount` (property keys of generator outputs; they survive minification because they are accessed by name). The guarantee to preserve is unchanged: **daily-route and shared chunks still carry none of them** — ADR-0033, its bundle clause amended-and-narrowed by ADR-0047 (§6.4, Appendix B), binds for the daily; the daily wire and daily bundles are exactly as forbidden as before.

### 10.2 The new semantics

**Chunk attribution** (from `route-bundle-stats.json`, the file Next emits on every build, `:9-16`):

- `dailyChunks` = union of `firstLoadChunkPaths` over every route **not** under `/modo-livre` (this automatically includes `/`, the eight daily URLs, and anything future that isn't free play — new routes are daily-strict by default).
- `freeOnlyChunks` = union over `/modo-livre*` routes, **minus** `dailyChunks` — a chunk shared with any daily route is daily-scope, period.
- `unattributedChunks` = everything on disk in neither set (lazy chunks, runtime slices) — scanned as **daily scope, fail closed**.

**Marker scopes:**

| Set | Members | Scanned against |
|---|---|---|
| `FORBIDDEN_EVERYWHERE` | `então`, `mamãe`, `época` (Termo answer canonicals) | every chunk — unchanged from today, now with free-play chunks explicitly in scope |
| `FORBIDDEN_DAILY_SCOPE` | `Escada`, `Borboleta`, `Caranguejo`, `Flamingo`, `sitting-cat`, `motifId`, `reveal.solution must be size x size`, `givensCount`, `requiredTier`, `clueCount` | `dailyChunks ∪ unattributedChunks` |
| `FORBIDDEN_FREE_PLAY_SCOPE` | `zurro` | **each `/modo-livre*` route's `firstLoadChunkPaths`, directly** — every chunk in a free-play route's first-load set, shared with `/termo` or not. NOT `freeOnlyChunks`: if free play imported `@miolos/games/termo`, webpack may hoist the dictionary into a chunk shared with `/termo`; that chunk lands in `dailyChunks`, `freeOnlyChunks` never contains `zurro`, and the derived-set scan stays green — vacuously. The per-route scan closes that door. In `/termo`'s own first-load set it remains **expected** |
| `EXPECTED_DAILY_SCOPE` | the five existing `EXPECTED` markers (`:211-217`), unchanged | `dailyChunks` |
| `EXPECTED_FREE_PLAY_SCOPE` | at least one motif name (e.g. `Escada`) and `givensCount` | `freeOnlyChunks` |

### 10.3 Why the positive controls stay meaningful

The elegance the rework must keep: **the same string is red in one scope and required in the other.** `Escada` forbidden in daily scope + expected in free-play scope means (a) the attribution actually separates the two sets — if free-play chunks were mis-attributed into `dailyChunks`, the forbidden side reds immediately; if the free-play set were empty or unscanned, the expected side reds; (b) the marker still exists in the library — additionally pinned by `packages/games/test/nonogram/bundle-markers.test.ts`, unchanged. `zurro` plays the same double role for Termo (expected in the `/termo` first-load set, forbidden in every `/modo-livre*` first-load set), but its forbidden side is scanned **per route rather than over the derived `freeOnlyChunks`** — a hoisted chunk shared with `/termo` would otherwise remove it from the derived set and the scan would pass without ever looking (§10.2). The five `EXPECTED_DAILY_SCOPE` markers keep proving the daily scan reaches both `apps/web` copy and `packages/games` code, exactly as the current header argues (`:191-209`).

A structural sanity check is added: the script fails (exit 2) if `freeOnlyChunks` is empty or if any `/modo-livre*` route is missing from the stats — a build shape change must be loud, not a silently-vacuous scope.

### 10.4 Budgets

`BUDGETED` (`:119`) gains the four free-play routes. Ceilings per D12: measured at step 8 + ~10%, `/modo-livre/nonogram` with a justified `PER_ROUTE_BUDGET` entry in the `/termo` mold (`:93-117`), and an explicit comment that the shared 40KB default is untouched **because it is what arms the daily motif tripwire**. The script stays hand-run at step 8 with output pasted in the PR — its header's reasoning for staying out of CI (`:66-73`, hard-coded product copy reds builds on copy edits) is not changed by this ticket; considered and declined again, recorded here so the PR can cite it.

### 10.5 Library-side pins

`packages/games/test/nonogram/bundle-markers.test.ts` and `test/termo/bundle-markers.test.ts` keep their exact assertions (the markers must exist in `MOTIFS` / spell answers). Their header comments cite the script's old global semantics ("must appear in 0 client chunks"); if the wording pins globality, it is updated to name the scopes — a comment-only diff, flagged in §1 as one of the two permitted `packages/games` touches.

---

## 11. Gates and CI

### 11.1 impeccable — three lists, four URLs, markers

`.github/workflows/impeccable.yml` changes in the three places its own comment demands stay in step (`:65`):

1. **Preflight loop** (`:76`): add `"/modo-livre" "/modo-livre/binairo" "/modo-livre/sudoku" "/modo-livre/nonogram"`. Case arm additions: `"/modo-livre") marker='data-free-play='` before the catch-all; the three game paths fall through to the existing `data-play-state=` arm, which their static generating shell renders (§7.2).
2. **Desktop detect** (`:143-154`) and 3. **mobile detect** (`:163-174`): the same four URLs appended to both invocations.

Locally at step 8: one URL per invocation from the repo root, each beside its `--no-config` positive control (the silent-green trap, handoff 024 §3).

### 11.2 The mechanical gate, with the ritual

Per `CLAUDE.md` and handoff 024 §7, outputs pasted in the PR:

```
rm -rf apps/web/.next && pnpm typecheck   # ALWAYS the rm first (stale .next/types)
pnpm lint
pnpm test
pnpm build
cd apps/web && pnpm bundle-check          # from apps/web, NOT the root (silent exit-0 trap)
npx impeccable detect <each new URL> --viewport 1440x900   # repo root, one URL + control each
npx impeccable detect <each new URL> --viewport 390x844
```

Every node/pnpm/npx command behind `source ~/.nvm/nvm.sh && nvm use default >/dev/null`. Pre-commit never bypassed. CI's `gate` job (typecheck/lint/test/build) needs no workflow change; only `impeccable.yml` is edited.

---

## 12. Test plan and reserved ids

Frontier at `166767a` (re-derive by grep before allocating, and again at step 8): T-CORE next S25 · T-DB next S13 · T-API next S46 · T-WEB next **S109** · T-LINT next **S9**. This plan reserves **T-WEB-S109…S124** and **T-LINT-S9…S20** (contiguous; S17/S18 carry the indirect-door probes, S19–S20 are the headroom); unused tail numbers burn per `docs/agents/test-ids.md`. No T-CORE/T-DB/T-API ids: those packages have no diff. `packages/games` gets no tests because it gets no changes. `apps/web` ids go on `describe(...)` — the shipped convention there (`test-ids.md:5`).

**New file `apps/web/test/eslint-free-play-wall.test.ts`** — real ESLint instance over in-memory probes at fake paths, the `eslint-db-wall.test.ts` architecture:

| Id | Assertion |
|---|---|
| T-LINT-S9 | Static imports of `play/sync`, `play/play-record`, `play/use-play-lifecycle`, `play/day-state`, `play/use-record-snapshot` red from `apps/web/src/free-play/x.ts`; the same specifiers clean from `apps/web/src/binairo/x.ts` (scope control) |
| T-LINT-S10 | `termo/guess-client` and `session/bootstrap` red from free-play paths, clean from daily paths |
| T-LINT-S11 | `@miolos/db` root entry red from free-play paths (clean app-wide elsewhere — the stricter-than-global assertion) |
| T-LINT-S12 | `@miolos/games/termo` red: bare, deep relative (`packages/games/src/termo/...`), and dynamic-literal forms; `@miolos/games/binairo` clean from the same path (control) |
| T-LINT-S13 | Glob construction: probes at `apps/web/app/modo-livre/binairo/page.tsx` fire the same wall |
| T-LINT-S14 | **Replacement regression:** `@miolos/db/publishing` from a free-play path still reds with the DB-wall message (`eslint.config.mjs:224`) |
| T-LINT-S15 | **Replacement regression:** `daily_puzzles` literal + template forms from a free-play path still red (block-2 selectors carried over) |
| T-LINT-S16 | Dynamic-import evasions of the free-play bans (literal specifier) red; `import("./local")` clean |
| T-LINT-S17 | **Indirect doors:** `binairo/use-binairo-play`, `sudoku/use-sudoku-play`, `nonogram/use-nonogram-play`, the three `*-screen` roots, and `play/conclusion-view` red from free-play paths; the same specifiers clean from daily paths (scope control) |
| T-LINT-S18 | `components/session-bootstrap` red from free-play paths — the layout's actual mount point, which the bare `session/bootstrap` pattern does not match — clean from a daily path |
| S19–S20 | Reserved headroom for review-round probes |

**`apps/web/test/free-play-catalog.test.ts`:**

| Id | Assertion |
|---|---|
| T-WEB-S109 | `FREE_PLAY_GAMES` set-equals `GAMES` minus `termo` (control: `GAMES` has four members); `LEVEL_WEEKDAYS` values are `{1,4,7}` |
| T-WEB-S110 | `pickSeed` draws from `crypto.getRandomValues` (stubbed to a sentinel, returned value proves the source) and yields a uint32 |

**`apps/web/test/free-play-routes.test.tsx`:**

| Id | Assertion |
|---|---|
| T-WEB-S111 | `routes.freePlay*` literals compose from `routeSlugs`; `freePlayRoutes` covers exactly the three grid games |
| T-WEB-S112 | `app/modo-livre/` directory listing is exactly `{page.tsx, binairo, sudoku, nonogram}` — no termo segment exists |
| T-WEB-S113 | The index renders three links (to the three `freePlayRoutes` values), its marker, and no occurrence of "Termo" |
| T-WEB-S114 | The hub renders "Modo livre" as a real link to `routes.freePlay`; Arquivo/Estatísticas remain href-less |

**Per-game screen suites** (`free-play-binairo.test.tsx`, `free-play-sudoku.test.tsx`, `free-play-nonogram.test.tsx`):

| Id | Assertion |
|---|---|
| T-WEB-S115 | Binairo: full pinned-seed session (generate → play → hint → solve → Mais um regenerates with a new seed) with `fetch` stubbed: **zero calls**; in-file instrument control |
| T-WEB-S116 | Binairo: same session with `fetch` rejecting (network cut): completes identically (AC 4) |
| T-WEB-S117 | **Keyspace:** `localStorage` deep-equal before/after the full session, seeded with a daily record + unrelated key; control: a `writePlayRecord` call visibly changes the snapshot |
| T-WEB-S118 | Sudoku: generating state renders at final dimensions with the marker; injectable generator throwing `SudokuGenerationError` twice → third seed succeeds; three throws → error card whose retry regenerates |
| T-WEB-S119 | Sudoku: zero-fetch + solve (pinned easy seed, weekday 1) swaps to the solved card; no timer rendered anywhere |
| T-WEB-S120 | Nonogram: zero-fetch solve — the test derives its inputs from the generator's `reveal.solution`, converting the `boolean[][]` grid to the reducer's flat 0/1 marks (the state's own `solution` is clue-derived via `solutionMarks`, `state.ts:116-124`; `reveal` never enters the hook); solved card shows the picture and **never** `reveal.name`/`motifId` text |
| T-WEB-S121 | Level switch remounts: entries reset, new puzzle matches `LEVEL_WEEKDAYS[level]` (e.g. Nonogram size 5→10→15 across the three levels) |
| T-WEB-S122 | Hint parity: one free hint fires (`nextHint` against the generator solution for Binairo/Sudoku; Nonogram via its bare `use-hint` verb, D7), second press inert, `aria-disabled` set |
| S123–S124 | Reserved headroom |

**Existing suites touched:** `route-ssr.test.tsx`'s `T-WEB-S56` ROUTES table gains the four free-play rows (marker + no-function-across-RSC-boundary) — inside the existing describe, **no new id**, the `T-WEB-S100` burn precedent (`test-ids.md:71`). #75's totalisation is covered by the existing hub/conclusion suites going green on the new types; any comment-level id references to the dead branches are updated, not renumbered.

---

## 13. What cannot be verified in this environment

Stated per the evidence rule, with the honest substitute for each; the PR repeats this list rather than letting a green suite imply otherwise.

| Cannot do here | Substitute, and who does the real thing |
|---|---|
| A real browser's Network tab showing no free-play requests | jsdom zero-fetch suites (S115/S119/S120) + the ESLint wall; **step-8 ritual** on the local `next start` build (handoff 024 §3 recipe): open each free-play route with DevTools Network open on the **Fetch/XHR filter**, play a full puzzle, screenshot showing the load-time session mint and nothing else — the unfiltered tab also shows document/chunk/font/RSC-payload rows, which are the page load itself, not fetches, and the ritual says so rather than promising an impossibly empty tab. Transcript pasted in the PR |
| A real offline toggle | Fetch-rejecting harness (S116); step-8 ritual: DevTools → Network → Offline after load, complete a puzzle per game, "Mais um" included |
| Production/Neon `completions` row counts before and after | Structural proof (§9.2 item 3: only one writer route, only one client caller, both walled off, `apps/api` diff empty). No production DB access from this environment, and none is needed for the argument to close |
| impeccable against the real preview | Local scans against `next start` at step 8 with `--no-config` controls; CI's `detect` job runs on the Vercel preview after push — its two runs (per-project) checked per handoff 024 §7 |
| A screen-reader pass (VoiceOver/NVDA) | jsdom role/name/aria assertions only. The real pass is already an owed, tracked debt (handoff 024 §6); free play adds the level picker and solved card to its surface, noted in the PR |
| Generator timing on low-end phones | Dev-machine timings only (§4); the D5 skeleton is the mitigation, the §15 worker escalation the contingency |

---

## 14. Out of scope

- **Shareable seed links / "challenge a friend"** — ADR-0011 notes them as future, not scheduled. D4 keeps `{seed, weekday}` in state so nothing forecloses them; no URL, UI or copy ships.
- **Archive (`/arquivo`, #31) and statistics (`/estatisticas`, #29)** — their hub anchors stay href-less (§8).
- **#74, #76, #78** — #27 follow-ups and the ADR-citation checker; untangled from this ticket.
- **#63, #67** — a11y/polish on the **shared** play layer. Free play inherits both surfaces by reusing `screen.module.css` (noted for #67: the free-play screens do render into `grid-area: hint`, so its empty-row concern does not newly bite here); fixing them is their own tickets.
- **Free-play persistence** (D6), **timer** (D8), **extra-hint affordances** (D7) — decided out, each with its recorded reversal cost.
- **Service worker / PWA / any caching work** — AC 4 is "page loaded, network cut", nothing more.
- **A free-play Termo of any kind** — project invariant, not a backlog item.
- **Adding bundle-check to CI** — considered and declined again (§10.4).

---

## 15. Deviation / risk register

What could force a plan change at step 5, and the pre-agreed response:

1. **Next merges free-play-only code into a chunk shared with daily routes** (attribution collapse: motif tables land in `dailyChunks` and the daily-scope grep reds — correctly). Response: this is the tripwire working; fix the split (verify only `app/modo-livre/nonogram/page.tsx`'s tree imports `@miolos/games/nonogram`'s generator path), or as escalation isolate the generator import behind route-level boundaries. Never respond by moving the marker's scope.
2. **`route-bundle-stats.json` route naming for nested segments** differs from the literal `/modo-livre/binairo` shape. Response: read the actual keys on the first build and match the script's route filters to them; the §10.3 exit-2 sanity check turns a mismatch into a loud failure, not a vacuous scan.
3. **Sudoku Difícil (weekday 7 / tier 5) generation proves slow enough to feel broken on a phone.** Response ladder: lower `maxAttempts` per seed and lean on the 3-seed retry (more, cheaper slices); if still bad, ADR-0046 amendment mapping Difícil to weekday 6; the Web Worker remains the named last resort, its costs already argued in D5.3.
4. **The ESLint constant extraction ripples** — the shared-constant refactor of wall objects (1)/(2) disturbs `eslint-db-wall.test.ts` expectations (message strings must stay byte-identical). Response: the extraction moves arrays, never edits messages; if a probe reds, the refactor is wrong, not the probe.
5. **Reducer reuse leaks a daily assumption** — some reducer path free play exercises turns out to consult `date`/timer semantics in a way that shows (e.g. a nonogram solved-derivation edge). Response: fix in the free-play hook, never by forking a reducer; if a reducer genuinely needs a change, it is a step-3-style stop — the daily suites own that behavior.
6. **`satisfies` + `as const` interplay** on `FREE_PLAY_GAMES` mis-infers under the current TS version. Response: fall back to an explicit `readonly ["binairo","sudoku","nonogram"]` annotation with an `Exclude`-typed assignment check beside it; the set-equality test (S109) carries the runtime half regardless.
7. **impeccable findings on the new screens.** Response: fix within the Ateliê system (tokens, existing patterns); a finding suppressed in `.impeccable/config.json` requires the #25/#27-style written justification in the PR.
8. **Step-8 budget measurements far off D12's provisional expectations** (e.g. free-play sudoku > 55KB). Response: investigate what rode along before setting the ceiling — a budget is calibrated to the intended content, never to whatever shipped.

---

## 16. Commit and PR plan

One branch, `feat/28-free-play-on-the-grid-games`. Commit sequence (each green under pre-commit — lint-staged + typecheck + tests):

1. `refactor(web): totalise playRoutes to Record<Game, Route> (#75)` — §5.1, mechanical, its own reviewable boundary.
2. `feat(web): free-play catalog, typed routes and the hub link` — §6.1, §5.2, §5.3 (index page), §7.1, §7.5 strings, tests S109–S114.
3. `feat(web): free-play Binairo, Sudoku and Nonogram screens` — §6.2–6.4, §7.2–7.4, tests S115–S124. Step 5 may split this across three parallel subagents (one game each — the seams are per-game files with no overlap) landing as one commit or three sibling commits.
4. `feat(lint): the free-play import wall, with probes` — §9.1, tests T-LINT-S9…S18.
5. `feat(web): route-scoped bundle markers and free-play budgets` — §10, plus the two library-side comment touches if needed (§10.5).
6. `ci: extend impeccable preflight and detect to the free-play routes` — §11.1.
7. `docs: ADR-0046, ADR-0047, CONTEXT.md motif amendment, test-id frontier` — appendices A/B as real files; the one-line amendment pointer added to `docs/adr/0033-the-nonogram-reveal-ships-no-name.md` naming ADR-0047 as the amender of its bundle clause (§6.4); `docs/agents/test-ids.md`'s LINT area definition (`test-ids.md:13`) widened from the single file `apps/web/test/eslint-db-wall.test.ts` to cover both wall suites (e.g. "the `apps/web/test/eslint-*-wall.test.ts` suites") — without this, the new `eslint-free-play-wall.test.ts` ids would sit outside their own area's definition; frontier re-derived by grep, never from memory (`test-ids.md:26,48`).

**PR description** (per CLAUDE.md): what changed; every gate's real output inline (§11.2 list); the §13 cannot-verify table with the manual-ritual transcripts; the three product decisions Fernando may override (D2 levels/mapping, D7 hint, D8 no-timer) each with its reversal cost — explicitly framed as non-blocking; closes #28 **and** #75.

Step 6 runs the six standard lenses in parallel; reviewers default to rejecting; dismissals in writing. Step 8 merges only on all-green with output shown, then closes both issues and **M2**.

---

## 17. Exit criteria — mapped to handoff 024 §8

| Handoff 024 §8 says | Discharged by |
|---|---|
| All five ACs met, each with a machine-checkable proof — especially the three negatives | §9's instruments + controls; §12's suites; §10's scoped markers |
| `pnpm typecheck` / `lint` / `test` / `build` / `bundle-check` green, counts pasted | §11.2 ritual, outputs in the PR |
| impeccable green on every new route at both viewports, positive control beside each scan, `impeccable.yml` extended | §11.1 |
| Step-6 review closes on an empty blocking/high pass, dismissals written down | §16 |
| `test-ids.md` frontier re-derived by grep at step 8 | §16 commit 7 |
| M2 closed | §16 — the merge closes #28 (+#75), and #28 is M2's last ticket |

---

## Appendix A — Draft ADR-0046 (to be created as `docs/adr/0046-free-play-routes-levels-and-the-ephemeral-session.md`)

```markdown
# ADR-0046 — Free play: three routes, a level picker over the weekday ramps, an ephemeral session

**Status:** Proposed — 2026-08-12 (issue #28)
**Depends on:** ADR-0011, ADR-0008, ADR-0005, ADR-0013, ADR-0019

## Context

ADR-0011 decided free play is generated in the browser from a client-picked
seed, with no endpoint and nothing recorded. It deliberately left open the
product surface: routes, how difficulty is expressed (the engines have no
free-play difficulty concept — their only axis is the ISO weekday ramp,
Monday easiest through Sunday hardest, in all three grid games), whether a
session persists, and what daily furniture (timer, hints, conclusion)
transfers. Termo is excluded by project invariant (ADR-0005/ADR-0015).

## Decision

1. **Routes:** `/modo-livre` (index) plus literal per-game segments
   `/modo-livre/{binairo,sudoku,nonogram}` (pt-BR slug per ADR-0013; game
   names are untranslated proper nouns). Literal, not dynamic: typed routes
   stay literal types, and the route boundary is what carries ADR-0011's
   per-game code-splitting. No `/modo-livre/termo` segment exists; the 404
   is by absence. The pages are static — they fetch nothing.
2. **Difficulty is a three-level picker** — Leve / Médio / Difícil — mapped
   to weekdays **1 / 4 / 7**, the ramp's endpoints and middle. The picker
   lives on each game screen (default Médio), not in the URL, keeping the
   pages static and level switches offline-instant.
3. **The client picks one uint32 seed per puzzle** via
   `crypto.getRandomValues`. "Mais um" draws a fresh seed at the same
   level. No seed is user-visible in v1; the state keeps `{seed, weekday}`
   so ADR-0011's noted-not-scheduled shareable links stay one rendering
   away.
4. **A free-play session is ephemeral.** Nothing is written to
   `localStorage` — no reuse of the daily `miolos:play:*` namespace and no
   new namespace. Reload regenerates. Puzzles are infinite; nothing scarce
   is lost, and zero-writes is the strongest provable form of "records
   nothing" on the client.
5. **One free hint per puzzle, computed client-side** from the generator's
   own solution (ADR-0027's mechanism). No extra-hint affordance: hint
   grants are day-scoped server rows (ADR-0006) and free play never
   touches that system.
6. **No timer.** A clock measures a value free play has nowhere to put.
7. **No conclusion screen and no daily chaining.** Solving swaps, in
   place, to a solved card offering "Mais um".
8. **The root layout's `POST /session` is unchanged** on free-play routes:
   it is route-agnostic identity bootstrap, not a free-play request. The
   "no free-play requests" guarantee is: zero requests originate from any
   free-play module.

## Rejected

- **Seven-weekday difficulty UI:** exposes an internal axis as seven
  labels nobody asked for.
- **Random weekday per puzzle:** difficulty roulette.
- **A persistence namespace:** schema/versioning/pruning machinery for a
  convenience, purchased by weakening the cleanest negative proof.
- **Suppressing the session mint on free-play routes:** layout surgery to
  hide a request every other route makes.

## Consequences

- The Nonogram motif library (curated pt-BR names included) ships in the
  free-play nonogram chunk — generation needs the tables. The names remain
  **non-user-facing everywhere**: the solved card shows the painted
  picture, never `reveal.name`. ADR-0033's payload and response
  guarantees are unaffected; its bundle clause is amended and narrowed to
  daily-route and shared chunks by ADR-0047, whose route-scoped tripwire
  keeps daily chunks as forbidden as ever. CONTEXT.md's Motif row is
  rewritten accordingly.
- Free play never touches streak, statistics distributions or medals
  (ADR-0008 rule 5) — enforced by an ESLint wall around the free-play
  directories banning the sync/record/lifecycle/session/db/termo modules,
  with probe tests.
- Sudoku generation runs on the main thread with a generating state and a
  fresh-seed retry ladder on exhaustion; a Web Worker is the named
  escalation, not the default.
```

## Appendix B — Draft ADR-0047 (to be created as `docs/adr/0047-bundle-markers-are-route-scoped.md`)

```markdown
# ADR-0047 — Bundle markers are route-scoped: forbidden-everywhere vs forbidden-in-daily-scope

**Status:** Proposed — 2026-08-12 (issue #28)
**Depends on:** ADR-0033, ADR-0011, ADR-0046
**Amends:** [ADR-0033](./0033-the-nonogram-reveal-ships-no-name.md) — decision 1's *"not by shipping the motif library into the bundle"* clause narrows to daily-route and shared chunks, and consequence (d)'s premise that no motif name may reach `apps/web` narrows likewise; the payload and completion-response guarantees, and `FORBIDDEN_DAILY_KEYS`, are not touched. Its Rejected entry on shipping the motif tables stays rejected for what it argued — naming the daily reveal client-side; free play ships the tables to generate, never to name.

## Context

`apps/web/scripts/route-client-js.mjs` greps every client chunk for one
global forbidden list (motif names, server-only schema keys, Termo answer
words), with expected markers proving the scan looks at the right files.
ADR-0011/ADR-0046 put the generators in the browser for free play, so
free-play chunks now legitimately contain motif names and generator output
keys (`givensCount`, `requiredTier`, `clueCount`, `motifId`). A global
scan therefore fails by design — while the guarantee it protects (no
withheld daily content in daily-route or shared chunks; ADR-0033) must
not weaken by a byte.

## Decision

Chunks are attributed from Next's own `route-bundle-stats.json`:
**daily-scope** (first-load chunks of every non-`/modo-livre` route),
**free-play-only** (free-play first-load chunks minus daily-scope), and
**unattributed** (on disk, in neither — scanned as daily scope, fail
closed). Markers carry a scope:

- **Forbidden everywhere:** Termo answer canonicals (`então`, `mamãe`,
  `época`).
- **Forbidden in daily scope** (daily + unattributed): motif names,
  `sitting-cat`, `motifId`, `givensCount`, `requiredTier`, `clueCount`,
  the reveal refine message.
- **Forbidden in any free-play route's first-load set:** `zurro` —
  scanned over each `/modo-livre*` route's `firstLoadChunkPaths`
  directly, shared chunks included, never over the derived free-play-only
  set: a Termo import from free play could be hoisted into a chunk shared
  with `/termo`, which the derived set excludes by construction, and the
  scan would pass vacuously. The dictionary in any free-play first-load
  set means `@miolos/games/termo` leaked there; in `/termo`'s own chunks
  it remains expected.
- **Expected in daily scope:** the five existing controls, unchanged.
- **Expected in free-play scope:** at least one motif name and one
  generator key — the SAME strings the daily scope forbids, so a broken
  motif attribution reds one side or the other. The `zurro` check earns
  the same non-vacuousness differently — by scanning per-route first-load
  sets rather than a derived set that hoisting could empty.

The script exits non-zero if the free-play chunk set is empty or a
free-play route is missing from the stats: a vacuous scope is a failure,
never a pass. A chunk shared between a daily route and a free-play route
is daily-scope, period — sharing withheld-content code with a daily route
is the defect, not an attribution nuance.

## Rejected

- **Raising the shared budget / trimming the forbidden list:** un-arms the
  motif tripwire for the three daily grid routes — the only thing it
  exists for.
- **Per-chunk allowlists by filename:** chunk names are build artifacts;
  route attribution is the stable identity.

## Consequences

- ADR-0033 is amended as headed above and continues to bind everywhere
  else, enforcement now scoped: daily chunks are exactly as forbidden as
  before, and free play's legitimate content cannot mask a daily leak.
  ADR-0033's own file gains the reciprocal amendment pointer.
- New routes are daily-strict by default (attribution is "everything not
  under /modo-livre"), so forgetting to classify a future route fails
  closed.
- The library-side marker pins (`packages/games/test/*/bundle-markers.test.ts`)
  are unchanged: markers must keep existing on both sides of every grep.
```
