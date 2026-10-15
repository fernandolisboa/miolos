# ADR-0114 — Termo free play draws from a pool that is never a daily answer

**Status:** Accepted — 2026-10-15 (issue #333)
**Depends on:** [ADR-0004](./0004-no-unpublished-puzzle-reaches-the-client.md), [ADR-0011](./0011-free-play-is-generated-on-the-client.md), [ADR-0015](./0015-termo-word-list-is-ai-curated-under-mechanical-constraints.md), [ADR-0088](./0088-cruzadinha-free-play-ships-the-lexicon-on-its-own-route.md), [ADR-0112](./0112-the-grid-game-routes-bundle-budget-is-a-leak-tripwire.md)
**Supersedes in part:** [ADR-0005](./0005-all-content-is-free.md), [ADR-0011](./0011-free-play-is-generated-on-the-client.md) and [ADR-0015](./0015-termo-word-list-is-ai-curated-under-mechanical-constraints.md) — "Termo is excluded from free play"; [ADR-0045](./0045-the-termo-screen-ships-no-hint-and-no-clock.md)'s Rejected "split `words.generated.ts`" and "a sub-barrel", and its decision 5(b), the second channel: a client can now derive the answers, but only mixed with the reserve and never the day's draw; [ADR-0019](./0019-per-game-subpath-exports-in-packages-games.md)'s one subpath per game; [ADR-0088](./0088-cruzadinha-free-play-ships-the-lexicon-on-its-own-route.md)'s Rejected "carving the route out of the markers", for `zurro` on one route.
**Amends:** [ADR-0046](./0046-free-play-routes-levels-and-the-ephemeral-session.md) decision 1, and decisions 2 and 3 (Termo plays without a level; its state is `{seed}`); [ADR-0047](./0047-bundle-markers-are-route-scoped.md)'s free-play scope; [ADR-0078](./0078-the-free-play-wall-is-proved-on-the-runtime-module-graph.md) decisions 1 and 2.

## Context

Fernando asked for Termo in free play (#333). It was excluded because the 400 curated answers are finite and free play would burn them. The crossword lexicon already holds 2,878 curated five-letter words, 2,806 of them guessable. The repository is public, so `answers.csv` is readable by anyone; what ADR-0004 protects is a day's answer before its day.

## Decision

1. **The free pool** is the five-letter crossword lexicon words that are in the guess dictionary, are not a daily answer and are not in the **reserve**: 2,187 words. The reserve, `content/termo/reserve.txt`, is the curated picks of `select_answers.py` that did not make `answers.csv` — the words a future answer extension draws from (ADR-0015). `generate:termo` renders the pool to `packages/games/src/termo-free/pool.generated.ts`; `drawFreeTermoWord(seed)` (`@miolos/games/termo-free`) draws one. The answer list is never spent by free play.
2. **The answer list moves to its own subpath**, `@miolos/games/termo-answers` (`TERMO_ANSWERS`, two `/*#__PURE__*/`). `@miolos/games/termo` keeps the engine and the dictionary. Only `apps/api` and tests import the new subpath; ESLint bans it, static and dynamic, in `apps/web/app/**` and `apps/web/src/**`.
3. **`/modo-livre/termo`** judges guesses on the device with `evaluateGuess`, records nothing, and ends on the free-play card with the finished board, "Mais uma" and the accented word. No hint, clock, streak, statistics or medal. ADR-0038 and ADR-0039 govern the daily; free Termo is judged on the device and plays offline.
4. **The free-play wall allow-lists the reused `termo/` modules** (board, keyboard, view, state, types, the board hook, its stylesheet). Any other `termo/` module, the daily ones included, stays banned in free play by default.
5. **Bundle check** (`route-client-js.mjs`):
   1. `/modo-livre/termo` carries the dictionary by design: its budget follows ADR-0112's margin, `zurro` is checked on the other free-play routes only, and `T-WEB-S704` proves it is the only free-play page reaching the dictionary.
   2. The answer pairs stay forbidden in every chunk, this route included; `T-WEB-S704` proves no page reaches `termo-answers`.
   3. The pool marker `ábaco\nabade` must be in this route's exclusive chunks and in no other chunk.

## Consequences

- **A client can derive answers ∪ reserve** ((lexicon ∩ dictionary) − pool, ~619 words, no dates). It can never single out a day's answer, and as the published answers drop out, the unpublished ones — the dailies already drawn into the buffer included — stay mixed with at least the reserve floor the pool test pins. Without the reserve, the end of the list would narrow that set to the buffered dailies, a day early (ADR-0004). ADR-0045 5(c) already keeps the answer list out of the security register.
- An answer extension moves words from `reserve.txt` into `answers.csv`; when the reserve floor test fails, add reserve words first.
- An answer removed from `answers.csv` after it was published would re-enter the pool on regeneration: re-curation moves published answers to `reserve.txt`, never deletes them.
- A lexicon, answers or reserve edit needs `generate:termo`; the pool's staleness test says so.
- The shared free-play card gained the finished-board slot, which tipped `/modo-livre/cruzadinha` over its budget; per ADR-0111 it is re-sized with ADR-0112's margin.

## Rejected

- **Keep Termo out of free play.** Fernando asked for it.
- **Replay published answers.** Repeats the dailies a player already solved.
- **Share the answer list.** Burns it.
- **Dictionary minus answers.** Thousands of rare inflections a player would not know, and the end-of-list narrowing above.
