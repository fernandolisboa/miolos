# Pending on Fernando — living ledger

**Living document — no number, edited in place.** The single list of actions and decisions only Fernando can take. Compiled 2026-08-20 from every handoff, plan, ADR, issue, PR body and the napkin, cross-checked against live state (`vercel env ls`, `gh secret list`, issue/PR states) at `main` `bbcc1cd`.

**How to use it (Fernando):** when you have time, start a session with *"run /wizard over docs/pending-fernando.md, NOW section"* — the wizard walks you through each step, one at a time. Decisions marked ⚡ are answerable in one line on the named issue, from a phone.

**Maintenance protocol (agents):**

1. Any PR, review, plan or session that surfaces a **new** action or decision only Fernando can take adds it here, **in the same PR** — an item that lives only in a PR body or issue comment is how things get forgotten.
2. When an item is discharged, **move it to the Done table** with the date and the evidence (PR, commit, command output). Never delete a row; never re-ask a Done item.
3. Before presenting this list to Fernando, **verify the NOW items against reality** (`vercel env ls`, `gh secret list`, issue state) — he may have done them outside git.
4. Each item keeps the wizard-ready shape: **Do / Verify / Blocks / Source**.

---

## NOW — in blocking order

### 1. VAPID keys — web push is merged and invisible until this runs

- **Do:** `npx web-push generate-vapid-keys`, then from `apps/web/../api` (the `miolos-api` project dir):
  - `vercel env add VAPID_PUBLIC_KEY production`
  - `vercel env add VAPID_PRIVATE_KEY production`
  - `vercel env add VAPID_SUBJECT production` — value `mailto:privacidade@miolos.app`
  - redeploy `miolos-api`.
