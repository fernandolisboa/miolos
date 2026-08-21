# Pending on Fernando — living ledger

**Living document — no number, edited in place.** The single list of actions and decisions only Fernando can take. Created 2026-08-20 from every handoff, plan, ADR, issue, PR body and the napkin, cross-checked against live state. Last updated 2026-08-21 (night session) — CRON_SECRET mismatch found (NOW §2); POSTHOG_KEY activation added (NOW §3, PR #176), then rewritten at that PR's step-7 round: the `vercel env pull` step is gone (it dumped every miolos-web production secret to `/tmp` to read one publishable token), the `NEXT_PUBLIC_` twin removal is required rather than optional, the item carries a privacy-copy precondition, and its Blocks line no longer promises five event streams where Resend gates one. The PostHog-deletion residual is a new SOON row. Closed 2026-08-21 (day): **both credential items are discharged** — `CRON_SECRET` rotated and the streak-notify tick green, then `POSTHOG_KEY` set and the first telemetry event captured end to end (both in the Done table, with the evidence). NOW is down to a single item, Resend. The shared lesson, now recorded in `apps/api/src/telemetry/capture.ts` and `.env.example` as well as here: setting a Vercel env var does nothing until a deploy with a real `apps/api` diff carries it into the running function, and `vercel env ls` cannot tell you whether that happened.

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

- **Do:** run `~/miolos-activate-attach.sh` **in a real terminal** (not through an agent). Eight stages: Resend account → add `miolos.app` as a sending domain → copy Resend's SPF/DKIM/DMARC into Vercel DNS and verify → `privacidade@miolos.app` forwarding to a real inbox (the address is already published on `/privacidade`) → create a sending-only API key → `vercel env add RESEND_API_KEY production` on `miolos-api` → **hand back to the agent for the redeploy** → smoke test. Optional afterwards: the `attachStreakThreshold` remote-config row.
  **Amended 2026-08-21.** The wizard's old final stage said "newest production deployment → ⋯ → Redeploy", which is the `turbo-ignore` trap that bit `CRON_SECRET` and was caught on `POSTHOG_KEY`: with no diff under `apps/api` that build is skipped and the key never reaches the running function, while `vercel env ls` still lists it. Stage 7 is now an explicit handoff — it stops the wizard and refuses to run the smoke test until an agent has landed an `apps/api` commit and confirmed a deployment went `● Building` → `● Ready`, because smoke-testing a dormant flow would just produce a confusing failure. Stage 6 also now *checks* `WEB_ORIGIN` rather than asserting it, since `isAttachConfigured()` needs both halves and a missing one fails silently.
- **Verify:** post-activation smoke = attach an email on device A, recover on device B, watch the **first live `mergeAccounts` ever**, check spam placement, run one throwaway deletion through `/privacidade`.
- **Blocks:** email attach / account recovery / merge — live-but-invisible since 2026-08-13; the email-hedge slice of #32; and **`login_linked`, the fifth telemetry event** — the other four went live 2026-08-21, and this one fires zero times until the attach flow works, so expect four streams in PostHog until then, not five.
- **Source:** `docs/handoffs/032-handoff-21-merged-m1-complete.md` §6; wizard form in `docs/plans/031` §15.

*(NOW is down to one item. Section numbers here are positional and have moved three times — PostHog was §2, became §3 when CRON_SECRET took §2, returned to §2 when CRON_SECRET was discharged, and is now itself in the Done table. Several Done rows carry older numbering in their "Was pending in" column; each is about its own subject, not about whatever holds that number today. **Cite Done rows by subject, never by section number.**)*

---

## SOON — decided or queued, agent-driven, nothing for you unless asked

- **#146** streak-at-risk dispatcher — SHIPPED (plan 063, ADR-0068) **and green as of 2026-08-21**: the hourly tick reaches the API and returns a real body (run 32477211453, the first `success` the workflow has ever had) after the CRON_SECRET rotation in the Done table. The phone ritual in ANY TIME is now the only thing between this and a real nudge. Email-hedge slice (slice C) still waits on NOW §1.
- **#64** Nonogram picture name — decided (ship the name, amend ADR-0033), `ready-for-agent`.
- **#104** archive OG cards — decided (index + month get cards), `ready-for-agent`.
- **#158** terms-of-use page `/termos` — approved and filed, `ready-for-agent`.
- **#37** account deletion does not reach PostHog — **an honest residual, recorded here because the ledger is where a gap with no owner goes to get one.** `POST /account/delete` is a `db.delete(users)` cascade over our own tables and issues no PostHog deletion, so telemetry event rows keyed to that `userId` outlive the account. `/privacidade` says so and publishes the path that does work (`privacidade@miolos.app`), so nothing on the page is false — but the immediate self-service erasure is not complete on this axis. Closing it needs a PostHog **personal** API key (the publishable token cannot delete), which is a new credential and therefore a new NOW item the day someone decides to take it; **#37's LGPD review (ADR-0012) owns that decision**, and it also inherits a second row of the same shape: a merged-away loser account keeps its `userId` alive as a PostHog `distinct_id`, outside `mergeAccounts` and outside `CONTEXT.md`'s Tombstone row. Source: ADR-0069 decision 5; #176 step-6 security B1 / ADR B2. **Nothing for Fernando until #37 is picked up.** It was deliberately kept out of the PostHog key item, which is now discharged; this residual survives it untouched, and as of 2026-08-21 telemetry is live, so the rows it describes are now accumulating for real rather than hypothetically.
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
| `POSTHOG_KEY` set — telemetry live, first event captured | NOW §2 (PostHog), 2026-08-21 | 2026-08-21, Fernando set the key (`phc_`, non-sensitive) on miolos-api production and removed all **three** `NEXT_PUBLIC_POSTHOG_KEY` copies from miolos-web; agent forced the redeploy with PR #181's `apps/api` diff (`miolos-bq9i8jlis`, watched `● Building` → `● Ready`, **not** skipped). Precondition confirmed first: `/privacidade` already named PostHog and said the data leaves Brazil. Verified end to end — opened today's Sudoku on production, `POST /telemetry` → **204**, and the event landed in PostHog: `puzzle_started`, `game: sudoku`, `date: 2026-08-21`, `archive: false`, person = the server `userId`. ADR-0069's promises hold in the live data: *Person profile processing* `false`, *GeoIP disabled* `true`, URL/SCREEN and LIBRARY both empty, and **one entry only** — no autocapture, no `$pageview`, no client SDK |
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
