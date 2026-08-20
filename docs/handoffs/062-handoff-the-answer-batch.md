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

## Addendum A — 2026-08-20, late session (Fernando present)

- **#59 executed live**, Fernando approving in-session: `miolos_web` role created (`relacl`: `miolos_web=r` on `daily_puzzles` only; `sessions` select and `daily_puzzles` delete both denied, probes pasted on the PR), `WEB_DATABASE_URL` set in all three miolos-web environments, `db.ts` repointed **with no fallback** (`T-WEB-S290`), `turbo.json` env list widened, ADR-0026's deferral bullet amended to claim both enforcement points. Secret files deleted after use.
- **#51 closed wontfix** (Fernando delegated). **#74 accepted** — bulk-extension; his live-generation preference recorded on the issue. **PR #135 decision 2 confirmed** ("fine").
- **Fernando's UI feedback filed:** #160 (`/privacidade` + `/estatisticas` hug the left on wide screens), #161 (Termo hub button reads as the odd one out — likely #68's contrast root), #162 (onboarding card looks misplaced — the veto is on the look, the no-shift property must survive), #163 (archive as a real clickable calendar). **He announced more gameplay feedback per game is coming.**
- **PostHog signup in progress**: guidance = Product Analytics + Error Tracking, **Session Replay unticked**; its Error Tracking may discharge #37's monitoring AC. Awaiting his Project API key. *(Discharged the same evening — Addendum B.)*

## Addendum B — 2026-08-20, later still

- **Fernando delivered the PostHog project token.** Stored as `NEXT_PUBLIC_POSTHOG_KEY` on miolos-web ×3 environments; recorded on #33 with the products-enabled note (no Session Replay) and the install-step-skipped note. **#33 is unblocked.** One open detail: the project's region (us vs eu) — one-word question to Fernando, or read off the settings URL during #33.

## Kickoff prompt for the next session

```
Read docs/handoffs/062-handoff-the-answer-batch.md WITH Addenda A+B, then
docs/pending-fernando.md.

PREFLIGHT: #59 CLOSED with its PR merged; #51 CLOSED; #160–#163 exist and
are ready-for-agent; gh secret list shows CRON_SECRET; #33's last comment
records the delivered PostHog token.
On mismatch: stop, read the newest addendum before acting.

Route work by CLAUDE.md § tiers. Frontier order: #146 first (fully
unblocked), then #160–#163 (Fernando's own complaints — high signal),
then #33 (unblocked: token in NEXT_PUBLIC_POSTHOG_KEY ×3; confirm the
us/eu region from the project settings URL before wiring api_host),
then #64/#104/#158. Reserve test ids on the issue before step 5 (T-WEB
S290 is spent by #59). Take ~/miolos-session/gate-lock.sh before any suite run,
git commit included. Update docs/pending-fernando.md in the same PR
whenever an item for Fernando appears or is discharged. End the session
with a handoff ≤120 lines + kickoff ≤15 lines — never skip it.
```
