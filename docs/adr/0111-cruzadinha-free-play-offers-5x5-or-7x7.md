# ADR-0111 — Cruzadinha free play offers 5×5 or 7×7

**Status:** Accepted — 2026-10-15 (issue #330)
**Depends on:** [ADR-0046](./0046-free-play-routes-levels-and-the-ephemeral-session.md), [ADR-0088](./0088-cruzadinha-free-play-ships-the-lexicon-on-its-own-route.md), [ADR-0103](./0103-boards-size-from-the-space-they-have-not-from-fixed-cells.md), [ADR-0108](./0108-the-cruzadinha-size-is-a-parameter-and-the-lexicon-reaches-seven-letters.md)
**Amends:** ADR-0046 decisions 2 and 3 for the Cruzadinha, and its main-thread consequence; ADR-0088 decisions 1 and 2; ADR-0103 decision 8; ADR-0108 decision 2 and its last consequence.

## Context

ADR-0108 gave the engine a 7×7 grid and left the player's choice for later. The daily and archive stay 5×5. Free play had no choice at all (ADR-0088 decision 2: no level, state `{seed}`), and a 7×7 build can block the main thread for up to 653 ms on its throw path.

## Decision

1. **A *Tamanho* picker, 5×5 or 7×7, default 5×5.** It is the same radiogroup as the level picker, generalised to `ChoicePicker<T>` (`free-play/choice-picker.tsx`), which the four level screens also use. The size lives in component state, never in the URL or storage (ADR-0046 decisions 2 and 4). The free crossword's state is `{seed, size}`; "Mais uma" keeps the size. The stat and the solved card name it ("7×7").
2. **One projection, sized by its caller.** `projectCrossword(date, puzzle, size)` in `@miolos/core` picks the same allowlist at any size and parses it with a schema built for that size. The daily strip passes `DAILY_CROSSWORD_SIZE` (5), so `dailyCrosswordResponseSchema` and `crosswordDailyContentSchema` stay exactly 5×5. This is where ADR-0108 decision 2's split lands: free play never reads stored content, so the split is on the response, not the content schema. There is no size schema: the size never crosses a boundary, and the engine's output is parsed at the side that was asked for.
3. **The board takes its side from the puzzle.** `apps/web/src/crossword/` reads `daily.grid.length`; no 5 is left in it. A 7×7 page sets `--board-min: 232px` on its page modifier (`.pageSize7`), the smallest 4px step that keeps 7×7 cells at 24px or more (ADR-0103 decision 3); the 5×5 floor stays 200px.
4. **Free play builds after a paint.** `useFreeGeneration` schedules every build with `requestAnimationFrame` then `setTimeout(0)`, and cancels both on cleanup. After a click React runs the effect before painting, so without this the *generating* note never shows before a slow build. It is in the shared hook, so the Sudoku level switch gets it too.

## Consequences

- Every first build waits one frame; a hidden tab builds when it becomes visible.
- A size switch and back inside one frame rebuilds at the first size with a fresh seed.
- The route bundle: see the PR's `bundle-check` output; `/modo-livre/cruzadinha` stays under its 660 KB budget.
- The daily's size remains Fernando's call, now that 7×7 can be played (`docs/pending-fernando.md`).

## Rejected

- **A Web Worker.** The lexicon would need its own worker chunk, outside ADR-0088's one-importer wall and the route attribution of `bundle-check`; 6.7 ms mean and 143 ms max per 7×7 puzzle do not pay for that.
- **A second picker component.** It would copy the roving tabindex and arrow handling of the level picker.
- **A free-play response type.** It would infer to the same shape as `DailyCrosswordResponse`; Queens and Nonogram already play several sizes on their daily response types.
