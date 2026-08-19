# 0023 — Generator invariants: the "proved, not sampled" test pattern

**Status:** Accepted — 2026-07-31
**Amended by:** [ADR-0059](./0059-the-property-proof-splits-from-the-per-pr-gate.md) — #126 narrows layer 3's *"never below 100"* clause in **where** it binds, never in **whether** it binds: the floor moves to a nightly run (`MIOLOS_FULL_PROPERTIES=1`) and the per-pull-request gate takes a reduced 25-run sample of the same pinned draw. **One clause, one annotation, nothing deleted.** Layers 1 and 2 — the construction-level proof and the independent fixture-validated instrument — are untouched, and so is the reservation of the word *"prove"*; the sampled layer is the only one that moved, and it moved sites rather than standards.

## Context

The verification gates require that a `packages/games` generator "ships
with its invariants proved, not sampled". Issue #16 (Binairo, the seam-1
engine) established the concrete pattern, but its durable spelling lived
only in plan 010 §4 and test-file comments — and plans are point-in-time
snapshots. Sudoku (#19), Nonogram (#20) and Termo reviewers need a living
document to cite instead of excavating the Binairo plan.

## Decision

A generator's three gate invariants — every puzzle solvable, every puzzle
unique, seed → puzzle deterministic — are established in three layers:

1. **Construction-level proof.** The invariant holds for every seed by how
   the code is built, not by how many samples pass: every clue removal is
   re-proved by a counting solver before it stands (uniqueness); givens
   are a subset of a full valid solution (solvability); all randomness
   flows from the seeded PRNG, retry sub-seeds included (determinism).
2. **An independent, fixture-validated instrument.** The re-proof
   instrument (e.g. the counting solver) is not the generator trusting
   itself: it is validated in its own test file against small hand-built
   fixtures whose full solution sets are enumerated by hand in adjacent
   comments, including at least one fixture that discriminates each
   ruleset-specific rule.
3. **Property re-proof over the sampled domain.** fast-check properties
   quantify over the full uint32 seed domain (and every weekday where
   applicable) and re-check each invariant with the independent
   instrument. Run counts are a floor, never below 100 for the main
   validity and determinism properties. *(**Amended at #126** —
   [ADR-0059](./0059-the-property-proof-splits-from-the-per-pr-gate.md).
   **The floor stands; what changed is which run it binds on.** It binds
   on the full proof — `.github/workflows/properties.yml`, nightly and on
   `workflow_dispatch`, with `MIOLOS_FULL_PROPERTIES=1` — and the
   per-pull-request gate runs the same properties at a reduced 25-run
   sample. The two are not different samples: fast-check draws forward
   from the pinned seed, so the gate's 25 pairs are a strict **prefix** of
   the nightly's 100, asserted on every run rather than assumed. 25 is
   sized rather than chosen — the sudoku criteria table is per-weekday, and
   full weekday coverage of that pinned draw first arrives at 21 runs, so
   25 is that measured floor plus margin. The narrowing applies **only at a
   measured cost centre**: sudoku's three generation properties cost
   167–219 s of every gate run, 83–87 % of `@miolos/games`, while binairo's
   cost 4.4–7.9 s and nonogram's 0.6 s — those keep running their full
   counts on every pull request, and a new property joins the split only
   with its own measured gate rows. The clause that did NOT survive is the
   reading that a green pull-request gate is this layer's proof; it is a
   subset of it, and the test files say so.)*

The word "prove" is reserved for construction-backed invariants. Claims a
property can only sample (e.g. that a difficulty-criteria table is
achievable within the generation retry cap) are labeled as sampled
evidence, in tests and docs alike.

## Consequences

- Sudoku, Nonogram and Termo cite this ADR instead of re-deriving the
  pattern; reviewers reject a generator PR that samples an invariant a
  construction-level proof could carry. *(**Still true, and #126 is what
  it bought.** The one-character uniqueness break written for ADR-0059's
  anti-vacuity control — capping the per-removal re-proof so it can never
  see a second solution — failed **no** test, because the grading ladder
  rejects the same removal independently. The invariant is proved twice by
  construction, which is why moving the sampled layer's floor to a nightly
  costs the project nothing on that axis.)*
- Reference implementation: `packages/games/src/binairo/generate.ts`
  (per-removal re-proof), `packages/games/test/binairo/solver.test.ts`
  (instrument fixtures), `packages/games/test/binairo/generate.test.ts`
  (P1–P3 properties).
