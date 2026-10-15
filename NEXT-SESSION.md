# Do I need to do anything?

Nothing required from #333. New, low urgency: NOW §4 ⚡, Termo free play shipped on the recommended pool; answer only to change it. NOW §3, whether the daily Cruzadinha ever becomes 7×7 (#330); play 7×7 in free play first. Also open, low urgency: NOW §1 (#200), and NOW §2, the Google OAuth client and its two Vercel variables (#280, ADR-0089; Sign in with Google is dormant until then). Optional: ANY TIME has a real-phone check of the Sudoku *Número fixo* double tap (#300). Attach your Gmail in Ajustes once to count as an admin. To work the ledger: *"run /wizard over docs/pending-fernando.md, NOW section"*.

## Start here

**Termo free play** (#333, ADR-0114): `free-play/termo-free-screen.tsx` plays through `useFreeTermoBoard` (`free-play/use-free-termo.ts`), which judges on the device and shares `termo/use-termo-board.ts` with the daily.

Every grid game's hint reveals and explains the next logical step (#296 ADR-0099, #297 ADR-0101). Each game's `next<Game>Hint` is in `apps/web/src/<game>/hint.ts` on the shared `nextLogicalHint` (`play/grid-hint.ts`); the engines export `nextSudokuStep`, `nextBinairoStep`, `nextNonogramStep` and `nextQueensStep`. The reason and the spotlight live in `HintState<R>` in every reducer. Binairo and Rainhas generation is pinned (`packages/games/test/{binairo,queens}/`).

**Player settings** (#300, ADR-0102): one device-local key, `miolos-settings`, read through `useSettings` (`apps/web/src/settings/settings.ts`); shown in Ajustes' *Jogos* card and each grid game's *Ajustes* dialog (`settings/settings-dialog.tsx`, in `PlayScreenChrome`). *Mostrar erros* is `wrongCells` in `play/grid-hint.ts` (the hint's correction uses the same predicate) drawn as `WrongMark`; the Sudoku *Número fixo* lives in the reducer (`locked`) with its 300 ms gesture in `sudoku/use-digit-lock.ts`, on a keypad digit or on a board cell showing a digit (#323). The Nonogram's struck clue numbers are `placedClues` (`packages/games/src/nonogram/placed.ts`, ADR-0104) behind `strikePlacedRuns`; *Arrastar só em linha reta* (`straightDrag`, off, #329) is `usePointerStroke`'s `straight` option, which fixes the axis on the first cell entered and fills along it (`play/straight-stroke.ts`). Rainhas could pass it too; nothing does yet. A new setting is a schema field, a copy entry and a key in `settings.games[game]`. Account sync is #317. Rainhas has three more (#326, ADR-0105): the reach, the fade and an opt-in auto-✕ whose ✕ belong to the queens that made them (`autoCrossed`, kept in the play record).

**`/admin`** (#304, #314, ADR-0097, ADR-0100): an admin edits each `remote_config` key within its bounds, no deploy. Admins and superusers are verified attached emails in `admin_users` (migration 0016, `packages/db/src/admin-users.ts`); a superuser manages them on the page, and one locking statement keeps the last superuser. `ADMIN_USER_IDS` is gone. **The free hint allowance is the `freeHintsPerPuzzle` key** (1 to 9, default 3, ADR-0098): daily and archive puzzles read it from `GET /hints` through `FetchedFreeHints`; free play stays at `FREE_HINTS_PER_PUZZLE`. `HINTS_PER_PUZZLE_CEILING` (9) is the only wire bound. Before rolling either app back, set the key to 3 or less and wait for the rollover.

**Control tips** (#331): the keyboard and mouse tips of Termo, Sudoku, Nonogram, Binairo and Rainhas sit behind one circled-i button, `InfoTip` (`play/info-tip.tsx`): tap toggles it, hover and keyboard focus open it, Escape, blur and an outside tap close it. Each game keeps its own visibility rule on the `.affordance` wrapper (hidden on phones). The Nonogram toggle and the Binairo buttons are centred in a `1fr auto 1fr` row with the tip in the third column. **Keyboards** (#321): Termo and Cruzadinha use `qwertySlots` (`play/letter-keyboard.tsx`), glyphs from `play/key-glyph.tsx`. **Termo's current row is editable** (#327, ADR-0106): five slots and a cursor; one key map, `pressKey` (`termo/play-view.tsx`).

**The Sudoku keypad tallies each digit** (#328, `digitTally` in `sudoku/engine.ts`). **Cruzadinha** skips filled cells with `nextEmptyCell` (#322); `generateCrossword(seed, 7)` builds 7×7 (ADR-0108).

**Cruzadinha 7×7 in free play** (#330, ADR-0108, ADR-0111): a *Tamanho* 5×5/7×7 choice through `ChoicePicker` (`free-play/choice-picker.tsx`, which the level picker now is too); `projectCrossword(date, puzzle, size)` parses at the asked side and the daily stays 5×5. The board reads its side from the grid. Every free-play build now waits a paint (`useFreeGeneration`); tests await `flushGeneration()` (`apps/web/test/free-generation.ts`).

**Right-click marks** (#299, ADR-0094) are `play/brush.ts`; Binairo's tap starts from *Primeiro valor* (#325). **Recomeçar** (#298, ADR-0096) is `resetBoard` (`play/reset-board.ts`) and `ResetControl`; the hint is never refunded and the clock never rewinds.

**Boards size from the space they have** (#303, ADR-0103): `BoardCard` (`play/board-card.tsx`) wraps every board in a size container; `--board-side` is the largest square the column and viewport allow, up to the page class's `--board-max`. `--board-below` is a hand-kept mirror of the rows under the card. The fold is 1024px, the page is `100svh`, the Recomeçar confirm overlays the hint, `.hintSlot` reserves the explanation, and free play's `GeneratingNote` is `BoardCard`'s `overlay`. The Cruzadinha's clues sit beside the grid from a 640px column (`crossword` container) and fold behind *Pistas* below it. Pinned by `T-WEB-S596…S605`; jsdom has no layout, so re-measure in a browser (360×780 to 1440×900) after any change to the shared sheet.

## Traps

**Turbo's cache for `packages/db` tests does not cover `apps/api/src`.** `users-updated-at.test.ts` scans `apps/api/src`, but the db test task's cache key does not include that folder, so pre-commit can replay a stale pass. Run `pnpm test --force` before trusting a green gate after an `apps/api` change. Content is not a Turbo input either: after editing `content/crossword/lexicon.tsv`, `content/termo/answers.csv` or `content/termo/reserve.txt`, run `generate:crossword` and `generate:termo` (`pnpm --filter @miolos/games`), then `pnpm test --force`. An answer extension moves words out of `reserve.txt` (ADR-0114); a published answer is never deleted.

**Dependabot npm PRs cannot be merged as opened.** They change one `package.json` and never `pnpm-lock.yaml`, so `--frozen-lockfile` fails. Land them as one hand-made bump across every pin, outside `minimumReleaseAge` (7 days).

**A perfect day needs a lineup buffered before midnight (ADR-0087).** If every buffer ran dry and all of a day's rows were inserted after `published_at`, that day cannot be perfect. The buffer alert exists to prevent that.

**A Rainhas record with `autoCrossed` fails the pre-#326 schema.** Rolling `apps/web` back past #326 drops a pending Rainhas completion saved with *Marcar ✕ automático* on; sync it first. **Six per-game medals is T-CORE-S70's maximum** (`queens-30` reached it); a seventh game raises that cap first, with a reason.

## Next

**Next:** #332 (the hint reason as a card by the hinted cell), the last quality-of-life item; then file per-game time buckets as an issue, and #317 (sync settings with the account, needs a migration).

**Queued:** #206 cluster 10's `Frame` half; the telemetry opt-out UI (ADR-0069 decision 5, #37); the remaining write routes onto `writePreamble` (`apps/api/src/http/write-preamble.ts`); #254; #205's CSS half (~1,820 lines, NOT a sweep); the `jsonResponse`/`stubFetch` Quick change; `T-WEB-S183`'s module walker onto `module-graph.ts`. `/modo-livre/cruzadinha` sits at 660.2 of 664 KB and CI's `bundle-check` fails a route over budget, so client code added there re-sizes that budget with a reason.
