---
name: small-fix
description: Defect row — fix a real bug that needs no new decision and no new surface, with one correctness reviewer instead of the Feature flow's four parallel lenses. Use when a bug is small and understood and you are about to spin up a full Feature flow for it.
---

# Defect — small fix

Reproduce → fix → one reviewer → gate → merge. No plan document, no ADR, no handoff.

Routing lives in `CLAUDE.md` § *Pick the flow, then work*. Read the table there; it is not repeated here. If the fix needs a decision, or adds a surface, it is a Feature — stop and re-route. Escalating is always allowed.

## 1. Reproduce — before touching the fix

**A described bug is not a reproduced bug.** Produce one of:

- a **failing test** at the seam that reaches the defect, or
- a **pasted repro** — the command and its real output.

Use `mattpocock-skills:diagnosing-bugs` for the loop that gets you there; do not re-derive it. Its Phase 1 completion criterion is the bar: one command you have already run, whose output you can show, that goes red on *this* defect.

If you cannot reproduce it, you cannot fix it on the Defect row. Say so and escalate.

## 2. Fix

Smallest change that turns the loop green. Nothing else in the diff.

## 3. Prove the test is not vacuous

**A fix ships with the failing case demonstrated.** Show two runs, both pasted:

- the new or repaired test **red against the broken implementation** (stash the fix, or revert the one line, and run it), and
- the same test **green with the fix in**.

A test that passes against the bug proves nothing, and this is the single check that catches it. If the repro was not a test, say in the PR why the defect is not test-reachable — never silently drop this step.

## 4. Review — one lens

Spawn **one** reviewer, correctness only: does the fix address the actual cause, and does the test fail without it. Fresh context, and it defaults to rejecting. A finding is dismissed only with a written reason in the PR, never by silence.

If the reviewer finds a design problem rather than a bug, that is the signal the work was a Feature. Re-route; do not patch forward.

## 5. Gate, PR, merge

Run the gate and **paste the real output** (`CLAUDE.md` § *Verification gates*). Serialise full-suite runs: `scripts/gate-lock.sh acquire "<who>"` before, `release` after. Never `--no-verify`.

PR body: what the defect was, the red-then-green evidence, the gate output, the reviewer's verdict, and the row claim (`Defect`) in one line. Merge on green.
