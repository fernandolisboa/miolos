# Pending on Fernando — living ledger

**Living document — no number, edited in place.** The single list of actions and decisions only Fernando can take. Created 2026-08-20 from every handoff, plan, ADR, issue, PR body and the napkin, cross-checked against live state. Last updated 2026-08-20 (evening) after Fernando's answer batch — see handoff 062.

**How to use it (Fernando):** when you have time, start a session with *"run /wizard over docs/pending-fernando.md, NOW section"* — the wizard walks you through each step, one at a time. Decisions marked ⚡ are answerable in one line on the named issue, from a phone.

**Maintenance protocol (agents):**

1. Any PR, review, plan or session that surfaces a **new** action or decision only Fernando can take adds it here, **in the same PR** — an item that lives only in a PR body or issue comment is how things get forgotten.
2. When an item is discharged, **move it to the Done table** with the date and the evidence (PR, commit, command output). Never delete a row; never re-ask a Done item.
3. Before presenting this list to Fernando, **verify the NOW items against reality** (`vercel env ls`, `gh secret list`, issue state) — he may have done them outside git.
4. Each item keeps the wizard-ready shape: **Do / Verify / Blocks / Source**.

---

## NOW — in blocking order

### 1. Resend / email-attach activation — the largest dormant surface in production

Fernando (2026-08-20): *will do when ready to run the wizard — not yet.* Stays here until then.

- **Do:** run `~/miolos-activate-attach.sh` **in a real terminal** (not through an agent). It walks: Resend account → verify `miolos.app` + SPF/DKIM/DMARC in Vercel DNS → `privacidade@miolos.app` forwarding to a real inbox (the address is already published on `/privacidade`) → `vercel env add RESEND_API_KEY production` on `miolos-api` → optional `attachStreakThreshold` remote-config row.
- **Verify:** post-activation smoke = attach an email on device A, recover on device B, watch the **first live `mergeAccounts` ever**, check spam placement, run one throwaway deletion through `/privacidade`.
- **Blocks:** email attach / account recovery / merge — live-but-invisible since 2026-08-13; also the email-hedge slice of #32.
- **Source:** `docs/handoffs/032-handoff-21-merged-m1-complete.md` §6; wizard form in `docs/plans/031` §15.

### 2. #59 — run one session with you present (approval taps only)

Fernando authorized the work outright (2026-08-20); the agent permission layer blocks unattended commands against production database credentials, so it needs you in the room to tap "allow".

- **Do:** start a session, say *"do #59"*, approve the permission prompts. The full plan is on issue #59 (comment of 2026-08-20); the agent does everything else.
- **What it is, in plain words:** the website's database password can read and write everything; it only needs to read the daily puzzles. This creates a second, read-only database user for the website, so a leak of that credential is not a master key.
- **Blocks:** nothing shipped — it is a security hardening ADR-0026 already promises.

### 3. PostHog account — a signup only you can do (#33)

- **Do:** sign up at posthog.com with your email (free tier), create a project named `miolos`, then give any session the **Project API key** (or `vercel env add` it yourself if you prefer). That is the whole human part — the five events, config and gate are agent work.
- **Blocks:** #33 (telemetry), which sits on #37's blocked-by list.

### 4. Error-monitoring account (#37 AC 4) — same shape as PostHog

- **Do:** pick a vendor (Sentry-class), sign up, hand the DSN to a session. Can wait until #33/#36 are done; needed before launch.
- **Blocks:** #37 (launch hardening) → the launch.

---

## SOON — decided or queued, agent-driven, nothing for you unless asked

- **#146** streak-at-risk dispatcher — unblocked: `CRON_SECRET` is set (Done table) and #32's Q1/Q2 answered. Email-hedge slice still waits on NOW §1.
- **#64** Nonogram picture name — decided (ship the name, amend ADR-0033), `ready-for-agent`.
- **#104** archive OG cards — decided (index + month get cards), `ready-for-agent`.
- **#158** terms-of-use page `/termos` — approved and filed, `ready-for-agent`.
- **⚡ #51** — still yours, one line: close as `wontfix`? (The "does impeccable ≥ 3.6.0 ship value extraction" check is Tier 0 agent work first.)

---

## AT LAUNCH — production actions in #37's orbit

### The founder-grant one-shot SQL

- **Do:** pick the launch instant, run the tombstone-safe `INSERT INTO medal_grants … 'founder' …` from the #37 comment (2026-08-14), via the operator ritual (napkin § Shell 2). `medal_grants` is empty today.
- **Verify:** a granted user's own `GET /medals` includes `founder`.
- **Source:** issue #37 comment; ADR-0052 decision 9.

### The #37 checks only you can run

