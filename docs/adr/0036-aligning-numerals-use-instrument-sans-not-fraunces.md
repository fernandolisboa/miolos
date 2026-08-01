# ADR-0036 — Numerals that must align in a column use Instrument Sans; Fraunces has no tabular figures

**Status:** Accepted — 2026-08-01
**Depends on:** [ADR-0002](./0002-plain-react-web-ui-not-universal-rn-web.md)
**Amends:** `DESIGN.md:28` — *"`font-variant-numeric: tabular-nums` is mandatory on every grid, timer and statistic."* — and `packages/ui/tokens.css`'s standing comment plus the trailing `/* + tabular-nums */` on `--text-numeral-lg`. All three state as law a rule the chosen display face cannot satisfy. They are edited in the same commit that lands this ADR; no token **value** moves.

## Context

The design system names two faces — Fraunces for display, Instrument Sans
for UI — and then states one typographic rule that applies to both:
*tabular figures are mandatory on every grid, timer and statistic.* Both
shipped play screens follow it literally, setting
`font-variant-numeric: tabular-nums` on Fraunces timers and Fraunces board
cells.

The Nonogram board forced the rule to be checked rather than assumed,
because its clue rails are literally columns of numerals that have to line
up in a 13 px track, and the geometry rests on the exact advance
([ADR-0035](./0035-the-nonogram-board-is-a-ruled-continuous-field.md)). So
it was measured — in the repo's own Chrome 151, against the **exact woff2
files `next/font` ships** for the latin subset, with the advance computed
as `width(61 repeats) − width(60 repeats)` so side bearings cannot pollute
it:

```
Instrument Sans 400/500/600/700 11px tabular-nums → EVERY digit 6.609375px, spread 0.000000
Instrument Sans 400 11px plain                    → min 4.171875  max 7.500000  spread 3.328125
Fraunces 400 11px plain                           → min 4.953125  max 7.140625  spread 2.187500
Fraunces 400 11px + font-feature-settings:"tnum"  → IDENTICAL. No change.
Fraunces 600 11px tabular                         → min 5.156250  max 7.437500  spread 2.281250
Fraunces @100px: digits plain 510.875 · "tnum" 510.875 · "onum" 510.875   (no feature responds)
             letters plain 457.406 · "smcp" 457.406 · "ss01" 457.406      (none at all)
             axis wght 400→900: 510.875 → 580.312   (variable machinery IS live)
             axis opsz 9→144:   566.703 → 508.062   (opsz IS live)
```

**The finding is broader than the one feature.** `tnum` does not respond
on Fraunces, and neither does `onum`, `smcp` or `ss01` — no OpenType
feature tag responds at all — while the `wght` and `opsz` variable axes
are live. That is the positive control: the file is loading and its
variable machinery works, so the null result is a real property of the
face as shipped, not a broken measurement.

Therefore `font-variant-numeric: tabular-nums` on `var(--font-display)` is
a **no-op**, and a document that calls it mandatory is asking for
something that cannot be delivered. The rule needs to be stated in terms
of the face that can satisfy it.

## Decision

1. **Numerals that must align in a column use `var(--font-ui)` with
   `font-variant-numeric: tabular-nums`.** Grids, timers, statistics,
   histograms — anything where a digit changing must not move its
   neighbours. Instrument Sans collapses every digit to **6.609375 px** at
   11 px, spread **0.000000**.

2. **`var(--font-display)` numerals are for single-glyph or non-aligning
   use.** A lone numeral that never has to line up with another — a
   streak count on its stamp, a board cell holding one centred glyph — may
   stay on Fraunces, and `tabular-nums` on it is inert rather than
   harmful. What it may not do is carry a *column* of figures.

3. **The three comment lines that state the old rule are amended in the
   commit that lands this ADR** — `DESIGN.md:28`,
   `packages/ui/tokens.css`'s standing rule, and the trailing
   `/* + tabular-nums */` on `--text-numeral-lg`, which pairs a Fraunces
   token with a feature this ADR measures as a total no-op. **No token
   value moves and no JSX enters `packages/ui`**; these are comments, and
   [ADR-0002](./0002-plain-react-web-ui-not-universal-rn-web.md)'s
   invariant is about JSX and primitives.

4. **The Nonogram clue rails are Instrument Sans 600 at 11 px with
   `tabular-nums`**, which is decision 1 applied to the first surface that
   forced it. 11 px is the floor the visual gate enforces for a
   two-character string, and 13.203 px for `"15"` is the number
   ADR-0035's whole geometry is derived against.

5. **This ADR does not fix the defect it documents, and says so rather
   than implying it was fixed.** `.timerCard` (Fraunces 30 px) and
   `.timerBar` (Fraunces 20 px) render the running clock on the display
   face today, with a ≈6.1 px swing per digit at 30 px — the clock
   physically shifts on every tick, on both shipped play screens, and
   `/nonogram` inherits it as a third surface because it renders the same
   shared components. Fixing it here would put an unrelated visible change
   to two shipped screens inside a Nonogram diff. It is carried as its own
   issue, filed before #25's pull request body is written so the link is
   real at review time.

## Rejected

- **Leaving `DESIGN.md:28` and the token comments as they are, and
  recording the measurement only in the Nonogram plan.** A plan is a
  point-in-time snapshot; `DESIGN.md` and `tokens.css` are what the next
  session and the `impeccable` skill actually read. Leaving them stating
  an unachievable rule means the next author either writes a no-op or
  contradicts the system on purpose with no record.
- **Forcing tabular figures onto Fraunces with
  `font-feature-settings: "tnum" 1`.** Measured: byte-identical output.
  There is nothing to force.
- **Replacing Fraunces as the display face.** A whole brand decision
  overturned to serve a numeric alignment property, when the system
  already ships a second face that has the property. Fraunces is chosen
  for its voice, not its figures.
- **Switching `--text-numeral-lg` to `var(--font-ui)`.** It would change
  the *value* of a shipped token and re-render the streak stamp in the
  wrong face — the token's numeral is a single, non-aligning glyph, which
  is exactly the case decision 2 keeps on the display face.
- **Fixing `.timerCard`/`.timerBar` in this ticket.** Two shipped screens
  change appearance inside a diff about a third game. It is a real bug
  with a real fix; it is not this ticket's.

## Consequences

- **(a) Every future timer, statistic, histogram and grid is bound by
  this.** The rule is now stated in terms a face can satisfy, so "use
  tabular figures" has an answer instead of a contradiction.
- **(b) `DESIGN.md` and `packages/ui/tokens.css` stop contradicting the
  shipping fonts.** This repo's convention is that "X is amended" means X
  was **edited** — the founding handoff carries an amendments table added
  by the ADR-landing commits themselves — so an ADR that claimed an
  amendment without making it would be the same class of false document it
  exists to correct.
- **(c) A known visible defect is on the record with its magnitude.**
  ≈6.1 px per digit at 30 px, on two shipped screens and inherited by a
  third. Anyone who notices the clock jitter finds the measurement and its
  ticket rather than re-deriving both.
- **(d) The measurement is reproducible, and its method is part of the
  claim.** Advance by 61-minus-60 repeats, against the exact woff2 the
  build emits, with a feature-tag positive control. A future font bump
  re-runs it; a recalled number would not have caught that no feature tag
  responds at all.
- **(e) Board cells are unaffected and that is not luck.** Each holds one
  centred glyph, so per-digit advance never accumulates — which is why the
  defect surfaced on the timer and not on two years of grid cells.
