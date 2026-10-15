# Do I need to do anything?

Nothing new. You said "sim" to a 7×7 daily Cruzadinha (#330) and picked logo E (#354, a brain whose lobes are grid cells); both shipped and are in Done. Open, low urgency: NOW §1 (#200), and NOW §2, the Google OAuth client and its two Vercel variables (#280, ADR-0089; Sign in with Google is dormant until then). Optional: ANY TIME has a real-phone check of the Sudoku _Número fixo_ double tap (#300). Attach your Gmail in Ajustes once to count as an admin. To work the ledger: _"run /wizard over docs/pending-fernando.md, NOW section"_.

## Start here

**Calendars** (the calendars thread): the Estatísticas months sit side by side in an auto-fill grid (`app/estatisticas/stats-calendar.tsx`, its own sheet), every day shows its numeral, and a missed day wears a hairline ring so it differs from an untracked one. The Arquivo index and month pages share one layout (`ArchiveBody` in `app/arquivo/archive-body.tsx`): previous / month / next on a larger card (`adjacentMonths`), then the month chips with the current one marked. Ajustes uses the width too (T-WEB-S800): `GameSettings` is a size container, so its groups split into two columns only above 50rem and the in-game dialog stays one column.

**Termo free play** (#333, ADR-0114): `free-play/termo-free-screen.tsx` plays through `useFreeTermoBoard` (`free-play/use-free-termo.ts`), which judges on the device and shares `termo/use-termo-board.ts` with the daily. The pool is `@miolos/games/termo-free`; the answer list is `@miolos/games/termo-answers`, banned in `apps/web` source.

**Hints** (ADR-0099, ADR-0101): each game's `next<Game>Hint` (`apps/web/src/<game>/hint.ts`) sits on `nextLogicalHint` (`play/grid-hint.ts`); the reason and spotlight live in `HintState<R>`. The reason shows in a card on the hinted cell (#332, ADR-0113): the chrome lazy-loads `HintCard` (`play/hint-card.tsx`); the visually hidden live region is the screen-reader copy, so tests read it through `SPOKEN` (`test/hint-reason.ts`). The loader ignores a chunk that lands after unmount (T-WEB-S720); that race was the `window is not defined` CI flake.

**Player settings** (#300, ADR-0102): one device-local key, `miolos-settings`, read through `useSettings` (`settings/settings.ts`). A new setting is a schema field, a copy entry and a key in `settings.games[game]`. Per-game options: ADR-0104 (struck clues), ADR-0105 (Rainhas), #322, #323, #325, #329. Account sync is #317.

**End flourish** (#353, ADR-0118): a game that ended in front of the player presses its stamp (win) or lets grey ink run (Termo loss). `useSawPlay`/`JustEnded` (`play/just-ended.ts`) decide "just ended" in `DailyScreen`/`ArchiveScreen`; `EndingFlourish` (`play/ending-flourish.tsx`) wraps the stamp. Setting `endAnimation`, on; reduced motion stands it down.

**`/admin`** (ADR-0097, ADR-0100): admins are verified attached emails in `admin_users`. The free hint allowance is the `freeHintsPerPuzzle` key (ADR-0098); before rolling either app back, set it to 3 or less and wait for the rollover.

**Shared play chrome** (ADR-0077): `PlayScreenChrome` holds three stateful children, `ResetControl` (ADR-0096), `GameSettingsButton` and `HintCard`. Control tips sit behind `InfoTip` (#331), whose open/close logic is `useTip` (`play/use-tip.ts`), shared with the earned medals that `artOf` (`medals/art.ts`) draws from their rule (ADR-0122); keyboards come from `qwertySlots` and `KeyGlyph` (#321); Termo's current row is editable (ADR-0106).

**Boards size from the space they have** (ADR-0103): `BoardCard` wraps every board in a size container; `--board-below` mirrors the rows under the card by hand. jsdom has no layout, so re-measure in a browser (360×780 to 1440×900) after any change to the shared sheet.

**Cruzadinha 7×7** (#330, ADR-0108, ADR-0111, ADR-0117): new dailies are generated at 7×7 (`attemptCrossword`); stored 5×5 days stay as they are, so every crossword schema takes either side and a day's size is its `grid.length`. The first 7×7 daily is due about 2026-10-22, once the 5×5 buffer runs out. Free play offers both through `ChoicePicker`; its builds wait a paint (`useFreeGeneration`), and tests await `flushGeneration()`.

**Brand mark** (#354, ADR-0119): `BrandMark` and `Wordmark` (`components/brand-mark.tsx`) sit in every top bar (the conclusion's included) and on the hub, which also shows `messages.brand.tagline` and `signOff`; a placeholder `BoardCard` shows the mark shuffling. The favicon is `app/icon.svg`; the PWA and apple PNGs come from `scripts/app-icon.svg` through `node scripts/render-icons.mjs`.

## Traps

**Turbo's cache for `packages/db` tests does not cover `apps/api/src`.** Run `pnpm test --force` before trusting a green gate after an `apps/api` change.

**Dependabot npm PRs cannot be merged as opened** (no lockfile change). Land one hand-made bump, outside `minimumReleaseAge` (7 days).

**A perfect day needs a lineup buffered before midnight (ADR-0087).** The buffer alert exists to prevent that. **Six per-game medals is T-CORE-S70's maximum.** A seventh game needs that cap raised first.

**Content is not a Turbo test input.** After editing `content/crossword/lexicon.tsv`, `content/termo/answers.csv` or `content/termo/reserve.txt`, run `generate:crossword`, `generate:termo` and `pnpm test --force`. Re-curation moves a published answer to `reserve.txt`, never deletes it (ADR-0114).

**Never roll either app back past #330 part 3 once a 7×7 day exists** (ADR-0117): the old API answers a 49-cell completion 400 and sync drops it for good. Stop 7×7 with a forward PR that generates at 5. Before about 2026-10-22, check both production deployments are on the merge commit. Likewise a Rainhas record with `autoCrossed` fails the pre-#326 schema: sync pending completions before rolling `apps/web` back past #326.

## Next

**Next:** the #321–#333 waves are done. File per-game time buckets as an issue (Cruzadinha times now mix 5×5 and 7×7 days), then #317 (settings sync, needs a migration).

**Queued:** #206 cluster 10's `Frame` half; the telemetry opt-out UI (#37); the remaining write routes onto `writePreamble`; #254; #205's CSS half (~1,820 lines, NOT a sweep); the `jsonResponse`/`stubFetch` Quick change; `T-WEB-S183`'s module walker onto `module-graph.ts`. `/modo-livre/cruzadinha` sits at 663.4 of 664 KB, `/modo-livre/termo` at 61.5 of 62 and `/modo-livre/nonogram` at 66.2 of 67 KB (ADR-0119, after #354).
