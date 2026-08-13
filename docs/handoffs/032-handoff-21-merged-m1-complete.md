# Handoff — #21 merged: the attach flow lands dormant, and M1 is complete

**To:** the session that picks the next ticket.
**From:** the session that ran #21 through all eight steps — two-lens plan review (both rejected, 18 findings fixed), six-lens code review (a real security BLOCKER found and closed), two fix rounds, a verification round that went REJECT → CLEAN, merge.
**Next step:** **pick from §5's table and start at step 1 of `CLAUDE.md`'s eight-step flow.** There is no code work left on #21 — but activation is a human checklist (§6) that Fernando owns.

Point-in-time snapshot; where an ADR disagrees, the ADR wins.

---

## 0. Check this before you read anything else

```
git checkout main && git pull && git log --oneline -1
curl -s https://api.miolos.app/health
curl -s https://api.miolos.app/attach/state
curl -s -o /dev/null -w "%{http_code}\n" https://miolos.app/privacidade
curl -s -o /dev/null -w "%{http_code}\n" https://miolos.app/vincular
```

Expect `main` at **`878a919`** ("feat: email attach — magic link, merge-on-collision, and the LGPD minimum (#21) (#88)") or a descendant, health `ok`, `/attach/state` answering **`{"error":"no-session"}`** (the route working, cookieless), both pages **200**. All verified against production the hour this was written. **The attach feature is live but DORMANT**: no `RESEND_API_KEY` exists, so `isAttachConfigured()` is false, `/attach/state` reports ineligible for everyone, the hub card never renders, and `/attach/request` would 503 fail-closed. **M1 is complete** — `gh` lists zero open M1-titled issues (the 028-handoff claim that #20 closed M1 was corrected in handoff 030; #21 was the real last ticket).

**Migration 0004 is applied to production Neon** (pre-push, per the preview-shares-prod-DB rule): `attach_tokens`, `users.attach_prompt_dismissed_at`, partial unique index `users_verified_email_uq`.

---

## 1. What #21 shipped, and where the reasoning lives

The email-attach stack end to end, dormant until keyed: **magic-link request/confirm** (`apps/api/app/attach/{request,confirm}/route.ts` + `src/attach/service.ts` — hash-only `attach_tokens`, 30-min DB-clock expiry, atomic `DELETE…RETURNING` single-use claim, 3/rolling-hour rate caps per user AND per email counted from the token rows, global 1-hour cleanup); **merge-on-collision** calling #20's `mergeAccounts` with the winner-liveness guard (`packages/db/src/merge.ts`, `WINNER_LIVENESS_SIGNATURE` discriminable error) and the **stale-intent pre-merge 409**; **cross-account session revocation** (`revokeSessionsForUser` — after a merge, no pre-existing session survives on the winner; only the clicking browser's fresh cookie lives); **`GET /attach/state`** (strict `{eligible}`, threshold never ships to the client, `attachStreakThreshold` in remote config, default 5); **dismiss** (server-owned exactly-once lifecycle via `users.attach_prompt_dismissed_at`); **account deletion** (`POST /account/delete`, real cascade + clearing cookie); the **hub attach card** (quiet in-flow card, repo's first form controls, renders only when `eligible`); **`/vincular`** (scanner-safe two-step confirm, bystander gate on the clicking browser's own streak, malformed-token explainer); **`/privacidade`** (pt-BR policy naming both deletion paths and `privacidade@miolos.app`); **Resend transport via plain fetch** (zero new deps, `AbortSignal.timeout(10_000)`, fail-closed on `RESEND_API_KEY` AND `WEB_ORIGIN`).

- **The plan:** [`docs/plans/031-issue-21-plan-email-attach-magic-link-merge-lgpd.md`](../plans/031-issue-21-plan-email-attach-magic-link-merge-lgpd.md); deviation register (9 items + addenda) in the PR body.
- **The ADR:** [ADR-0050](../adr/0050-email-attach-magic-link-tokens-consents-and-the-lgpd-minimum.md) — 14 decisions. It **amends ADR-0009** (flow-level: the loser's original cookie now resolves to nothing after a confirm-merge; the merged identity rides the clicking browser's fresh cookie; reciprocal `Amended by:` in ADR-0009). Consents stay timestamp-only (ADR-0022's conditional resolved, ADR-0012's "given or withdrawn" argued as a recorded near-miss).
- **The review:** six lenses; the security lens found a real **account-takeover BLOCKER** (attacker-requested link + victim click left the attacker's remapped cookie live on the merged account) — closed by the session revocation, pinned by `T-API-S82`. Disposition + verification corrections: [PR #88 disposition](https://github.com/fernandolisboa/miolos/pull/88#issuecomment-5286001984), flake addendum `issuecomment-5286308288`.
- **Recorded residuals (read before touching this area):** the pre-revocation window (transient, neon-http structural — ADR-0050 D13); the recovery-direction stranding after a mid-merge transient failure (bounded loss, repair seam = the nightly consistency check ADR-0009 contemplates — D5); the lapsed-history bystander not gated on `/vincular` (D14); the per-email-cap victim lockout (D11).

**Final gate:** typecheck 6/6 · lint 0 · **1 447 tests** serial (was 1 383 pre-#21) · bundle-check exit 0 (`/` 818.7 KB raw / 219.8 gzip — fresh baselines published in the PR) · impeccable clean beside `--no-config` positive controls · contrast arithmetic hand-computed in the PR · CI green incl. main post-merge.

---

## 2. New rules of the road #21 leaves behind

- **Authenticated-write conventions extended:** the four attach POSTs follow the completions template (origin guard, JSON content-type gate, credentialed CORS, ordered gates, deliberate-throw-is-the-500). `GET /vincular` is side-effect-free by construction — keep it that way.
- **After a cross-account confirm-merge, no pre-existing session survives on the winner.** ADR-0050 D13; weakening it reopens the takeover.
- **Migrations on tables with INSERT writers reach Neon BEFORE the branch's first push** — preview deploys share the production DB (handoff 019 fact, now a napkin rule). Apply via the serverless-driver script pattern (napkin Shell #2) — no `psql` on the dev box.
- **`isAttachConfigured()` is the single dormancy switch** (key AND origin); both the request route and `/attach/state` read it. Half-configured environments render no prompt.
- **The flake convention paid off:** any test near the CI 5s default gets an explicit in-file timeout with arithmetic (`T-WEB-S119` now carries `{ timeout: 20_000 }` — this also fixed main's own red gate).
- **Test-id frontier at `878a919`, re-derived by grep:** next free **`T-CORE-S59` · `T-DB-S34` · `T-API-S85` · `T-WEB-S153` · `T-LINT-S31`**. #21's burns (CORE S55–S58, DB S30–S33, LINT S29–S30) recorded in `docs/agents/test-ids.md`, stay burned.

---

## 3. Landmines

All of [handoff 030 §3](./030-handoff-20-merged-the-account-merge-lands.md) stands (nvm preamble; `.next` wipe before typecheck; bundle-check needs a build after the wipe; napkin stash before `gh pr merge`; `--concurrency=1` for jsdom flakes; migrations never via `drizzle-kit migrate`). New: the **preview-shares-prod-DB push-ordering rule** above — it is the sharpest landmine this project has.

**`docs/` numbering:** plan 031 and handoff 032 are taken. Next plan/handoff: `033`. Next ADR: `0051`. Plans/handoffs owe a `docs/README.md` row; ADRs owe none.

---

## 4. Live state

- Production: four dailies, free play, streak, manifest, **plus** `/privacidade`, `/vincular`, and the five attach/account endpoints — all dormant/fail-closed until activation (§6). The hub card renders for no one yet.
- `mergeAccounts` has now ONE production caller (the confirm route) but has never run live — the first live merge happens after activation, in the §6 smoke.
- `readDayState` still local (#83); #58 still decided-not-implemented; both untouched.

---

## 5. Open work, in the order it is likely to matter

| Issue | Why it might come first |
|---|---|
| **Activation (§6)** | Not an issue — Fernando's checklist. Until it runs, #21's surface is invisible to users |
| [#29](https://github.com/fernandolisboa/miolos/issues/29) · [#31](https://github.com/fernandolisboa/miolos/issues/31) | **M3 opens.** #29 (stats, calendar, Dia Perfeito — unblocks #30 medals, #37); #31 (archive, the SEO surface). **Read #58's decision first**; whoever encodes on-time into stored rows must sequence with it |
| [#32](https://github.com/fernandolisboa/miolos/issues/32) | Streak-at-risk notifications — was blocked by #21, now unblocked; reminder consent exists (stored, never yet acted on). One push type only |
| [#83](https://github.com/fernandolisboa/miolos/issues/83) | Cross-device day state — now MORE valuable (recovery/device move exist; a recovered account's done/pending tiles are empty until this) |
| [#58](https://github.com/fernandolisboa/miolos/issues/58) | Decided, not implemented; own plan + ADR-0009/0026 amendments; the T-DB-S24 column tripwire will catch its stored column |
| Nightly consistency check | Unticketed: the repair seam for ADR-0050 D5's stranding residual — `listCompletionsForMerge` exists for it; consider ticketing |
| [#74](https://github.com/fernandolisboa/miolos/issues/74) · [#76](https://github.com/fernandolisboa/miolos/issues/76) · [#78](https://github.com/fernandolisboa/miolos/issues/78) · [#63](https://github.com/fernandolisboa/miolos/issues/63) · [#67](https://github.com/fernandolisboa/miolos/issues/67) · [#64](https://github.com/fernandolisboa/miolos/issues/64) · [#51](https://github.com/fernandolisboa/miolos/issues/51) · [#59](https://github.com/fernandolisboa/miolos/issues/59) · [#61](https://github.com/fernandolisboa/miolos/issues/61) · [#62](https://github.com/fernandolisboa/miolos/issues/62) · [#65](https://github.com/fernandolisboa/miolos/issues/65) · [#66](https://github.com/fernandolisboa/miolos/issues/66) | The polish/infra tail |
| [#33](https://github.com/fernandolisboa/miolos/issues/33) · [#34](https://github.com/fernandolisboa/miolos/issues/34) · [#35](https://github.com/fernandolisboa/miolos/issues/35) · [#36](https://github.com/fernandolisboa/miolos/issues/36) · [#37](https://github.com/fernandolisboa/miolos/issues/37) | M3/M4 tail, mostly blocked |

---

## 6. Activation checklist — Fernando's, in order (plan 031 §15)

None of these block anything in the repo; the code is merged and fail-closed. Until all are done, the attach flow stays invisible.

1. **Resend account** (resend.com) — free tier suffices for v1.
2. **Verify the sending domain** `miolos.app` in Resend → add the SPF/DKIM DNS records it issues, in Vercel DNS.
3. **`privacidade@miolos.app` forwarding** to your inbox (Vercel DNS email forwarding, or ImprovMX/Cloudflare-style forwarder) — the policy page already publishes this address.
4. **API key** → `vercel env add RESEND_API_KEY production` on **miolos-api** (also `preview` if you want the card testable on previews). `WEB_ORIGIN` already exists in production.
5. *(Optional)* seed `remote_config` with `{"key": "attachStreakThreshold", "value": N}` to tune away from the default 5 — one INSERT via the napkin's serverless-driver pattern.
6. **Post-deploy smoke — the first live merge** (handoff 030 §6 debt): attach an email on account A (real inbox, real link); clear site data and recover on the same browser; play a day on a second browser, attach the same email there and watch the merge (union streak served, old cookies dead); check spam placement; one throwaway deletion via `/privacidade`.

---

## 7. Still owed by ADRs and rituals, not doable in this environment

Handoff 030 §7's list stands (screen-reader pass, installability panel, live streak ritual, 320px `apagar`). #21 adds: deliverability/spam placement (§6.6), the attach card's rendered state under impeccable (never renders unkeyed — first form controls shipped on contrast arithmetic + jsdom pins), and the live `mergeAccounts` run (§6.6).

---

## 8. Kickoff prompt

Copy everything between the markers.

--------------- BEGIN KICKOFF ---------------

Continue Miolos. #21 (email attach: magic link, merge-on-collision, LGPD
minimum, ADR-0050) merged as PR #88; main is at 878a919; M1 IS COMPLETE.
The attach flow is live in production but DORMANT (no RESEND_API_KEY —
fail-closed by design; activation is Fernando's checklist in the handoff §6).
Read docs/handoffs/032-handoff-21-merged-m1-complete.md in full first.

Pick the next ticket from that handoff's §5 table — the natural candidates
are M3's #29 (stats/calendar/Dia Perfeito, unblocks #30) and #31 (archive),
with #58's decision comment read FIRST by whoever plans either; #32 and #83
also just unblocked/appreciated — and run it through STEP 1 of CLAUDE.md's
eight-step flow. #58 stays decided-but-unimplemented; never a rider, never
re-asked.

New machinery from #21 you must not break: cross-account confirm revokes all
winner sessions (ADR-0050 D13 — weakening it reopens a closed account-
takeover); GET /vincular stays side-effect-free; isAttachConfigured() is the
single dormancy switch; the four recorded residuals in ADR-0050 D5/D11/D13/
D14 are accepted, not bugs; migrations on tables with INSERT writers reach
Neon BEFORE the branch's first push (previews share the prod DB — apply via
the serverless-driver pattern in the napkin, no psql on this box).

Every node/pnpm/npx command needs:
  source ~/.nvm/nvm.sh && nvm use default >/dev/null &&

rm -rf apps/web/.next before typecheck; bundle-check from apps/web needs a
build after the wipe. docs/ numbering: next plan/handoff 033, next ADR 0051,
each plan/handoff owes its docs/README.md row. Test-id frontier: T-CORE-S59 ·
T-DB-S34 · T-API-S85 · T-WEB-S153 · T-LINT-S31 (re-derive by grep at your
step 8).

--------------- END KICKOFF ---------------