- **Verify:** `vercel env ls production` shows the three vars; after redeploy, `GET /notifications/state` stops answering `{eligible:false, vapidPublicKey:null}` and the opt-in prompt card renders for a 3-day-streak user.
- **Blocks:** the shipped push opt-in (PR #154) is fail-closed dormant for every user; #146's dispatcher would have zero subscribers.
- **Source:** PR #154 §"Activation checklist"; `docs/plans/061-issue-145-plan-web-push-opt-in.md` §10; ADR-0064 consequence (a).

### 2. ⚡ Two one-line answers on issue #32 (labelled `needs-info`)

- **Do:** comment on #32 with just `1a`/`1b` and `2a`/`2b`.
  - **Q1** — a user with both a push subscription and reminder-email consent gets: **(a)** push only, email as fallback when no push exists *(recommended)*, or **(b)** both channels.
  - **Q2** — the nudge fires for: **(a)** any live streak at risk *(recommended; #146 ships this default)*, or **(b)** only streaks ≥ 3.
- **Verify:** the comment exists; an agent then drops `needs-info` on #32.
- **Blocks:** Q1 blocks filing/building the email-hedge slice of #32. Q2 only confirms #146's default (one gate in the candidate SQL).
- **Source:** issue #32 comment of 2026-08-20; ADR-0064 consequence (d); #146 body.

### 3. Resend / email-attach activation — the largest dormant surface in production

- **Do:** run `~/miolos-activate-attach.sh` **in a real terminal** (not through an agent). It walks: Resend account → verify `miolos.app` + SPF/DKIM/DMARC in Vercel DNS → `privacidade@miolos.app` forwarding to a real inbox (the address is already published on `/privacidade`) → `vercel env add RESEND_API_KEY production` on `miolos-api` → optional `attachStreakThreshold` remote-config row.
- **Verify:** post-activation smoke = attach an email on device A, recover on device B, watch the **first live `mergeAccounts` ever**, check spam placement, run one throwaway deletion through `/privacidade`.
- **Blocks:** email attach / account recovery / merge — live-but-invisible since 2026-08-13; also the email-hedge arm of #32, and `login_linked` telemetry (#33) has nothing to fire on.
- **Source:** `docs/handoffs/032-handoff-21-merged-m1-complete.md` §6 (canonical checklist); wizard form in `docs/plans/031` §15; napkin § Domain Behavior Guardrails 5.

### 4. `CRON_SECRET` as a GitHub repository secret — due when #146 merges

- **Do:** `gh secret set CRON_SECRET` with the **same value** already in Vercel (pull it with `vercel env pull` to a path outside the repo, then delete the file — napkin § Shell 2).
- **Verify:** `gh secret list` shows `CRON_SECRET` (today it shows only `VERCEL_AUTOMATION_BYPASS_SECRET`).
- **Blocks:** the hourly `streak-notify.yml` → `POST /cron/notify` call; #146 activation.
- **Source:** issue #146 body, last bullet.

---

## SOON — needed by open tickets, not today

### 5. PostHog account + project key (#33)

- **Do:** create a PostHog account/project, hand the client key to the #33 session. No checklist written yet — the #33 plan will produce one.
- **Blocks:** #33 (five events, no session replay), which sits on #37's blocked-by list.

### 6. Error-monitoring account (#37 AC 4)

- **Do:** pick and provision a monitoring vendor (Sentry-class) for both apps; hand DSN/env vars to the implementing session.
- **Blocks:** #37 (launch hardening) → the launch.

### 7. Least-privilege Neon role for `apps/web` (#59, labelled `ready-for-human`)

- **Do:** create role `miolos_web` (login, `GRANT SELECT ON daily_puzzles` only); repoint `miolos-web`'s `DATABASE_URL` (pooled) across Production/Preview/Development; answer the issue's question about the Neon integration re-sync clobbering the var; paste `\dp` evidence and a failing `select` on `sessions`.
- **Blocks:** nothing shipped — it is ADR-0026's second enforcement point. An agent must **not** pick this up (live credential rotation).
- **Source:** issue #59; `docs/plans/054` §"Needs Fernando".

### 8. ⚡ Four product calls, one line each

| Issue | The question | The cost of "yes" |
|---|---|---|
| #64 | Name the revealed Nonogram picture on the conclusion? | Loses the tripwire proving `@miolos/games/nonogram` tree-shakes out of `apps/web` (ADR-0033 (d)) — a trade, not a task |
| #104 | Do `/arquivo` and the month pages get OG cards at all? Does the day card name the four games? | None — unblocks a clean Tier 2 |
| #74 | What does the product do when the Termo answer pool runs out? (ADR-0040 rejected recycling; ADR-0015's remedy is regenerating the curated list) | Content-regeneration session. Soft deadline: ~400 answers ≈ ~1 year of runway |
| #51 | Close as `wontfix`? (The "does impeccable ≥ 3.6.0 ship value extraction" check is Tier 0 agent work first) | None |

---

## AT LAUNCH — production actions in #37's orbit

### 9. The founder-grant one-shot SQL

- **Do:** pick the launch instant, run the tombstone-safe `INSERT INTO medal_grants … 'founder' …` from the #37 comment (2026-08-14), via the operator ritual (napkin § Shell 2: env pulled outside the repo, temp script over `@neondatabase/serverless`, delete both after).
- **Verify:** a granted user's own `GET /medals` includes `founder`. `medal_grants` is empty today.
- **Source:** issue #37 comment; ADR-0052 decision 9.

### 10. The three #37 ACs only you can satisfy

- LGPD deletion request exercised end-to-end **in production**.
- Neon backup/restore posture documented **and tested**.
- The launch checklist actually run, with real output recorded.
- Note: #37 is labelled `ready-for-agent`; an agent should relabel the human ACs before any unattended run picks it up (`docs/plans/054` flagged this).

---

## ANY TIME — real-device rituals no CI can stand in for

Accumulated across handoffs 024, 026, 028, 034; none ever marked done. One session on a real phone + one on a desktop clears the lot:

- A real screen-reader pass (VoiceOver/NVDA) over the four games, hub streak stamp, conclusion streak card, free-play level picker (ADR-0042 (e), ADR-0043 d.10).
- Real-Chrome installability panel + an actual "add to home screen".
- The live streak ritual: complete a daily on consecutive days on a phone, watch the stamp increment.
- The 320 px `apagar` measurement (plan 022 §12.6's fallback ladder, never measured).
- Free play in a real Network tab: one `POST /session` and nothing after; the DevTools offline toggle.
- A seeded-data browser pass with screenshots over `/estatisticas` (CI's impeccable only ever sees the anonymous zero state).

---

## STANDING — no action unless you disagree

- **PR #135 veto decision 2 stands unvetoed:** Termo cross-device, both directions of one rule — lost elsewhere demotes `Feito → Jogado`; won elsewhere shows `Feito` and tapping restores this device's loss screen. The other three #135 decisions were answered and shipped (#141/#142/#143).
- **Copy/design flags left open, revise only if you dislike them** (per CLAUDE.md, UI/UX calls are not brought to you): medals names/placement (handoff 036 §flags), five #29-era stats copy flags (handoff 034 §flags), four sharing deviations from the `f5`/`f6` frames (handoff 041 §flags).
- **No terms-of-use document exists anywhere in the repo.** `/privacidade` covers LGPD; ToS absence looks like an unexamined gap rather than a decision — say "wontfix" or ask for one.

---

## POST-LAUNCH — gated by #151 (native epic), correctly not started

- Apple Developer + Google Play accounts, certificates, store listings; key art via Nano Banana (outside the runtime only). Source: issue #151 item 5.

---

## DONE — so nothing is re-asked

| Item | Was pending in | Evidence done |
|---|---|---|
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