- Delete a throwaway account end-to-end **in production** via `/privacidade` and confirm it is really gone.
- Confirm Neon backups exist and a restore works (agent documents the steps; you run/watch the restore).
- Run the launch checklist itself, with real output recorded.
- Everything else in #37 is agent work; an agent should split the human ACs out before an unattended run picks the issue up.

---

## ANY TIME — real-device rituals no CI can stand in for

Accumulated across handoffs 024, 026, 028, 034; none ever marked done. One session on a real phone + one on a desktop clears the lot:

- A real screen-reader pass (VoiceOver/NVDA) over the four games, hub streak stamp, conclusion streak card, free-play level picker (ADR-0042 (e), ADR-0043 d.10).
- Real-Chrome installability panel + an actual "add to home screen".
- The live streak ritual: complete a daily on consecutive days on a phone, watch the stamp increment.
- The 320 px `apagar` measurement (plan 022 §12.6's fallback ladder, never measured).
- Free play in a real Network tab: one `POST /session` and nothing after; the DevTools offline toggle.
- A seeded-data browser pass with screenshots over `/estatisticas` (CI's impeccable only ever sees the anonymous zero state).
- New 2026-08-20: on a phone with a 3-day streak, confirm the push opt-in card appears and a test nudge arrives (VAPID is live as of today).

---

## STANDING — no action unless you disagree

- **Termo cross-device rule (PR #135 decision 2), in plain words:** same account, two devices, both played today's Termo before syncing — one won, one lost. Only the result that reached the server **first** counts (results are write-once). Both devices then show that result: if your win was second, your tile flips `Feito` → `Jogado` and the win doesn't count. Doing nothing keeps this rule.
- **#74 answer-pool recommendation, awaiting your veto:** don't use a raw pt-BR dictionary as answers (full of plurals, conjugations, obscure/offensive words) — instead bulk-extend the curated pool by running the ADR-0015 harness over a big open dictionary. Runway grows from ~1 year to many years. Silence = go.
- **Copy/design flags left open, revise only if you dislike them:** medals names/placement (handoff 036), five stats copy flags (handoff 034), four sharing deviations (handoff 041).

---

## POST-LAUNCH — gated by #151 (native epic), correctly not started

- Apple Developer + Google Play accounts, certificates, store listings; key art via Nano Banana (outside the runtime only). Source: issue #151 item 5.

---

## DONE — so nothing is re-asked

| Item | Was pending in | Evidence done |
|---|---|---|
| VAPID keys — push activated | this ledger NOW §1 (morning) | 2026-08-20: 3 `VAPID_*` vars added to miolos-api production, prod redeployed (`api.miolos.app`, "Ready in 1m") |
| `CRON_SECRET` GitHub repo secret | this ledger NOW §4 (morning) | 2026-08-20: `gh secret list` shows `CRON_SECRET 2026-08-20T21:03:26Z` |
| #32 Q1/Q2 | this ledger NOW §2 (morning) | Fernando 2026-08-20: **1a, 2a** — recorded on #32, `needs-info` dropped |
| #64 name-the-picture decision | SOON product calls | Fernando 2026-08-20: ship the name, amend ADR-0033 — on #64, `ready-for-agent` |
| #104 archive OG cards decision | SOON product calls | Fernando 2026-08-20: index + month get cards — on #104, `ready-for-agent` |
| Terms-of-use decision | STANDING gap note | Fernando 2026-08-20: approved, agent-written — filed as #158 |
| #58 late-sync product decision | handoff 058 §10 | Decided 2026-08-02; shipped PR #156 → ADR-0066; issue closed |
| #35 onboarding: placement + five pt-BR strings | handoff 058 §10 | Answered on #35; shipped PR #150 |
| #134 attach-prompt merge defect | handoff 058 §8 | Closed 2026-08-20, absorbed by #35's merge statement |
| PR #135 veto decisions 1, 3, 4 | handoff 058 §8 | Shipped as #141→PR #148, #142→PR #153, #143→PR #147 |
| #68 accent-contrast decision | NEXT-SESSION.md (retired) | Closed 2026-08-02 |
| #31's eight product flags | handoff 038 | Confirmed 2026-08-14, recorded in ADR-0053 |
| #34's two product questions; #96's four | handoffs 041, 048 | Answered in-session |
| #78 rescope judgement | plan 054 | Closed 2026-08-20 |
| Domain `miolos.app` + Vercel projects | plan 015 / PR #40 | Bought, registered, site live (ADR-0013) |
| Dependabot security settings; `property-alert` label; `VERCEL_AUTOMATION_BYPASS_SECRET` | handoffs 039, 058 | Verified enabled / existing |
| Migration 0009 apply | PR #156 | Applied 2026-08-20, verification pasted on the PR |
