# ADR-0111 — Cruzadinha free play offers 5×5 or 7×7

**Status:** Accepted — 2026-10-15 (issue #330)
**Depends on:** [ADR-0046](./0046-free-play-routes-levels-and-the-ephemeral-session.md), [ADR-0088](./0088-cruzadinha-free-play-ships-the-lexicon-on-its-own-route.md), [ADR-0103](./0103-boards-size-from-the-space-they-have-not-from-fixed-cells.md), [ADR-0108](./0108-the-cruzadinha-size-is-a-parameter-and-the-lexicon-reaches-seven-letters.md)
**Amends:** ADR-0046 decisions 2 and 3 for the Cruzadinha, and its main-thread consequence; ADR-0088 decisions 1 and 2; ADR-0103 decision 8; ADR-0108 decision 2 and its last consequence.

## Context

ADR-0108 gave the engine a 7×7 grid and left the player's choice for later. The daily and archive stay 5×5. Free play had no choice at all (ADR-0088 decision 2: no level, state `{seed}`), and a 7×7 build blocks the main thread: 6.7 ms on average, 143 ms at worst when it fills, 653 ms when every attempt fails and it throws (ADR-0108).

## Decision

1. **A *Tamanho* picker, 5×5 or 7×7, default 5×5.** It is the same radiogroup as the level picker, generalised to `ChoicePicker<T>` (`free-play/choice-picker.tsx`), which the four level screens also use. The size lives in component state, never in the URL or storage (ADR-0046 decisions 2 and 4). The free crossword's state is `{seed, size}`; "Mais uma" keeps the size. The stat and the solved card name it ("7×7").
2. **One projection, sized by its caller.** `projectCrossword(date, puzzle, size)` in `@miolos/core` picks the same allowlist at any size and parses it with a schema built for that size. The daily strip passes `DAILY_CROSSWORD_SIZE` (5), so `dailyCrosswordResponseSchema` and `crosswordDailyContentSchema` stay exactly 5×5. This is where ADR-0108 decision 2's split lands: free play never reads stored content, so the split is on the response, not the content schema. There is no size schema: the size never crosses a boundary, and the engine's output is parsed at the side that was asked for.
3. **The board takes its side from the puzzle.** `apps/web/src/crossword/` reads `daily.grid.length`; no 5 is left in it. A 7×7 page sets `--board-min: 232px` on its page modifier (`.pageSize7`), the smallest 4px step that keeps 7×7 cells at 24px or more (ADR-0103 decision 3); the 5×5 floor stays 200px. The grid takes its tracks from `--crossword-size`, set inline from the side (`crossword/size-classes.ts`); at 7×7 clue numbers drop to 9px and letters sit low in the cell, so two-digit numbers never touch them.
4. **Free play builds after a paint.** `useFreeGeneration` schedules every build with `requestAnimationFrame` then `setTimeout(0)`, and cancels both on cleanup. After a click React runs the effect before painting, so without this the *generating* note never shows before a slow build. It is in the shared hook, so the Sudoku level switch gets it too.

## Consequences

- Every first build waits one frame; a hidden tab builds when it becomes visible.
- A size switch and back inside one frame shows the old puzzle for a frame, then rebuilds it with a fresh seed.
- At 360×780 the 7×7 board sits at its 232px floor and the keyboard still fits under it; shorter phones scroll (ADR-0103 decision 3).
- `/modo-livre/cruzadinha` adds 659.6 KB raw / 158.8 KB gzip over `/`, 0.4 KB under its 660 KB budget (main: 658.3). The next client change on that route re-sizes the budget with a reason.
- The daily's size remains Fernando's call, now that 7×7 can be played (`docs/pending-fernando.md`).

## Rejected

- **A Web Worker.** The lexicon would need its own worker chunk, outside ADR-0088's one-importer wall and the route attribution of `bundle-check`; the build times above do not pay for that.
- **A second picker component.** It would copy the roving tabindex and arrow handling of the level picker.
- **A free-play response type.** It would infer to the same shape as `DailyCrosswordResponse`; Queens and Nonogram already play several sizes on their daily response types.
