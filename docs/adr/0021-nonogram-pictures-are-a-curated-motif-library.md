# ADR-0021 — Nonogram pictures are a curated motif library

- Status: accepted
- Date: 2026-07-31
- Issue: [#24](https://github.com/fernandolisboa/miolos/issues/24)
- Plan: [`docs/plans/012-issue-24-plan-nonogram-engine.md`](../plans/012-issue-24-plan-nonogram-engine.md)

## Context

Spec user story 12 demands that solving the daily Nonogram has a payoff
beyond the grid: a **recognizable hidden picture** emerges. Random or
procedurally generated bitmaps fail this — they produce abstract noise, and
tuning a generator until its output "looks like something" is exactly the
unfalsifiable, judgement-driven loop the project's mechanical-gate culture
forbids. At the same time, most naive pixel art is **not line-solvable**
(solvable by per-line forced deductions alone, which is the project's bar
for solvable + unique + human-completable without guessing), so pictures
cannot be accepted on looks alone either.

ADR-0015 already settled the pattern for finite curated content: AI curates
under written constraints, a mechanical harness proves the invariants
before the content is used, and judgment calls are recorded so a bad entry
is fixed by tightening a constraint, not by hand-editing under pressure.

## Decision

Nonogram pictures come from an **AI-curated, in-code motif library**
(`packages/games/src/nonogram/motifs-{5,8,10,15}.ts`), under written
constraints enforced by a mechanical harness
(`packages/games/test/nonogram/motifs.test.ts`):

1. **Four size classes — 5×5, 8×8, 10×10, 15×15** — mapped to the ISO
   weekday ramp: Mon = whole 5×5 class; Tue/Wed = 8×8 easy/hard band;
   Thu/Fri = 10×10 easy/hard band; Sat/Sun = 15×15 easy/hard band. Bands
   are half-open: easy `[0, T)`, hard `[T, ∞)` over the solver-effort score
   `passes + (1 − firstPassFill)`.
2. **Judged constraints (AI, recorded here):** every subject is a concrete,
   everyday object/animal/plant/food/tool/nature/Brazilian-iconography item
   nameable by a common pt-BR noun; no letters/digits/text, no brands, no
   people/faces of real persons, no offensive, violent, religious or
   political shapes; `mirrorable` is set only when the horizontally
   mirrored form is still recognizable as the same subject.
3. **Mechanical constraints (harness, binary):** exact size×size shape over
   `{#, .}`; unique ids; non-empty pt-BR names; `mirrorable` ⇒ mirrored
   bitmap ≠ original; **line-solvable to the exact bitmap, for the motif
   and its mirrored variant**; class floors met (28/40/40/32); every
   weekday pool ≥ `MIN_POOL = 14` effective entries. The 30–65% density
   guideline is a warning-level diagnostic, not a gate.
4. **The only transform is the horizontal mirror**, applied to motifs
   tagged `mirrorable`. Any dihedral transform preserves line-solvability
   (it is a bijective relabeling of the constraint system), but only the
   horizontal mirror reliably preserves recognizability — a mirrored anchor
   is an anchor; an upside-down cat is noise. Rotations, vertical flips,
   translations and pixel perturbation are rejected.
5. **Selection is uniform with replacement** from the weekday's pool, all
   randomness through the shared seeded PRNG (`createSeededRandom`), so
   seed → puzzle stays deterministic (ADR-0010/ADR-0011).

### Shipped library and calibrated thresholds

As authored in #24 (floors in parentheses):

| Class | Motifs | Effective entries (with mirrors) |
| ----- | ------------ | -------------------------------- |
| 5×5   | 37 (28) | 50 — Monday pool |
| 8×8   | 55 (40) | 77 — Tue 37 / Wed 40 |
| 10×10 | 50 (40) | 67 — Thu 32 / Fri 35 |
| 15×15 | 42 (32) | 71 — Sat 35 / Sun 36 |

Band thresholds were calibrated from the measured effort distribution of
this library — the value nearest the class median that keeps both bands at
`MIN_POOL` or more, placed strictly inside a gap between two observed
scores so the partition is stable:

- `T8 = 2.17` (observed gap 2.15625–2.1875)
- `T10 = 2.19` (observed gap 2.18–2.2)
- `T15 = 3.12` (observed gap ≈3.1156–3.1244)

Recalibrate by the same rule whenever the library grows enough to move a
class median; the harness fails loudly if a band ever dips below
`MIN_POOL`. The calibration is executable, not prose:
`packages/games/test/nonogram/calibration.test.ts` recomputes each class's
effort distribution, prints the observed gap around each threshold, and
fails if a threshold ever sits on an observed score or a band dips below
`MIN_POOL` — recalibrating is re-running that file and moving the
threshold into the printed gap nearest the class median.

## Consequences

- **Finite but non-consumable content.** Each weekday draws ~52
  puzzles/year from a pool of 32–50 effective entries, so a given picture
  recurs on its weekday roughly 1–2 times a year. Unlike a Termo word, a
  Nonogram picture is not burned by being seen — knowing March's "Âncora"
  does not hand you May's solve — and the seeded uniform choice makes
  repeats unpredictable. Free play (ADR-0011) reuses the same generator
  with client seeds, so per-motif exhaustion is moot.
- **Growth is additive content work**: new array entries that must pass the
  same harness; zero code change. A stricter no-repeat-within-a-year
  guarantee would need server-side without-replacement state — a product
  decision outside the pure engine, deliberately not taken here.
- **Recognizability disputes are content edits**, not code changes: adjust
  or cull the motif and re-run the harness.
- The library ships in the code-split nonogram chunk as plain TS string
  literals (~180 motifs ≈ tens of KB source, less minified) — negligible
  against ADR-0011's interactive-generation budget.
