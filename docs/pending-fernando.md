# Pending on Fernando — living ledger

**Living document — no number, edited in place.** The single list of actions and decisions only Fernando can take. Created 2026-08-20 from every handoff, plan, ADR, issue, PR body and the napkin, cross-checked against live state. Last updated 2026-08-21 (night session) — CRON_SECRET mismatch found; see handoff 062.

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

### 2. Re-set the GitHub `CRON_SECRET` — the streak-notify tick is 401ing against production

Found 2026-08-21 (night): a manual `Streak notify` dispatch (run 32439773422) got **HTTP 401** from `POST https://api.miolos.app/cron/notify`. The API's auth is fail-closed and expects `Bearer <CRON_SECRET>` (`apps/api/src/cron/auth.ts`); the daily publish cron works, so production's value is good — the **GitHub repo secret copy doesn't match it** (likely a stray newline or paste slip when it was set on 2026-08-20). Every hourly tick is red until this is fixed, and **no streak-at-risk push is being sent** even though VAPID and the dispatcher are live. An agent cannot pull the production value unattended (permission classifier, same class as #59).

- **Do (easiest):** start a session with *"fix the CRON_SECRET GitHub secret — pending-fernando NOW §2"* and approve the prompts; the agent pulls the value from Vercel and re-sets the secret. **Or by hand, in a real terminal:**
  ```
  cd ~/projects/miolos/apps/api
  vercel env pull /tmp/api.env --environment=production --yes
  gh secret set CRON_SECRET --body "$(grep '^CRON_SECRET=' /tmp/api.env | cut -d'"' -f2)"
  rm /tmp/api.env
  gh workflow run "Streak notify"
  ```
- **Verify:** `gh run list --workflow="Streak notify" -L1` shows `success`, and the run log's `cron-notify response:` line is a JSON body, not an error.
- **Blocks:** the entire #146 dispatcher in practice — the hourly tick fails before reaching the API, so no nudge is ever dispatched; the ANY TIME phone ritual (push card + test nudge) will also fail until this is done.
- **Source:** run 32439773422 (2026-08-21 manual dispatch); PR #171; `apps/api/src/cron/auth.ts` fail-closed comment.

*(Former §2 discharged 2026-08-20: PostHog region answered — US. See the Done table.)*

---

## SOON — decided or queued, agent-driven, nothing for you unless asked

- **#146** streak-at-risk dispatcher — SHIPPED (plan 063, ADR-0068): the hourly tick is live on `main`, **but every tick currently 401s — see NOW §2**; the phone ritual in ANY TIME covers the human verification once §2 is done. Email-hedge slice (slice C) still waits on NOW §1.
- **#64** Nonogram picture name — decided (ship the name, amend ADR-0033), `ready-for-agent`.
- **#104** archive OG cards — decided (index + month get cards), `ready-for-agent`.
- **#158** terms-of-use page `/termos` — approved and filed, `ready-for-agent`.
- **#160–#163** Fernando's UI feedback of 2026-08-20 (left-hugging layouts, the Termo accent, the onboarding card's look, the archive calendar) — filed, `ready-for-agent`. He announced **more gameplay feedback per game is coming**; when he gives it, file it the same way and add anything human-blocking here.

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
- New 2026-08-20: on a phone with a 3-day streak, confirm the push opt-in card appears and a test nudge arrives (VAPID is live as of today, **and the hourly tick is live** — #146's dispatcher sends for real at the habitual hour once a subscription exists).

---

## STANDING — no action unless you disagree

- **Copy/design flags left open, revise only if you dislike them:** medals names/placement (handoff 036), five stats copy flags (handoff 034), four sharing deviations (handoff 041).

---

## POST-LAUNCH — gated by #151 (native epic), correctly not started

- Apple Developer + Google Play accounts, certificates, store listings; key art via Nano Banana (outside the runtime only). Source: issue #151 item 5.

---

## DONE — so nothing is re-asked

| Item | Was pending in | Evidence done |
|---|---|---|
| PostHog account + project token + region | NOW §2 (PostHog) | 2026-08-20: Fernando signed up (Product Analytics + Error Tracking, no Session Replay), delivered the `phc_…` token (stored as `NEXT_PUBLIC_POSTHOG_KEY` ×3 envs on miolos-web) and confirmed **US** region; all on #33. Error Tracking may also discharge #37's monitoring AC |
| #59 least-privilege web DB role | NOW §2 | 2026-08-20, Fernando present and approving: `miolos_web` role live (`relacl … miolos_web=r`, `sessions`/`delete` probes denied), `WEB_DATABASE_URL` in all 3 envs, code + ADR-0026 amendment in #59's PR |
| #135 veto decision 2 (Termo cross-device rule) | STANDING | Fernando 2026-08-20: "fine" — rule confirmed, ADR-0060/0065 stand as shipped |
| #74 answer-pool direction | STANDING | Fernando 2026-08-20: bulk-extension accepted for now; his live-generation preference recorded on #74 |
| #51 wontfix call | SOON | Fernando delegated 2026-08-20; closed as wontfix with reason |
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
