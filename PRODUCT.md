# Product

## Register

product

## Users

Brazilian adults who solve puzzles daily, on the web, in pt-BR. They arrive once a day — over coffee, on a commute, in a break — mostly on phones, often in short sessions. The job to be done: complete today's four puzzles (Termo, Sudoku, Nonogram, Binairo) and keep the streak alive. The same puzzle for everyone on the same day makes results shareable and comparable; the archive and free play serve the ones who want more than the daily.

## Product Purpose

Miolos is a daily-puzzle web app: one fresh puzzle per game per day, identical for every user, published by the server on `America/Sao_Paulo` time. The streak is the core mechanic and the reason to return. All puzzle content is free (ADR-0005); the product succeeds when the daily visit becomes a ritual — measured in streaks kept, days completed, and results shared. Web launches first; native iOS and Android follow against the same visual system.

## Brand Personality

A hand-assembled puzzle notebook made with care — paper on paper, tape, rubber stamp. Editorial and warm, never childish. Typography is the protagonist; the italic Fraunces voice is the app's human voice.

Guide words: *editorial, warm, precise, adult, tactile, confident.*

## Anti-references

From the design brief (`docs/design/002-brief-design-direction.md`, section 5), binding verbatim:

> Gradiente roxo/azul; glassmorphism; card dentro de card; texto cinza sobre fundo colorido; tile arredondado com ícone acima de todo heading; dark mode preto-puro com neon; mascote; emoji decorativo; sombra difusa em tudo; Inter.

In English: purple/blue gradients; glassmorphism; card-inside-card; grey text on colored backgrounds; rounded icon-above-heading tiles; pure-black dark mode with neon; mascots; decorative emoji; diffuse shadows everywhere; Inter as a brand font — and the brief's typography section (section 4) extends the brand-font ban to DM Sans, Poppins, Montserrat and Roboto, carried into `DESIGN.md`. Beyond the brief: no gamification chrome — no XP, levels, loot boxes, currency or global rankings exist in the product (ADR-0006), so the interface never borrows their visual language.

## Design Principles

1. **Typography is the protagonist.** Hierarchy, warmth and identity come from Fraunces + Instrument Sans, not from ornament. Numerals that must align in a column use Instrument Sans with `tabular-nums`; Fraunces numerals are the single, non-aligning kind, and `tabular-nums` on that face is a measured no-op ([ADR-0036](./docs/adr/0036-aligning-numerals-use-instrument-sans-not-fraunces.md)).
2. **Depth is paper, not blur.** Layers read as sheets of paper: hard single-color offset shadows, hairline borders, subtle static rotations. Never a diffuse shadow.
3. **Celebration is contained.** The reward is a rubber stamp settling into place — tactile, adult, quiet. Never confetti, never a modal takeover.
4. **The ritual is calm.** One screen, one task; timers are discreet; nothing nags. The daily visit should feel like opening a notebook, not entering a casino.
5. **Desktop is not stretched mobile.** Each viewport gets its own composition from the same system — columns and generous margins at 1440, redesigned hierarchy at 390.

## Accessibility & Inclusion

- Touch targets ≥44px everywhere; verified in the winning mobile references.
- Body text contrast ≥4.5:1 against its paper background. **An accent may colour a shape — a fill, a washi tape, a hard shadow, a rule, a stamp ring, a card border, a graph bar, a board cell. The shared per-game accent may never colour a word** — no `color: var(--accent)` on text, at any size, on any paper. A *literal* accent token may colour a word only where its measured contrast against the paper behind it clears 4.5:1 — per token and per paper: terracotta fails on desk (4.3182:1) and passes on card (4.5063:1) ([ADR-0041](./docs/adr/0041-accents-colour-shapes-never-words.md) decision 1, whose consequence (h) measures the sites that use the exception; [ADR-0067](./docs/adr/0067-termo-accent-deepens-to-carry-a-light-label.md) deepened the Termo accent so its fills carry a light label like the other three). Text on paper is otherwise `--ink` or `--ink-2`, and a label on an accent fill is `--ink-on-accent`. Accents are used for identity, never as the only carrier of meaning (done/pending states pair color with a chip, border or label).
- `prefers-reduced-motion`: every "ink settles" animation has an instant/crossfade alternative.
- Haptics (Vibration API) are reinforcement only, never state-bearing — desktop and iOS Safari get visual-only feedback.
- pt-BR only in v1, with strings externalized for i18n from the start.
