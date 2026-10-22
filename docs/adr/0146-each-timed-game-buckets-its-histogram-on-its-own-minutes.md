# ADR-0146 — Each timed game buckets its histogram on its own minutes

**Status:** Accepted — 2026-10-22 (issue #415)
**Depends on:** [ADR-0051](./0051-statistics-are-read-time-derivations-on-closed-contracts.md)

## Context

Six timed games shared one histogram, cut at 4, 5, 6, 7 and 9 minutes. Rainhas and Campo Minado are short games and a 7×7 Cruzadinha (ADR-0117) is a long one, so most of their solves fall in one end bar and the chart says nothing. The repo holds no solve-time data to fit bounds against.

## Decision

1. `TIME_BUCKET_BOUNDS_MS` in `packages/core/src/stats.ts` is a literal `Record<TimedGame, five bounds>` in whole minutes, chosen from each game's workload: short games top out near 6 to 8 minutes, long ones near 15 or 16. The table is the source of truth; `T-CORE-S204` pins it.
2. `timeBucketIndex(game, elapsedMs)` counts the bounds at or below the time, as before. `computeStats` passes each block's own game.
3. The contract does not change: `timedGameStatsSchema` keeps its six counts, and the server sends no bounds.
4. The web derives the labels and spoken names from the table: `timeBuckets(game)` in `apps/web/src/stats/time-buckets.ts`, over three templates each in `messages.stats.histogram` (`under`, `between`, `over`). Labels never wrap.

## Consequences

- Past days re-bucket at read time: `/stats` recomputes from the rows on every GET (ADR-0051), so no backfill exists.
- A tab open across the deploy shows the old labels over the new counts until it reloads. `apps/api` and `apps/web` deploy separately, so the skew can also run the other way for a few minutes.
- Labels reach five characters (`12–16`), so below 360 px the conclusion's histogram gap shrinks.
- Cruzadinha's all-time best may stay a 5×5 time; the histogram does not split by grid size.
- F5's histogram labels (`<4 … >9 min`) in the frozen snapshot `docs/design/006-handoff-design-winner-atelie/README.md` no longer describe the product; `DESIGN.md` is the live spec.
- The bounds are guesses. Re-tune them from PostHog's median `elapsed_ms` per game (`docs/pending-fernando.md`).

## Rejected

- **Bounds sent by the server:** `statsResponseSchema` is strict, so an old client would reject the new field and drop `/stats` entirely.
- **Per-weekday or percentile bars:** they need data the repo does not have, and a percentile bar moves under the player.
- **One shared ladder scaled by a per-game reference time** (R × ½, ¾, 1, 1½, 2): half minutes make poor labels, and no single span fits both Nonogram's 5×5 Monday and its 15×15 weekend.
