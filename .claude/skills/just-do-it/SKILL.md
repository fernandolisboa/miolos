---
name: just-do-it
description: Tier 0 flow — ship a typo, a comment or doc correction, a dependency bump, a one-line test fix, or a records-only change (ADR status flip, docs/README.md row, test-id frontier update) with no ticket, no plan and no review agents. Use when the change is on CLAUDE.md's Tier 0 row and you are about to reach for the eight-step flow anyway.
---

# Tier 0 — Just do it

One agent, one branch, one PR. No ticket, no plan document, no ADR, no handoff, no review subagents. The mechanical gate is the whole defence, and it binds here exactly as it binds on a feature slice.

Routing lives in `CLAUDE.md` § *Implementation flows are tiered*. Read the table there; it is not repeated here.

## 1. Confirm the tier

Check the change against the Tier 0 row. It is a **closed list**, not a judgement call — if the change is not literally one of those things, it is not Tier 0.

Three disqualifiers, any one of which ends Tier 0 immediately:

- It needs a **decision** — anything you would want an ADR to record.
- It adds or changes a **surface** — a route, an export, a contract, a schema, a user-visible string.
- It changes **behaviour** anyone could observe at runtime. A dependency bump that changes behaviour is Tier 1 or 2, not a bump.

**If you find yourself writing a plan, you are in the wrong tier.** Stop, say so, and re-tier — Tier 1 if it is a defect, Tier 2 otherwise. Escalating costs nothing. Continuing at the wrong weight is the failure this tier exists to prevent.

## 2. Branch

`<type>/<slug>` — `docs/`, `chore/`, `fix/` per Conventional Commits. There is usually no issue number to carry; use one only if a ticket already exists.

## 3. Change

Make the change and nothing else. Tier 0's diff is small by definition, and an unrelated "while I'm here" edit is how a Tier 0 PR earns a Tier 2 review it will not get.

## 4. Gate

Run it and **paste the real output**. `CLAUDE.md` § *Verification gates* is the list; `npx impeccable detect` only if the change touches UI.

Serialise full-suite runs on the shared box: `scripts/gate-lock.sh acquire "<who>"` before, `release` after. Never `--no-verify`.

## 5. PR and merge

The body is three things, in this order:

1. **What changed** — a sentence or two.
2. **Gate output** — pasted, not summarised.
3. **The tier claim** — `Tier 0` and the routing-table row it matches, in one line.

Then merge on green. If the diff of process artifacts you produced is larger than the code diff, the tier was wrong — say so in the PR rather than hiding it.
