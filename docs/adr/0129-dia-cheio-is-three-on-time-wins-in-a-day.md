# ADR-0129 — Dia Cheio is three on-time wins in a day

**Status:** Accepted — 2026-10-15 (issue #370)
**Depends on:** [ADR-0048](./0048-the-streak-is-a-client-fetched-server-computed-value.md), [ADR-0051](./0051-statistics-are-read-time-derivations-on-closed-contracts.md), [ADR-0122](./0122-earned-medals-are-drawn-as-medals-side-by-side.md)
**Amends:** [ADR-0008](./0008-completion-and-streak-semantics-across-play-modes.md) rules 2 and 3 (late completions and a lost Termo never feed Dia Cheio either). [ADR-0052](./0052-medals-are-derived-facts-plus-curated-grants.md) decision 3 (Dia Cheio counts via `fullDays` join the sanctioned inputs), decision 7 (the quota table) and decision 10 (`/estatisticas` makes four reads, not three). [ADR-0087](./0087-dia-perfeito-counts-the-dailies-published-that-day.md) (a second tier measured against the lineup).

## Context

Fernando, 2026-10-15: needing every game for a Dia Perfeito is too heavy to keep people playing; the reward should be progressive, "mínimo é completar 3 jogos, fez todos ganha uma medalha top". One on-time win keeps the streak; the next reward was the whole lineup, with nothing between.

## Decision

1. **A date is a Dia Cheio when its distinct games won on time reach `min(3, lineup size)`**, or 3 when the date has no lineup. Every Dia Perfeito is a Dia Cheio. The count is over every on-time win of that date, so a win on a daily outside the lineup (minted late, or killed after play) still counts. The lineup sets only the threshold.
2. **One rule, one place:** `dayMarkOf(won, lineup)` in `packages/core/src/stats.ts` returns `"full"`, `"perfect"` or nothing. `perfectDays`, `fullDays`, `earnedMedals` and the hub stamp all call it. `3` is the constant `FULL_DAY_GAMES`, never a share of the roster.
3. **A new read, not a wider contract:** `GET /stats/full-days` answers `{ dates }`, strict, built from the same `fullDays(rows, published)` the medals use. `/stats` and `/stats/calendar` stay byte-identical, as ADR-0048 d3 and ADR-0051 d3 require for growth.
4. **Surfaces, each an earned fact:** a "Dia Cheio" or "Dia Perfeito" ink stamp beside "X de N concluídos" on the hub, only once earned; a ring on the calendar's on-time cell (the diamond stays Dia Perfeito's), named in the legend only when one shows; a "Dias Cheios" numeral before "Dias Perfeitos"; three medals `full-1`, `full-10`, `full-50` of rule kind `fullDaysReached`, appended at the end of the catalog so no tilt moves.

## Consequences

- No migration: everything derives on read from `completions` and `daily_puzzles`.
- Any deploy order is safe. An old web never calls the new route; a new web against an old API gets a 404, so the numeral and the ring render nothing.
- The hub counts against `DAY_GAMES` while the server counts against the lineup, so on a day with a killed daily they can disagree; "X de 6" already did.
- `derive.ts` drops rows dated after today and the route does not; the write window cannot create such rows.

## Rejected

- **Half the lineup, or 4 games.** "3" is what Fernando named, and it stays reachable on a short lineup.
- **Counting only lineup games.** It drops real on-time wins on a late-minted daily.
- **A run of Dias Cheios.** A second streak; ADR-0051 and ADR-0052 reject runs beyond the streak.
- **Renaming `perfect` to a `mark` field on `/stats/calendar`.** Strict schemas on both ends make every deploy order break `/estatisticas` for stale tabs.
