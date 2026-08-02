# ADR-0035 — The Nonogram board is a ruled continuous field, not a grid of separated cells

**Status:** Accepted — 2026-08-01
**Depends on:** [ADR-0002](./0002-plain-react-web-ui-not-universal-rn-web.md), [ADR-0021](./0021-nonogram-pictures-are-a-curated-motif-library.md), [ADR-0030](./0030-grid-games-are-composite-widgets-one-tab-stop-roving-focus.md), [ADR-0032](./0032-a-nonogram-is-finished-when-the-picture-is-painted.md), [ADR-0036](./0036-aligning-numerals-use-instrument-sans-not-fraunces.md)

## Context

`DESIGN.md:50` specifies the puzzle grid as *"cells 52px desktop / 38px
mobile, gap 4px/3px, wrapped in a paper card with hard accent shadow"*,
and `DESIGN.md:35` gives grid cells a 5 px radius. That spec was written
against the Binairo reference frame — an 8×8 board, one fixed size, one
set of numbers. Both shipped boards honour it.

A Nonogram board cannot. Its side changes **daily** — 5, 8, 10 or 15 — and
it carries clue rails outside the cells on two edges. There is no
reference frame for this screen at all, so the geometry is derived rather
than transcribed, and the derivation runs into a hard floor that the other
two boards never meet.

**The floor is a two-digit column clue.** A column clue of `10`–`15` has
to fit inside one cell-wide track, and the visual gate fires
`undersized-ui-text` below 11 px for a two-character string
unconditionally — so 11 px is not a preference, it is the smallest legal
type. At 11 px, the tabular advance measured for the shipping UI face is
6.609375 px per digit ([ADR-0036](./0036-aligning-numerals-use-instrument-sans-not-fraunces.md)),
so `"15"` occupies **13.203 px**. Enumerating every motif and every
mirrored variant in the shipped library, a two-digit column clue occurs on
**14.7 %** of size-15 column lines and **5.2 %** of size-10 ones. It is not
a corner case.

**The arithmetic at the narrow end decides the whole design.** At a 320 px
viewport the card's inner width is 258 px, and the row-clue gutter — a
`max-content` track — resolves to 45.05 px at sizes 10 and 15. That leaves
212.95 px for 15 cells:

| size 15 at 320 px | cell |
|---|---|
| `gap: 0` | **14.20 px** ✓ |
| `gap: 2px` | **12.33 px** ✗ |
| `gap: 3px` | **11.40 px** ✗ |

A gapped board is **below the 13.203 px clue floor**, which means either
the clues overflow their track or the board overflows the phone. "Let it
scroll" is already a closed question in this repo: a Binairo board that
overflowed below 369 px shipped once, the whole document scrolled
sideways, the last columns were unreachable, and the regression test that
exists because of it is still there. `CLAUDE.md` states the page body must
never scroll horizontally.

So the 4 px/3 px gap is unavailable, and once the gap is zero the 5 px
radius follows it out: at `gap: 0` a radius notches all four corners of
every interior junction.

## Decision

1. **The board is one flat CSS grid at `gap: 0`, and the structure is
   *drawn* rather than inferred from spacing.** Ordinary separation is a
   1 px per-cell border in
   `color-mix(in srgb, var(--ink) 50%, transparent)` — computed
   **3.16:1** over desk paper, clearing WCAG 1.4.11's 3:1 for a
   non-text boundary. `--line` was measured at **1.37:1** on the same
   paper and is not a separator at all.

2. **The frame and the every-5-cells group rules are 2 px `var(--ink)` on
   the same borders** — **15.01:1** on paper and **3.48:1** on a filled
   cell, so the structure survives the picture painting over it. Both come
   from one modulo on the cell's own index; the frame and the group rules
   are the same rule at `index % 5 === 0`.

3. **Never a wrapper element** — not per row, not per group. A container
   around part of a board inside the board's card is *card dentro de card*
   verbatim from `DESIGN.md`'s anti-references, and row wrappers are
   independently unavailable under
   [ADR-0030](./0030-grid-games-are-composite-widgets-one-tab-stop-roving-focus.md)
   decision 2.

4. **The clue gutters are `max-content` tracks inside the same flat
   grid.** The failure mode is what chooses this: a future motif with more
   runs than today's library **shrinks the cells** rather than overflowing
   the phone. The library's run bound is pinned by
   `packages/games/test/nonogram/clue-bounds.test.ts`, which enumerates every
   motif and every mirrored variant through `deriveClues` and asserts the
   per-size worst row; `apps/web/test/nonogram-screen.test.tsx`'s `WORST_ROW`
   is its consumer, named in both files. So that day cannot arrive silently.

5. **Four explicit size classes carry literal templates**: fixed cells of
   52 / 52 / 48 / 32 px above 768 px for sizes 5 / 8 / 10 / 15, and
   `minmax(0, 1fr)` with `aspect-ratio: 1` below it. No formula, no
   generated CSS — four templates a reader can check against the table
   above.

6. **The shared 1140 px fold holds.** The widest Nonogram card is
   **559.05 px** (sizes 10 and 15) against **579 px** of board column at
   the binding viewport, 19.95 px of margin. Honouring `DESIGN.md:50`'s
   52 px cell at 15×15 would need a 1421 px fold and would change three
   games and the conclusion, in a band **neither scanned viewport
   enters**. The 32 px cell at size 15 is the price of one fold and it is
   the right trade.

