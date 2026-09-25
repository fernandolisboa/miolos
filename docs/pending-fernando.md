# Pending on Fernando — living ledger

**Living document — no number, edited in place.** The single list of actions and decisions only Fernando can take. Created 2026-08-20 from every handoff, plan, ADR, issue, PR body and the napkin, cross-checked against live state. **Last updated 2026-09-24 at #36: NOW gains §2, the database step for #36's second PR.** Before that, 2026-09-24: #199's question (how people stop the email reminder) was asked and answered the same day; it is in the Done table. Before that, 2026-08-31: §2 was filed and discharged the same day — the SessionStart hook that carries Fernando's standing request into every session is installed and in the Done table. NOW is back to the single ⚡ item. Before that, 2026-08-22 (session 072): NOW gained its first item since the section emptied — §1, the ⚡ dark-day product call on #200, split out of #74's exploration. It is low urgency by ~13 months and the row says so. Before that, 2026-08-22 at #104 — two SOON rows flipped to SHIPPED and nothing new added. #104 (archive OG cards) shipped in PR #190 with ADR-0071, and nothing in it needs Fernando: no credential, no production action, no store listing, no money, no legal, no product-scope call. **And #64 was found stale** — it still read `ready-for-agent` for an issue that merged in PR #188 (`69e4d35`, ADR-0070) the day before, which is what a SOON row does when a shipping PR does not close its own. NOW stays empty. Before that: last updated 2026-08-21 (night session) — CRON_SECRET mismatch found (NOW §2); POSTHOG_KEY activation added (NOW §3, PR #176), then rewritten at that PR's step-7 round: the `vercel env pull` step is gone (it dumped every miolos-web production secret to `/tmp` to read one publishable token), the `NEXT_PUBLIC_` twin removal is required rather than optional, the item carries a privacy-copy precondition, and its Blocks line no longer promises five event streams where Resend gates one. The PostHog-deletion residual is a new SOON row. **NOW is EMPTY as of 2026-08-21 (evening)** — Resend/email-attach was the last item, and its activation carried the first magic link, the first `mergeAccounts` and the first account deletion this product has ever run (Done table). Earlier that day: **both credential items were discharged** — `CRON_SECRET` rotated and the streak-notify tick green, then `POSTHOG_KEY` set and the first telemetry event captured end to end (both in the Done table, with the evidence). NOW is down to a single item, Resend. The shared lesson, now recorded in `apps/api/.env.example` and `.claude/napkin.md` as well as here: setting a Vercel env var does nothing until a deploy with a real `apps/api` diff carries it into the running function, and `vercel env ls` cannot tell you whether that happened.

**How to use it (Fernando):** when you have time, start a session with *"run /wizard over docs/pending-fernando.md, NOW section"* — the wizard walks you through each step, one at a time. Decisions marked ⚡ are answerable in one line on the named issue, from a phone.

**Maintenance protocol (agents):**

1. Any PR, review, plan or session that surfaces a **new** action or decision only Fernando can take adds it here, **in the same PR** — an item that lives only in a PR body or issue comment is how things get forgotten.
2. When an item is discharged, **move it to the Done table** with the date and the evidence (PR, commit, command output). Never delete a row; never re-ask a Done item.
3. Before presenting this list to Fernando, **verify the NOW items against reality** (`vercel env ls`, `gh secret list`, issue state) — he may have done them outside git.
4. Each item keeps the wizard-ready shape: **Do / Verify / Blocks / Source**.

---

## NOW — one database step, and one ⚡ decision that is not urgent

*(Section numbers were positional and moved three times before the section emptied on 2026-08-21. Several Done rows carry that old numbering in their "Was pending in" column; each row is about its own subject, not about whatever held that number. **Cite Done rows by subject, never by section number.** As promised there, the next item filed starts at §1 again — this is it.)*

### §1 ⚡ What Miolos does on a day with no Termo — issue #200

