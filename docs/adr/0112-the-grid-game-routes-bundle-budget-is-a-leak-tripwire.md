# ADR-0112 — The grid-game routes' bundle budget is a leak tripwire, re-sized to 48 KB

**Status:** Accepted — 2026-10-15
**Amends:** [ADR-0045](./0045-the-termo-screen-ships-no-hint-and-no-clock.md) decision 7 (*"the shared `MAX_DELTA_BYTES` is not raised"*); [ADR-0054](./0054-the-share-is-plain-text-and-the-card-is-a-nameplate.md)'s *"Not raising `MAX_DELTA_BYTES` is right"* (the `/nonogram` slack paragraph); the 40 KB figure in [ADR-0027](./0027-the-hint-is-computed-on-the-client.md)'s instrument paragraph, [ADR-0056](./0056-the-record-snapshot-cache-is-per-key-and-the-done-chip-wears-the-hub-word.md) and [ADR-0076](./0076-the-shared-route-envelope-takes-a-render-callback-not-a-screen-registry.md).

## Context

`pnpm --filter @miolos/web bundle-check` was measured red on `main` at `2282a1d`: `/nonogram` adds 42.0 KB over `/` against the 40 KB default (`MAX_DELTA_BYTES`), and `/modo-livre/nonogram` adds 60.2 KB against its 60 KB entry. The line was crossed by #324 and #329 (PRs #339, #342); the check is not in CI (#155), so neither saw it. Nothing leaked. A source-map attribution of the route-only chunks puts the growth in those features' modules (`placed.ts`, `straight-stroke.ts`, the larger `use-pointer-stroke.ts` and settings panel), many 0.3–2 KB files, with no module duplicated across chunks. #344's shared `InfoTip` adds about 1.8 KB to `/nonogram`, `/sudoku`, `/rainhas` and `/binairo` and their archive and free-play routes, and reds `/sudoku` (41.0) and `/rainhas` (41.5) too.

ADR-0045 and ADR-0054 kept the constant because raising it would un-arm the leak tripwire, and ADR-0054 named the `next/dynamic` conclusion boundary as the relief. That relief was spent at #145. What is left to lazy-load is small: the *Ajustes* panel (`GameSettings`) is about 2.4 KB per grid route, short of the ~3.8 KB `/nonogram` needs with #344, and it adds a chunk-failure path to a dialog.

## Decision

1. **`MAX_DELTA_BYTES` is 48 KB**, about 4 KB over the largest default-budget route measured with #344 (`/nonogram`, 43.8 KB). The tripwire stays armed for the two large leaks it guards: the Nonogram motif tables (~35 KB) and the Termo validation dictionary (~36 KB) both still clear 48 KB on every play and conclusion route, the tightest being a conclusion route at ~51 KB. The motifs are also caught by name (`FORBIDDEN_DAILY_SCOPE`); on the daily routes the dictionary is caught by size alone. The Termo answer list (~2.8 KB) was never caught by size and is caught by name (`FORBIDDEN_EVERYWHERE`). Routes that sit below `/` (`/estatisticas`, the archive index, month and day pages, `/modo-livre`) were never guarded by size: the motifs are caught there by name, and the dictionary by nothing, at 40 KB as at 48.
2. **`/modo-livre/nonogram` is 66 KB**: 61.9 KB measured with #344, plus the same ~4 KB.
3. `/termo`, `/arquivo/[data]/termo`, `/modo-livre/cruzadinha` and every marker are unchanged.

## Consequences

- One constant moves, not per-route entries for the play routes. The margin on the known leaks narrows to about 3 KB on the conclusion routes (~16–17 KB over `/`), and an unnamed leak of roughly 23–31 KB there, red at 40 KB, now passes.
- The next relief, when 48 KB is reached, is named so the constant is not the first move: load the *Ajustes* panel through `next/dynamic` behind the existing chunk-boundary pattern (~2.4 KB per grid route). Splitting `playRecordSchema`'s six-game union (`apps/web/src/play/play-record.ts`, 4.5 KB on every play route) is a refactor behind `readPlayRecord`, not a cut.
- `/modo-livre/cruzadinha` stands at 658.3 of 660 KB; #330 part 2 (the 7×7 picker) re-measures it.
- Until #155 puts the check in CI, any PR that touches a play route runs it by hand.

## Rejected

- **Trim to fit 40 KB.** No single cheap cut gets `/nonogram` under 40 KB with #344 in; the cuts that come close are refactors with their own failure modes.
- **Per-route entries for `/nonogram`, `/sudoku` and `/rainhas`.** Three numbers that drift together; the next feature reds the fourth.
