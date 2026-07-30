> **Amendments on import** (2026-07-30, issue #11). This bundle was authored in the Claude Design project ("F Ateliê" exploration) and imported here as a point-in-time snapshot. Body below is verbatim. Changes made on import:
>
> | Point in the body | What changed |
> |---|---|
> | Files `F1 Hoje Desktop.dc.html` … `F6 Conclusao Mobile.dc.html` | Renamed to kebab-case on import: `f1-hoje-desktop.dc.html` … `f6-conclusao-mobile.dc.html` (repo filename convention). Content unchanged. |
> | `DESIGN.md` ("drop-in draft for the repo") | Adopted as the **living** root [`DESIGN.md`](../../../DESIGN.md), written in English per the repo language rule, with the brief's section 5 anti-references verbatim. The pt-BR draft is kept here as the snapshot. |
> | `tokens.css` ("token sheet for packages/ui") | Living copy landed at [`packages/ui/tokens.css`](../../../packages/ui/tokens.css). The copy here is the snapshot. |

# Handoff: Miolos — Sistema visual "Ateliê" (vencedor da exploração)

## Overview
Winning visual system from the Miolos design exploration (per `docs/design/002-brief-design-direction.md`). Variation **F "Ateliê"**: the warm end of the Editorial/Paper direction — paper-on-paper cards with hard single-color offset shadows, a washi-tape accent per game, subtle rotations, dotted-paper texture. Covers the three exploration-scope screens: **Hoje** (hub), **Binairo em jogo**, **Conclusão** — each at desktop 1440×900 and mobile web 390×844.

## About the Design Files
The `.dc.html` files in this bundle are **design references created in HTML** — visual specs, not production code. The task is to **recreate these designs in the Miolos monorepo**: plain React/Next.js in `apps/web` (ADR-0002), with tokens and primitives in `packages/ui` (ADR-0007 keeps `apps/api` separate). Open each file in a browser to inspect it (`support.js` must sit beside them). Do not ship these files.

## Fidelity
**High-fidelity.** Colors, type, spacing, radii and shadows are final and should be recreated pixel-faithfully using the token sheet (`tokens.css`). Copy in pt-BR is final-draft quality — review before launch.

## Screens / Views

### 1. Hoje (hub) — F1 desktop / F2 mobile
- Purpose: daily ritual entry. Big date, streak counter, the day's 4 puzzles with done/pending state, links to Arquivo / Modo livre / Estatísticas (all launch features, ADR-0005), reserved self-promo strip (ADR-0006).
- Desktop layout: page padding 48px 80px on dotted paper #F7F2E9. Header row: masthead block left (italic Fraunces "Miolos" 42px rotated −1deg, date Fraunces 28px, meta line 13px #6E6659); streak stamp card right. Then 4-column grid of game cards (gap 28px). Then centered links (Fraunces 19px, 2px #D8D0C2 underline, gap 56px). Footer promo strip shown FILLED as sample (13px, "do Miolos" italic lacre lead-in, dismiss link right).
- Mobile layout: masthead + streak card row, stacked game rows (gap 16px, row padding 16px 18px), centered links, promo strip shown DORMANT as annotated dashed reserved space, height 64px — activation must cause no reflow.
- Game card (desktop): bg #FBF7EF, 1px border #D8D0C2, radius 6px, hard shadow 5px 5px 0 rgba(accent,0.22), rotation alternating −0.6/0.5/−0.4/0.6deg, washi tape 78×26px rgba(accent,0.32) top-center (rotated ±3–4deg), padding 44px 24px 24px, min-height 250px. Content: kicker (11px, ls 0.16em, uppercase, accent), name (Fraunces 30px wt 550), description (14px/1.5 #6E6659).
- Done state: outlined stamp chip (1.5px accent border, accent text, 11px uppercase ls 0.12em, padding 5px 12px, radius 6px, rotate −3deg) + result (14px #6E6659, tabular-nums).
- Pending state: solid accent button "Jogar hoje" (14px wt 600, text #F7F2E9, padding 12px, radius 6px).
- Streak stamp card: bg #FBF7EF, 1.5px border #9E3B2F, shadow 4px 4px 0 rgba(158,59,47,0.25), rotate 2deg, number Fraunces 44px wt 600 #9E3B2F tabular-nums, label 11px uppercase ls 0.14em.
- Games and kickers: Termo/Palavras, Sudoku/Números, Nonogram/Imagem, Binairo/Lógica.

### 2. Binairo em jogo — F3 desktop / F4 mobile
- Purpose: play the daily 8×8 Binairo. Screen accent: verde-musgo #4E6B52.
- Desktop: top bar (← Hoje, italic wordmark, date). Left column 330px: kicker "Lógica · caderno nº 214", Fraunces 54px title, rules paragraph (15px/1.6 #6E6659), stats card (paper card + tape, Tempo Fraunces 30px tabular, Progresso 14px), hint button bottom. Grid centered in remaining space.
- Grid: 8×8; cell 52px desktop / 38px mobile; gap 4px/3px; wrapped in paper card (bg #FBF7EF, border #D8D0C2, radius 6, shadow 6px 6px 0 rgba(78,107,82,0.2), padding 16px/10px, rotate 0.4deg).
- Cells: radius 5px, Fraunces numerals 23px/18px, tabular-nums. Given: bg #F1EADD, border 1.5px #D8D0C2, ink #211D19 wt 600. Player-entered: bg #F7F2E9, border 1.5px rgba(78,107,82,0.5), #4E6B52 wt 500. Empty: bg #F7F2E9, border #D8D0C2.
- Controls: "0"/"1" buttons 64×52 desktop (Fraunces 24px, 1.5px musgo border, shadow 3px 3px 0 rgba(78,107,82,0.22)); mobile: flex row, height 60px (≥44px target). "apagar" neutral (border #D8D0C2). Hint: solid musgo full-width "Usar dica — 1 disponível".
- Interaction: tapping a non-given cell cycles empty → 0 → 1 → empty; the 0/1 buttons set a paint mode. Timer counts up, discreet. Hint fills one cell and highlights the reasoning.

### 3. Conclusão — F5 desktop / F6 mobile
- Purpose: post-completion — time, streak status, distribution, share, next action.
- Celebration: the round rubber stamp — circle w/ 3px #4E6B52 border (150px desktop / 108px mobile), rotated −6deg, containing "CONCLUÍDO" (uppercase 11px ls 0.18em), final time (Fraunces 40px/28px tabular) and "sem dicas" italic. Contained and tactile; NO confetti. Recreate as the "ink settles" moment (see Motion).
- Main card (shadow in musgo): stat rows melhor 03:58 / média 07:20 / resolvidos 38 (hairline #E4DCCB separators), then 6-bucket time histogram (labels <4, 4–5, 5–6, 6–7, 7–9, >9 min; today's bucket solid #4E6B52 + bold label, others rgba(78,107,82,0.25); bar radius 3px top). Italic Fraunces closing line.
- Side stack (desktop, 26px gap) / stacked below (mobile): streak card in lacre ("12 dias de sequência — mantida por hoje."), "O dia até agora" card with 4 mini chips (done: bg rgba(accent,0.1), accent name, tabular result; missing: 1.5px dashed border), then CTA "Fechar o dia — jogar Nonogram" solid #B5563C, then Compartilhar (solid ink #211D19) + Ver estatísticas (paper w/ border) buttons.

## Interactions & Behavior
- Motion metaphor "tinta que assenta": 150–250ms, ease-out with slight settle (see --ease-settle), no exaggerated bounce. Cards may mount with a 1–2px drop settling to final rotation.
- Pressed state: element translates 1px toward its shadow; shadow shrinks by the same amount.
- Hover: links shift to the screen accent (#9E3B2F hub, #4E6B52 Binairo).
- Haptics (Vibration API) only as reinforcement where supported; desktop and iOS Safari get visual-only feedback — no state may depend on haptics.
- Promo strip: dormant at launch (ADR-0006); space reserved so activation causes no reflow; dismissible.
- Rotations and tape are static decoration — never animated per interaction.

## State Management
- Hub: per-game daily state (pending/done + result string), streak count, done count, promo flag.
- Binairo: 8×8 grid (given/empty/player values), elapsed time, hints remaining, filled count.
- Conclusão: final time, personal best/avg/solved, 6-bucket distribution, remaining games.
- Data comes from server contracts in `packages/core`; the day flips at midnight America/Sao_Paulo (ADR-0004: nothing unpublished reaches the client).

## Design Tokens
Full sheet in `tokens.css` (shaped for `packages/ui`). Core: paper #F7F2E9 / card #FBF7EF / tint #F1EADD; ink #211D19 / #6E6659; line #D8D0C2; accents #C08A1E #2E4E7E #B5563C #4E6B52; app accent #9E3B2F. Radius 6px (cells 5px, tape 2px). Shadows hard offsets, blur 0, in rgba(accent, 0.2–0.3). Fonts Fraunces + Instrument Sans; tabular-nums on all numbers. Dot texture radial-gradient rgba(33,29,25,0.06) 1px / 24–26px.

## Anti-references (hard bans — brief section 5)
Purple/blue gradients; glassmorphism; card-inside-card; grey text on colored backgrounds; icon-above-heading rounded tiles; pure-black dark mode with neon; mascots; decorative emoji; diffuse shadows; Inter/DM Sans/Poppins/Montserrat/Roboto.

## Portability
Variable-font axes work on web; React Native does not support fontVariationSettings (ADR-0002) — future native client uses static instances of the chosen weights. tabular-nums works on both.

## Assets
No image assets. Fonts via Google Fonts (Fraunces ital+opsz+wght; Instrument Sans wght). Tape, stamps and shadows are pure CSS.

## Files
- F1 Hoje Desktop.dc.html / F2 Hoje Mobile.dc.html
- F3 Binairo Desktop.dc.html / F4 Binairo Mobile.dc.html
- F5 Conclusao Desktop.dc.html / F6 Conclusao Mobile.dc.html
- support.js (runtime so the references open in a browser)
- DESIGN.md (drop-in draft for the repo)
- tokens.css (token sheet for packages/ui)

Mock data used everywhere: streak 12 dias; Termo feito 4/6; Sudoku feito 07:12; Nonogram e Binairo pendentes; quinta-feira, 30 de julho de 2026; Binairo em jogo 42/64 às 04:32; conclusão 06:47 sem dicas.
