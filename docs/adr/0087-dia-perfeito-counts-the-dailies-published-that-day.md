# ADR-0087 — Dia Perfeito counts the dailies published that day

**Status:** Accepted — 2026-09-28 (issue #276)
**Depends on:** [ADR-0008](./0008-completion-and-streak-semantics-across-play-modes.md), [ADR-0024](./0024-buffer-stores-validated-content-reads-strip-inside-the-wall.md), [ADR-0051](./0051-statistics-are-read-time-derivations-on-closed-contracts.md), [ADR-0052](./0052-medals-are-derived-facts-plus-curated-grants.md), [ADR-0086](./0086-the-cruzadinha-daily-ships-its-letters.md)
**Amends:** ADR-0008 rule 4 (*"all four dailies"*). ADR-0051 decision 1: the derivations gain a second, read-only input. ADR-0052 decision 2: monotonicity now holds under a fixed lineup. ADR-0052 decision 3: breadth is the original four.

## Context

ADR-0008 rule 4 defines Dia Perfeito as all four dailies won on time, and `perfectDays` compared against `GAMES.length`. With a fifth game, "every game" would un-perfect every past day and take back the `perfect-*` medals. A day with no Termo daily (#200) could never be perfect. Whether the Cruzadinha counts is still open with Fernando (ledger NOW §2). This ADR records the default, option (a).

## Decision

1. **A date is perfect iff its lineup is non-empty and every game in it was won on time.** The lineup is the day's `daily_puzzles` rows that are published, not killed, and have `created_at <= published_at`. That last condition means the row was buffered before its day began.
2. **`requiredOn(date, published)`** in `packages/core/src/stats.ts` decides which games a date requires. `perfectDays`, `computeStats`, `computeCalendar` and `earnedMedals` take the lineup as `published: readonly PublishedDaily[]`.
3. **`listPublishedDailiesOnWonDates`** (`packages/db/src/published.ts`, exported from `@miolos/db/user` only) reads the lineup of the user's on-time-won dates. It reuses `publishedConjuncts()`.
4. **`crossword-30` is added** after `termo-30`, making 24 medals. **`all-games` stays on `ORIGINAL_GAMES`**, which is local to `medals/derive.ts`. Nobody loses it, and its copy ("quatro jogos") stays true.

## Consequences

- Past dates keep their four games. A day published before a game existed is perfect with fewer games, so the change only adds perfect days. A dark-Termo day is perfect with the other games, which is #200's option (c).
- On launch day, the cron inserts the first crossword after midnight, so the crossword is not required that day. A four-game perfect day earned before the insert stays perfect. The same happens whenever the buffer runs dry: a late row is not required. If every row of a day is late, the lineup is empty and the day cannot be perfect.
- **The one remaining way to lose a perfect day is un-killing a row.** When `killed_at` goes back to null, that daily becomes required again.
- Adding completion rows still never takes a medal away when the lineup is fixed (T-CORE-S75). Only the kill switch changes the lineup of a past day.
- Stats, calendar and medals reads each make one extra query.
- **Switching to "only the original four" is not a one-line change.** `requiredOn` would return `ORIGINAL_GAMES`, and the lineup would then have no use. Removing it touches four core signatures, three API routes and the db reader. No data changes.

## Rejected

- **A launch-date constant.** It is a second clock, and it still gets dark-Termo days wrong.
- **Always every game in `GAMES`.** It un-perfects every past day and takes back `perfect-*` medals.
- **`all-games` over `GAMES`.** It takes the medal back from everyone who earned it before the Cruzadinha.
- **A lineup without the `created_at` filter.** A crossword inserted after midnight on launch day would take back a perfect day that had already been earned.
