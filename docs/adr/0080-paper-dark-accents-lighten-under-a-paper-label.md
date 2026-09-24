# ADR-0080 — Paper-dark accents lighten under a paper label

**Status:** Accepted — 2026-09-24
**Depends on:** [ADR-0041](./0041-accents-colour-shapes-never-words.md), [ADR-0067](./0067-termo-accent-deepens-to-carry-a-light-label.md)

## Context

Every game accent carries a paper label (`--paper-desk` or `--paper-card`, via `accentVars`'s `--ink-on-accent`) on its deep fill, per ADR-0067. The brief's dark background, `#1B1814`, and the light-theme accent hues left no value that cleared 4.5:1 for a paper label AND kept `--ink`'s border ≥ 3:1 on the fill — the same two-floor window ADR-0067 tuned in light.

`--paper-desk` and `--paper-card` are themselves dark colours in the dark palette (`packages/ui/tokens.css`), so the family inverts: the label is now the DARK ink and the fill is the LIGHTER surface, the opposite of light mode's dark fill / light label.

## Decision

1. **`--paper-desk` moves to `#16130F`**, not the brief's `#1B1814` — the darker desk buys the accents enough room to lighten without leaving `--ink`'s border floor.
2. **The five accents lighten for dark** (`--accent-app` `#CC6255`, `--accent-termo` `#AC7816`, `--accent-sudoku` `#5883C2`, `--accent-nonogram` `#C4684E`, `--accent-binairo` `#658B6A`), tuned so every accent clears ≥ 4.5:1 against BOTH dark papers as a label background (`T-WEB-S299a`, `T-WEB-S300a`) and stays ≥ 3:1 against `--paper-desk` as a non-text fill edge (`T-WEB-S301a`) — the same two floors ADR-0067 used, now both satisfied by every accent at once rather than by construction for one.
3. **`--accent-sudoku-text` and `--accent-binairo-text`** are new dark-only-lifted tokens. Two small-text sites — `.cellHinted` in `sudoku-board.module.css` and `binairo-screen.module.css` — paint the hint glyph on `color-mix(accent 10%, --paper-desk)`, a background too close to the accent's own hue for the plain accent to clear 4.5:1 in dark (`T-WEB-S395`). Light keeps `var(--accent-sudoku)` / `var(--accent-binairo)` — no visual change. No other accent has a failing small-text site, so no other `-text` token exists.

## Rejected

- **The brief's `#1B1814` desk.** Left no accent-lightening window that cleared both floors at once.
- **Deep accents with a light-ink label**, mirroring light mode exactly. Fails `--ink`'s 4.5:1 badly on every accent — ink-blue at ~1.7:1 — because `--ink` in dark is itself very light, the same shape ADR-0067 rejected for the opposite reason.

## Consequences

- Dark accents read visibly lighter and slightly more saturated than their light twins, by construction — this is the trade the window forces, not a stylistic choice.
- `--accent-sudoku-text` / `--accent-binairo-text` are the only accent-as-text lift so far; a future accent-as-text site failing 4.5:1 in dark gets the same treatment, not a palette-wide relift.
