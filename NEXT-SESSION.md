# Do I need to do anything?

Nothing new from #332 or #155. Open, low urgency: NOW §1 (#200), and NOW §2, the Google OAuth client and its two Vercel variables (#280, ADR-0089; Sign in with Google is dormant until then). Optional: ANY TIME has a real-phone check of the Sudoku *Número fixo* double tap (#300). Attach your Gmail in Ajustes once to count as an admin. To work the ledger: *"run /wizard over docs/pending-fernando.md, NOW section"*.

## Start here

**Hints** (ADR-0099, ADR-0101): each game's `next<Game>Hint` (`apps/web/src/<game>/hint.ts`) sits on `nextLogicalHint` (`play/grid-hint.ts`); the reason and spotlight live in `HintState<R>`. The reason shows in a card on the hinted cell (#332, ADR-0113): the chrome lazy-loads `HintCard` (`play/hint-card.tsx`); the visually hidden live region is the screen-reader copy, so tests read it through `SPOKEN` (`test/hint-reason.ts`).

**Player settings** (#300, ADR-0102): one device-local key, `miolos-settings`, read through `useSettings` (`settings/settings.ts`). A new setting is a schema field, a copy entry and a key in `settings.games[game]`. Per-game options: ADR-0104 (struck clues), ADR-0105 (Rainhas), #322, #323, #325, #329. Account sync is #317.

**`/admin`** (ADR-0097, ADR-0100): admins are verified attached emails in `admin_users`. The free hint allowance is the `freeHintsPerPuzzle` key (ADR-0098); before rolling either app back, set it to 3 or less and wait for the rollover.

**Shared play chrome** (ADR-0077): `PlayScreenChrome` holds three stateful children, `ResetControl` (ADR-0096), `GameSettingsButton` and `HintCard`. Control tips sit behind `InfoTip` (#331); keyboards come from `qwertySlots` and `KeyGlyph` (#321); Termo's current row is editable (ADR-0106).

**Boards size from the space they have** (ADR-0103): `BoardCard` wraps every board in a size container; `--board-below` mirrors the rows under the card by hand. jsdom has no layout, so re-measure in a browser (360×780 to 1440×900) after any change to the shared sheet.

**Cruzadinha 7×7** (ADR-0108): `generateCrossword(seed, 7)` works; `golden.test.ts` pins 5×5.

## Traps

**Turbo's cache for `packages/db` tests does not cover `apps/api/src`.** Run `pnpm test --force` before trusting a green gate after an `apps/api` change.

**Dependabot npm PRs cannot be merged as opened** (no lockfile change). Land one hand-made bump, outside `minimumReleaseAge` (7 days).

**A perfect day needs a lineup buffered before midnight (ADR-0087).** The buffer alert exists to prevent that.

**Six per-game medals is T-CORE-S70's maximum.** A seventh game needs that cap raised first.

**The crossword lexicon is not a Turbo test input.** After editing it, run `generate:crossword` and `pnpm test --force`.

**A Rainhas record with `autoCrossed` fails the pre-#326 schema.** Sync pending completions before rolling `apps/web` back past #326.

## Next

**Next:** #330 part 2 (PR #346, the 7×7 picker in Cruzadinha free play) and #333 (Termo free play, in its own thread). Then file per-game time buckets as an issue, and #317 (settings sync, needs a migration).

**Queued:** #206 cluster 10's `Frame` half; the telemetry opt-out UI (#37); the remaining write routes onto `writePreamble`; #254; #205's CSS half (~1,820 lines, NOT a sweep); the `jsonResponse`/`stubFetch` Quick change; `T-WEB-S183`'s module walker onto `module-graph.ts`.