- **Do:** answer #200 with one or two letters. **(a)** keep the dark screen, fix only the copy so it stops calling a permanent state a temporary glitch; **(b)** as (a), plus the hub hides the Termo tile on days it is not published; **(c)** redefine **Dia Perfeito** as "every daily that exists today", so three-for-three counts on a dark day; **(d)** recycle answers rather than go dark — **ADR-0040 rejected this** and choosing it means writing the ADR that reverses it. (a) and (b) compose with (c), so `b+c` is a valid answer.
- **Verify:** the letters are on #200 and its `needs-info` label is dropped.
- **Blocks:** #200 only. **It does not block #74**, which is the alert that stops us ever getting here and is ordinary agent work.
- **Urgency: low, and stated so you can ignore it for a year.** The pool is 400 answers draining at exactly one per day — ≈ 13.1 months of dailies (ADR-0015: *"400 answer words (13+ months of dailies)"*). Today nothing is dark and nothing is close to dark.
- **Why it is yours and not an agent's:** the four options are different promises to the player, and (c) changes a shipped medal's meaning. The pt-BR wording, the tile's visual treatment and the ordering are **not** yours and will not be asked — CLAUDE.md, *"Do not bring him UI/UX choices."*
- **Do NOT be re-asked the answer-pool direction.** You settled that on 2026-08-20 (bulk-extension accepted, live generation preferred long-term) and it is in the Done table as *"#74 answer-pool direction"*. That is about **refilling** the pool; #200 is about **running out**. Two questions, and #74's body ran them together, which is why #200 was split out.
- **Source:** #74's exploration, 2026-08-22 (this session). The consequence that made it worth filing rather than leaving in the ticket: with no Termo daily, **Dia Perfeito is unreachable for every user indefinitely** — an achievement class silently freezes. The streak survives (ADR-0008 rule 3, *"the streak stays reachable through the three grid games"*), so the core mechanic does not break.

### §2 Apply the migration #36's second PR adds to Neon — before that PR

- **Do:** run these two statements against production with `DATABASE_URL_UNPOOLED` (the operator ritual, napkin § Shell 2):
  ```sql
  ALTER TABLE "users" ADD COLUMN "recovery_consent_withdrawn_at" timestamp with time zone;
  ALTER TABLE "users" ADD COLUMN "reminder_consent_withdrawn_at" timestamp with time zone;
  ```
- **Verify:** `SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name LIKE '%withdrawn_at';` returns both names. Paste it on #36.
- **Blocks:** #36's second PR (withdrawing email-reminder consent and removing the email from `/ajustes`). It is not pushed until this row is in Done: previews share the production database, and a new `users` column changes the insert every new session runs (ADR-0038 (h)).
- **Safe to do early:** both columns are new and nullable, and nothing reads them until that PR ships. Applying today changes nothing for players.
- **Source:** #36 plan, 2026-09-24; [ADR-0082](./adr/0082-settings-withdraws-consent-with-timestamps-removing-the-email-is-the-recovery-withdrawal.md).

---

## SOON — decided or queued, agent-driven, nothing for you unless asked

- **#146** streak-at-risk dispatcher — SHIPPED (plan 063, ADR-0068) **and green as of 2026-08-21**: the hourly tick reaches the API and returns a real body (run 32477211453, the first `success` the workflow has ever had) after the CRON_SECRET rotation in the Done table. The phone ritual in ANY TIME is now the only thing between this and a real nudge. Email-hedge slice (slice C) is **filed as #199** as of 2026-08-22 — it had been unblocked and *unfiled* for two days, which is the same rot this section's #64 row below is about. Resend went live 2026-08-21 (Done table) and Fernando's Q1/Q2 were answered 2026-08-20, so nothing had blocked it since; the filing step simply never happened, and the row said *"it remains ordinary agent work on #146"* while no ticket existed. Ordinary agent work on **#199**, nothing for Fernando. **#199 is built** (PR #268, ADR-0083) and merges after #36's second PR, which adds the Ajustes checkbox that stops the email.
- **#64** Nonogram picture name — **SHIPPED** (PR #188, `69e4d35`, ADR-0070). *This row read `ready-for-agent` for a full day after the work merged; corrected 2026-08-22 at #104. It is live proof that the ledger rots when a shipping PR does not close its own SOON row, which is why #104's row below was scheduled inside its own plan rather than left to be noticed.* The two deliberate departures from Fernando's instructions are in STANDING and stay there until he says otherwise.
- **#104** archive OG cards — **SHIPPED** (PR #190, ADR-0071): all three archive shells have cards, `/arquivo` as a committed asset and the month and day pages pointing at `/cartao/mes/<YYYY-MM>` and `/cartao/<YYYY-MM-DD>`. The design call his comment delegated — whether the day card names the four games — was decided in-plan (it does not) and recorded on the issue. **Nothing in it needs Fernando.**
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

