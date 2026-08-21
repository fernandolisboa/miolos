# ADR-0067 — The Termo accent deepens to carry a light label

**Status:** Accepted — 2026-08-20 (issue #161)
**Depends on:** [ADR-0041](./0041-accents-colour-shapes-never-words.md), [ADR-0042](./0042-the-termo-board-is-read-only-output.md)
**Supersedes in part:** [ADR-0041](./0041-accents-colour-shapes-never-words.md) — decision 6 (*"The token values do not move. `--accent-termo` stays `#C08A1E`."*) is **replaced outright** for `--accent-termo`, by exactly the instrument that decision demanded: *"no ticket may reopen it without a new ADR"* — this is that ADR. The other three game accents and `--accent-app` do not move. Decision 2's Termo value and consequence (c)'s Termo-only fallback are replaced by decisions 2–3 below.
**Amends:** [ADR-0042](./0042-the-termo-board-is-read-only-output.md) — the state table's `correct` row now reads `var(--ink-on-accent, var(--paper-desk))` at **4.8433:1**, and every `2.7311:1`/`2.8501:1`/`5.4968:1` figure quoted for mustard is the OLD value's; the board's design (accent fills exactly one state, neutral-ink marks carry every distinction) is unchanged and its chroma argument survives (#8D6212's chroma is 123, still ≥ 30).
**Amends:** [ADR-0056](./0056-the-record-snapshot-cache-is-per-key-and-the-done-chip-wears-the-hub-word.md) — the done-chip/postmark decorative-exemption worst cases quoted at 2.8501:1 (card) and 2.7311:1 (desk) are now 5.0542:1 and 4.8433:1; every ring clears WCAG 1.4.11's 3:1 unaided, so the decorative exemption is head-room, no longer load-bearing.

## Context

Fernando (2026-08-20, #161, with screenshots): the Termo hub card's "Jogar
hoje" reads as the odd one out — a mustard fill with a DARK label, while
Sudoku, Nonogram and Binairo carry deep fills with a LIGHT label. He wants
the four cards to read as one family.

The root is arithmetic, recorded in ADR-0041: `#C08A1E` has relative
luminance **0.29477163** — nearly double the next-lightest game accent
(nonogram terracotta, 0.16805578) — so no paper ink cleared 4.5:1 on it
(desk 2.7311:1, card 2.8501:1, tint 2.5457:1) and `accentVars("termo")`
had to return `--ink` (5.4968:1). Every place the family look breaks —
the hub CTA, the play screen's hint button, the conclusion CTAs, the
`correct` tile and key — is downstream of that one luminance.

ADR-0041 decision 6 froze the token because #68's question was *"may the
accent colour words?"* and darkening the palette to buy accent-as-text was
the wrong fix for that question. #161 asks a different question — *"why
does one card wear a different label treatment?"* — and for that question
the token's lightness IS the defect. Decision 6 anticipated exactly this
path: reopening it takes a new ADR, and this is it.

## Decision

1. **`--accent-termo` moves from `#C08A1E` to `#8D6212`.** The same hue
   family (~39° vs ~40°) — Termo stays the golden/ochre card — at
   luminance **0.14441758**, inside the family's band (sudoku 0.0754,
   app 0.1060, binairo 0.1274, nonogram 0.1681). Measured on this branch
   with the WCAG 2.x formula (the script reproduces ADR-0041's shipped
   figures exactly as its control):

   | pair | ratio | floor |
   |---|---|---|
   | `--paper-desk` ON `#8D6212` (labels, tile/key glyph) | **4.8433:1** | 4.5 |
   | `--paper-card` ON `#8D6212` | 5.0542:1 | 4.5 |
   | `#8D6212` vs `--paper-desk` (fill edge, non-text) | 4.8433:1 | 3 |
   | `#8D6212` vs `--paper-tint` | 4.5143:1 | 3 |
   | `#8D6212` vs `--line` (secondaryLink hover delta) | 3.5288:1 | 3 |
   | `--ink` border ON `#8D6212` (`.tileCorrect`/`.keyCorrect`) | 3.0996:1 | 3 |

   The desk label's 4.8433:1 carries 7.6 % of headroom where nonogram's
   shipped 4.5063:1 carries 0.14 %.

2. **`accentVars("termo")`'s `--ink-on-accent` flips `var(--ink)` →
   `var(--paper-desk)`, in the same commit as the token.** They are one
   change: `--ink` ON `#8D6212` is 3.0996:1, an AA failure, so the old ink
   is illegal on the new fill and the new fill is the reason the light ink
   is legal. All four games now resolve `--ink-on-accent` to a paper —
   desk for sudoku, binairo and termo; card for nonogram — which is the
   family treatment #161 asked for. ADR-0041 decision 2's range ("an ink
   legible on this accent", not "a paper token") stands unrevised: it is
   what made the old state expressible, and it is where a future accent
   too light for any paper would land again.

