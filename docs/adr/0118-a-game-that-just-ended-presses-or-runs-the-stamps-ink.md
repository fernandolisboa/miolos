# ADR-0118 — A game that just ended presses its stamp, or lets its ink run

**Status:** Accepted — 2026-10-15 (issue #353)
**Depends on:** [ADR-0034](./0034-the-completion-celebration-renders-in-the-conclusion.md), [ADR-0041](./0041-accents-colour-shapes-never-words.md), [ADR-0102](./0102-player-settings-are-device-local-and-mostrar-erros-is-an-opt-in-assist.md)
**Amends:** [ADR-0043](./0043-the-conclusion-has-a-fourth-state-and-it-is-a-loss.md) decision 3 (a loss now has motion); ADR-0102 decision 2 (a new setting, and the general group in every dialog); `PRODUCT.md` §3 and `DESIGN.md` § Motion (the end flourish is the one motion past 250 ms).

## Context

Fernando asked for an animation at the end of every game: a happier one on a win and a sadder one on a loss. Until now the win had only the stamp's 250 ms settle, and ADR-0043 decision 3 made a loss deliberately still. `PRODUCT.md` and `DESIGN.md` forbid confetti and modal takeovers. Only Termo can be lost; the five grid games end only when solved.

## Decision

1. **Win: the stamp is pressed.** Its wrapper drops from `scale(1.12)` to rest on `--ease-settle`, then a thin ring and eight short strokes in the screen's own `--accent` splash out and fade. **Loss: the ink runs.** The wrapper sags and comes back to rest, and three `--ink-2` drips run down from the stamp and fade. Both are CSS keyframes in `play/ending-flourish.module.css`, built from duration tokens. They use no library, never loop, and end at the stamp's resting pose, so a reload looks the same as the end of the game.
2. **Only a game that ended in front of the player plays it.** `useSawPlay` (`play/just-ended.ts`) records whether `DailyScreen` or `ArchiveScreen` showed the board during this mount. The `JustEnded` context carries that to `ConclusionView` and `LateResult`. A revisit, a reload or a result from another device stays calm. Free play keeps no session, so its card always plays it.
3. **It is a setting, on by default.** `endAnimation` sits beside `showClock`. The *Em todos os jogos* group is now in every dialog and shows the clock switch only where the game has a clock. `prefers-reduced-motion` turns every piece off.
4. **The loss stays a loss.** The grey stamp keeps no settle (ADR-0043 decision 3's still stamp), and the answer row stays unanimated (decision 6). The motion is a sag and a drip, never a settle or a splash.

## Consequences

- `EndingFlourish` wraps a stamp in an `inline-block` anchor; it does not change the stamp's layout. The free-play stamp lost its UA paragraph margin, and the spacing moved to `.stampSlot`.
- The screens import only `just-ended.ts`. The flourish and its sheet load with the conclusion's lazy chunk, the archive's late result and the free-play card.

## Rejected

- **Confetti.** `PRODUCT.md` §3 forbids it. A first draft that used it was rejected in plan review.
- **Playing on every visit to the conclusion.** The payoff would repeat on every bookmark and reload.
- **Animating the solved board.** ADR-0034 decision 1.
