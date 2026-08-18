# 0020 — Binairo ruleset: canonical Takuzu, including unique lines

**Status:** Accepted — 2026-07-31

## Context

The design fixes the daily Binairo at 8×8 with 0/1 digits (design brief
line 85; Ateliê frames f3/f4). The canonical Takuzu ruleset has four rules:
(1) cells are 0/1; (2) no three identical digits consecutive in a row or
column; (3) each row and column holds exactly n/2 of each digit; (4) no two
rows identical, no two columns identical. Many casual Binairo apps drop
rule 4. Nothing in the spec or design decided it, and the weekday
difficulty ramp (easy Monday → hard Sunday, enforced by the validator's
approval criteria) needs enough technique depth on a small grid.

## Decision

Adopt the full canonical ruleset, rules 1–4, including unique rows and
columns (rule 4), for generation, solving and validation.

## Rationale

- On 8×8, rules 1–3 alone yield a thin technique spread; the hard end of
  the weekly ramp would need guessing. Rule 4 adds one advanced logic
  technique (duplicate-line avoidance) that extends the ramp while keeping
  the "no guessing ever required" guarantee for dailies.
- Rule 4 only shrinks solution sets, so clue removal can go deeper before
  losing uniqueness — the low-givens weekend bands stay reachable.
- It is the ruleset players know from canonical Takuzu implementations.

## Consequences

- Solver, grader and validator all enforce rule 4; the uniqueness proof in
  the property suite is relative to rules 1–4.
- The play screen (#18) must state the rule in its pt-BR rules copy.
- The difficulty instrument (technique tiers, weekday criteria table) lives
  in `packages/games/src/binairo/` and is exported for the publishing cron
  (#17) to consume.
