# 0023 — Generator invariants: the "proved, not sampled" test pattern

Status: accepted
Date: 2026-07-31

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
   validity and determinism properties.

The word "prove" is reserved for construction-backed invariants. Claims a
property can only sample (e.g. that a difficulty-criteria table is
achievable within the generation retry cap) are labeled as sampled
evidence, in tests and docs alike.

## Consequences

- Sudoku, Nonogram and Termo cite this ADR instead of re-deriving the
  pattern; reviewers reject a generator PR that samples an invariant a
  construction-level proof could carry.
- Reference implementation: `packages/games/src/binairo/generate.ts`
  (per-removal re-proof), `packages/games/test/binairo/solver.test.ts`
  (instrument fixtures), `packages/games/test/binairo/generate.test.ts`
  (P1–P3 properties).
