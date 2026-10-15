# ADR-0114 — Termo free play draws from a pool that is never a daily answer

**Status:** Accepted — 2026-10-15 (issue #333)
**Depends on:** [ADR-0004](./0004-no-unpublished-puzzle-reaches-the-client.md), [ADR-0011](./0011-free-play-is-generated-on-the-client.md), [ADR-0040](./0040-the-termo-daily-stores-the-drawn-answer.md), [ADR-0088](./0088-cruzadinha-free-play-ships-the-lexicon-on-its-own-route.md), [ADR-0112](./0112-the-grid-game-routes-bundle-budget-is-a-leak-tripwire.md)
**Supersedes in part:** [ADR-0005](./0005-all-content-is-free.md), [ADR-0011](./0011-free-play-is-generated-on-the-client.md) and [ADR-0015](./0015-termo-word-list-is-ai-curated-under-mechanical-constraints.md) — "Termo is excluded from free play"; [ADR-0045](./0045-the-termo-screen-ships-no-hint-and-no-clock.md)'s Rejected "split `words.generated.ts`" and "a sub-barrel"; [ADR-0019](./0019-per-game-subpath-exports-in-packages-games.md)'s one subpath per game; [ADR-0088](./0088-cruzadinha-free-play-ships-the-lexicon-on-its-own-route.md)'s Rejected "carving the route out of the markers", for `zurro` on one route.
**Amends:** [ADR-0046](./0046-free-play-routes-levels-and-the-ephemeral-session.md) decision 1, [ADR-0047](./0047-bundle-markers-are-route-scoped.md)'s free-play scope, [ADR-0078](./0078-the-free-play-wall-is-proved-on-the-runtime-module-graph.md) decisions 1 and 2.

## Context

Fernando asked for Termo in free play (#333). It was excluded because the 400 curated answers are finite and free play would burn them. The crossword lexicon already holds 2,878 curated five-letter words, 2,806 of them guessable.

## Decision

1. **The free pool** is the five-letter crossword lexicon words that are in the guess dictionary and are not a daily answer: 2,409 words, 330 accented. `generate:termo` renders it to `packages/games/src/termo-free/pool.generated.ts`; `drawFreeTermoWord(seed)` (`@miolos/games/termo-free`) draws one. The answer list is untouched and never spent by free play.
2. **The answer list moves to its own subpath**, `@miolos/games/termo-answers` (`TERMO_ANSWERS`, two `/*#__PURE__*/`). `@miolos/games/termo` keeps the engine and the dictionary, so a client reaches the answers by no import at all. Only `apps/api` and tests import the new subpath; ESLint bans it, static and dynamic, in `apps/web/app/**` and `apps/web/src/**`.
3. **`/modo-livre/termo`** judges guesses on the device with `evaluateGuess`, records nothing, and ends on the free-play card with "Mais uma" and the accented word. No hint, clock, streak, statistics or medal.
4. **The free-play wall allow-lists the reused `termo/` modules** (board, keyboard, view, state, types, the board hook, its stylesheet). Any other `termo/` module, the daily ones included, stays banned in free play by default.
5. **Bundle check.** `/modo-livre/termo` measured +59.4 KB raw over `/`; its budget is 64 KB, ADR-0112's ~4 KB margin. It carries the dictionary by design, so `zurro` is checked on the other six free-play routes only, and `T-WEB-S704` proves in CI that it is the only free-play page reaching the dictionary. The answer pairs stay forbidden in every chunk, this route included, and `T-WEB-S704` proves no page reaches `termo-answers`. The pool marker `ábaco\nabade` must be in this route's exclusive chunks and in no other chunk. A motif leak (~35 KB) or another route's generator still reds the budget; the crossword lexicon is caught by its own marker.

## Consequences

- **(lexicon ∩ dictionary) − pool is the answer set** (397 of 400). Minus the answers the archive has published, it is the set the next dailies draw from, shrinking toward the end of the list. Accepted: ADR-0004's threat is spoiler broadcast, ADR-0040 says the list is not a confidentiality boundary, and the day's draw stays on the server.
- Adding answers shrinks the pool on the next `generate:termo`, so a word met in free play may later be a daily.
- A lexicon or answers edit needs `generate:termo` too; the pool's staleness test says so.

## Rejected

- **Keep Termo out of free play.** Fernando asked for it.
- **Replay published answers.** Repeats the dailies a player already solved.
- **Share the answer list.** Burns it.
- **Dictionary minus answers.** Thousands of rare inflections a player would not know.
- **Hold back a decoy set.** It only delays the set-difference above; any later pool change reveals the same.
