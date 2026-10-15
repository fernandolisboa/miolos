# ADR-0135 — Termo free play offers Dueto and Quarteto as variants

**Status:** Accepted — 2026-10-15 (issue #374)
**Amends:** [ADR-0114](./0114-termo-free-play-draws-from-a-pool-that-is-never-a-daily-answer.md) decision 1 (`drawFreeTermoWords(seed, count)` draws N distinct pool words); [ADR-0046](./0046-free-play-routes-levels-and-the-ephemeral-session.md) decisions 2 and 3 (Termo gains a _Variante_; its state is `{seed, variant}`, in component state, never the URL); [ADR-0042](./0042-the-termo-board-is-read-only-output.md) decision 5 (on a variant keyboard the marks sit on per-board segments); [ADR-0106](./0106-the-termo-current-row-is-editable.md) decision 5 (only the first open board's row is editable); [ADR-0123](./0123-on-a-phone-the-rules-sit-behind-an-i-and-the-hint-shares-the-reset-row.md) decision 1 (on a phone Quarteto drops the title block and the variant menu carries the rules); [ADR-0112](./0112-the-grid-game-routes-bundle-budget-is-a-leak-tripwire.md) (`/modo-livre/termo` re-sized).
**Depends on:** [ADR-0041](./0041-accents-colour-shapes-never-words.md), [ADR-0103](./0103-boards-size-from-the-space-they-have-not-from-fixed-cells.md), [ADR-0113](./0113-the-hint-reason-shows-in-a-card-on-the-hinted-cell.md)

## Context

Fernando asked for more ways to play the other games. Termo's are the well-known multi-board ones: one guess is played on several boards at once, with a few more rows than boards. Free play has the room; the daily stays one word (out of scope: daily, archive, statistics, medals, URL state).

## Decision

1. **A _Variante_ choice on `/modo-livre/termo`:** Clássico (1 board, 6 rows), Dueto (2 boards, 7 rows), Quarteto (4 boards, 9 rows), from `TERMO_VARIANTS` (`@miolos/games/termo`). The word is "Variante", never "Modo" (free play is already a mode).
2. **One engine call judges every board.** `judgeBoards(guesses, answers, maxGuesses)` (`termo/judge-boards.ts`) gives each board its rows up to the guess that found its word; the game is won when every board is, lost when the rows run out.
3. **The draft is the shared seam.** `editDraft`/`submittedWord` (`termo/state.ts`) serve the daily reducer and `useTermoVariant` alike. As in the daily, `submit` holds the word and clears the notice, and a separate `judged` step on the next commit appends it and writes the announcer, so ADR-0042 decision 10's disjoint writers hold. Only the first open board holds the editable row (ADR-0106); the others mirror the draft as typed tiles. When that board closes, the shared `refocusRef` moves focus to the next.
4. **A variant key is split into one segment per open board**: `correct` fills the segment with the accent, `present` frames it in inset `--ink`, `absent` tints it with an `--ink-2` slash. The glyph keeps a paper halo over the segments. A key absent on every open board is struck as in Clássico. Its name lists each board's mark (`letterAria`).
5. **The variant code is one lazy chunk.** `termo-variants.tsx` and everything only it reaches load through `lazyChunk` after mount; the trigger opens the menu only once the chunk is in and retries it when tapped before. So there is no variant skeleton or error card: while the chunk is out, Clássico plays and the menu waits. `next/dynamic` is rejected for ADR-0113's reason (its own runtime on the route); `React.lazy` because a switch would flash a Suspense fallback.
6. **Layout runs on custom-property hooks** in the shared sheets, defaulted to today's values: `--boards-across` (tile font), `--tile-gap`, `--notice-min`, `--keyboard-gap`, `--grid-card-pad`, `--title-display`. Quarteto is four across at 1120px and up, where its column holds 24px tiles, two by two below. On a phone it drops the whole title block (its heading and (i)), tightens gaps and the notice row (28px, still reserved: ADR-0042 decision 10 stands), so a 780px-tall phone keeps 24.5px tiles with the keyboard on screen. Every `--board-min` × `--board-aspect` is the card width at 24px tiles, so a shorter screen scrolls rather than shrinks under ADR-0103's floor. The variant menu, one tap away in the top bar, shows the chosen variant's full rules at every width.
7. **The free-play card names every word** ("As palavras eram") and shows every finished board; its props are `words` and `lost`.

## Consequences

- `/modo-livre/termo` first load went from 64.2 to 66.4 KB, mostly the board taking 7 and 9 rows, the trigger and the multi-word draw; its budget is 67 KB. The daily `/termo` carries the board change inside its margin.
- The pool still never reaches a variant chunk (`T-WEB-S895`); pinned by `T-WEB-S890…S898`.

## Rejected

- **A route per variant:** each would need its own budget of about 60 KB of the same code.
- **Every board editable:** one guess, one row to type in; five tab stops per board read as five drafts.
- **Keeping Quarteto's title on a phone:** its 40px pushes the tiles under the 24px floor or the keyboard off screen.
