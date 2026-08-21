# Pending on Fernando — living ledger

**Living document — no number, edited in place.** The single list of actions and decisions only Fernando can take. Created 2026-08-20 from every handoff, plan, ADR, issue, PR body and the napkin, cross-checked against live state. Last updated 2026-08-21 (night session) — CRON_SECRET mismatch found (NOW §2); POSTHOG_KEY activation added (NOW §3, PR #176), then rewritten at that PR's step-7 round: the `vercel env pull` step is gone (it dumped every miolos-web production secret to `/tmp` to read one publishable token), the `NEXT_PUBLIC_` twin removal is required rather than optional, the item carries a privacy-copy precondition, and its Blocks line no longer promises five event streams where Resend gates one. The PostHog-deletion residual is a new SOON row. Closed 2026-08-21 (day): the `CRON_SECRET` item is **discharged** — rotated, redeployed and verified green (Done table), so PostHog returns to §2. Its lesson is carried into the PostHog item, whose `vercel --prod` redeploy step was the same trap and is now a required `apps/api` diff.

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

### 2. Set `POSTHOG_KEY` on miolos-api — the telemetry shipped in #33 sends nothing until you do

Issue #33's PostHog integration ships in PR #176 and **deploys dormant**: the capture helper is server-side only (`apps/api/src/telemetry/capture.ts`, ADR-0069), it reads `POSTHOG_KEY` from the API's environment, and that variable does not exist there yet. The token itself already exists — it is the value sitting in `NEXT_PUBLIC_POSTHOG_KEY` on **miolos-web**, where nothing reads it, because the final design keeps the key off the client entirely. So this is a **move**, not a new credential. Until it is done the deployed API logs one line per instance (*"POSTHOG_KEY is unset: telemetry capture disabled…"*) and the PostHog dashboard stays empty. An agent cannot run `vercel env` unattended (permission classifier, the same class as #59 and the 2026-08-21 CRON_SECRET rotation in the Done table).

**Do not do this until:** `/privacidade` names PostHog as a processor and says the measurements leave Brazil. **This shipped in PR #176 itself** (`privacy.collected.telemetry`, ADR-0069 decision 5), so the precondition is met the moment #176 is on production — check `https://miolos.app/privacidade` shows the PostHog sentence before setting the key. The ordering is what makes the deferral of the full LGPD review to **#37** (ADR-0012) safe: setting the key starts sending per-user play history to a US processor, and it must not start before the page says so.

- **Do (easiest):** start a session with *"set POSTHOG_KEY — pending-fernando NOW §2"* and approve the prompts. **Or by hand, in a real terminal:**
  ```
  # Read the token from the DASHBOARD, not from `vercel env pull`:
  #   vercel.com → miolos-web → Settings → Environment Variables
  #   → NEXT_PUBLIC_POSTHOG_KEY → the eye icon → copy.
  # `vercel env pull` would write the project's ENTIRE production
  # environment — WEB_DATABASE_URL included — to a file, to copy one
  # publishable token. Don't.
  cd ~/projects/miolos/apps/api
  vercel env add POSTHOG_KEY production                   # paste the value

  # REQUIRED, same sitting — not optional (ADR-0069 decision 8):
  cd ../web
  vercel env rm NEXT_PUBLIC_POSTHOG_KEY production
  ```
  **Then ask an agent to land any commit touching `apps/api/**` — that, not `vercel --prod`, is the redeploy.** This line used to read `vercel --prod` and it would not have worked: `apps/api/vercel.json` sets `"ignoreCommand": "npx turbo-ignore"`, so a production build with no diff under `apps/api` is **skipped** — the 6-second `Canceled` rows in `vercel ls miolos-api --prod`. The key would never have been baked into the running function, `vercel env ls` would still have listed it, and the item would have looked done while the PostHog dashboard stayed empty. Proven the hard way by the CRON_SECRET rotation on 2026-08-21 (see the Done table), which is why a real `apps/api` diff is the instruction here.
  If the dashboard's eye icon will not reveal `NEXT_PUBLIC_POSTHOG_KEY`, do not fight it — the same token is always readable at its source, in PostHog: **Settings → Project → Project API Key**.
  The twin removal is a required step because ADR-0069 decision 8 rules the `NEXT_PUBLIC_` twin out outright — a public twin invites client use, and leaving it is exactly the state the ADR says must not exist. Nothing reads it, so removing it breaks nothing. (Preview/Development copies too, if any: `vercel env ls` from `apps/web` shows them.)
- **Verify:** `vercel env ls` from `apps/api` lists `POSTHOG_KEY` and the same command from `apps/web` no longer lists `NEXT_PUBLIC_POSTHOG_KEY`; then play one puzzle on production and PostHog's *Verify installation* goes green on the first captured event (`puzzle_started` fires as soon as a board opens).
- **Blocks:** four of the five telemetry events in production — `puzzle_started`, `puzzle_completed`, `streak_broken`, `notification_opt_in`. **`login_linked` additionally waits on NOW §1 (Resend):** the attach flow is dormant in production, so it fires zero times until that is done, and you should expect four streams here, not five. `notification_opt_in` also needs a real browser opt-in to happen — no longer blocked, since the CRON_SECRET rotation of 2026-08-21 turned the hourly tick green; it now waits only on the ANY TIME phone ritual. Nothing else: the API is unaffected by the absence, by design.
- **Source:** issue #33; PR #176; ADR-0069 decisions 1, 5 and 8; `apps/api/.env.example`; step-6 security B1/B2 and issue B3 on #176.

*(Section numbers here are positional and have moved twice. PostHog was §2, became §3 when the CRON_SECRET item took §2 on 2026-08-20, and is §2 again now that CRON_SECRET is discharged. Two Done rows carry the older numbering in their "Was pending in" column; both are about their own subject, not about whatever holds that number today. Cite Done rows by subject, never by section number.)*

---

## SOON — decided or queued, agent-driven, nothing for you unless asked

- **#146** streak-at-risk dispatcher — SHIPPED (plan 063, ADR-0068) **and green as of 2026-08-21**: the hourly tick reaches the API and returns a real body (run 32477211453, the first `success` the workflow has ever had) after the CRON_SECRET rotation in the Done table. The phone ritual in ANY TIME is now the only thing between this and a real nudge. Email-hedge slice (slice C) still waits on NOW §1.
- **#64** Nonogram picture name — decided (ship the name, amend ADR-0033), `ready-for-agent`.
- **#104** archive OG cards — decided (index + month get cards), `ready-for-agent`.
- **#158** terms-of-use page `/termos` — approved and filed, `ready-for-agent`.
- **#37** account deletion does not reach PostHog — **an honest residual, recorded here because the ledger is where a gap with no owner goes to get one.** `POST /account/delete` is a `db.delete(users)` cascade over our own tables and issues no PostHog deletion, so telemetry event rows keyed to that `userId` outlive the account. `/privacidade` says so and publishes the path that does work (`privacidade@miolos.app`), so nothing on the page is false — but the immediate self-service erasure is not complete on this axis. Closing it needs a PostHog **personal** API key (the publishable token cannot delete), which is a new credential and therefore a new NOW item the day someone decides to take it; **#37's LGPD review (ADR-0012) owns that decision**, and it also inherits a second row of the same shape: a merged-away loser account keeps its `userId` alive as a PostHog `distinct_id`, outside `mergeAccounts` and outside `CONTEXT.md`'s Tombstone row. Source: ADR-0069 decision 5; #176 step-6 security B1 / ADR B2. **Nothing for Fernando until #37 is picked up** — it sits beside the PostHog NOW item rather than inside it, because the key move is not blocked on it.
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
- New 2026-08-20: on a phone with a 3-day streak, confirm the push opt-in card appears and a test nudge arrives (VAPID is live, **and as of 2026-08-21 the hourly tick actually reaches the API** — it had been 401ing since it shipped, so no nudge had ever been sent). #146's dispatcher now sends for real at the habitual hour once a subscription exists, which makes this ritual the last unproven link in the chain.

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
| `CRON_SECRET` rotated — streak-notify tick green for the first time | NOW §2 (CRON_SECRET), 2026-08-21 | 2026-08-21, Fernando ran the two writes (`gh secret set` + `vercel env add --force --sensitive`), agent did the rest. The copy was impossible: the variable is **Sensitive** on miolos-api, so `vercel env pull` yields the literal `[SENSITIVE]` and `vercel env run` yields empty — rotation was the only route. Redeploy forced by PR #179's `apps/api` diff (deployment `miolos-qkzn3lwla`, `● Ready`, production) because `turbo-ignore` skips a no-diff build. Verified: run **32477211453** `success` — the workflow's first ever — with body `{"candidates":0,"claimed":0,"sent":0,"pruned":0,"failed":0}` instead of 401. Zeros are correct at 08:26 São Paulo. `/cron/publish` safe by construction: same variable, same deployment |
| PostHog account + project token + region | NOW (PostHog — the section renumbered to §3 when CRON_SECRET took §2) | 2026-08-20: Fernando signed up (Product Analytics + Error Tracking, no Session Replay), delivered the `phc_…` token (stored as `NEXT_PUBLIC_POSTHOG_KEY` ×3 envs on miolos-web) and confirmed **US** region; all on #33. Error Tracking may also discharge #37's monitoring AC |
| #59 least-privilege web DB role | NOW §2 | 2026-08-20, Fernando present and approving: `miolos_web` role live (`relacl … miolos_web=r`, `sessions`/`delete` probes denied), `WEB_DATABASE_URL` in all 3 envs, code + ADR-0026 amendment in #59's PR |
| #135 veto decision 2 (Termo cross-device rule) | STANDING | Fernando 2026-08-20: "fine" — rule confirmed, ADR-0060/0065 stand as shipped |
| #74 answer-pool direction | STANDING | Fernando 2026-08-20: bulk-extension accepted for now; his live-generation preference recorded on #74 |
| #51 wontfix call | SOON | Fernando delegated 2026-08-20; closed as wontfix with reason |
| VAPID keys — push activated | this ledger NOW §1 (morning) | 2026-08-20: 3 `VAPID_*` vars added to miolos-api production, prod redeployed (`api.miolos.app`, "Ready in 1m") |
| `CRON_SECRET` GitHub repo secret | this ledger NOW §4 (morning) | 2026-08-20: `gh secret list` shows `CRON_SECRET 2026-08-20T21:03:26Z`. ⚠️ **This evidence was not sufficient and this row was premature.** `gh secret list` proves a secret *exists*; it cannot show the value, so it could not show that the value was wrong — which it was, and the streak-notify tick 401ed for a full day before a manual dispatch caught it. Superseded by the 2026-08-21 rotation row above. **Lesson: a credential is discharged by exercising it end to end, never by listing it.** The same presence-vs-correctness error later appeared as a `grep -c` readability test and was caught before it could do damage |
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
