# ADR-0117 — The daily Cruzadinha is 7×7

**Status:** Accepted — 2026-10-15 (issue #330)
**Depends on:** [ADR-0024](./0024-buffer-stores-validated-content-reads-strip-inside-the-wall.md), [ADR-0086](./0086-the-cruzadinha-daily-ships-its-letters.md), [ADR-0103](./0103-boards-size-from-the-space-they-have-not-from-fixed-cells.md), [ADR-0108](./0108-the-cruzadinha-size-is-a-parameter-and-the-lexicon-reaches-seven-letters.md), [ADR-0111](./0111-cruzadinha-free-play-offers-5x5-or-7x7.md)
**Supersedes in part:** ADR-0108 decision 2 (the daily stays 5×5); ADR-0111 decision 2 (one projection sized by its caller, no size schema) and its last consequence (the daily's size is Fernando's call).
**Amends:** ADR-0086 decisions 1 and 4 and its cron-cost line; ADR-0103 decision 8 (the 232px 7×7 floor now applies to the daily and the archive too).

## Context

Fernando answered "sim" on 2026-10-15: the daily Cruzadinha becomes 7×7. The buffer already holds about `bufferDepth` 5×5 days, the archive holds every past one, and players hold in-progress 5×5 games and queued completions. All of them must keep working: a day's content never changes once stored (ADR-0024).

## Decision

1. **New dailies are generated at 7×7; stored rows are never rewritten.** `attemptCrossword` (`apps/api/src/publishing/service.ts`) calls `generateCrossword(seed, 7)`; the engine's default stays 5, so the golden hash holds. `topUpBuffer` only fills missing dates, so the first 7×7 day lands about `bufferDepth` days after the deploy. The size constant lives in the API, not in `@miolos/core`: it is the generation size, not the size of any given day.
2. **One crossword schema for every size, sized by its grid.** `crosswordGridSchema` (`packages/core/src/contracts/daily.ts`) is a square whose side is in `CROSSWORD_SIZES`; clue indices and lengths are capped at 7, and the white-cell check reads `grid.length`. `projectCrossword(date, puzzle)` takes no size. Completion bodies and play records take 25 or 49 cells through one `crosswordCellsSchema`. Zod refuses a union member inside `z.discriminatedUnion`, so a per-size union cannot sit in `dailyPuzzleResponseSchema`; one object with a refine is the Nonogram and Rainhas precedent.
3. **No `size` field on the response or the play record.** The grid already carries it. A new key on the strict `crosswordPlayRecordSchema` would fail to parse every stored record, and `parseAt` drops a record that fails, so in-progress games and pending syncs would be lost silently.

## Consequences

- **Rollback rolls forward.** Once a 7×7 row exists, an `apps/api` rolled back past this change answers `/completions` 400 to a 49-cell body, and `apps/web/src/play/sync.ts` treats 400 as terminal: the completion and its streak credit are dropped for good. An `apps/web` rolled back cannot parse the 7×7 day at all. To stop 7×7, ship a forward change that sets the generation size back to 5 and keeps the widened readers.
- Generation per date: 7×7 averages 6.7 ms, 143 ms at most, and the throw path is 8 × 653 ms ≈ 5.2 s against the cron's `maxDuration: 60` (`apps/api/vercel.json`). A backfill multiplies that by the number of dates. The cron order (`COST_ASCENDING_GAMES`) stays.
- Best time and average mix 5×5 and 7×7 days, as Nonogram already mixes sizes; per-game time buckets are queued in `NEXT-SESSION.md`.
- Measured in Chromium on the daily and archive pages: 27px cells at 360×780 and at 320 wide, keyboard and *Usar dica* in reach; at 360×780 the daily scrolls 12px, the archive as its 5×5 already did.

## Rejected

- **Regenerating the buffered 5×5 rows.** A production write with no code path, to gain one week.
- **Alternating sizes by weekday.** Fernando chose *sim*, not *alterna*.
- **A `size` field.** See decision 3.
