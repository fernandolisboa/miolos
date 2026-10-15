# ADR-0112 — The grid-game routes' bundle budget is a leak tripwire, re-sized to 48 KB

**Status:** Accepted — 2026-10-15
**Amends:** [ADR-0054](./0054-the-share-is-plain-text-and-the-card-is-a-nameplate.md)'s *"Not raising `MAX_DELTA_BYTES` is right"* (the `/nonogram` slack paragraph); the 40 KB figure in [ADR-0027](./0027-the-hint-is-computed-on-the-client.md)'s instrument paragraph.

## Context

`pnpm --filter @miolos/web bundle-check` went red on `main` at `2282a1d`: `/nonogram` adds 42.0 KB over `/` against the 40 KB default (`MAX_DELTA_BYTES`), and `/modo-livre/nonogram` adds 60.2 KB against its 60 KB entry. The check is not in CI (#155), so the PRs that crossed the line did not see it. Nothing leaked. A source-map attribution of the route-only chunks shows the growth is the features Fernando asked for in #324 and #329 (`placed.ts`, `straight-stroke.ts`, the larger `use-pointer-stroke.ts` and settings panel), spread over many 0.3–2 KB modules, with no module duplicated across chunks. #344's branch (the shared `InfoTip`) adds about 1.8 KB to every grid route and also reds `/sudoku` (41.0) and `/rainhas` (41.5).

ADR-0054 kept the constant because it arms the motif tripwire, and named the `next/dynamic` conclusion boundary as the relief. That relief was spent at #145. What is left to lazy-load is small: the *Ajustes* panel (`GameSettings`) is about 2.4 KB per grid route, not enough for `/nonogram` even before #344, and it would add a chunk-failure path to a dialog.

## Decision

1. **`MAX_DELTA_BYTES` is 48 KB.** The default's job on the play routes is to catch a content leak, not to cap features. The leaks it exists for are far larger than the new headroom: the Nonogram motif tables are about 34 KB, the Termo answer list larger still, and both are also caught by name (`FORBIDDEN_DAILY_SCOPE`, `FORBIDDEN_EVERYWHERE`). The largest default-budget route measured with #344 is `/nonogram` at 43.8 KB, so 48 KB leaves about 4 KB.
2. **`/modo-livre/nonogram` is 66 KB**: 61.9 KB measured with #344, plus the same ~4 KB.
3. `/termo`, `/arquivo/[data]/termo`, `/modo-livre/cruzadinha` and every marker are unchanged.

## Consequences

- One constant moves rather than six per-route entries; the other routes it covers sit at most 16 KB over `/` (the conclusions) or below it, so the looser default changes nothing they can catch.
- The next relief, when 48 KB is reached, is named here so the constant is not the first move: load the *Ajustes* panel through `next/dynamic` behind the existing chunk-boundary pattern (~2.4 KB per grid route), or split `playRecordSchema`'s six-game union (`apps/web/src/play/play-record.ts`, 4.5 KB on every play route).
- `/modo-livre/cruzadinha` stands at 658.3 of 660 KB; #330 part 2 (the 7×7 picker) re-measures it.
- Until #155 puts the check in CI, any PR that touches a play route runs it by hand.

## Rejected

- **Trim to fit 40 KB.** No single cheap cut gets `/nonogram` under 40 KB with #344 in; the cuts that come close are refactors with their own failure modes.
- **Per-route entries for `/nonogram`, `/sudoku` and `/rainhas`.** Three numbers that drift together; the next feature reds the fourth.
