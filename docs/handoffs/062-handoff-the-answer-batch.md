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

- **Fernando delivered the PostHog project token.** Stored as `NEXT_PUBLIC_POSTHOG_KEY` on miolos-web ×3 environments; recorded on #33 with the products-enabled note (no Session Replay) and the install-step-skipped note. **#33 is unblocked.** Region confirmed minutes later: **US cloud** (`api_host` targets `https://us.i.posthog.com`, or a first-party proxy — the plan's call). Nothing PostHog remains on Fernando.

## Addendum C — 2026-08-21, the parallel night

Fernando said "work the recommended issues, in parallel." Five tickets shipped through five PRs, serialized only at the gate lock and the merge queue:

| Ticket | PR | What |
|---|---|---|
| #158 `/termos` | #166 | Terms of use, `/privacidade` mirror, Tier 2 reduced |
| #160 left-hug pages | #167 | `margin-inline: auto` + the S292 sweep test (also fixed `/termos`) |
| #162 onboarding card | #168 | Full-width band, no-shift preserved; step 7 fixed the tablet cap claim |
| #161 Termo accent | #170 | `#8D6212` + light label 4.84:1, full sweep → **ADR-0067**; step 7 re-proved the before-evidence |
| #146 dispatcher | #171 | Full eight steps, six lenses; step 7 added the partial index (migration **0011**, EXPLAIN-chosen, applied pre-push) and renumbered its ADR → **ADR-0068** |

**The dispatcher is LIVE** — hourly `streak-notify.yml` against `POST /cron/notify`; migrations 0010+0011 applied to Neon pre-push. New: plan 063, ADR-0067/0068, issue **#169** (hub nav overflows at 390px with five links, found by #162's fixtures). Notable process facts: four `test-ids.md` merge collisions all resolved by the documented convention, nothing renumbered; one lens finding was *disproved with pixel evidence* (#170's "before" was genuine); the ADR-number collision (#170/#171 both minting 0067) was resolved by merge order + renumber sweep.

## Addendum D — 2026-08-21, the telemetry-and-calendar night

Four tickets closed. The session opened by finding a **live production bug that no test could have caught**.

| Ticket | PR | What |
|---|---|---|
| — | #173 | **The dispatcher has never worked.** A manual `Streak notify` dispatch returned **401** from `POST /cron/notify`. The API gate is fail-closed and the daily publish cron shares production's value and works, so the **GitHub repo secret copy of `CRON_SECRET` is the mismatch**. No streak-at-risk push has ever been sent. Agents cannot pull production credentials unattended (the #59 class), so it is ledger **NOW §2** |
| #169 hub links | #174 | Tier 1: the five-link row wraps at 390px (`flex-wrap` + row gap), `T-WEB-S307` |
| #163 archive calendar | #175 | Tier 2: one shared server-rendered grid, **zero client JS** (bundle byte-identical), month + index, `DayRows` deleted |
| #33 PostHog telemetry | #176 | Tier 2: five events, **zero dependencies**, server-truth capture + one relay → **ADR-0069** |

**#64 is planned but not built** — steps 1–4 done, held before step 5 deliberately rather than opening a third front. Everything it needs is on the issue.

### What the reviews caught, because this is why the flow exists

- **An archive module-graph wall breach, twice, independently.** #64's plan review and #33's implementation both hit it: `sync.ts` and `play/day-state.ts` reach `src/day/**`, and the archive's play shells mount the same hook — so a "read the day claim" seam would fire a **credentialed `GET /day` from a crawler-facing route**. Both moved to passing the value *in*. The governing rule is **ADR-0053 decision 10** ("Why no endpoint"), *not* decision 9 — the wrong number was copied from `archive-day.test.tsx` on `main` and was fixed at nine sites.
- **A false privacy promise, caught by two lenses independently.** `/privacidade` promised deletion of "todo o histórico, de uma vez" while nothing deleted the PostHog rows. The disclosure copy now ships, ADR-0069 decision 5's reasoning was rewritten as wrong, and the deletion gap is a SOON row owned by #37 (the real fix needs a PostHog *personal* API key).
- **A runbook that would have leaked a Neon credential.** NOW §3 told Fernando to `vercel env pull` miolos-web's *entire* production environment to `/tmp` to read one publishable token. Rewritten to read from the dashboard.
- **Two claims that were simply untrue**: "zero UI files touched" (four screen files were), and a comment asserting a strict-parse guard whose schemas had no runtime consumer. Both fixed rather than reworded.
- The visual gate flagged **the fix agent's own copy** (`em-dash-overuse` on `/privacidade`); fixed, not dismissed.

### Landmines

- **Nothing streak-related reaches a phone until NOW §2 is done**, and nothing lands in PostHog until NOW §3 — whose **precondition is that the privacy copy ships first**, which it now has.
- **Credits ran out mid-session on Fable 5**; three agents died with uncommitted work in worktrees. Nothing was lost because the work was on disk, but the lesson stands: **commit early**, and every agent writes its report to `~/miolos-session/` as its first act.
- `T-WEB-S313`/`S314` and `T-CORE-S111` burned at step 8. Next free: `T-WEB-S323`, `T-CORE-S112`, `T-API-S176`, `T-LINT-S54`.

## Kickoff prompt for the next session

```
Read docs/handoffs/062-handoff-the-answer-batch.md — Addendum D FIRST
(A+B+C are older) — then docs/pending-fernando.md.

PREFLIGHT: #33/#163/#169 CLOSED (PRs #174/#175/#176 merged); main has
651ec33; ADR-0069 = telemetry; ADR-0070 reserved for #64; zero open PRs.
On mismatch: stop, read the newest addendum first.

TWO production surfaces are dark on Fernando: NOW §2 (CRON_SECRET
mismatch — the hourly tick 401s, no push ever sent) and NOW §3
(POSTHOG_KEY). Offer §2 first; it is a real bug, not activation.

Frontier: #64 (steps 1-4 DONE — plan ~/miolos-session/64-step2-plan.md,
reserve ids on the issue, go to step 5), then #104, #149, #155, #106,
#74. Re-derive the id frontier by grep; reserve on the ISSUE before
step 5. Take ~/miolos-session/gate-lock.sh before any suite run, git
commit included. Update docs/pending-fernando.md in the same PR when a
Fernando item appears or is discharged. End with a handoff addendum
≤120 lines + kickoff ≤15 — never skip it.
```
