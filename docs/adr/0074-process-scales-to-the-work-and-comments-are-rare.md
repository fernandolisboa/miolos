# ADR-0074 — Process scales to the work, and comments are rare

**Status:** Accepted — 2026-08-22

**Supersedes:** [ADR-0058](./0058-implementation-flows-are-tiered.md)

## Context

Measured across all 119 PRs merged to `main`:

- **54 (45%)** touched zero code files; 49 were pure docs. The rate did not improve after ADR-0058 introduced tiers — the oldest 20 PRs were 40% zero-code, the newest 20 were **60%**.
- Line churn split **docs 38.7% / tests 26.6% / code 34.7%**. `docs/plans/` alone held 33,449 lines against 25,558 lines of non-comment TypeScript.
- **40.8%** of non-test TypeScript lines were comments, and 134 of 315 source files had more comment than code. The density was inverted: `play/accent.ts` carried 85 comment lines around a two-entry lookup table; `packages/db/src/testing.ts` 224 around 55.
- An audit of the comment mass found ~71% of it fails any reasonable rule: ADR narration (~3,630 lines), plan cross-references (~1,940), code-review finding IDs (~1,720), test-id back-references (~1,075), benchmark tables (~790).
- A duplication audit found ~3,000 lines of verified copy-paste in 15 clusters — seven identical mount-fetch hooks, eighteen copies of `errorResponse` (already drifted into two variants), eight copies of the authenticated-GET route body, sixteen per-game route files differing by five tokens.

ADR-0058 diagnosed the ceremony correctly and added tiers. It did not work, because the artifacts were mandatory at every tier that produced code, and because "records work is Tier 0" made bookkeeping cheap to file rather than unnecessary to write.

Fernando's call, 2026-08-22: the ceremony goes, the review does not.

## Decision

1. **The flow scales with the work**, per the table in `CLAUDE.md` § *Pick the flow, then work*, which is the operative copy. Records / quick change / defect / feature / foggy.

2. **Code review is never skipped.** Any change touching production code gets at least one reviewer. This is the one thing the light rows do not drop. Feature-row changes get four parallel lenses — correctness, security, design, invariants — down from six; performance is added conditionally, and issue-adherence folds into correctness.

3. **Plans, handoffs and evidence are not committed.** A plan is a comment on its issue; session state is `NEXT-SESSION.md`, overwritten; verification output is the PR body. `docs/plans/` (45 files), `docs/evidence/` (60 files) and 22 of 23 handoffs are deleted — 37,260 lines. Git history keeps them.

4. **Comments are rare.** One exists only where the code is genuinely hard to follow, and then it says what it does *and* why it must be that complicated; plus invariants no test covers, security arguments, runtime workarounds, and `TODO`s with issue numbers. Rationale goes in an ADR, cited as `// see ADR-NNNN`. `/*#__PURE__*/` and `eslint-disable` directives are not comments and are never stripped.

5. **SOLID, DRY, KISS and YAGNI bind implementing agents**, in the order YAGNI → KISS → DRY → SOLID when they conflict, enforced by the `reviewer-design` lens.

6. **Subagents are spawned with the model the step earns** — Opus for planning, plan review, and the correctness, security and invariant lenses; Sonnet for exploring, implementing and the design lens; Haiku for mechanical sweeps. The bindings live in `.claude/agents/`.

7. **ADRs stay, and get shorter.** An audit of all 71 found that **69 are cited from real source, test or CI files** — 0004 from 62 files, 0053 from 104. They are the destination for the rationale leaving the comments, so the count is not the problem; the length is. New ADRs are ~40 lines with two statuses (`Proposed` / `Accepted`). Existing ADRs are not rewritten.

8. **Fernando is not in the review loop.** The reviewers and the mechanical gate decide done. He gets `docs/pending-fernando.md` items and product-shape questions, nothing else.

## Consequences

- The mechanical gate is unchanged and still binds identically on every row. Nothing here removes a check.
- **Deleting the plans orphans a derivation trail.** ~794 prose citations across ~313 source files cite plan numbers as rationale footnotes, and ADRs 0055, 0057 and 0059 point at plan appendices for their measurements. Every such comment states its rule inline, so nothing breaks — but the deeper trail now lives only in git history. Accepted deliberately; most of those citations are themselves scheduled for deletion under decision 4.
- **Removing ~12,500 comment lines cannot be one PR.** It runs in per-package tranches. Six comments encode invariants no test covers (the `CRON_SECRET` operational runbook, two `vitest.shared.ts` constraints, the PGlite `t0` ordering, the nonogram oracle ban, the share-button dead-control residual) and must be relocated before they are cut.
- A single reviewer on the quick-change and defect rows catches less than six did. The gate and free escalation are the only bounds, as ADR-0058 already stated.
- Tier claims move from four numbered tiers to five named rows. The PR body still names the row, and it is still a claim checkable against the diff.
