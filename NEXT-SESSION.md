# Do I need to do anything?

Nothing new from #303. Open, low urgency: NOW §1 (#200), and NOW §2, the Google OAuth client and its two Vercel variables (#280, ADR-0089; Sign in with Google is dormant until then). Optional: ANY TIME has a real-phone check of the Sudoku *Número fixo* double tap (#300). Attach your Gmail in Ajustes once to count as an admin. To work the ledger: *"run /wizard over docs/pending-fernando.md, NOW section"*.

## Start here

Every grid game's hint reveals and explains the next logical step (#296 ADR-0099, #297 ADR-0101). Each game's `next<Game>Hint` is in `apps/web/src/<game>/hint.ts` on the shared `nextLogicalHint` (`play/grid-hint.ts`); the engines export `nextSudokuStep`, `nextBinairoStep`, `nextNonogramStep` and `nextQueensStep`. The reason and the spotlight live in `HintState<R>` in every reducer. Binairo and Rainhas generation is pinned (`packages/games/test/{binairo,queens}/`).

**Player settings** (#300, ADR-0102): one device-local key, `miolos-settings`, read through `useSettings` (`apps/web/src/settings/settings.ts`); shown in Ajustes' *Jogos* card and each grid game's *Ajustes* dialog (`settings/settings-dialog.tsx`, in `PlayScreenChrome`). *Mostrar erros* is `wrongCells` in `play/grid-hint.ts` (the hint's correction uses the same predicate) drawn as `WrongMark`; the Sudoku *Número fixo* lives in the reducer (`locked`) with its 300 ms gesture in `sudoku/use-digit-lock.ts`. A new setting is a schema field, a copy entry and a key in `settings.games[game]`. Account sync is #317.

**`/admin`** (#304, #314, ADR-0097, ADR-0100): an admin edits each `remote_config` key within its bounds, no deploy. Admins and superusers are verified attached emails in `admin_users` (migration 0016, `packages/db/src/admin-users.ts`); a superuser manages them on the page, and one locking statement keeps the last superuser. `ADMIN_USER_IDS` is gone.

**The free hint allowance is the `freeHintsPerPuzzle` key** (1 to 9, default 3, ADR-0098): daily and archive puzzles read it from `GET /hints` through `FetchedFreeHints`; free play stays at `FREE_HINTS_PER_PUZZLE`. `HINTS_PER_PUZZLE_CEILING` (9) is the only wire bound. Before rolling either app back, set the key to 3 or less and wait for the rollover.

**One daily and one archive screen shell** (#289, ADR-0093): every daily and archive screen root, Termo included, now only calls its hooks and hands nodes to `DailyScreen` (`apps/web/src/play/daily-screen.tsx`) or `ArchiveScreen` (`apps/web/src/archive/archive-screen.tsx`). A change to the ladder is one edit. The per-game play views use `DailyPlayChrome`, and every `buildRecord` spreads `recordHeader`.

**Keyboards** (#321): the Termo and Cruzadinha keyboards are laid out by `qwertySlots` (`play/letter-keyboard.tsx`) on 22 columns, `apagar` after P and `enviar` after L; the ⌫ and ↵ glyphs, Sudoku's keypad included, come from `play/key-glyph.tsx`. The Cruzadinha keyboard sits in the board's column.

**Right-click marks** (#299, ADR-0094): `apps/web/src/play/brush.ts` holds the mark and stroke rules; the board reads a `Press` from `usePointerStroke`.

**Recomeçar** (#298, ADR-0096): every grid game resets through `resetBoard` (`apps/web/src/play/reset-board.ts`); `resetBoard` also clears the hint's reason and spotlight, and `ResetControl` (`play/reset-control.tsx`) is the chrome's one stateful child. The hint is never refunded and the clock never rewinds. Test ids `T-WEB-S514…S517`.

**Boards size from the space they have** (#303, ADR-0103): `BoardCard` (`play/board-card.tsx`) wraps every board in a size container; `--board-side` is the largest square the column and viewport allow, up to the page class's `--board-max`. `--board-below` is a hand-kept mirror of the rows under the card.
The fold is 1024px, the page is `100svh`, the Recomeçar confirm overlays the hint, `.hintSlot` reserves the explanation, and free play's `GeneratingNote` is `BoardCard`'s `overlay`. The Cruzadinha's clues sit beside the grid from a 640px column (`crossword` container) and fold behind *Pistas* below it. Pinned by `T-WEB-S596…S605`; jsdom has no layout, so re-measure in a browser (360×780 to 1440×900) after any change to the shared sheet.

## Traps

**Turbo's cache for `packages/db` tests does not cover `apps/api/src`.** `users-updated-at.test.ts` scans `apps/api/src`, but the db test task's cache key does not include that folder, so pre-commit can replay a stale pass. Run `pnpm test --force` before trusting a green gate after an `apps/api` change.

**Dependabot npm PRs cannot be merged as opened.** They change one `package.json` and never `pnpm-lock.yaml`, so `--frozen-lockfile` fails. Land them as one hand-made bump across every pin, outside `minimumReleaseAge` (7 days).

**A perfect day needs a lineup buffered before midnight (ADR-0087).** If every buffer ran dry and all of a day's rows were inserted after `published_at`, that day cannot be perfect. The buffer alert exists to prevent that.

**Six per-game medals is T-CORE-S70's maximum.** `queens-30` reached it. A seventh game needs that cap raised, with a reason, first.

**The crossword lexicon is not a Turbo test input.** After editing `content/crossword/lexicon.tsv`, run `pnpm --filter @miolos/games generate:crossword` and `pnpm test --force`.

## Next

**Next:** file per-game time buckets as an issue; then #317 (sync settings with the account, needs a migration).

**Queued:** #206 cluster 10's `Frame` half; the telemetry opt-out UI (ADR-0069 decision 5, #37); the remaining write routes onto `writePreamble` (`apps/api/src/http/write-preamble.ts`); #254; #205's CSS half (~1,820 lines, NOT a sweep); #155 (`bundle-check` into CI); the `jsonResponse`/`stubFetch` Quick change; `T-WEB-S183`'s module walker onto `module-graph.ts`.
