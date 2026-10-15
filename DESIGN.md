# Miolos — Design System ("Ateliê", the winning direction)

The target feeling: a hand-assembled puzzle notebook made with care — paper on paper, tape, rubber stamp. Editorial and warm, never childish. Typography is the protagonist.

Guide words: *editorial, warm, precise, adult, tactile, confident.*

Chosen 2026-07-30 from the Claude Design exploration (variation F "Ateliê"); high-fidelity references live in [`docs/design/006-handoff-design-winner-atelie/`](./docs/design/006-handoff-design-winner-atelie/). Tokens live in [`packages/ui/tokens.css`](./packages/ui/tokens.css).

## Color (light theme)

| Role | Value |
|---|---|
| Desk background | `#F7F2E9` with dot texture `radial-gradient(rgba(33,29,25,0.06) 1px, transparent 1px)`, 26px desktop / 24px mobile |
| Card paper | `#FBF7EF` |
| Tinted paper (given cell) | `#F1EADD` |
| Ink | `#211D19` |
| Secondary ink | `#6E6659` |
| Lines | `#D8D0C2` (soft hairline `#E4DCCB`) |

Per-game accents — sanctioned surfaces are **a fill, a washi tape, a hard shadow, a rule, a stamp ring, a card border, a graph bar, a board cell**; the kicker is no longer among them: Termo deep mustard `#8D6212` ([ADR-0067](./docs/adr/0067-termo-accent-deepens-to-carry-a-light-label.md); `#C08A1E` before it) · Sudoku ink-blue `#2E4E7E` · Nonogram terracotta `#B5563C` · Binairo moss-green `#4E6B52` · Cruzadinha plum `#6B4560` · Rainhas royal violet `#7A569C`. App accent (streak, promo): sealing-wax red `#9E3B2F`. **An accent may colour a shape. The shared per-game accent may never colour a word** — no `color: var(--accent)` on text, at any size, on any paper. A *literal* accent token may colour a word only where its measured contrast against the paper behind it clears 4.5:1 — per token and per paper: terracotta fails on desk (4.3182:1) and passes on card (4.5063:1) ([ADR-0041](./docs/adr/0041-accents-colour-shapes-never-words.md) decision 1, whose consequence (h) measures the sites that use the exception).

