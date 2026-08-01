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

Per-game accents (tape, kicker, stamp, button): Termo mustard `#C08A1E` · Sudoku ink-blue `#2E4E7E` · Nonogram terracotta `#B5563C` · Binairo moss-green `#4E6B52`. App accent (streak, promo): sealing-wax red `#9E3B2F`.

Accents carry identity, not meaning alone — every state they mark is also carried by a chip, border, or label.

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

- **Game card** (Hoje): card paper, 1px line border, hard shadow in the game accent at 0.22, washi tape top-center, kicker + Fraunces title + description; done state is an outlined "Feito" stamp chip (rotated −3deg) + tabular result, pending state is a solid accent button.
- **Streak stamp card**: 1.5px `#9E3B2F` border, hard shadow in lacre 0.25, rotated 2deg, Fraunces tabular numeral.
- **Puzzle grid**: cells 52px desktop / 38px mobile, gap 4px/3px, wrapped in a paper card with hard accent shadow; given cells on tinted paper with ink numerals wt 600, player cells on desk paper with accent numerals wt 500.
- **Histogram**: 6 buckets, today's bucket solid accent + bold label, others `rgba(accent, 0.25)`, 3px top radius.
- **Promo strip** (`AdSlot` seam): dormant at launch, dimensions reserved per placement so activation is a paint, never a reflow — 64px on the mobile hub (F2's annotated dormant slot), 60px on the desktop hub (measured from F1's filled sample: 1px top hairline + 16px/24px vertical padding + one 19px text line); dismissible; only first-party creative, italic "do Miolos" lead-in (ADR-0006).

## Anti-references (law)

From the brief, section 5, verbatim:

> Gradiente roxo/azul; glassmorphism; card dentro de card; texto cinza sobre fundo colorido; tile arredondado com ícone acima de todo heading; dark mode preto-puro com neon; mascote; emoji decorativo; sombra difusa em tudo; Inter.

## Dark mode (pending)

A launch requirement, not yet designed. Starting point from the brief: background `#1B1814`, ink `#E9E2D4`, secondary `#9C9485`, lines `#3A352E`; accents to be revalidated for contrast on dark paper.