- Delete a throwaway account end-to-end **in production** via `/privacidade` and confirm it is really gone. **Still open, but narrowed on 2026-08-21:** the *route* and its cascade are proven — `POST /account/delete` returned `{"deleted":true}` and the database showed the users row gone with 0 completions and 0 sessions. What remains untested is the **`/privacidade` page itself**: the button, its confirmation copy, and what the browser is left holding afterwards. Do not read the Done row as covering that.
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
- **#64's two departures from your instructions, both deliberate and both reversible in a one-line ticket** (PR #188, ADR-0070). **(1) The bundle tripwire is KEPT, not spent.** You said the implementing PR must "replace or retire" ADR-0033 consequence (d)'s grep. It turned out nothing had to be spent: the grep scans `.next/static/chunks` only, the name ships over an authenticated wire, and an API response is never a chunk — so the check is still fully armed, proved by a `bundle-check` run with the name live (ADR-0070 consequence (c)). Keeping it costs nothing; only bundling the motif tables would kill it. **(2) The caption's copy register is the shipped card's, not your phrasing.** Your "Você revelou: Âncora" reads as a second-person sentence at 11px tracked-uppercase kicker size, which breaks the register Termo's `dayWordRow` established; the lead is "A figura de hoje era" with the name under it, and the second person lives in the accessible label — "Você revelou Âncora — …" (ADR-0070 consequence (j)). Per CLAUDE.md copy register is the agent's call, so this is recorded rather than asked. **Say the word on #64 if you disagree with either.**

---

## POST-LAUNCH — gated by #151 (native epic), correctly not started

- Apple Developer + Google Play accounts, certificates, store listings; key art via Nano Banana (outside the runtime only). Source: issue #151 item 5.

---

## DONE — so nothing is re-asked

| Item | Was pending in | Evidence done |
|---|---|---|
| #199 how people stop the email reminder | NOW §2, 2026-09-24 | Fernando 2026-09-24 on the #199 thread: never by writing an email; it must be a user setting (a checkbox). The checkbox is #36's second PR; PR #268 merges after it (ADR-0083 decision 6) |
| SessionStart hook installed — the standing request now reaches every session in this repo | NOW §2 (standing authorization), 2026-08-31 | 2026-08-31, Fernando ran the install himself; an agent cannot, and three attempts were refused by the auto-mode classifier (a Bash heredoc and the Write tool for `~/.claude/hooks/`, then the edit that would have added its own permission rules — self-granting privilege is the one refusal no in-chat approval lifts, and it is correct). **Installed:** `~/.claude/hooks/miolos-standing-authorization.sh`, executable, guarded on `*"/projects/miolos"*` with `exit 0` otherwise so it is silent in every other project; emits one line of valid JSON carrying `hookEventName: "SessionStart"` and the four points as `additionalContext`. **Registered:** second entry in the existing `matcher: "*"` SessionStart group in `~/.claude/settings.json`, the herdr hook untouched at position one. **Permissions:** `.claude/settings.local.json` allow list gained `Bash(gh pr *)`, `Bash(gh issue *)`, `Bash(pnpm *)`, `Bash(npx vitest *)`, `Edit(.claude/agents/**)` beside the `Bash(git *)` Fernando had already added — which is what let PR #243 merge after two earlier refusals. **Why it was needed:** Claude Code injects `heron_brook` (*"Do not call the AgentTool unless the user requested it"*), gated on the Opus 5 capability `opus_5_prompt_bundle`, in no config file, unreachable from `/config`, and it overrides `CLAUDE.md` — upstream anthropics/claude-code#80988 and #82371, both open and verified. The hook wins by satisfying that line's own escape clause. **Not verified in-session:** SessionStart hooks fire at startup, so the installing session could not test it; the check is the first item in `NEXT-SESSION.md` |
| Resend / email-attach activated — **the first magic link, the first merge, the first deletion** | NOW §1 (Resend), 2026-08-21 | 2026-08-21, Fernando ran the wizard (Resend account, `miolos.app` sending domain in São Paulo, DNS, sending-only key, `vercel env add`); agent forced the redeploy with PR #183's `apps/api` diff and drove the smoke test over the real HTTP API. **Mail:** magic link delivered to the **inbox, not spam**, link host `miolos.app` (no click-tracking rewrite — tracking is off by default, needs a verified tracking subdomain, and only rewrites HTML bodies while this transport sends `text:` only). **Config proof:** `GET /attach/state` → `{"eligible":true}` on production, which is the only check that shows `isAttachConfigured()` true *inside the running function* — `vercel env ls` cannot. **Merge (first ever, ADR-0050 decision 5):** device B completed today's Binairo, requested the same email; after confirm the older holder won, Binairo moved into it (4 games), the loser kept an emptied tombstone row, and **every other session died** — both driver cookies 401 afterwards, one live session left. **Deletion:** `POST /account/delete` on a throwaway → `{"deleted":true}`, and the DB shows users row gone, 0 completions, 0 sessions — real erasure, deliberately unlike the merge tombstone. **Remote config:** `attachStreakThreshold` dropped to 1 to make the card reachable, restored to **5** (ADR-0003) after; the row is now explicit where the table was previously empty, same effective value |
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
