---
name: just-do-it
description: Records row — ship a doc edit, an ADR status flip, a test-id frontier update, a label or workflow tweak with no ticket, no plan and no review agents. Nothing under apps/ or packages/ may change. Use when the change is on CLAUDE.md's Records row and you are about to reach for a heavier flow anyway.
---

# Records — just do it

One agent, one branch, one PR. No ticket, no plan document, no ADR, no handoff, no review subagents. The mechanical gate is the whole defence, and it binds here exactly as it binds on a feature slice.

Routing lives in `CLAUDE.md` § *Pick the flow, then work*. Read the table there; it is not repeated here.

## 1. Confirm the row

Check the change against the Records row. It is a **closed list**, not a judgement call — if the change is not literally one of those things, it is not a Records change.

Four disqualifiers, any one of which ends the Records row immediately:

- It changes **any file under `apps/` or `packages/`** — including a comment-only edit. That is a Quick change and it owes a reviewer.

- It needs a **decision** — anything you would want an ADR to record.
- It adds or changes a **surface** — a route, an export, a contract, a schema, a user-visible string.
- It changes **behaviour** anyone could observe at runtime. A dependency bump belongs on the Quick change row, never here.

**If you find yourself writing a plan, you are in the wrong row.** Stop, say so, and re-route — Defect if it is a bug, Feature otherwise. Escalating costs nothing. Continuing at the wrong weight is the failure this row exists to prevent.

## 2. Branch

`<type>/<slug>` — `docs/`, `chore/`, `fix/` per Conventional Commits. There is usually no issue number to carry; use one only if a ticket already exists.

## 3. Change

Make the change and nothing else. A Records diff is small by definition, and an unrelated "while I'm here" edit is how it earns a review it will not get.

## 4. Gate

Run it and **paste the real output**. `CLAUDE.md` § *Verification gates* is the list; `npx impeccable detect` only if the change touches UI.

Serialise full-suite runs on the shared box: `scripts/gate-lock.sh acquire "<who>"` before, `release` after. Never `--no-verify`.

## 5. PR and merge

The body is three things, in this order:

1. **What changed** — a sentence or two.
2. **Gate output** — pasted, not summarised.
3. **The row claim** — `Records` and why the change matches that row, in one line.

Then merge on green. If the diff of process artifacts you produced is larger than the code diff, the tier was wrong — say so in the PR rather than hiding it.