3. **The Termo-only fallback dissolves.** ADR-0041 consequence (c)'s
   *"a surface that can only ever render mustard reads
   `var(--ink-on-accent, var(--ink))`"* existed only because desk failed
   on the old mustard. `.tileCorrect` and `.keyCorrect` now read
   `var(--ink-on-accent, var(--paper-desk))` like every other consumer.
   The per-site fallback machinery (the test's per-site expected column)
   stays — the mechanism was right; this value changed.

4. **No accent-as-text site opens.** `#8D6212` on desk would satisfy
   ADR-0041 decision 1's measured exception (4.8433:1 ≥ 4.5), but the
   Termo board's glyphs stay `--ink` 600 as a kept judgement, recorded at
   `termo-board.module.css` deviation 5: a typed letter is not yet judged,
   and the accent's one job on that screen is the `correct` fill. The
   shared sheets remain barred outright — `var(--accent)` has no fixed
   value, so decision 1 is untouched.

5. **Every mirror of the token moves with it, and the snapshots do not.**
   `src/og/tokens.ts`'s `#8D621238`/`#8D621252` (T-WEB-S200 ties the OG
   literals to `tokens.css` by their leading seven characters, so staying
   behind is a red, not an option); `app/icon.svg`'s Termo square, with
   the four PNG icons re-rendered by `scripts/render-icons.mjs`;
   `.impeccable/config.json`'s `low-contrast` waiver reason. Reference
   frames, handoffs, plans and issue bodies keep `#C08A1E` — they are
   point-in-time snapshots (`docs/README.md`), and the winning frames now
   document where the palette started, as the design brief already does.

## Rejected

- **Keeping the token and the dark label** — the shipped state. It is
  internally legal (5.4968:1) and it is what Fernando rejected: the fix
  #161 exists for.
- **A "true mustard" that passes.** No value with the old mustard's
  brightness clears 4.5:1 under any light ink — dark goldenrod `#B8860B`
  (L 0.2726) is still only 2.92:1 under desk. Any passing value is a deep
  ochre; that trade is the decision, taken with eyes open.
- **Lighter candidates** `#946811` (desk 4.4338:1) and `#916712`
  (4.5349:1) — the first fails the floor, the second ships nonogram-class
  zero headroom on the family's newest value for no reason.
- **Darker candidates** `#8A5F0F` / `#87600E` (desk 5.06/5.08:1) — their
  `--ink` border ratio drops to 2.97/2.96:1, under WCAG 1.4.11's 3:1 for
  the `correct` tile's border carrier, and they read brown rather than
  ochre.
- **Harmonizing the other direction** — moving sudoku/binairo/nonogram to
  dark labels on their deep fills. Fails AA everywhere (`--ink` on
  ink-blue is ~1.7:1) and repaints three healthy screens to match the one
  defective one.
- **A Termo-only component fork on the hub** (same accent, restyled
  button). Leaves the play screen, conclusion CTAs, tile and key on the
  old treatment — #161 names the card as where he SAW it, not as the only
  place it exists — and forks a shared sheet, ADR-0041's own rejected
  shape.

## Consequences

- **(a) Every Termo surface repaints, deliberately** — hub card (tape,
  shadow, CTA), `/termo` board and keyboard `correct` fills, conclusion
  stamp ring and chips, `.ctaNext` when Termo is the destination, archive
  chip and postmark, stats tape/shadow/bars/distribution, OG tape and
  shadow, the app icon's Termo square. The washi tape and shadows shift
  from bright mustard toward ochre at their same alphas. Before/after
  screenshots ride the PR.
- **(b) The figures on the record move, and the sweep is the PR.** Every
  living-code comment and living-doc sentence quoting 2.7311 / 2.8501 /
  2.5457 / 5.4968 / 1.9899 / 2.5949 as the CURRENT state is rewritten in
  this PR; historical statements are kept as history, marked as the old
  value's. ADR-0041's body is a record of the decision as taken and is
  amended by header, not rewritten.
- **(c) ADR-0041 decision 4's hover exception is now headroom.** The
  accent underline's worst case moves from mustard 2.7311:1 to nonogram
  4.3182:1 on desk — every hover rule clears 1.4.11's 3:1. The
  `.secondaryLink` 2px → 3px geometry delta is kept: its grounds are
  palette-independent and it is what makes the treatment safe for any
  future accent.
- **(d) The chip tint composites move.** The 10 % accent-over-card chip
  tint is now `#F0E8D9` (rounded 8-bit, the browser's own arithmetic);
  `--ink` on it is **13.7508:1** (was 14.2637:1 on the old `#F5ECDA`).
- **(e) The gate grows a family-wide contrast pin** — `T-WEB-S299`–`S301`
  in `apps/web/test/accent-contrast.test.ts`, the T-WEB-S230
  token-resolving idiom: resolve every game's accent hex and its
  `--ink-on-accent` paper from `packages/ui/tokens.css` + `accent.ts`,
  compute the WCAG ratio in-test, assert the 4.5 label floor, the
  all-papers family shape, and the 3:1 non-text floors. A future token
  nudge reds arithmetic instead of trusting a table.
- **(f) Dark mode revalidation now includes this value.** DESIGN.md's
  pending dark theme must measure `#8D6212` on dark paper like every
  other accent; nothing here pre-decides it.