7. **Board touch targets fall below 44 px, this is conscious, and it is
   recorded HERE rather than only in a code comment.** At the reference
   phone the card inner is 328 px, and `10 × 44 = 440` and
   `15 × 44 = 660` both exceed it **before any gap, border or gutter**, so
   `PRODUCT.md:39` / `DESIGN.md:40`'s ≥44 px is arithmetically unreachable
   at sizes 10 and 15. WCAG 2.5.8's softer 24 px floor: sizes 5 and 8
   clear at both scanned viewports; size 10 clears at 390 (28.30 px) and
   not at 320 (21.30 px); size 15 fails at both (**18.86 px** at 390,
   **14.20 px** at 320). **WCAG 2.5.7/2.5.8's essential-presentation
   exception applies because the grid *is* the content** — a nonogram
   whose cells are 44 px is a different puzzle, not a bigger one. The
   44 px rule is honoured where it governs: the chrome controls, 60 px
   tall and 88 px wide at 320 px.

## Rejected

- **A gapped, rounded, 52 px-cell board like the other two, letting a
  320 px phone scroll on the days it does not fit.** The strongest
  argument against everything above, and it loses three times over: "let
  it scroll" is a closed question with a regression test behind it and a
  `CLAUDE.md` rule against it; the deviation is smaller than it looks,
  because a nonogram is traditionally a ruled field rather than a grid of
  separated values, and separating the cells actively fights the picture;
  and the system's own escape hatch is already drawn — Sudoku answered the
  same problem one rung down by drawing its box structure with the
  identical `color-mix` expression and the identical 3:1 argument. This is
  that decision taken one step further, not a new idea.
- **`--line` (`#D8D0C2`) for the hairline.** **1.37:1** over desk paper.
  It is a decorative rule in this palette, not a separator, and it would
  vanish entirely against a filled cell.
- **`--ink-2` for the heavy rule.** **1.18:1** against a filled cell — the
  one place the heavy rule has to survive.
- **A `border-radius` on cells.** At `gap: 0` it notches all four corners
  of every interior junction, and the picture is exactly the thing those
  junctions are made of.
- **Fixed pixel gutter tracks per size.** Embeds a font measurement in the
  stylesheet, which breaks silently the day the font, weight or size
  changes, and over-reserves for short clue sets.
- **Cell-wide `K` gutter tracks.** Couples the gutter to the cell, so it
  clears the 320 px case only by accident and stops clearing it the moment
  the cell shrinks.
- **A JavaScript-emitted custom property carrying the gutter width.**
  Reimplements — with a hard-coded digit advance — exactly what the layout
  engine computes exactly and for free.
- **Moving the shared 1140 px fold to 1421 px** so 15×15 can hold 52 px
  cells. Three games and the conclusion re-laid out to serve one weekday
  of one game, in a viewport band no automated gate visits.

## Consequences

- **(a) Four `DESIGN.md` deviations are on the record, each with its
  arithmetic:** `gap: 0` instead of 4 px/3 px; no `--radius-cell` on
  cells; 48 px and 32 px cells instead of 52 px at sizes 10 and 15; and no
  press affordance on a board cell, because a ruled-field cell has no
  shadow for `DESIGN.md`'s press rule to bind and a 1 px translate at
  `gap: 0` paints over its neighbour. Each also lands in the stylesheet's
  own TSDoc, so a reader of the CSS finds the reason where the CSS is.
- **(b) The 44 px trade is inheritable for the first time.** Sudoku made
  the same trade one rung up and recorded it only in
  `sudoku-board.module.css`, and no ADR in the repo mentions 44 px or WCAG
  2.5.8 at all. A code comment in one game's stylesheet is a snapshot, not
  a record #28 and the native clients can inherit — which is why decision
  7 is a decision here rather than a comment there.
- **(c) The hairline is invisible between two adjacent filled cells, and
  that is correct rather than a defect.** Over a filled cell the 50 %
  expression computes 1.93:1, so a run of filled cells reads as one block
  — which is what a nonogram picture *is*, and the boundary inside a run
  carries no information. The heavy rule is the one that must survive the
  fill, and at 3.48:1 it does.
- **(d) One escalation is pre-agreed, so a browser review does not reopen
  the design.** If the rendered hairline measures below 3:1 at DPR 1 after
  anti-aliasing, the fix is `ink 55%` → 3.67:1 — one token expression,
  still 4.09:1 apart from the heavy rule, no geometry change.
- **(e) The 32 px cell at 1440 px is the known soft spot, with a
  sanctioned fix.** If a visual review calls the size-15 board too small
  on a wide desktop, the answer is a nonogram-only `min-width: 1240px`
  cell step **inside its own module** — never a change to the shared fold.
- **(f) Only one size class renders on any given day.** The URL scan and
  every real-app pass therefore see exactly one of four; the other three
  are covered for *geometry* by a static harness and by stylesheet-text
  assertions, and by nothing else. That is stated so no gate is credited
  with coverage it does not have.
- **(g) #28's free play and the native clients inherit this board.** Free
  play is the same geometry with no completion write; a native client
  re-implementing the screen re-implements a ruled field, and the numbers
  it needs are here rather than in a web stylesheet.
