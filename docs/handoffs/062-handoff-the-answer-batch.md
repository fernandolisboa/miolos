# Handoff 062 — the ledger, and Fernando's answer batch

**Point-in-time snapshot, 2026-08-20.** `main` at `8e6c980`. Not a living document.

Two sessions in one day. The first built [`docs/pending-fernando.md`](../pending-fernando.md) (PR #157) — the living ledger of everything only Fernando can do, plus the CLAUDE.md rule that every session maintains it. The second executed his answer batch. **Handoffs resume as standard at every session close** — the Aug-20 feature session (#150–#156) wrote none, which was a miss; the cap is ~120 lines, not zero.

## What happened (all evidence on the PRs/issues named)

| Item | Result |
|---|---|
| **VAPID / web push** | **Live.** 3 `VAPID_*` vars on miolos-api production, prod redeployed. Smoke still owed: a 3-day-streak phone sees the card (ledger, ANY TIME) |
| **`CRON_SECRET`** | **Set** as a GitHub repo secret (same value as Vercel). #146's activation step is done |
| **#32 Q1/Q2** | Fernando: **1a, 2a**. On #32; `needs-info` → `ready-for-agent`. Email-hedge slice now filable (still needs Resend) |
| **#64** | Decided: **ship the Nonogram picture name**. Amend ADR-0033, spend consequence (d)'s tree-shake tripwire with a written reason. `ready-for-agent`, Tier 2 |
| **#104** | Decided: **`/arquivo` + month pages get OG cards**. Day-card content is a design call, decided in-plan. `ready-for-agent`, Tier 2 |
| **#74** | Recommendation posted (keep ADR-0015 curation, bulk-extend the answer pool from a big open pt-BR dictionary via the harness). Standing: silence = go |
| **#158 (new)** | Terms-of-use page `/termos`, approved by Fernando, agent-written, `ready-for-agent`, Tier 2 |
| **#59** | **Not executed.** Fernando authorized it, but the auto-mode permission classifier blocks unattended commands against production DB credentials. Full plan + `T-WEB-S290` reservation on the issue; needs a Fernando-present session ("do #59", approve prompts). No role was created; no env var was touched |
| **Ledger** | Updated to all of the above (this handoff's own PR) |

## Landmines

- **#59 is half-armed:** the plan on the issue reserves `T-WEB-S290` and specifies `WEB_DATABASE_URL` with **no fallback** — do not ship the code change before the env var exists in all three environments, and do not add a fallback (it silently restores the over-privileged credential and defeats the ticket).
- **#158 must not say anywhere why the terms are agent-written** — no meta-commentary about legal review in docs, code or the app (Fernando, 2026-08-20).
- The push smoke (card appears, nudge arrives) has never run on a real device; VAPID went live today.
- Frontier note: `T-WEB` next free is **S290** and it is **reserved by #59 on the issue**; next free after that is S291.

## Exit criteria / what's next

Frontier order: **#146** (dispatcher — fully unblocked today), then #64 / #104 / #158 (all decided, `ready-for-agent`), #149, #155, #106. #51 still wants Fernando's one-liner. Resend activation and #59 wait for him (ledger NOW §1–§2).

## Kickoff prompt for the next session

```
Read docs/handoffs/062-handoff-the-answer-batch.md, then docs/pending-fernando.md.

PREFLIGHT: main has 8e6c980 in history; #32/#64/#104 are ready-for-agent;
#158 exists; gh secret list shows CRON_SECRET; #59 open ready-for-human.
On mismatch: stop, read the newest addendum below before acting.

Route work by CLAUDE.md § tiers. Frontier order: #146 first (unblocked:
CRON_SECRET set, Q1=1a Q2=2a on #32), then #64/#104/#158. Do NOT start
#59 unless Fernando is present to approve permission prompts — plan is
on the issue. Reserve test ids on the issue before step 5; T-WEB S290 is
taken by #59. Take ~/miolos-session/gate-lock.sh before any suite run,
git commit included. Update docs/pending-fernando.md in the same PR
whenever an item for Fernando appears or is discharged. End the session
with a handoff ≤120 lines + kickoff ≤15 lines — never skip it.
```
