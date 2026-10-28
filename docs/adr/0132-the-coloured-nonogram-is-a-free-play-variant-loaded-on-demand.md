# ADR-0132 — The coloured Nonogram is a free-play variant loaded on demand

**Status:** Accepted — 2026-10-15 (issue #372)
**Depends on:** [ADR-0011](./0011-free-play-is-generated-on-the-client.md), [ADR-0021](./0021-nonogram-pictures-are-a-curated-motif-library.md), [ADR-0047](./0047-bundle-markers-are-route-scoped.md), [ADR-0059](./0059-the-property-proof-splits-from-the-per-pr-gate.md), [ADR-0103](./0103-boards-size-from-the-space-they-have-not-from-fixed-cells.md), [ADR-0121](./0121-the-solved-nonogram-picture-is-painted-in-its-motifs-tones.md), [ADR-0135](./0135-termo-free-play-offers-dueto-and-quarteto.md)
**Amends:** [ADR-0046](./0046-free-play-routes-levels-and-the-ephemeral-session.md) decisions 2 and 3; [ADR-0094](./0094-the-secondary-mouse-button-writes-the-opposite-mark.md) decisions 4 and 5; [ADR-0104](./0104-a-nonogram-clue-number-is-struck-when-the-marks-place-it.md) decision 3; [ADR-0121](./0121-the-solved-nonogram-picture-is-painted-in-its-motifs-tones.md) decision 3; [ADR-0037](./0037-the-nonogram-board-is-a-three-state-brush-board.md) decision 4; [ADR-0035](./0035-the-nonogram-board-is-a-ruled-continuous-field.md) decision 7; [ADR-0018](./0018-i18n-is-an-in-repo-typed-message-module.md) (copy home); [ADR-0102](./0102-player-settings-are-device-local-and-mostrar-erros-is-an-opt-in-assist.md) decision 3 (the wrong-cell flag); [ADR-0112](./0112-the-grid-game-routes-bundle-budget-is-a-leak-tripwire.md) (re-measured, no budget changed).
**Amended by:** [ADR-0143](./0143-the-nonogram-crosses-a-line-its-fills-complete.md) (#402) — Cores crosses a line whose tones form its clue, under the same setting as Clássico.
**Amended at #386:** Cores strikes a chip its marks place, under *Riscar números resolvidos* (ADR-0104 on tone runs), with a 2 px line-through in the chip's `--cell-ink`.
**Amended by:** [ADR-0158](./0158-on-a-phone-the-nonogram-board-takes-the-full-width.md) (#455) — the *Variante* is one *Cores* toggle beside the level chips, not a second row of chips.

## Context

Fernando asked for a colour variant of the Nonogram (issue #372). The curated motifs already carry a tone per filled cell (ADR-0121), so a puzzle can ask for a tone per run, not only for fill or not. It must be free play only, keep the daily inside its budget, and fit a 320 px phone.

## Decision

1. **A lazy chunk, not a route.** `/modo-livre/nonogram` gains a **Variante** picker beside the level: Clássico or Cores, through the same `Choice` and `variantChoice` as Termo's Variante (ADR-0135). Cores loads through `lazyChunk` (`components/lazy-chunk.ts`), which now hands back the loaded value as `{state: "ready", value}`, else `"loading"` or `"failed"`; a new retry key or a fresh mount loads again. A failed Cores load shows `FreePlayErrorCard`. A route would re-ship the motif tables and tones. The variant is not in the URL. If the chunk ever trips the daily-scope marker scan, the scan is never weakened; the fallback is a route at `/modo-livre/nonogram/cores` with its own budget, which needs Fernando's yes.
2. **Keyed under `Game` "nonogram".** Chrome, accent and Ajustes are unchanged and there is no hub card, so the catalogue is untouched. Cores state is `{seed, size}` (ADR-0111 precedent). Levels are sizes only (5, 10, 15) with no effort band: the pools are too small to split. Clássico and Cores share one frame (`free-play/picture-free-frame.tsx`).
3. **A separate colour line solver, `@miolos/games/colored-nonogram`** (`solveColoredLine`, `nextColoredStep`, `generateColoredNonogram`). The Clássico `solveLine` is untouched; a property test shows the two agree on one-tone lines. Runs of one tone need a gap; different tones may touch. The solver keeps only the cells a line fully fixes, the same rule the hint uses, so every pool picture is solvable by lines with real marks and the hint chain reaches the solution.
4. **The pool** (`coloredPool(size)`) is every motif and mirror that line-solves to exactly its tones, with at most 7 runs per line, no column run of 10 or more (the clue chip must fit), and no pair in `CONFUSABLE_TONE_PAIRS`. A pair is confusable when its minimum ΔE76 is under 10 over normal, protan, deutan and tritan vision (Machado 2009), in either theme. Pools: 34, 46 and 19 entries for 5, 10 and 15.
5. **This replaces the issue's "lightness or pattern" colour-blind rule.** A pattern does not fit a clue chip of about 10 px that must also carry a number. The lightness rule (ΔL* of 10 in both themes) keeps 19, 20 and 11 motifs; the pair rule keeps 27, 40 and 20 before the other filters.
6. **Reading a tone.** Each tone has a label ink, `--ink-on-tone-<l>`, of at least 4.5:1 on it in both themes (hex literals); a painted cell and a chip set `--cell-ink` from it. A painted cell keeps only the ruled field's 50% `--ink` hairline: it edges every tone against the paper at 3.16:1 or more, and stays under 3:1 inside a run, so a run of one tone reads as one block, as in Clássico. The caret and the 2 px hint ring are `--cell-ink`; the chip edge is a 1 px `--ink` line (13.69:1 or more on the card); the Mostrar erros flag gains an edge stop in `--cell-ink` (`--wrong-edge`, transparent by default, so daily boards do not change).
7. **Input.** The brush is ✕ plus one segment per tone. A right press writes ✕ or the current tone, whichever the cell is not. Key 1 paints the current tone, 2 crosses, 0 clears. Undo, hints and Recomeçar work as in Clássico. Palette segments are 36 px wide and 48 px tall at every width, below the 44 px target in width only (ADR-0035 decision 7): ✕ and five tones then fit the 280 px board floor. The alternative, 56 px segments with a narrow rule only past four, needs a second rule for the same palette.
8. **Copy beside the chunk.** Copy rendered only inside a lazy chunk may live beside that chunk when its bytes would otherwise ride every route: tone names, aria, the hint words and the keyboard line are in `colored-nonogram/copy.ts` (303 B of strings in the Cores chunk), not in `messages.ts`, which every route ships. This extends ADR-0052's narrowing of ADR-0018, with its contract: typed, in-repo, `as const`.
9. **Bundle.** No budget changed (measurements in ADR-0112's amendment line and the PR). The solved card and its picture load lazily (`picture-solved-card.tsx`), preloaded when the board mounts, which pays for the picker on `/modo-livre/nonogram`. `heart:mrmr13` and `Escada` stay out of every daily-scope chunk.

## Consequences

- In `apps/web/app` and `apps/web/src`, the ESLint wall bans `@miolos/games/colored-nonogram` outside `src/colored-nonogram/**` and `use-free-colored-nonogram.ts`, static and dynamic, and the Cores modules by relative path outside `src/free-play/**`, `src/colored-nonogram/**` and tests; `src/colored-nonogram/**` carries the free-play I/O wall.
- A new motif joins a Cores pool only if it passes decision 4; a changed `PICTURE_TONES` value must re-run the pair test.
- `/nonogram` keeps 0.2 KB of headroom; the `playRecordSchema` split stays the next relief (ADR-0112).

## Rejected

- **A route for Cores:** re-ships the tone and motif tables, about 78 KB, for no gain.
- **Patterns or glyphs on chips:** cannot carry a number at 10 px.
- **A coloured daily:** a puzzle in the wire and a migration; not asked.
- **One solver with a tone argument:** the daily would ship colour code.
- **A per-cell `--ink` ring:** it drew a lattice across every run, a bright one in dark.
- **A shared rail and cell shell for Clássico and Cores:** +341 B on `/nonogram`, which has 0.2 KB of headroom; revisit after the `playRecordSchema` split.
