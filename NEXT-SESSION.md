# Do I need to do anything?

**Not for Rainhas.** You said yes to it and ran migration 0015 on the Miolos database before #285 PR 2 merged; both are in the ledger's Done table. Also NOW §2: the Google OAuth client and its two Vercel variables (#280, ADR-0089); Sign in with Google is merged but dormant until then. **NOW §3** — set `ADMIN_USER_IDS` on miolos-api so `/admin` works for you (#304). Still open, low urgency: NOW §1 (#200). To work through the ledger: start a session with *"run /wizard over docs/pending-fernando.md, NOW section"*.

## Start here

Every grid game's hint reveals and explains the next logical step (#296 ADR-0099, #297 ADR-0101). Each game's `next<Game>Hint` is in `apps/web/src/<game>/hint.ts` on the shared `nextLogicalHint` (`play/grid-hint.ts`); the engines export `nextSudokuStep`, `nextBinairoStep`, `nextNonogramStep` and `nextQueensStep`. The reason and the spotlight live in `HintState<R>` in every reducer; `useHintKind` is gone. Binairo and Rainhas generation is pinned (`packages/games/test/{binairo,queens}/`).

**`/admin` shipped** (#304, ADR-0097, ADR-0098): an admin edits each `remote_config` key within its schema bounds, no deploy. Admins are the user ids in `ADMIN_USER_IDS` on `apps/api`. `getRemoteConfig` now falls back per key. #304 is closed.

**The free hint allowance is the `freeHintsPerPuzzle` key** (1 to 9, default 3, ADR-0098): daily and archive puzzles read it from `GET /hints` through `FetchedFreeHints`; free play stays at `FREE_HINTS_PER_PUZZLE`. `HINTS_PER_PUZZLE_CEILING` (9) is the only wire bound. Before rolling either app back, set the key to 3 or less and wait for the rollover.

**Rainhas is complete** (#285): the engine (ADR-0090), the daily and archive (ADR-0091, ADR-0092) and free play at `/modo-livre/rainhas`. The daily and free screens share `useQueensBoard` and `BoardPanel` (`apps/web/src/queens/`); only `use-queens-play.ts` adds the lifecycle, and the free-play wall bans it.

**One daily and one archive screen shell** (#289, ADR-0093): every daily and archive screen root, Termo included, now only calls its hooks and hands nodes to `DailyScreen` (`apps/web/src/play/daily-screen.tsx`) or `ArchiveScreen` (`apps/web/src/archive/archive-screen.tsx`). A change to the ladder is one edit. The per-game play views use `DailyPlayChrome`, and every `buildRecord` spreads `recordHeader`.

**Three free hints per puzzle shipped** (#295, ADR-0095): `FREE_HINTS_PER_PUZZLE` in `@miolos/core` is the default and free play's count; the chrome builds the countdown label from `used`.

**Right-click marks** (#299, ADR-0094): `apps/web/src/play/brush.ts` holds the mark and stroke rules; the board reads a `Press` from `usePointerStroke`.

**The Sudoku board shows the selection's reach** (#302): selecting a cell tints its row, column and box, and fills every other copy of its digit with the accent; violating and hinted cells keep their own look. The rule lives in `selectionHighlights` (`apps/web/src/sudoku/engine.ts`), on the games package's `sudokuPeers`. Test ids `T-WEB-S495…S497`.

**Recomeçar** (#298, ADR-0096): every grid game resets through `resetBoard` (`apps/web/src/play/reset-board.ts`); `useHintKind` (`play/use-hint-kind.ts`) clears the hint note with it, and `ResetControl` (`play/reset-control.tsx`) is the chrome's one stateful child. The hint is never refunded and the clock never rewinds, so a change to hint counts (#295) needs no change to the reset. Test ids `T-WEB-S514…S517`.

## Traps

**Turbo's cache for `packages/db` tests does not cover `apps/api/src`.** `users-updated-at.test.ts` scans `apps/api/src`, but the db test task's cache key does not include that folder, so pre-commit can replay a stale pass. Run `pnpm test --force` before trusting a green gate after an `apps/api` change.

**Dependabot npm PRs cannot be merged as opened.** They change one `package.json` and never `pnpm-lock.yaml`, so `--frozen-lockfile` fails. Land them as one hand-made bump across every pin, outside `minimumReleaseAge` (7 days).

**A perfect day needs a lineup buffered before midnight (ADR-0087).** If every buffer ran dry and all of a day's rows were inserted after `published_at`, that day cannot be perfect. The buffer alert exists to prevent that.

**Six per-game medals is T-CORE-S70's maximum.** `queens-30` reached it. A seventh game needs that cap raised, with a reason, first.

**The crossword lexicon is not a Turbo test input.** After editing `content/crossword/lexicon.tsv`, run `pnpm --filter @miolos/games generate:crossword` and `pnpm test --force`.

## Next

**Next:** file per-game time buckets as an issue.

**Then:** #300 (per-game settings, "Mostrar erros") and #303 (better use of space), which touch every game.

**Queued:** #206 cluster 10's `Frame` half; the telemetry opt-out UI (ADR-0069 decision 5, #37); moving the remaining write routes onto `writePreamble` (`apps/api/src/http/write-preamble.ts`, today used by the push route, the three account routes and `/admin/config`); #254; #205's CSS half (~1,820 lines, NOT a sweep); #155 (`bundle-check` into CI); the `jsonResponse`/`stubFetch` Quick change; folding `T-WEB-S183`'s module walker in `archive-day.test.tsx` onto `module-graph.ts`.