Accents carry identity, not meaning alone — every state they mark is also carried by a chip, border, or label. Words on paper are `--ink` or `--ink-2` unless the exception above is measured and met; a label sitting **on** an accent fill reads `--ink-on-accent`, the ink chosen to be legible on that accent — since [ADR-0067](./docs/adr/0067-termo-accent-deepens-to-carry-a-light-label.md) it resolves to a light paper for all six games (desk on the deep mustard is 4.8433:1; the old `#C08A1E` cleared no paper and forced `--ink` on Termo's fills, the odd-one-out #161 removed). The shared-property rule does not soften with the palette: `var(--accent)` in a shared sheet has no fixed value, so it has no ratio to measure and may never colour a word ([ADR-0041](./docs/adr/0041-accents-colour-shapes-never-words.md)).

## Typography

- Display: **Fraunces** (variable; `ital`, `opsz`, `wght`). Italic is the app's human voice. Weights 450–600.
- UI: **Instrument Sans** 400–700.
- Numerals that must align in a column — every grid, timer, statistic and histogram — use **Instrument Sans** with `font-variant-numeric: tabular-nums` (measured: every digit 6.609375px, spread 0). Fraunces has **no tabular figures** — no OpenType feature tag responds on it at all, so `tabular-nums` on the display face is a no-op and its digits keep a ~2.2px spread. Fraunces numerals are for the single, non-aligning kind: a streak stamp, a board cell holding one centred glyph ([ADR-0036](./docs/adr/0036-aligning-numerals-use-instrument-sans-not-fraunces.md)).
- Kickers: 10–11px, uppercase, letter-spacing 0.14–0.16em — a deliberate brand system, used for game categories, not as a generic section eyebrow.
- Banned as brand fonts: Inter, DM Sans, Poppins, Montserrat, Roboto.
- Portability: variable-font axes are web-only; the future native client uses static instances of the chosen weights (ADR-0002). `tabular-nums` works on both.

## Shape

- Radius 6px (grid cells 5px, washi tape 2px). Paper has corners, not bubbles.
- **Hard shadow, never diffuse**: `Npx Npx 0 rgba(accent, 0.2–0.3)`, N = 3–6, blur always 0. Depth comes from paper color and line, not from blur.
- Washi tape: rectangle `rgba(accent, 0.32)`, radius 2px, rotated ±3–5deg, over the card's top edge.
- Card rotations: ±0.3–2.4deg, static — never animated per interaction.
- Completion stamp: 3px circle in the game's accent, rotated −6deg, typographic content only.
- Spacing on a 4pt scale; touch targets ≥44px.

## Motion

"Ink that settles" (*tinta que assenta*): 150–250ms, ease-out with a slight settle (`--ease-settle`), no exaggerated bounce. Pressed = the element slides 1px toward its shadow and the shadow shrinks by the same amount. Celebration = the stamp settling; never confetti. Haptics (Vibration API) are reinforcement only, never state-bearing (absent on desktop and iOS Safari). Every animation has a `prefers-reduced-motion` alternative.

## Components (from the winning references)

- **Game card** (Hoje): card paper, 1px line border, hard shadow in the game accent at 0.22, washi tape top-center, kicker + Fraunces title + description; done state is an outlined "Feito" stamp chip (rotated −3deg) + tabular result, pending state is a solid accent button. **The archive day card (`/arquivo/<data>`) is a documented variant of this register** ([ADR-0056](./docs/adr/0056-the-record-snapshot-cache-is-per-key-and-the-done-chip-wears-the-hub-word.md) consequence (e)), differing in five ways: no tabular result and no duration at all, because the archive's own copy says a late completion counts for neither the streak nor your times; no description, so its anatomy is kicker + title only; **no pending counterpart** — the pending state is the card as it ships, with no accent button; the chip is an item in a flex row **beside the kicker and above the title** rather than in a reserved box below it, which inverts this entry's anatomy where the done state is terminal; and the chip is **deliberately smaller**, because it declares `line-height: 1` so its geometry can be asserted from stylesheet text (`T-WEB-S221`). **With the basis named, since one figure for a rotated box is ambiguous:** the hub's chip is a **28.5px used box** (2 × 1px floored border + 2 × 5px padding + a 16.5px line), **29px** by `offsetHeight` and **31.8px** as a painted rect through its rotation; the archive chip's used box is **23px**, ~19% tighter on the only basis the two are comparable on. Inheriting the hub's 16.5px line would take the row to ~24.5px and the card's growth to +13.5px instead of +8.
  - **The archive card's growth is a DIAL, not a constant**, and the dial is recorded here because growth and tape → chip clearance trade continuously along `--done-chip-box` and the next person should see the trade. Measured in Chrome at 1440×900, 390×844, 360×800 and 320×700, clearance on the painted `getBoundingClientRect` basis, rhythm on the layout one:

    | row | card growth | tape → chip | pending rhythm (top inset / kicker → title) |
    |---|---|---|---|
    | 24px | +13px | 11.14px | 31 / 14 |
    | 20px | +9px | 9.14px | 29 / 12 |
    | **19px — shipped** | **+8px** | **8.64px** | **28 / 12** |
    | 18px | +7px | 8.14px | 28 / 11 |
    | 11px | 0px | 4.14px | 24 / 8 |

    The chip's declared box stays 24px at every row; `margin-block` takes its outer box to the row's height, so the chip overhangs into the card's own top padding rather than shrinking. **19px is the only intermediate point that keeps the pending card's rhythm on the 4pt scale above**: the kicker gains growth/2 of leading on each side, so the two terms are `24 + g/2` and `8 + g/2` and both are multiples of 4 only when `g ≡ 0 (mod 8)`. **The rhythm change is real and is paid on the ~99% of visits with no record** — the card goes from 24 / 8 to 28 / 12, airier rather than gapped, and nothing in it reads as a reserved slot.
- **Streak stamp card**: 1.5px `#9E3B2F` border, hard shadow in lacre 0.25, rotated 2deg, Fraunces numeral — the sanctioned single, non-aligning case (ADR-0036 decision 2), so `tabular-nums` on it is inert rather than load-bearing.
- **Puzzle grid**: square cells that grow with the space ([ADR-0103](./docs/adr/0103-boards-size-from-the-space-they-have-not-from-fixed-cells.md): the board is the largest square the column and viewport allow, up to a per-game ceiling, 280px at the floor, 200px for the Cruzadinha (232px for a 7×7 in free play, where clue numbers drop to 9px and letters sit low in the cell so two-digit numbers never touch them, [ADR-0111](./docs/adr/0111-cruzadinha-free-play-offers-5x5-or-7x7.md)), whose clues sit beside the grid from a 640px column and fold behind *Pistas* below it), gap 4px/3px, wrapped in a paper card with hard accent shadow; given cells on tinted paper with ink numerals wt 600, player cells on desk paper with **accent numerals** wt 500. The board cell is a sanctioned accent surface and this numeral is the *measured exception* to the colour rule above, not a contradiction of it: a per-game board module renders one accent and one only, so the figure exists — ink-blue **7.5113:1** (Sudoku, shipped at wt 450, deviation 6) and moss-green **5.3066:1** (Binairo, wt 500) on desk paper, and 6.4612:1 / 4.6733:1 on the revealed-hint tint ([ADR-0041](./docs/adr/0041-accents-colour-shapes-never-words.md) decision 1 and consequence (h)). Termo's board keeps `--ink` glyphs as a recorded judgement (`termo-board.module.css` deviation 5): the deep mustard measures 4.8433:1 on desk since [ADR-0067](./docs/adr/0067-termo-accent-deepens-to-carry-a-light-label.md), so accent glyphs would be legal there, but a typed letter is not yet judged and the accent's one job on that screen is the correct-tile fill. No shared sheet may use the exception at all.
- **Reset control** (*Recomeçar*, every grid game): ink text, never the accent and no alarm red; the confirmation opens in place of the button and downward over the hint (hidden while it is open) so the board never moves, and **Cancelar comes first**, in the slot the button held (recorded on [#298](https://github.com/fernandolisboa/miolos/issues/298); what a reset keeps is [ADR-0096](./docs/adr/0096-recomecar-clears-the-board-and-never-refunds-the-hint-or-the-clock.md)).
- **Wrong mark** (*Mostrar erros*, every grid game): a small corner flag in the cell's top-right corner, `--accent-app` red with a paper band, a child of the cell so it sits on top of the rule rings (`.cellViolating`, `.cellConflict`) instead of replacing them; ≥3:1 on every surface it can land on, Rainhas regions included (`T-WEB-S594`, [ADR-0102](./docs/adr/0102-player-settings-are-device-local-and-mostrar-erros-is-an-opt-in-assist.md)).
- **Game settings**: one `role="switch"` row style for every switch (`src/components/switch.module.css`); in Ajustes the *Jogos* card groups them in fieldsets separated by hairlines, never cards in a card. On a game screen the *Ajustes* text button sits under *Recomeçar* in the same ink register, and opens a native modal dialog with the same rows for that game only.
- **Locked keypad digit** (Sudoku *Número fixo*): accent fill with an `--ink-on-accent` numeral and `aria-pressed`; the keypad takes `touch-action: manipulation` so a double tap never zooms.
- **Struck clue numeral** (Nonogram *Riscar números resolvidos*): `--ink-2` with a line-through, nothing that changes the glyph box and no transition; 5.30:1 light and 6.26:1 dark on `--paper-card` ([ADR-0104](./docs/adr/0104-a-nonogram-clue-number-is-struck-when-the-marks-place-it.md)).
- **Histogram**: 6 buckets, today's bucket solid accent + bold label, others `rgba(accent, 0.25)`, 3px top radius. The **bar** carries the accent; the label is `--ink`, because a histogram is shared chrome that renders whichever accent the game supplies and so has no ratio to measure (ADR-0041 decision 1).
- **Promo strip** (`AdSlot` seam): dormant at launch, dimensions reserved per placement so activation is a paint, never a reflow — 64px on the mobile hub (F2's annotated dormant slot), 60px on the desktop hub (measured from F1's filled sample: 1px top hairline + 16px/24px vertical padding + one 19px text line); dismissible; only first-party creative, italic "do Miolos" lead-in (ADR-0006).

## Anti-references (law)

From the brief, section 5, verbatim:

> Gradiente roxo/azul; glassmorphism; card dentro de card; texto cinza sobre fundo colorido; tile arredondado com ícone acima de todo heading; dark mode preto-puro com neon; mascote; emoji decorativo; sombra difusa em tudo; Inter.

## Dark mode

Ships as a device preference (`prefers-color-scheme`, overridable per-device, [ADR-0079](./docs/adr/0079-the-theme-is-a-device-preference-applied-before-paint.md)). Palette in `packages/ui/tokens.css`'s `:root[data-theme="dark"]` block:

- Paper: `--paper-desk` `#16130F`, `--paper-card` `#1D1914`, `--paper-tint` `#231F19` — darker than the brief's `#1B1814` starting point, the room the accents needed to lighten without breaking the label floor.
- Ink: `--ink` `#EAE3D5`, `--ink-2` `#A29A8A`; lines `--line` `#3A352E`, `--line-soft` `#2C2822`.
- Accents, lightened from their light values: `--accent-app` `#CC6255`, `--accent-termo` `#AC7816`, `--accent-sudoku` `#5883C2`, `--accent-nonogram` `#C4684E`, `--accent-binairo` `#658B6A`, `--accent-crossword` `#BD7F9D`, `--accent-queens` `#B48AD8`. Two small-text sites (Sudoku's and Binairo's `.cellHinted`) need a further-lifted `--accent-sudoku-text` / `--accent-binairo-text`.

The Rainhas violet was placed by distance: its CIE ΔE76 to every other accent is at least 25 in both themes. The nearest are Cruzadinha plum (26.27 light, 28.08 dark) and Sudoku ink-blue (26.78 light, 28.95 dark) (`T-WEB-S448a`). `--paper-desk` on it is 5.1756:1 light and 6.6724:1 dark (`T-WEB-S299`, `T-WEB-S299a`).

The Rainhas regions are nine paper tints, `--queens-region-1…9`. Light: `#EECFAE` `#F8C8D0` `#C1DCBF` `#B8DAE7` `#E7CDE4` `#FACABB` `#B3DDD4` `#D8D6B0` `#CDD4EC`. Dark: `#3F301D` `#462B32` `#253727` `#1C363F` `#3C2E3D` `#462C25` `#1A3734` `#33341E` `#2C3242`. On every tint `--ink` clears 11.29:1 light and 9.94:1 dark, the `--accent-app` conflict ring 4.54:1 and 3.29:1, and the violet hint ring 3.89:1 and 4.57:1 (`T-WEB-S457`). Colour is never a region's only carrier: a 2 px `--ink` boundary and the cell's name carry it too ([ADR-0092](./docs/adr/0092-the-rainhas-board-tap-cycles-drag-crosses-conflicts-show.md)).

The paper-label family (ADR-0067) inverts in dark: the label is the dark ink, the fill is the lighter accent. Tuning and the rejected candidates are in [ADR-0080](./docs/adr/0080-paper-dark-accents-lighten-under-a-paper-label.md).
