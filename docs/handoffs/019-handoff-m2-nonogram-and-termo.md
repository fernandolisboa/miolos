# Handoff — M2: the daily Nonogram (#25) and the daily Termo (#27)

**To:** the session that continues M2 after #23.
**From:** the session that built #23 (daily Sudoku end to end), on branch `feat/23-daily-sudoku-end-to-end`, PR [#60](https://github.com/fernandolisboa/miolos/pull/60).
**Next step:** the mandatory eight-step flow in `CLAUDE.md`, on **[#25](https://github.com/fernandolisboa/miolos/issues/25) first** — it blocks [#27](https://github.com/fernandolisboa/miolos/issues/27), and #27 blocks #29, #31 and #35.

This is a point-in-time snapshot, not a living spec. Where it and an ADR disagree, the ADR wins.

---

## 0. Check this before you read anything else

**As of writing, PR #60 is OPEN and not merged.** `gate` is green (typecheck 6/6, lint exit 0, `pnpm test` 703 passed — ui 3 · core 82 · db 40 · web 297 · api 103 · games 178). The `Impeccable / detect` run was red at the last poll and is being worked through the step-6 review loop.

Run `gh pr view 60 --json state,mergedAt` before assuming anything. If it merged, `main` already contains everything section 3 describes. If it did not, **finish it first** — #25 is defined as "at parity with Binairo and Sudoku", and there is no parity to reach against an unmerged shape.

---

## 1. Scope

Two issues, both `ready-for-agent`, in this order.

### #25 — M2: Daily Nonogram end-to-end
Blocked by #23 and #24 (engine, shipped). Acceptance criteria, verbatim:

- Production buffer holds validated future-dated Nonogram dailies behind the predicate helper
- The picture-reveal moment lands within the design system's contained-celebration rules; screen passes `npx impeccable detect`
- Completion recorded once with on-time derivation; hub, conclusion, rules blurb, hint, timer, offline sync at parity

### #27 — M2: Daily Termo end-to-end
Blocked by #25 and #26 (engine + word list, shipped). Acceptance criteria, verbatim:

- The day's answer comes from the curated list only after the harness gate; the answer never reaches the client before completion beyond normal gameplay feedback
- Accent-free input matches accent-insensitively; canonical accented form revealed at the end
- Rejected guesses show "não está na lista"; accepted guesses come from the validation dictionary
- A six-guess loss is recorded as played (fail row), completes nothing, and never counts toward streak or Dia Perfeito — covered at the `apps/api` seam
- Screen designed against the design system, passes `npx impeccable detect`; hub tile live; all four dailies now playable

---

## 2. Read first, in this order

1. `CLAUDE.md` — the eight steps and the mechanical gate. Not optional, and eight is the floor.
2. `CONTEXT.md` — the vocabulary. Use it in issue titles, test names and TSDoc; do not drift to synonyms.
3. **Every file under `apps/web/src/play/`.** Section 3 below is a map, not a substitute. Read `use-play-lifecycle.ts` and `sync.ts` in full — the TSDoc in both carries findings that cost three review rounds.
4. `docs/adr/0029` (the shared layer), `0030` (roving focus), `0031` (per-device day state) — all three written this session, all three constrain you.
5. `docs/adr/0004` (nothing unpublished reaches the client), `0008` (`lost` is Termo-only; a lost Termo is *played*, never *completed*), `0015` (the Termo word list), `0021` (the Nonogram motif library), `0024` (the strip table and fail-closed dispatch), `0026` (write-once completions, on-time derived), `0027` (the hint is client-computed — **and why that does not transfer to Termo**), `0028` (routes and the conclusion), `0019` (one subpath export per game in `packages/games`).
6. `docs/plans/018-issue-23-plan-daily-sudoku-end-to-end.md` — §5 the reuse architecture, §18 the three ADRs as specified, §19 the 25 landmines, §20 the 48 review dispositions.
7. `docs/plans/017-issue-18-plan-play-the-daily-binairo.md` §19/§20 — the 30 findings #18 paid for. They are encoded in the bodies you are about to reuse. Do not tidy them.
8. `apps/web/src/sudoku/` end to end. It is the worked example of "what a game supplies". Then `apps/web/src/binairo/` for the second data point.
9. `packages/games/src/nonogram/index.ts` and `packages/games/src/termo/index.ts` — the engines you are wiring.
10. `content/termo/README.md` — provenance, licences, and the constraints the list was built under.

---

## 3. The shared layer: `apps/web/src/play/`

Fourteen files, ~2 400 lines, extracted from `src/binairo/` in its own green commit before any Sudoku code existed. This is its real exported surface as of this writing.

| Module | Exports |
|---|---|
| `types.ts` | `PlayCore` — `{ date, timer, status: "playing"\|"solved"\|"lost", pendingSync, now, hydrated }`; `HintState` — `{ free: 1, used, lastIndex }`; `LifecycleAction` — `restore \| tick \| pause \| resume`; `ConclusionCopy` — `{ title, kicker, stampAria(elapsed, hints), notYet: { title, cta } }` |
| `timer.ts` | `TimerState` `{ accumulatedMs, runningSince }`; `TimerAction`; `elapsedMs(timer, now)`; `applyTimerAction(timer, action)` |
| `play-record.ts` | `ELAPSED_CAP_MS`; `playRecordKey(game, date)`; `binairoPlayRecordSchema` / `BinairoPlayRecord`; `sudokuPlayRecordSchema` / `SudokuPlayRecord`; `playRecordSchema` (a `z.discriminatedUnion("game", …)`) / `PlayRecord`; `readPlayRecord(game, date)`; `writePlayRecord(record)`; `listPendingRecords()`; `prunePlayRecords(keepDate)` |
| `sync.ts` | `flushPendingCompletions(record?)`; `startCompletionSync(): () => void` |
| `grid-hint.ts` | `Hint<T>` `{ index, value, kind: "correction" \| "fill" }`; `nextHint<T>(solution, givens, entries): Hint<T> \| null` |
| `progress.ts` | `countFilled(givens: readonly (number\|null)[], entries: readonly (number\|null)[]): number` |
| `use-play-lifecycle.ts` | `PlayLifecycle<S extends PlayCore>`; `usePlayLifecycle<S extends PlayCore>({ game, state, reduce, dispatch, buildRecord, persistDeps }): void` |
| `use-record-snapshot.ts` | `RecordSnapshot` (`{hydrated:false} \| {hydrated:true, record}`); `subscribeToPlayRecords(cb)`; `useRecordSnapshot(game, date)` |
| `day-state.ts` | `DayEntry` `{ concluded, elapsedMs: number \| undefined }`; `readDayState(date): Readonly<Record<Game, DayEntry>>`; `doneCount(state)`; `useDayState(date)` |
| `accent.ts` | `accentVar(game): string` — returns `var(--accent-<game>)`; all four are already in `packages/ui/tokens.css` (`--accent-nonogram: #B5563C` terracotta, `--accent-termo: #C08A1E` mustard) |
| `conclusion-view.tsx` | `ConclusionResult` `{ elapsedMs, hintsUsed }`; `ConclusionView({ game, date, copy: ConclusionCopy, result? })` |
| `timer-readout.tsx` | `TimerReadout({ elapsedMs, className? })` |
| `screen.module.css` | The shared play layout. Every accent is `var(--accent)`, set inline on the screen root. Four per-game values are custom properties with Binairo's values as fallbacks: `--grid-card-rot`, `--stats-card-rot`, `--tape-rot`, `--board-mobile-max`. Single-column fold at **1140px** |
| `conclusion-view.module.css` | The shared conclusion. Same `var(--accent)` rule, same 1140px fold |

Three properties of this layer are load-bearing and are not style preferences:

- **`sync.ts` is exactly one module, for every game.** Its `flushing` / `reminted` / `retryStep` / `retryTimer` / `memoryQueue` are module-level, and the queue they guard (`listPendingRecords()`) is **game-blind** — it scans the whole `miolos:play:` prefix. Two copies mounted in one SPA session each POST every pending record and each settle the other's. ADR-0029 records this as the trigger for the whole extraction.
- **`playRecordSchema` may never bump `v`.** A bump discards every stored record on deploy, and a discarded record with `pendingSync: true` is the only copy of a completion the server has not acknowledged — a lost streak day.
- **The lifecycle's terminal predicate is `status !== "playing"` — "the game is CLOSED", never "the grid is solved".** `PlayCore.status` already carries `lost`, and `buildRecord(state, now, closed)`'s third argument is `closed`, not `solved`. Both exist *for #27*: under a `"playing" | "solved"` union a Termo loss would never freeze the clock, never write the completion and never leave the play view.

### The one input everyone gets wrong

`usePlayLifecycle`'s `persistDeps` is the game-specific slice whose change means "the record's content changed" — `[givens, entries, hintsUsed]` for Binairo, `[givens, entries, hint.used]` for Sudoku. **`state.now` must never enter it.** `tick` returns a new state object every second; including `now` writes a `readPlayRecord` + Zod parse + `JSON.stringify` + `setItem` cycle once a second, forever, for every game. Omitting `persistDeps` entirely means a tab crash loses the board. `T-WEB-S33` in `apps/web/test/play-lifecycle.test.tsx` pins it — ten `tick` dispatches must produce zero `setItem` calls. Keep an equivalent for each new game.

---

## 4. What a game supplies for itself

Per-game modules stay per game: the reducer and its action set, the engine adapter, the board, the controls, the board-geometry stylesheet, the play composition, the screen root, and **all copy**. There is deliberately no shared `PlayCopy` and no `<PlayShell>`.

The concrete checklist, read off `src/sudoku/`:

| Piece | Sudoku's version |
|---|---|
| Engine adapter | `engine.ts` — `mergedGrid`, `isPlayable`, `solutionDigits`, `playableGivens`, `solvedDigits`, `track`. The single conversion boundary between the engine's types and the view's |
| Reducer + state | `state.ts` — `SudokuPlayState extends PlayCore`, `SudokuPlayAction` (its union **includes** `LifecycleAction`), `initSudokuPlayState(daily)`, `sudokuPlayReducer` |
| Play hook | `use-sudoku-play.ts` — wires `usePlayLifecycle`, exposes `{ state, elapsed, filled, hintReady, hintKind, selectCell, moveSelection, enterDigit, clearCell, revealHint }` |
| Board | `board.tsx` + `BoardSkeleton` |
| Controls | `keypad.tsx` + `KeypadSkeleton` |
| Board stylesheet | `sudoku-board.module.css`, with its own `prefers-reduced-motion` block |
| Composition | `play-view.tsx` (`PlayView`, `PlaySkeleton`) |
| Screen root | `sudoku-screen.tsx` — sets `--accent` inline, swaps `PlayView` → `ConclusionView` in place when the game closes |
| Route segments | `app/sudoku/page.tsx` and `app/sudoku/concluido/page.tsx` — both `export const dynamic = "force-dynamic"`, both thin: `getTodayDaily(getDb(), game)` plus a `DailyUnavailable` branch. **Literal routes, never a `[game]` dynamic segment** — a dynamic segment puts an untrusted `params.game` in front of the wall |
| Copy | `messages.games.sudoku.play.*` and `.conclusion` in `apps/web/src/i18n/messages.ts` |

`messages.games.nonogram` and `messages.games.termo` today hold only `{ kicker, name, description }`. Both need a full `play` and `conclusion` bundle.

---

## 5. Every extension point, named

Each of these is marked in code as an extension point and is *fail-closed*: today it throws, rejects, or does not typecheck for your game.

| File | What it does today | What #25/#27 must add |
|---|---|---|
| `packages/core/src/contracts/daily.ts` | `stripDailyContent` has a real branch for `binairo` and `sudoku`; `case "nonogram": case "termo": throw new DailyProjectionUnsupportedError(game)` | A `<game>DailyContentSchema` (strict, mirroring the engine's puzzle type exactly), a `daily<Game>ResponseSchema`, a branch, and a member on `dailyPuzzleResponseSchema` — which automatically widens `ProjectedGame` and unblocks `getTodayDaily`/`getPublishedDaily` for that game |
| `packages/core/src/contracts/completion.ts` | `completionRequestSchema` is a `discriminatedUnion("game", [binairo, sudoku])`, both grid-shaped and both `strictObject` | Your member. **The two `grid` members must not be generalised into `z.array(z.number())`** — that would let a binairo client post a `7`. Termo's member is not grid-shaped at all |
| `packages/core/src/contracts/cron.ts` | `cronPublishResponseSchema.games` and `bufferDepthResponseSchema.depths` are both `strictObject` with exactly `binairo` and `sudoku` | Your key, in the same PR that wires the top-up. Strictness is what makes a forgotten wiring a parse failure rather than a silent gap |
| `apps/api/src/publishing/service.ts` | `topUpBinairoBuffer`, `topUpSudokuBuffer` | `topUpNonogramBuffer`, `topUpTermoBuffer` — with per-date and per-run retry budgets, following `topUpSudokuBuffer`'s shape |
| `apps/api/app/cron/publish/route.ts` | Two serial `runTopUp` calls, fault-isolated per game, cheapest first | Your game, in the fixed serial order. Fault isolation is not optional: one game's Neon blip must never stop another's buffer |
| `apps/api/app/completions/route.ts` | `storedSolution(game, content)` is exhaustive over `CompletionRequest["game"]`, so widening the request union is a **compile error here** until you handle it | A branch. For Termo this is not "get the solution and compare a grid" — see section 7 |
| `apps/api/app/daily/<game>/route.ts` | `binairo` and `sudoku` exist | Yours, if the native client is to have one. `apps/web` reads the database directly (ADR-0014) and does not use these |
| `apps/web/src/play/play-record.ts` | `playRecordSchema` union has two members | Your member, with `v: 1` unchanged |
| `apps/web/src/play/sync.ts` | `buildBody`'s `switch (record.game)` covers `binairo` and `sudoku` via one `gridBody` | Nonogram folds into a grid-shaped body. **Termo adds a non-grid case here, not a second module** (ADR-0029 consequence (f)) |
| `apps/web/src/play/day-state.ts` | `readDayState` is spelled out game by game so the return type is the exhaustiveness check | Nothing — it already lists all four. But see the Termo caveat in section 7 |
| `apps/web/src/i18n/routes.ts` | `routeSlugs`, `routes` and `playRoutes` carry `binairo` and `sudoku` | Your slug, your two composed routes, your `playRoutes` key. `playRoutes` is `Partial<Record<Game, Route>>` on purpose — the conclusion's chaining CTA skips a game with no route rather than 404ing at the end of the one celebration screen the product has |
| `.github/workflows/impeccable.yml` | The preflight loop and both `detect` invocations list `/`, `/binairo`, `/binairo/concluido`, `/sudoku`, `/sudoku/concluido` | Your two routes in **all three** places. The comment in the workflow says "keep this list and the two detect invocations below in step" — it means it |

The database needs no migration: `daily_puzzles` and `completions` already carry all four games in their `text(… { enum: GAMES })` columns and their CHECK constraints, and `completions.outcome` already accepts `'lost'`.

---

## 6. Nonogram (#25) — where the layer fits, and where it does not

### Fits, essentially unchanged

The timer, the play record, the sync queue, the lifecycle, the conclusion, `day-state`, `accent`, `screen.module.css`, and the route/segment shape. Nonogram is a grid game with a client-recoverable solution, which is the class the whole layer was built for.

### `grid-hint.ts` fits — and ADR-0027's argument does transfer

`nextHint<T>` is deliberately **unconstrained** (`T`, not `T extends number`): its body uses only `!== null` and `!==`. A Nonogram board of `true | false | null` passes natively.

More importantly, the ADR-0027 reasoning holds: the published payload is `{ game, date, size, clues }`, and every shipped motif is **proven line-solvable** by the `packages/games/test/nonogram/motifs.test.ts` harness — so `solveNonogram(clues)` recovers the exact bitmap on the client, offline, in milliseconds. The hint costs no endpoint.

### The reveal is the open design question, and it is bigger than it looks

ADR-0021 makes the pictures a curated in-code motif library. The strip table withholds the **entire `reveal` object** — `motifId`, `name`, `mirrored`, `solution` — "identity spoils". But note precisely what that does and does not buy:

- `reveal.solution` is **not secret**. The client re-derives the bitmap from the clues to run the hint and to validate. Withholding it protects nothing.
- `reveal.name` (pt-BR display name — "Âncora") **is** genuinely absent from every client-reachable payload, and there is no way to derive it.

AC 2 asks for a "picture-reveal moment". If that moment names the picture, **the name has to arrive from somewhere and today nothing carries it.** Three candidates, none decided:

1. The picture is its own reveal and no name is ever shown. Cheapest; consistent with "the entire `reveal` is withheld"; possibly a weaker moment.
2. `POST /completions`' response carries it. Contained, but `completionResponseSchema` is `strictObject` and is documented as "the last place a solution could leak" — widening it is an ADR-sized decision, and it does not help a player who solves **offline**, which ADR-0028 requires to work.
3. A separate authenticated read after completion. Most machinery, and it also breaks offline.

Decide this at step 2, record it as an ADR, and note that option 1 is the only one that survives an offline solve. This is the single thing most likely to be discovered late.

### Two smaller mismatches, stated so they are not discovered at step 5

- **`countFilled` does not mean what you want.** It counts cells carrying a non-`null` value, with `null` as the only empty marker. A Nonogram cell has three states — filled, crossed-out-empty, unknown — and crossing a cell out *is* progress. `filled / total` would be the wrong readout. Either pass a projection that maps your three states onto the two `countFilled` understands, or give Nonogram its own progress function. Sudoku's precedent is instructive: it passes `playableGivens(givens)` and never the raw grid, because the engine's `0` sentinel is not nullish and `given ?? entries[i]` short-circuits to "81 of 81 filled" on a fresh board (plan 018 landmine 22, `T-WEB-S25`).
- **The board is up to 15×15 = 225 cells, plus row and column clue gutters.** ADR-0030 already binds you: one tab stop, roving focus, `role="group"` with a label, arrows/Home/End, **no `role="grid"`** (it requires `role="row"` children, and `display: contents` on a row is the canonical a11y-tree-removal bug). Consequence (a) names your board explicitly. The geometry work — clue gutters that scale with the longest run, at 320px — is the real cost, and there is **no reference frame** for this screen; design it just-in-time against `DESIGN.md` and the six frames in `docs/design/006-handoff-design-winner-atelie/` (open in a browser with `support.js` beside them; they are visual specs, never production code).

### Engine facts you will need

`generateNonogram(seed, weekday): NonogramPuzzle` — there is **no `generateDailyNonogram`**; only Sudoku has a `generateDaily*` wrapper. `NONOGRAM_MAX_GENERATION_ATTEMPTS = 8`. Validation is `validateNonogram(puzzle, criteria)` where criteria come from `NONOGRAM_WEEKDAY_CRITERIA[weekday]`. `NonogramPuzzle` is `{ game: "nonogram", seed, weekday, size, clues: { size, rows, cols }, reveal }`. Sizes by ISO weekday: Mon 5, Tue/Wed 8, Thu/Fri 10, Sat/Sun 15 — so **the board size changes daily**, which Binairo and Sudoku never do. `solveNonogram` and `effortScore` are exported and pure.

The strict daily-content schema must mirror `NonogramPuzzle` **exactly**, including `reveal` — ADR-0024 makes the pre-insert parse fail closed on any engine-added field, which drains the buffer and fires the depth alert. That is the wanted alarm, not a bug.

---

## 7. Termo (#27) — structurally different, and the risky one

Do not plan #27 as "a third copy of #25". Almost nothing above the sync queue transfers.

### The answer is the product's only real secret, and ADR-0027 does not transfer

The reasoning that lets Binairo, Sudoku and Nonogram compute their hints on the client is spelled out in `apps/web/src/play/grid-hint.ts`'s own header: today's board is published, its givens are legitimately in the player's hands, and it is uniquely solvable by construction — so the solution is client-recoverable anyway. **That argument has no Termo analogue.** The strip table gives Termo's client `game, date` **only** — the answer word never appears in any field of any payload. ADR-0029 consequence (g) records this, and the module is named `grid-hint`, not `hint`, for exactly this reason. #27 decides Termo's hint from scratch, or ships without one.

### What that forces

1. **A guess endpoint.** Judging must happen on `apps/api`, against the stored `daily_puzzles.content`. `evaluateGuess(guess, answer): TileStates` is pure and already in `packages/games/src/termo` — it runs server-side.
2. **A new Zod contract for the guess request and response**, at both boundaries. The response carries tile states, never the answer, until the game closes.
3. **The `apps/web` wall stands.** `apps/web` reads the database directly only for **public** pages (ADR-0014, as narrowed by ADR-0031 Decision 4). A guess is user-specific server state. It goes to `apps/api`, and the ESLint bans plus `server-only` in `src/db.ts` enforce it mechanically.
4. **Guess state has to live somewhere.** Six guesses, judged one at a time, is a per-user per-day sequence — and `completions` is write-once, so it cannot hold in-flight guesses. Either the server stores them (a new table, a migration, an ADR) or it re-judges a client-supplied guess list on every request (stateless, replayable, no schema — but the client then holds the tile states, which is fine, and holds nothing else). Decide at step 2; the stateless route is much cheaper and does not weaken ADR-0004.
5. **Local validation can stay on the client; judging cannot.** `TERMO_VALIDATION_WORDS` (5 310 words) and `isValidGuess` are public content by design — `content/termo/README.md` says so outright ("The list being public spoils nothing"). So the "não está na lista" gate can be instant and offline. **Measure the bundle cost:** `packages/games/src/termo/words.generated.ts` is ~40 KB of source, and it is what `@miolos/games/termo`'s barrel pulls in. If it does not tree-shake acceptably, the sanctioned fix is making the existing barrel tree-shakeable — **not** a sub-barrel and **not** a deep import (ADR-0019 fixes one subpath per game and makes `src/<game>/index.ts` the public API).
6. **Accent handling is already solved, in one place.** `normalizeWord` is the single normalization function (NFD, strip combining marks, `ç`→`c`); matching is accent-insensitive and the canonical accented spelling is revealed at the end. `TERMO_ANSWERS` is `readonly { canonical, normalized }[]`, 400 entries, **in `answers.csv` row order, and that order is contractual** — the word-list harness pins it, and #27's server-side seeded choice indexes into it. Reordering is a breaking change.
7. **Answer selection needs a no-repeat rule.** 400 answers is 13+ months of dailies. A uniform seeded pick collides long before that (birthday problem: ~50% chance of a repeat inside ~24 days). Publication is buffered `bufferDepth` days ahead through `insertDailyPuzzle`, so the natural check is "not used by any existing `daily_puzzles` row for `game = 'termo'`" — but that is a database read inside the top-up, which the grid games do not do. Decide and record it.

### `lost` is a real outcome, and the layer already knows

- `PlayCore.status` carries `"lost"`. `buildRecord`'s flag is `closed`, not `solved`. Both are there **for you** — verify they still are before you rely on them.
- `COMPLETION_OUTCOMES = ["won", "lost"]` ships in `packages/core/src/completion.ts`, is the drizzle enum, the Zod enum and the CHECK constraint, and M1 could never write `lost`. Termo is the first writer.
- `POST /completions` today 422s a mismatched grid with `grid-mismatch` and writes no row, because "for a grid game a wrong board is not a game outcome". **Termo inverts that**: six guesses exhausted *is* an outcome, and it must write `outcome: "lost"`.
- ADR-0008: a lost Termo is **played**, never **completed**. It records in the guess distribution as the fail row, and counts for neither the streak nor Dia Perfeito. That distribution is #29's; #27 only has to write a row #29 can read.

### Where the shared layer will need widening, and why

Be honest at step 2 rather than contorting the layer at step 5. An abstraction that fits three grid games and is bent onto Termo is worse than a fourth module.

- **`ConclusionView` has exactly three states**: skeleton, "ainda não concluído", and a **win** stamp (`messages.conclusion.stampLabel` is "Concluído"; `ConclusionCopy.stampAria(elapsed, hints)` reads "concluído em … sem dicas"). A Termo loss is a fourth state with different chrome, different copy and no time-as-achievement framing. Widen `ConclusionCopy` and add the branch — that is a real, honest extension of a shared component, not a contortion.
- **`day-state.ts`'s `DayEntry.concluded` would be wrong for a loss.** `entryFor` reads `record.concluded === true` and publishes `elapsedMs` as the day's result. Under ADR-0008 a lost Termo must render as *not* completing the day, on the hub tile and on the conclusion's "O dia até agora" chips, while still being visibly *played*. `DayEntry` needs a third shape. Note the monotone-safety rule this must not break (ADR-0031): a false "pending" is invisible to the player, a false "done" is not — so err toward pending.
- **`conclusion-view.tsx`'s `nextPendingDaily` chains on `!entryOf(candidate).concluded`.** A lost Termo would keep being offered as the next pending daily forever. Decide whether "played" closes the chain.
- **`grid-hint.ts` and `progress.ts` do not apply at all.** No `null`-empty grid, no `{filled} de {total}`.
- **The board is not a grid game's board.** Six rows × five tiles is fixed-size and read-only until submitted; the input is a keyboard, not a cell caret. ADR-0030 is about *grid games*; whether a Termo board is one composite widget is a fresh decision, and the natural answer is that the keyboard is the interactive surface and the tile board is `role="group"` output. `screen.module.css`'s four per-game custom properties (`--grid-card-rot`, `--stats-card-rot`, `--tape-rot`, `--board-mobile-max`) still apply; the board-geometry stylesheet is yours.

### Offline is the hard tension, and it must be named in the plan

ADR-0028 makes finishing offline a requirement — the conclusion is an in-place state precisely so the player who just solved offline gets a stamp rather than a navigation error. **Termo structurally cannot play offline**, because every guess needs a server round trip. That is a genuine conflict between ADR-0028 and ADR-0004, it cannot be engineered away, and it needs an ADR that says so plainly and defines the degraded behaviour (what the screen does when a guess POST fails, what the record holds, what the conclusion shows). Do not let it surface as a step-6 finding.

---

## 8. Non-negotiable principles

Vetoes, not gaps. Do not propose working around them.

- **`packages/games` takes zero React Native and zero Node dependencies.** Pure TS, deterministic, seed in → puzzle out. `packages/games/test/purity.test.ts` enforces it.
- **No unpublished puzzle content ever reaches the client** (ADR-0004), including RSC payloads. Both route segments are `force-dynamic` with no `revalidate`, no `generateStaticParams` and no `fetch`. The projection is an **allowlist pick inside the wall** (`packages/db/src/published.ts`), never a delete of `solution`.
- **`seed` is withheld for every game.** Engines are deterministic; a seed *is* the solution.
- **Dates and streaks are always `America/Sao_Paulo`, from the DB clock.** `todaySaoPaulo(db)`, never `new Date()`. The client clock never selects which day's record is read, and never enters streak arithmetic. `completed_at` is `defaultNow()`; the completion request carries **no timestamp**, and its schema is `strictObject` so it cannot grow one silently.
- **Completions are write-once.** `(user_id, game, date)` primary key plus the idempotent short-circuit *before* the wall read and before the judge. A retry must never be re-judged.
- **One free hint per puzzle**, `hintsUsed` bounded `.max(1)` on the wire for every game. No balance, no accumulable currency, no XP, no ranking (ADR-0006).
- **All content is free** (ADR-0005). Termo is excluded from free play — its word list is finite curated content (#28's scope, not yours).
- **pt-BR only**, strings externalised through `apps/web/src/i18n/messages.ts` (ADR-0018). Route slugs are pt-BR; game names are proper nouns and stay untranslated (ADR-0013).
- **No third-party banner, ever. No ads SDK in v1.** `<AdSlot>` renders nothing but reserves its dimensions.
- **`packages/ui` holds tokens and primitives, never components.** The `play/` layer is `apps/web`-internal by construction and does not migrate there (ADR-0029 consequence (a)).
- **Zod at every boundary.** `jsonb` is untyped: parsed, never cast. `localStorage` is user-editable: parsed on every read, strict, and an unparseable record is *discarded*, never migrated.
- **Property-based tests for `packages/games`**, proved not sampled (ADR-0023). No `fast-check` in `apps/web` — its universal-sounding tests are table-driven with the enumeration written out.

---

## 9. Open decisions you inherit

Four, none of them yours to silently resolve.

| # | What | Status |
|---|---|---|
| [#58](https://github.com/fernandolisboa/miolos/issues/58) | A completion synced after the São Paulo rollover derives as **late**. A player who finishes at 23:59 offline and reconnects at 00:01 loses the day. | `ready-for-human` — **Fernando's call.** Do not implement a grace window, do not widen `ACCEPTED_DAYS_BACK` (it is `1`). #25 and #27 inherit the identical window through the same route and the same SQL. |
| [#59](https://github.com/fernandolisboa/miolos/issues/59) | A least-privilege `miolos_web` Neon role instead of the integration-managed `DATABASE_URL`. | `ready-for-agent`, unstarted. Your duty is **negative**: no document, comment, ADR or PR body may say or imply the grant exists. ADR-0026 currently claims exactly one shipped enforcement point — the module-graph wall — and that must stay true. |
| [#51](https://github.com/fernandolisboa/miolos/issues/51) | `low-contrast` and `cream-palette` are wildcard-ignored in `.impeccable/config.json` on the scanned hosts, because impeccable extracts no value for those rules. | `needs-triage`. Consequence for you: **those two rules pass green regardless of what you ship.** They are not evidence. Compute and paste real contrast figures for anything new. Never add a third wildcard host pattern; a new by-design finding gets a **value-level** entry with a written reason. |
| ADR-0030 follow-up | Binairo's shipped board still has 64 ordinary tab stops. ADR-0030 consequence (b) states the repo carries both keyboard models until it is retrofitted. | Unfiled. #25 gives the roving-focus machinery its second consumer; retrofitting Binairo in the same PR is cheap and closes the inconsistency. File it or do it — do not leave it unstated. |

Plan 018 §10.4 also notes `nextBinairoDeduction` as a surfaced-but-deferred idea, deliberately unfiled.

---

## 10. Landmines

Concrete, each one paid for at least once.

1. **jsdom has no layout and no pointer capture.** `getBoundingClientRect()` returns zeros, `elementFromPoint` is a stub, `setPointerCapture` does not exist. A UI test can pass against visually broken code. Layout rules are asserted by **reading the stylesheet text** through `apps/web/test/css-source.ts` — `stylesheet(relativePath)` resolves from `apps/web/`, so it reads `src/play/screen.module.css`, a game's board module, and `app/page.module.css` alike. That helper is the only mechanism in the repo that can assert a layout rule at all.
2. **`impeccable detect` exits 0 on an unreachable URL — and passes green on the *wrong screen* when the URL is reachable but empty.** `/sudoku` with no published row renders `DailyUnavailable` at HTTP **200**. That is why the CI preflight asserts `data-play-state=` / `data-conclusion-state=` **in the response body**, not the status, and why the buffer must be seeded before the scan. A 200 alone is not evidence; it is the failure mode.
3. **`CRON_SECRET` is Production-only on `miolos-api`** (verified `vercel env ls`, 2026-08-01). Hitting a *preview* deployment's `/cron/publish` returns 401. Seed a preview's buffer by running the branch's own `topUp<Game>Buffer` locally against the database instead — same code path, same validation, idempotent, and safe pre-merge because nothing deployed reads that game's rows yet. `DATABASE_URL` **is** on Preview, which is why previews render db-backed pages and why preview and production read the same rows.
4. **Minification defeats identifier greps in bundle checks.** Asserting that a generator did not land in a client chunk by grepping for `generateNonogram` proves nothing — the name is mangled. Grep for **string literals** the engine carries (a motif's pt-BR name, a rejection-reason code) and include a **positive control** in the same test so a broken grep fails loudly.
5. **A comment or ADR claiming a guarantee the code lacks was caught three times in #18.** Every "this is enforced by X" line must name a file and a line you have actually read. The reviewers check these first.
6. **CI runners are ~3–4× slower than local, and vitest's default per-test timeout is 5 000 ms with no config raising it.** Any test that calls a generator carries an explicit trailing timeout **with the arithmetic in a comment**. Commit `271a935` exists solely because this was underestimated. Nonogram generation is cheap (every pool entry is harness-proven, so attempt 0 succeeds); Sudoku's Sunday tier is ~121 ms mean and 346 ms max locally — do not re-derive these from memory, measure yours.
7. **`packages/db` migrations are applied to Neon manually, through `DATABASE_URL_UNPOOLED` only. Nothing in CI or Vercel runs them.** Three are committed under `packages/db/migrations/`. `createTestDb` replays the committed artifacts, so the whole db suite stays red until generated SQL is committed untouched. Neither #25 nor #27 is expected to need a migration — `daily_puzzles` and `completions` already carry all four games. If #27's guess state does need one, that is a plan-level decision, not a step-5 discovery.
8. **`apps/web/next-env.d.ts` and `apps/api/next-env.d.ts` are tracked** (committed in M0) and Next regenerates them on `dev`/`build`. If one comes back modified, restore it — do not commit the churn, and do not `--no-verify` past it.
9. **`.returning()` must be bare** on the union `Db` type — only the no-argument overload survives TS's union-signature collapse. Three landed occurrences already say so.
10. **CSS Modules compile in css-loader `pure` mode.** A bare type selector (`a:hover`, `button`, `p`) either fails the build or leaks globally. Anchor every rule on a local class.
11. **CSS Modules hash per file**, so a shared rule cannot be overridden by a same-named per-game rule — resolution would fall to injection order, which Next does not guarantee. Per-game values in `play/screen.module.css` are **custom properties** set by a per-game class on the same element. Each game's board module carries its own `prefers-reduced-motion` block.
12. **`display: contents` cannot move a node across subtrees.** The responsive reflow is a named-area CSS grid with duplicated readout nodes (two `TimerReadout`s, one hidden per viewport). It is also why `role="grid"` is unavailable.
13. **Two impeccable structural traps stay closed**: `<h1>` must be the first element child of its wrapper (`h1.previousElementSibling === null`) in *every* view — play, skeleton, unavailable, conclusion; and no keyframe name matching `/bounce|elastic|wobble|jiggle|spring/i`.
14. **`turbo` runs in `envMode: strict`.** Anything new must be listed in `tasks.build.env` or it is stripped from the build.
15. **The `@miolos/db/user` export tripwire and `T-DB-9a`–`9e` must come out of your ticket byte-identical.** They compare `Object.keys(...).sort()`. If one needs editing, something was added to the wrong surface.
16. **A missing `docs/README.md` row has been a blocking review finding six times.** Ship it in commit 1.
17. **Do not ship the `.dc.html` frames or `support.js`.** Visual specs, zero production relevance.
18. **The `min-release-age` npm cooldown and `save-exact=true`** apply to any new dependency. `puppeteer`'s postinstall is deliberately blocked; Chrome is installed explicitly.

---

## 11. The flow, and what it actually costs

`CLAUDE.md`'s eight steps, each in a **freshly spawned specialised subagent with clean context**. Adding steps is always allowed; removing one never is. If a review at step 3 or 6 rejects, go back to the earliest step that can fix the cause — never patch forward over a bad plan.

Step 6 spawns **multiple reviewers in parallel, one lens each**: correctness and bugs; security; quality and maintainability; performance; adherence to the ADRs and `CONTEXT.md`; adherence to the originating issue. They default to rejecting. A finding is dismissed only with a written reason in the PR — never by silence.

Calibrate against what these two tickets actually cost:

- **#18** ran three step-6 rounds: **34 findings → 21 fixed**, then **11 → 9**, then **3 → 2**. The loop ends when a fresh pass returns empty, not when you are tired. **Two of #18's own fixes introduced regressions** — re-review after fixing, always.
- **#23**'s step-3 review produced **48 findings, 9 blocking, from five lenses**, and the plan was rewritten before a line of code was written. `docs/plans/018` §20 records every disposition, including three places where a reviewer was wrong and the refuting evidence is given.

**Evidence rule:** never report a step as passing without pasting the real command output. "Should pass" and "I've verified" are not results.

---

## 12. Environment

**Every node/pnpm/npx command needs the nvm preamble** — otherwise you get the system node:

```
source ~/.nvm/nvm.sh && nvm use default >/dev/null && <command>
```

Node v24.18.1, pnpm 11.18.0. pnpm workspace over `apps/*` and `packages/*`; `apps/{web,api}`, `packages/{core,db,games,ui}`.

**The gate**, from the repo root:

```
pnpm typecheck     # turbo, 6 projects, strict
pnpm lint          # eslint --max-warnings 0 .
pnpm test          # turbo, full suite
pnpm build         # measure and paste the new route's First Load JS
npx impeccable detect <url>   # required on anything touching UI
```

Add `--force` to bypass turbo's cache when you need a real run. Pre-commit (Husky + lint-staged + typecheck + tests) must stay green and is **never** bypassed with `--no-verify`.

**A local dev server against a real database.** `apps/web` reads the database directly, so `/sudoku` and friends render `DailyUnavailable` without one. `apps/api/.env.local` exists on this machine and holds a working `DATABASE_URL`; `apps/web/.env.local` does **not**. Copy the value into `apps/web/.env.local`, run the app, and **delete the file afterwards** — it is gitignored (`.env.*`), but a stray credential file is not something to leave lying around. `apps/web/.env.example` documents the full set (`NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_API_URL`, `DATABASE_URL`); `apps/api/.env.example` documents `WEB_ORIGIN`, `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `CRON_SECRET`, `COOKIE_DOMAIN`.

**`puppeteer` and `impeccable` are root devDependencies and resolve only from the repo root.** Run `npx impeccable detect` from `/home/ferna/projects/miolos`, never from inside a workspace package.

Vercel is provisioned: `miolos-web` and `miolos-api` are live with domains and auto-deploy on `main`; the CLI is authenticated. The Impeccable workflow fires on `deployment_status` for `Preview – miolos-web` (the dash is an EN DASH, U+2013) — production and the api project are filtered out.

---

## 13. Exit criteria

Per issue, all of it green with output pasted:

- Every acceptance criterion in section 1 satisfied, each mapped to named evidence.
- `pnpm typecheck` / `pnpm lint` / `pnpm test` green, with counts.
- `npx impeccable detect` green on both new routes, scanned against a preview deployment whose buffer was seeded first, with the preflight asserting page **content**.
- The strip table in `packages/core/src/contracts/daily.ts` updated in the same PR as the projection, and no longer throwing for your game.
- The cron and buffer-depth contracts widened in the same PR as the top-up.
- A new ADR for every technical decision of any weight — and for #25 the reveal-identity decision, for #27 both the server-judging shape and the offline tension, are of weight.
- `docs/README.md` gains the plan's row in commit 1.
- The step-6 review loop closes on an **empty** pass, with every dismissal written down.
- PR merged and issue closed, by you (agent-owned review and merge). Fernando reviews pull requests, not code — the PR body states what changed, what was verified with command output inline, and whether anything actually needs him. If nothing does, say so explicitly.

---

## 14. Next free numbers

`docs/README.md`: **one `NNN` sequence shared across every subdirectory** — handoffs, briefs, plans, specs and research draw from the same counter, so creation order stays readable no matter where a file sits. Next free number wins. (This document took **019**; the last plan was 018, and 001–006 are the founding handoff, the design brief, three research notes and the design-winner bundle.)

- **Next plan:** `docs/plans/020-issue-25-plan-<slug>.md`, then `021-issue-27-plan-<slug>.md`.
- **Next ADR:** `docs/adr/0032-<slug>.md` — ADRs keep their **own** 4-digit sequence and `docs/README.md` lists `adr/` as a directory, so an ADR owes no README row. A plan and a handoff each owe one.
- **Next handoff:** whatever is free when you write it.
