---
name: small-fix
description: Tier 1 flow — fix a real defect of roughly 50 lines or fewer that needs no new decision and no new surface, with one correctness reviewer instead of the eight-step flow's six lenses. Use when a bug is small and understood and you are about to spin up a full feature-slice flow for it.
---

# Tier 1 — Small fix

Reproduce → fix → one reviewer → gate → merge. No plan document, no ADR, no handoff.

Routing lives in `CLAUDE.md` § *Implementation flows are tiered*. Read the table there; it is not repeated here. If the fix needs a decision, or adds a surface, it is Tier 2 — stop and re-tier. Escalating is always allowed.

## 1. Reproduce — before touching the fix

**A described bug is not a reproduced bug.** Produce one of:

- a **failing test** at the seam that reaches the defect, or
- a **pasted repro** — the command and its real output.

Use `mattpocock-skills:diagnosing-bugs` for the loop that gets you there; do not re-derive it. Its Phase 1 completion criterion is the bar: one command you have already run, whose output you can show, that goes red on *this* defect.

If you cannot reproduce it, you cannot fix it at Tier 1. Say so and escalate.

## 2. Fix

Smallest change that turns the loop green. Nothing else in the diff.

## 3. Prove the test is not vacuous

**A fix ships with the failing case demonstrated.** Show two runs, both pasted:

- the new or repaired test **red against the broken implementation** (stash the fix, or revert the one line, and run it), and
- the same test **green with the fix in**.

A test that passes against the bug proves nothing, and this is the single check that catches it. If the repro was not a test, say in the PR why the defect is not test-reachable — never silently drop this step.

## 4. Review — one lens

Spawn **one** reviewer, correctness only: does the fix address the actual cause, and does the test fail without it. Fresh context, and it defaults to rejecting. A finding is dismissed only with a written reason in the PR, never by silence.

If the reviewer finds a design problem rather than a bug, that is the signal the work was Tier 2. Re-tier; do not patch forward.

## 5. Gate, PR, merge

Run the gate and **paste the real output** (`CLAUDE.md` § *Verification gates*). Serialise full-suite runs: `~/miolos-session/gate-lock.sh acquire "<who>"` before, `release` after. Never `--no-verify`.

PR body: what the defect was, the red-then-green evidence, the gate output, the reviewer's verdict, and the tier claim (`Tier 1`) in one line. Merge on green.
