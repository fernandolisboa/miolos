# Implementation plan — Issue #21: Email attach — magic link, merge, minimal LGPD

**Issue:** [#21](https://github.com/fernandolisboa/miolos/issues/21) — M1's last ticket. Unblocked (#20 merged); blocks #29, #31, #32.
**Governing ADRs:** [ADR-0003](../adr/0003-anonymous-first-identity-with-email-recovery.md) (anonymous-first, magic link, no password, threshold in remote config), [ADR-0012](../adr/0012-minimal-lgpd-ships-with-email-attach.md) (LGPD minimum ships here; two independent consents), [ADR-0022](../adr/0022-opaque-session-tokens-in-a-sessions-table.md) (the token idiom this ticket imitates; the consent timestamp-only narrowing this ticket resolves), [ADR-0049](../adr/0049-account-merge-one-pure-function-one-idempotent-operation.md) (the merge operation this ticket is the first production caller of), [ADR-0009](../adr/0009-account-merge-recomputes-from-the-union-of-completions.md), [ADR-0013](../adr/0013-canonical-domain-and-pt-br-routes.md) (magic links target `miolos.app`; pt-BR public routes), [ADR-0018](../adr/0018-i18n-is-an-in-repo-typed-message-module.md), [ADR-0025](../adr/0025-remote-config-is-a-database-table.md), [ADR-0048](../adr/0048-the-streak-is-a-client-fetched-server-computed-value.md) (strict contracts; growth = new endpoint), [ADR-0026](../adr/0026-completions-are-write-once-rows-on-time-is-derived.md) decision 5 (user-scoped tables on `@miolos/db/user`).
**Proposed ADR:** ADR-0050 — full draft in Appendix A, created as a real file at implementation time. It **amends nothing** (§3 D17): every decision resolves a recorded silence or a recorded conditional; the argument per candidate is in D17.
**Two binding preconditions** (issue #21 comment, from PR #86's security review): (1) merges touching a common user must be serialized → D5; (2) both ids passed to `mergeAccounts` must derive from verified identities, never request-supplied → D4.
**Two decisions Fernando has already made this session (bound, not re-opened):** the email provider is **Resend via plain `fetch`** (zero new dependencies, fail-closed without the key) → D11; the LGPD contact is **`privacidade@miolos.app`** on the policy page, forwarding set up as a human step → D13/§15.
**Snapshot:** written against `main` at `f0789f0`. Point-in-time; where a later ADR disagrees, the ADR wins.

The hard parts of this ticket are not the form or the email — they are (a) making one token flow honestly serve four product verbs (attach, recovery, device move, merge-on-collision) without flow variants, (b) calling `mergeAccounts` for the first time in production under the two recorded security preconditions, and (c) discharging AC 1's "exactly once" and AC 3's "independent flags" without contradicting ADR-0022's recorded narrowing. D1 collapses (a) into a single request/confirm pair; D4/D5 discharge (b); D7/D9 discharge (c).

---

## Table of contents

- §0. Acceptance criteria → plan mapping
- §1. Scope boundary
- §2. Read first
- §3. Fixed decisions (D1–D18)
- §4. What already exists — the seams, verified
- §5. Migration 0004 and `packages/db`
- §6. `packages/core` — contracts and the remote-config tunable
- §7. `apps/api` — transport, attach service, five routes
- §8. `apps/web` — prompt card, confirm page, policy page, walls and checkers
- §9. Gates and rituals
- §10. Test plan and reserved ids
- §11. What cannot be verified in this environment
- §12. What is deliberately NOT in this slice
- §13. Deviation / risk register
- §14. Commit and PR plan
- §15. Human steps — the wizard-shaped checklist (pre-push vs pre-activation)
- §16. Exit criteria
- Appendix A. Draft ADR-0050

---

## 0. Acceptance criteria → plan mapping

| AC | Claim | Where the plan discharges it |
|---|---|---|
| 1 | The attach prompt appears exactly once, at streak ≥ 5 read from remote config | D9 (server-owned eligibility: `streak ≥ threshold ∧ email IS NULL ∧ attach_prompt_dismissed_at IS NULL ∧ transport configured`) + D10 (`attachStreakThreshold` in `remoteConfigSchema`, default 5; served as a boolean by the new `GET /attach/state`, never as a leaked threshold). "Exactly once" is discharged as **one prompt lifecycle per account**: the card appears while eligible and can never return after an attach or an explicit dismissal, and the state lives server-side so the cleared-site-data user — the exact user this feature serves — is not re-prompted into a second lifecycle by losing `localStorage`. The strictest per-render reading (stamp "seen" on first paint) is rejected with reasons in D9. Seam-tested: T-API-S74 flips eligibility on a live `remote_config` row (pinning "read from remote config", not a compiled constant); T-API-S75 pins the three suppressions. Web: T-WEB-S135/S136 |
| 2 | Magic-link attach, recovery, device move, and merge-on-collision covered at the `apps/api` seam with the email transport faked | D1 (one request/confirm flow; recovery and device move ARE merge-on-collision with a fresh, empty loser — no flow variants, honoring ADR-0049's one-function rule) + D11 (transport faked via `vi.mock("../src/email/transport")`, the `../src/db` idiom). T-API-S62/S66 (attach), S70 (merge-on-collision, winner per ADR-0049 D3, loser tombstoned, `GET /streak` under the new cookie serves the merged streak), S71 (recovery and device move by name: fresh empty account requests with the attached email; after confirm the clicking browser resolves to the old history) |
| 3 | Consents stored as independent flags with timestamps; reminder defaults off; saving the streak never signs the player up for mail | D7: the two existing timestamp columns **are** the independent flags (NULL = not consented; a timestamp = consented then) — ADR-0022's recorded design, kept; independence is structural (two columns, two writers' predicates). Reminder default-off is triply structural: unchecked checkbox in the UI (T-WEB-S137), `reminderConsent` an explicit boolean in the request contract with no default (T-CORE-S51), and a NULL column that only a `true` on the token ever stamps (T-API-S63/S67). "Never signs the player up for mail": the request writes **nothing** to `users` (T-API-S63) and confirm stamps `reminder_consent_at` only when the token carries `true` (T-API-S66/S67); #32, the only future sender, is bound by ADR-0012 to target consent-holders only |
| 4 | pt-BR privacy policy page live; a deletion request path exists and works | D13 (real, immediate, self-service deletion: `POST /account/delete`, cascade, cookie cleared — plus `privacidade@miolos.app` as the human fallback) + D14 (static `/privacidade` page whose copy states exactly what D13 ships — the page and the mechanism cannot drift because both land in this PR). T-API-S77/S78; T-WEB-S141/S142. "Live" = deployed with the PR; nothing about the page or the deletion path waits on email activation |
| 5 | No password exists anywhere; the pre-attach anonymous history is fully preserved | No password field, column, contract key or route exists in this plan; discharged in the PR with grep evidence (`grep -ri "password\|senha" apps packages --include="*.ts*"` — expected: no production hit). History preservation is `mergeAccounts`' already-pinned property (ADR-0049, T-DB-S16…S24) plus this ticket's T-API-S70/S71: the union survives, the streak recomputes, the losing cookie resolves to the merged identity. The attach-without-collision path never touches `completions` at all (T-API-S66 asserts the row count is unchanged) |

---

## 1. Scope boundary

**In scope**

- Migration `0004`: the `attach_tokens` table, the `users.attach_prompt_dismissed_at` column, and the partial unique index on verified emails (§5). Hand-applied to Neon **before the branch is first pushed** (§15 step 0 — the deploy-order trap, quoted in §9; preview deploys share the production Neon DB, so the trap fires at first push, not at merge).
- The winner-liveness guard inside `mergeAccounts` (precondition 1, D5) — the one sanctioned edit to `packages/db/src/merge.ts`.
- Contracts: `attach.ts` + `account.ts` in `packages/core/src/contracts/`, barrel re-exports; `remoteConfigSchema` gains `attachStreakThreshold` (§6).
- `apps/api`: `src/email/transport.ts` (+ pt-BR copy module), `src/attach/service.ts`, `createSessionForUser` in `src/session/service.ts`, five routes — `POST /attach/request`, `POST /attach/confirm`, `GET /attach/state`, `POST /attach/dismiss`, `POST /account/delete` (§7). `.env.example` gains `RESEND_API_KEY` (documented, never valued).
- `apps/web`: the hub attach card (island + the repo's first form controls), the `/vincular` confirm page, the `/privacidade` policy page with the deletion island, `attach-client` + `use-attach-state`, i18n slugs/messages, free-play wall bans + probes, `route-ssr` rows, `impeccable.yml` lists, bundle figures (§8).
- ADR-0050 as a real file (Appendix A); CONTEXT.md rows (D17); `schema.ts` comment corrections; `docs/agents/test-ids.md` frontier re-derived at step 8.
- This plan file and its `docs/README.md` row (added with this document).

**Out of scope** — §12 carries the full list. Headlines: **sending** any reminder email, push, the service worker, habitual-time derivation (**#32** — this ticket only stores the consent); consent-withdrawal UI and the full LGPD pass (**M4**); email change for an already-attached account (D16); social login; stats/medals (**#29/#30**); any expired-token sweep cron (D12 names the trigger); `#58`.

**Not touched at all:** `packages/games`, `packages/ui` (tokens.css is read, not written — new UI uses existing tokens), `packages/core/src/merge.ts` and `streak.ts`, every existing contract file, `apps/api/app/{session,streak,completions,daily,termo,cron,buffer-depth,health}` routes, `apps/web/src/play/**`, `apps/web/src/free-play/**`, the manifest. A diff in any of these at step 6 is a finding by itself. `packages/db/src/merge.ts` is touched **only** by D5's guard; `apps/api/src/session/service.ts` only by the added `createSessionForUser` export.

---

## 2. Read first (in this order)

1. `CLAUDE.md` — gates, evidence rule, invariants (esp. "one push type only, no marketing push"; dependency posture).
2. Issue #21 **including its comment** — the two security preconditions are binding (§3 D4/D5).
3. ADR-0003, ADR-0012, ADR-0022 (the consent narrowing consequence verbatim), ADR-0049 (all six decisions; the code at `packages/db/src/merge.ts` is its faithful realization), ADR-0013 (magic links target `miolos.app`; nothing hardcodes the apex), ADR-0048 (strict contracts; new payloads = new endpoints), ADR-0025/0024 (remote config surface rules), ADR-0026 decision 5 (user-scoped tables on `@miolos/db/user`).
4. `CONTEXT.md` — this plan uses **Attach**, **Merge**, **Tombstone**, **Streak** exactly.
5. `packages/db/src/schema.ts:17-72` (timestamptz law, users/sessions comments), `packages/db/src/merge.ts` (the step-0 seam D5 slots into), `packages/db/src/user.ts` (tripwired surface).
6. `apps/api/src/session/{token,cookie,service,origin-guard}.ts` and `apps/api/src/cors.ts` — the idioms every new module imitates.
7. `apps/api/app/completions/route.ts` (the authenticated-WRITE template, its seven ordered gates), `app/streak/route.ts` (READ template), `app/session/route.ts` (Set-Cookie template), `app/cron/publish/route.ts:36` (fail-closed secret), `app/buffer-depth/route.ts` (config-derived value over HTTP).
8. `apps/api/test/streak.test.ts` + `merge-resolution.test.ts` — the seam-4 architecture and the `vi.mock("../src/db")` idiom the transport fake copies.
9. `apps/web/app/{page,hub-streak}.tsx`, `src/streak/{use-streak,streak-client}.ts`, `src/session/bootstrap.ts`, `app/modo-livre/page.tsx` (static-page register), `src/i18n/{messages,routes}.ts`, `eslint.config.mjs` (the wall groups), `apps/web/scripts/route-client-js.mjs`, `.github/workflows/impeccable.yml`.
10. `PRODUCT.md` + `DESIGN.md` — "never a modal takeover", "nothing nags", the accent rule (app accent `#9E3B2F` for the streak-protecting card), the anti-references.
11. `docs/plans/029-…` §12 risk 4 (the pre-planned shape of a `users` migration) and `docs/handoffs/030-…` (frontier; §6's post-deploy smoke duty this ticket inherits).

---

## 3. Fixed decisions

Settled here so step 5 implements rather than re-litigates. Each resolves one or more of the step-1 exploration's fourteen open questions (cited as Q1…Q14). D9, D13, D15 and D16 are product-visible; Fernando can override any of them in the PR without blocking.

### D1 — One flow, four verbs: request/confirm; recovery and device move ARE merge-on-collision with a fresh loser

The issue names four behaviors (attach, recovery, device move, merge-on-collision). Building them as separate flows would recreate exactly the flow-variant anti-goal ADR-0049 rejected for the merge itself.

**Decision:** there is one flow with two endpoints.

- **Request** (`POST /attach/request`): an authenticated user (D4: `requireUserId`) submits an email + the two consents. A token is minted (D2) and a magic link is emailed (D11). Nothing is written to `users`.
- **Confirm** (`POST /attach/confirm`, driven from the `/vincular` web page, D3): the token is atomically claimed; the system resolves the **verified holder** of the token's email; if a holder exists and differs from the token's requester, `mergeAccounts(requester, holder)` runs (D4/D5) — otherwise the winner is the requester alone. The winner then receives `email`, `email_verified_at = now()` and the consents (D7), and the clicking browser receives a fresh session cookie for the winner.

Every product verb falls out: **attach** = no collision; **merge-on-collision** = holder exists; **recovery** = the cleared-site-data user's fresh empty account requests with the old email → collision with the old account → merge in which the fresh account is an empty loser or empty winner (either way the union is the old history and the browser resolves to it); **device move** = identical to recovery from the new device. The winner is ADR-0049 decision 3's (older `created_at`), never "the device that clicked" — and because confirm writes the email to the **returned winner** after the merge nulls the loser's handles, the email lands correctly in both directions. Crash between merge and the email write: histories merged, email unattached, token consumed — the user requests a new link and re-attaches; every step is idempotent or re-runnable (recorded in ADR-0050).

### D2 — Token model (Q7): a new `attach_tokens` table, hash-only, 30-minute predicate expiry, single-use by atomic claim

New table (not `users` columns): a token is not an attribute of a user — several may be outstanding — and a new **table** does not change the `users` INSERT column list, so it carries none of the ADR-0038 (h) deploy hazard (the hazard this ticket does incur comes from D9's column, priced there). Stateless signed tokens are rejected on ADR-0022's own reasoning (every request touches the DB; a signing-secret lifecycle buys nothing).

Schema (§5): `token_hash` text PK (SHA-256 hex — the sessions idiom: plaintext never stored, a DB leak leaks no credential, lookup-by-hash means no timing-sensitive comparison), `user_id` uuid FK → `users.id` cascade (the requester, bound by D4), `email` text not null (already normalized, D6), `reminder_consent` boolean not null default false (D7), `created_at` timestamptz not null default now (DB clock only).

- **Expiry: 30 minutes**, expressed as a DB-side predicate on the claim (`created_at > now() - interval '30 minutes'`) — the sessions staleness idiom; no `expires_at` column, no JS clock. 30 minutes balances slow mail delivery against the exposure window of a link sitting in an inbox; recorded as tunable-by-ADR-amendment only (not remote config — a security parameter, not a product knob).
- **Single-use: consumption is `DELETE … WHERE token_hash = $h AND created_at > now() - interval '30 minutes' RETURNING …`** — one atomic statement is the claim, so two concurrent confirms of the same token cannot both win even over transactionless neon-http; the loser of the race (and any expired or unknown token) sees zero rows → `410` with one generic error (`invalid-or-expired` — no oracle distinguishing "expired" from "never existed").
- Token value: `generateSessionToken()` reused as-is (32 bytes Web Crypto, base64url, 43 chars) — same generator, different table; hashed with `hashSessionToken`.
- **`users.email` is written only at confirm** — the email rides the token until verified. Consequence, load-bearing for D6: on `users`, **non-null `email` now implies verified** (`email_verified_at` set in the same UPDATE). The `schema.ts` users header comment is corrected accordingly (D17).

### D3 — Landing split (Q6): the link targets the web `/vincular` page; consumption is a POST to `apps/api`, which owns Set-Cookie

The threat that decides this: **email scanners and link-prefetchers issue GETs**. A link whose GET consumes a single-use token is a flow that corporate and consumer mail filters break for real users. Additionally, ADR-0022's origin guard is POST-shaped and does not run on top-level GET navigations — a state-changing, cookie-setting GET would sit outside every protection this repo has built.

**Decision:** the emailed URL is `{WEB_ORIGIN}/vincular?token=<raw>` — a pt-BR web route (ADR-0013; slug `vincular`, matching CONTEXT.md's *Vincular e-mail*), built from env (`WEB_ORIGIN`, the api's existing carrier of the web origin — nothing hardcodes the apex). The page renders an inert server shell (request-rendered — §8; nothing here is a state change) plus a client island showing one explicit button (*"Confirmar vínculo"*); pressing it POSTs `{token}` to `POST /attach/confirm` with `credentials: "include"`. The API route — behind `warnIfGuardDegraded` → `isCrossSiteWrite` → `isJsonContentType` (the completions gate order) — consumes the token and answers with `Set-Cookie` for the winner's fresh session (the `POST /session` precedent: the api sets cookies; under prod `COOKIE_DOMAIN=miolos.app` the cookie is shared). A scanner's GET renders a page and consumes nothing; the guard applies to the actual state change; the human-in-the-loop click is what spends the token.

Token-in-query residual risk (history, referrer): accepted and named — the token is single-use, 30-minute, and hash-only server-side; the confirm page carries `<meta name="robots" content="noindex">` and the site-wide security headers apply. A possession-of-inbox attacker (forwarded email, shared mailbox) can claim the account — the standard magic-link trust model, recorded in ADR-0050.

Confirm requires **no session cookie** (the recovery user's browser may have none, or a brand-new one): D4 is what keeps that safe.

### D4 — Precondition 2: both merge ids derive from verified identities — the token row and the DB lookup, never the clicking cookie, never the request body

`mergeAccounts` merges whatever it is handed; the authorization boundary is entirely here.

**Decision:** the pair is always (`attach_tokens.user_id`, verified-holder-of-`attach_tokens.email`):

- `attach_tokens.user_id` was written by `POST /attach/request` from `requireUserId` — a resolved session, server-side, at request time. It is stored, not resupplied.
- The holder comes from one query: `select id from users where email = $tokenEmail and email_verified_at is not null` — a verified identity by definition (and by D6, at most one row).
- The clicking browser's cookie plays **no role in choosing the pair**. A third-device click (webmail on a random machine) authenticates that browser as the winner — possession-of-email semantics, D3 — but never merges that browser's own anonymous account: no verified identity asked for that merge. Its prior cookie is simply replaced by the winner's `Set-Cookie`; its account remains untouched in the DB.
- No id from the request body is ever passed to `mergeAccounts`. The confirm body contains exactly `{token}`.

Two liveness re-checks protect the pair against time-of-request/time-of-confirm drift: the requester must still own ≥ 1 session (a requester tombstoned by a concurrent merge, or deleted — though deletion cascades the token away — yields `410`, never a write to a tombstone, T-API-S72); the winner-liveness guard inside the operation (D5) protects the other side.

### D5 — Precondition 1: serialization is an in-operation winner-liveness guard inside `mergeAccounts`, not a route-level lock

Route-level single-flight has no substrate: routes are stateless Vercel functions with per-request `getDb()` — a process-local mutex would be fiction across instances, and `pg_advisory_lock` is unavailable over neon-http (the precondition's own text). The hazard is concrete: `merge(A,B)` racing `merge(B,C)`, where B loses the first merge and the second then strands C's history on B's tombstone.

**Decision:** `packages/db/src/merge.ts` gains one read between step 0 (winner select) and statement 1 (session remap): **the selected winner must still own ≥ 1 session or ≥ 1 identity handle** — i.e., must not be a tombstone. Mechanically: one `select 1 from sessions where user_id = $winner limit 1`, and on miss, one check of the winner's handles; on failure, throw `mergeAccounts: winner <id> owns no session or identity handle (concurrent merge?)` **before any destructive statement**. Why this predicate is exactly "not a tombstone": every minted user is born with a session, sessions are never deleted in v1 (no prune exists; deletion removes the whole user), and a tombstone is precisely the row whose sessions were remapped away and whose handles were nulled. The loser needs no symmetric guard — merging *into* a healed state is what idempotent re-run already covers, and a tombstoned loser contributes zero rows harmlessly.

ADR-0049 compliance, argued: no mode parameter, no caller roles (both Rejected entries untouched); decision 5's "ordered sequence of individually idempotent statements, sessions remapped FIRST" still holds — the guard is a read, and the remap is still the first *write*; T-DB-S20's double-run snapshot stays green (after run one the winner owns the union of sessions, so the guard passes and every statement no-ops).

One test edit is **sanctioned up front**: `packages/db/test/merge.test.ts`'s `createUser` inserts users with **no session and no handle** — under the guard, every existing merge test whose winner is such a fixture would throw (T-DB-S16, S17, S21's three merges, S22, and S19's second half). The fixtures are wrong, not the guard: the guard itself asserts that every real minted user is born with a session, so the old fixtures model users that cannot exist in production. The sanctioned fix is fixture realism — `createUser` gains a birth session (one `sessions` row with a unique literal token hash per user, reproducing `mintSession`'s own invariant), and session-count/snapshot assertions rebase on that +1 baseline where they count. `merge.test.ts` joins §10's knowingly-edited list; the new T-DB-S26 still manufactures a session-less, handle-less winner directly to pin the throw. **This is an addition discharging a recorded precondition, not an amendment** — no sentence of ADR-0049 claims the step-0 select is the only read (only a code comment does, and the comment is updated with the guard). No `Amends:` header, no reciprocal line; ADR-0050 records the guard and cites the issue comment. The route's response to a guard throw: re-derive the pair once (fresh holder lookup + fresh liveness) and retry the merge exactly once; a second failure is `409 conflict` — the token is already consumed, so the user is told to request a new link (T-API-S73 pins this, honestly: an astronomically rare race costs one re-request, never a stranded history).

### D6 — Email uniqueness (Q2): boundary normalization + a partial unique index on verified emails; the flow keeps at most one verified holder

`schema.ts`'s recorded deferral ("Uniqueness semantics land with the attach/merge ticket") lands here. The M0 comment's transient-two-holders fear no longer applies: under D2, `users.email` is written **only at confirm, after the merge has already nulled the loser's email**, so no two-holder state ever exists even transiently — which also means a hard unique index would be materially equivalent today; the partial shape is preferred on self-description grounds (layer 3). The real requirement is: **at most one *verified* holder per email, ever** — a second verified holder would make D4's lookup ambiguous and magic-link identity ill-defined.

**Decision, three layers:**

1. **Normalization at the Zod boundary (regardless of the rest):** `attachRequestSchema` trims and lowercases before validating the shape (§6), so every email that reaches a token row or a `users` row is already in canonical form — which is what lets layer 3 index the raw column with no expression index.
2. **Flow invariant:** the confirm sequence (claim → holder lookup → merge if collision → write email to winner) structurally converges on one verified holder — the merge nulls the loser's email before the winner gains it.
3. **A partial unique index as the mechanical backstop:** `uniqueIndex("users_verified_email_uq").on(users.email).where(isNotNull(users.emailVerifiedAt))` in migration 0004. It closes the one race the flow cannot: two *concurrent* confirms writing the same email to two different winners — the second UPDATE fails loudly instead of silently forking the identity, and the confirm route **catches exactly that unique violation** (the window where its holder lookup returned null) and maps it to the same `409` request-a-new-link answer as D5's exhausted retry (T-API-S73's shape; pinned by T-API-S80, recorded in ADR-0050 decision 6). Honest note on the partial shape: under D2 (non-null ⇒ verified) a plain unique index would be materially equivalent — the partial form is chosen for self-description and robustness to future states where unverified emails might exist on `users`, not for correctness today (the Rejected block of ADR-0050 says the same). Cost priced: this is the repo's first partial index and drizzle-kit has no in-repo precedent generating one — §13 risk 2 pre-plans the fallback (generated SQL is committed untouched or the index is dropped from the migration and the invariant rests on layers 1–2, stated in the PR; never hand-edited SQL). Multiple NULLs are exempt by Postgres semantics, and unverified emails never exist on `users` at all (D2), so the index constrains exactly the verified set.

### D7 — Consents (Q1): timestamp-only stands; the two columns ARE the flags; stamped on the winner at confirm; unchecked ≠ withdrawal

ADR-0022 recorded that the attach ticket adds explicit boolean flags "**if an audit trail is needed**". Resolved: **it is not needed in v1**, because no withdrawal surface exists in v1 — this ticket ships consent *capture* only; withdrawal arrives with the settings/M4 LGPD work, which is precisely ADR-0022's named condition ("making withdrawal timestamps representable") and therefore the recorded revisit trigger. What v1 must evidence under LGPD is that consent *was given* and *when* — the timestamp is that evidence, per ADR-0022's own sentence ("the flag is derivable, the timestamp is the evidence"). Full deletion (D13) is the v1 path for "revoke everything", and it removes the data itself, which is stronger than a withdrawal flag.

**Decision:**

- No new consent columns; no consent migration. `recovery_consent_at` / `reminder_consent_at` are the independent flags AC 3 names: two columns, independently null or stamped, never inferred from each other (ADR-0012).
- **Capture:** the request contract carries `recoveryConsent: z.literal(true)` (the account function — the form cannot be submitted without it, and a request without it is a 400: attaching *is* the recovery consent, ADR-0012's "the email exists to recover and move the streak") and `reminderConsent: z.boolean()` (no default — the client states the choice explicitly; the UI checkbox defaults unchecked). The choice rides the token row (`reminder_consent`), because consent must be stamped on the account only once the email is proven — an unverified stranger's form submission must not decorate someone's account.
- **Stamping, at confirm, on the winner:** `recovery_consent_at = now()` always (the confirmed attach is the consent act, evidence-stamped at the moment the attach becomes real); `reminder_consent_at = now()` **only when the token carries `true`**; when the token carries `false`, the winner's existing value is **left untouched** — an unchecked box at attach is the *absence of new consent*, not a withdrawal (withdrawal is a deliberate act on a surface that does not exist yet). All in one UPDATE with explicit `updated_at = now()` (the schema's own law — this is the second production UPDATE writer of `users`; the comment is corrected, D17).
- AC 3's discharge is argued in §0 and recorded in ADR-0050; because ADR-0022's conditional is resolved (not contradicted), **no amendment of ADR-0022 is owed** (D17).

### D8 — Consent merge semantics (Q10): the winner's consents stand; the loser's remain on the tombstone — never copied, never nulled

ADR-0049 decision 4 left this to this ticket. **Decision:** `mergeAccounts` keeps not touching consent timestamps (zero change); at confirm the winner then receives fresh stamps per D7. The loser's timestamps stay on the tombstone as historical evidence of a consent that once existed — copying them would fabricate a consent event on the winner that never happened at any moment (max/OR semantics rejected for the same reason: a consent is an act by a person at a time, not a mergeable maximum), and nulling them would destroy LGPD evidence. A tombstone holds no identity handle, so retained timestamps are not reachable personal data. Recorded in ADR-0050; #32 must read reminder consent from the **canonical** account only (which is the only account any cookie resolves to — structural).

### D9 — "Exactly once" (Q4): server-owned per-account state — `users.attach_prompt_dismissed_at` plus derivation from `email`

`localStorage` is disqualified by the feature's own audience: the cleared-site-data user would be re-prompted (and, worse, the *attached* user re-prompted on every new device). Implicit-only ("suppress after attach") fails the decliner — the card would return forever, violating "nothing nags".

**Decision:** eligibility is computed server-side (D10) as `streak ≥ threshold AND email IS NULL AND attach_prompt_dismissed_at IS NULL AND transport configured` (the last conjunct is D11's dormancy switch). Dismissal is explicit and permanent: the card's *"agora não"* button POSTs `/attach/dismiss`, which stamps `users.attach_prompt_dismissed_at = now()` (explicit `updated_at`; idempotent — re-stamping is guarded by `WHERE … attach_prompt_dismissed_at IS NULL` so a re-post touches zero rows). The column is the one `users` schema change of this ticket: nullable timestamptz, so every existing row satisfies it — **and it is what prices migration 0004's deploy-order trap (§9), because any `users` column changes the INSERT column list drizzle emits for `mintSession`'s `insert(users).values({})`**.

"Exactly once", argued honestly: the prompt has one lifecycle per account — it appears when eligibility first becomes true and is permanently retired by either terminal act (attach → `email` non-null; decline → `dismissed_at` non-null). The strictest reading (stamp on first *render*, so a card glimpsed once while scrolling burns the product's only ask forever) is rejected: it optimizes the letter of the AC against the feature's purpose, and a write-on-render is untestable-flaky besides. A merge retires the prompt on the winner via `email`; the loser's `dismissed_at` (like its consents, D8) stays on the tombstone untouched — not an identity handle, so not in the tombstone SET, and the tombstone-idempotence guard (T-DB-S20) is unaffected.

### D10 — Threshold delivery (Q5): `attachStreakThreshold` in remote config; a new `GET /attach/state` endpoint returning `{eligible}`; the threshold never ships to the client

ADR-0048 forbids appending to `streakResponseSchema` (strict on both ends, by design); ADR-0025 keeps `remote_config` behind `@miolos/db/publishing`, which `apps/web` is banned from. The clean shape is the buffer-depth precedent: a server route derives the answer and publishes only the answer.

**Decision:** `remoteConfigSchema` gains `attachStreakThreshold: z.number().int().min(1).max(365).default(5)` (ADR-0003: "starting at 5, tunable"; the clamp is the untrusted-loop-bounds discipline). New endpoint `GET /attach/state` (authenticated-READ template: `force-dynamic`, `requireUserId` → 401, whole-body try/catch → 500, `Cache-Control: no-store` on every branch, no OPTIONS export) computes D9's conjunction server-side — `computeStreak` over `listCompletionsForStreak` (exactly as `GET /streak` does), `getRemoteConfig` for the threshold, the user row for `email`/`dismissed_at`, `RESEND_API_KEY` presence for the transport conjunct — and answers with the new strict contract `attachStateResponseSchema = z.strictObject({ eligible: z.boolean() })`. One boolean: no threshold leak, no streak duplication, "exactly once" fully server-owned, and the client island stays a dumb renderer. Cost: one extra authenticated read per hub view beside `GET /streak` — accepted; merging them is forbidden by ADR-0048 and a combined new contract was rejected because `GET /streak` has a second consumer (the conclusion card) that must not grow an attach dependency.

### D11 — Transport (Q8): Resend over plain `fetch`, zero new dependencies, fail-closed; `vi.mock` at the module seam; unconfigured = fully dormant

Bound by Fernando's decision this session. **Shape:** `apps/api/src/email/transport.ts` exports `sendMagicLinkEmail({ to, url }): Promise<void>` — a plain `fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: \`Bearer ${key}\`, "Content-Type": "application/json" }, body })`, throwing on non-2xx (the route maps failures to `502 email-send-failed`; the token row is already minted and simply expires — a re-request supersedes it). No SDK: the hand-rolled-cookie/base64url posture, and the cheapest vulnerability is the dependency never installed. Sender: `Miolos <conta@miolos.app>` — a constant in the transport module beside the pt-BR subject/body copy (`apps/api/src/email/copy.ts`; `apps/api` has no i18n module — the copy module *is* the externalization, one file, pt-BR strings only, stated in ADR-0050). The email body is plain text plus one link — no tracking pixels, no remote assets.

**Fail-closed (the CRON_SECRET posture):** `RESEND_API_KEY` unset → `POST /attach/request` answers `503 email-unconfigured` **before minting any token** (no side effects it cannot complete), and — the dormancy switch — `GET /attach/state` reports `eligible: false`, so **the prompt never renders a form whose submit would 503**. The entire feature merges dormant and activates by `vercel env add RESEND_API_KEY` (§15), the `grantHints`/dormant-seam posture applied to a whole flow. `WEB_ORIGIN` unset likewise 503s the request route (the link cannot be built; nothing hardcodes the apex, ADR-0013). Env documented in `apps/api/.env.example` with a generation note ("create in the Resend dashboard"); `turbo.json` `build.env` gains it only if `CRON_SECRET` is listed there today (mirror the precedent exactly — verify at step 5, it is a cache-correctness bookkeeping rule, not a functional one).

**The test seam:** routes import the transport module; seam tests `vi.mock("../src/email/transport")` — the `../src/db` idiom (one `../`: test files sit in `apps/api/test/`, the `streak.test.ts` spelling) — asserting the `to`/`url` arguments and **harvesting the raw token from the mocked call's URL to drive the confirm tests**, which is what makes AC 2's "transport faked" end-to-end real: the same string a human would click is what the test confirms with.

### D12 — Rate limiting (Q14): 3 requests per rolling hour per user AND per email, derived from `attach_tokens` rows; opportunistic cleanup aligned to the rate window

The request endpoint sends real email — the first endpoint in the repo whose abuse costs money and sender reputation. ADR-0022 accepted unthrottled *minting* with a named revisit trigger; a real send is that trigger arriving for this endpoint only.

**Decision:** before minting, `POST /attach/request` runs two counts over `attach_tokens` rows with `created_at > now() - interval '1 hour'`: this **user's** rows, and this **email's** rows (`attach_tokens.email`, already normalized at the boundary, across all users — same cap, 3 per rolling hour); at 3 on either count, answer `429 too-many-requests` (with the standard error contract; no `Retry-After` niceties in v1). No new table, no infra: the token rows are the ledger (multiple outstanding tokens per user are deliberately allowed — each expires in 30 minutes and any is single-use — precisely so the count works). Consumed tokens vanish from the count, which under-counts *successful* flows and fully counts the abuse shape (sends that are never confirmed) — the right asymmetry.

**Cleanup is aligned to the rate window, not the expiry window:** the same request first deletes this user's rows older than **1 hour** (`created_at <= now() - interval '1 hour'`). Deleting at the 30-minute expiry would silently double the limit — cleanup-before-count would empty the 30–60-minute band the 1-hour count needs, making the real cap 6 sends/hour. Expired-but-recent rows therefore stay as the rate ledger for their remaining half hour; the cost is 30 extra minutes of an unconfirmed email (personal data) on a dead row, priced and accepted so "3 per rolling hour" stays true. A global sweep of tokens whose *users* never request again is named in ADR-0050 as the nightly-check ticket's inheritance.

**The bypass composition, recorded honestly:** `POST /session` mints users unthrottled (ADR-0022's recorded acceptance), so a per-user limit alone is per-attacker-unlimited — mint a fresh anonymous user per request and every request is that user's first. The per-email count is the cheap mitigation that closes the mail-bombing-one-inbox shape of that composition; the remaining shape — fresh users × many distinct addresses, burning Resend quota and sender reputation — is the accepted v1 risk. Per-IP and global caps are out of scope (Vercel's platform firewall is the backstop, the ADR-0022 acceptance); revisit trigger: first abuse signal or #32's send infrastructure, whichever first.

### D13 — Deletion (Q9): real, immediate, self-service — `POST /account/delete` + the policy page's island; `privacidade@miolos.app` as the human fallback; structurally distinct from tombstones

AC 4 says "exists and works"; a mailto alone is a *request* path whose "works" depends on an unverifiable human inbox, and a request-row table is a queue nobody processes in v1. Real deletion is mechanically the cheapest honest option: the cascade already exists.

**Decision:** `POST /account/delete` — authenticated-WRITE template (origin guard, JSON gate, `requireUserId` → 401), body `{ confirm: z.literal(true) }` (a deliberate second factor against drive-by fetches; the UI's two-step confirm supplies it). It runs `DELETE FROM users WHERE id = $userId` — cascade removes `sessions`, `completions`, `hint_grants` and `attach_tokens` in one statement — and answers `{ deleted: true }` with a cookie-clearing `Set-Cookie` (`miolos_session=; Max-Age=0`, same attributes as `buildSessionCookie` so the browser actually evicts it — a small `buildSessionClearingCookie` beside it in `cookie.ts`). The next visit re-mints a **fresh, empty** identity via the normal bootstrap — the correct post-deletion semantics, and the documented difference from a tombstone: **a tombstone must never be deletable by this route, and structurally cannot be** — it owns no session, so `requireUserId` can never resolve to one (T-API-S78 pins the fresh-mint independence; the tombstone argument is recorded in ADR-0050 so deletion and ADR-0049's "retained forever" can never be played against each other). A merge *loser's* tombstone surviving the *winner's* later deletion is a handle-less, session-less, completion-less shell — zero personal data — and retained per ADR-0049.

The **UI** lives on the policy page (D14): a quiet, ink-styled section at the end — *"Excluir minha conta e dados"* — a two-step island (button → explicit confirmation with consequence copy → POST → terminal state *"conta excluída"*). The page also publishes **`privacidade@miolos.app`** as the contact for deletion requests and any privacy question (LGPD requires a reachable channel; forwarding is §15 human work) — so the "request path" exists twice: self-service (works, tested) and human (stated, verified by Fernando once forwarding is live).

### D14 — The privacy policy page: static `/privacidade`, the `modo-livre` register; copy matches shipped reality

**Decision:** `apps/web/app/privacidade/page.tsx` — static on purpose (no `dynamic` export, no db import, no fetch in the server component), a `page.module.css`, marker attribute `data-page="privacidade"`, `messages.privacy.*` for every string (ADR-0018; the largest single copy block this ticket adds). Content per ADR-0012, in pt-BR: what is collected (the anonymous account and its completions; the email *if voluntarily attached*; the telemetry named by the founding handoff — no session replay), why (the streak's recovery and movement; the reminder channel *only under its own consent*), the two independent consents and that reminder defaults off, how deletion works (D13's self-service section on this very page + `privacidade@miolos.app`), that no password exists, no data is sold, and the full-policy revision note (M4). The deletion island (D13) is the page's one client component. Route additions: `routeSlugs.privacy = "privacidade"`, `routes.privacy`; `route-ssr` ROUTES row; `impeccable.yml` preflight + detect lists; daily-scope by construction in `route-client-js.mjs` (nothing daily rides it — trivially clean). Discoverability: the hub's secondary `<nav>` gains a real `Política de Privacidade` link (its `arquivo`/`estatisticas` entries stay deliberately href-less — this one has a live target so it links), and the attach card's consent copy links it (D15).

### D15 — The attach prompt (Q12): a quiet card on the hub — the repo's first form controls; every design law named

**Decision:** a new hub island `apps/web/app/hub-attach.tsx` + `hub-attach.module.css` (the `hub-streak` mechanical precedent: CSS Modules hash per file; islands beside the page). Placement: in the hub's flow after the game cards, before the secondary nav — in-flow paper, **never a modal takeover** (PRODUCT.md principle 3), never floating, never blocking. It renders `null` until `useAttachState()` (a `use-streak`-shaped mount-effect hook over `GET /attach/state`) resolves `eligible: true` — so the server render and first paint are unchanged (T-WEB-S127's no-fetch-at-render contract intact) and `impeccable detect`'s clean profile sees the hub without it (the `hub-streak` zero-state precedent, pinned).

Composition, inside DESIGN.md law: card paper, 1px line border, hard single-color offset shadow in the **app accent** `#9E3B2F` at 0.22–0.3 (the streak-protection accent — this card exists to protect the streak; blur 0, always), static rotation within ±0.3–2.4deg, radius 6px, washi tape optional in the same accent at 0.32. Fraunces italic for the one-line invitation (the human voice: protecting the streak, e.g. *"Sua sequência merece um plano B."*), Instrument Sans for the form. The form: one email input, two native checkboxes with visible labels (recovery — required to submit, its label carrying the purpose-limited consent language of ADR-0012 and the link to `/privacidade`; reminder — **unchecked**), one solid accent submit (*"Enviar link mágico"*), one plain text dismiss (*"agora não"*). Accent colours shapes only — never a word (ADR-0041; labels are `--ink`, the button label `--ink-on-accent`). Touch targets ≥ 44px; every state change within 150–250ms `--ease-settle` with a `prefers-reduced-motion` alternative; success replaces the form with the sent-state line (*"Enviamos um link para …"* + the normalized address); errors are inline `--ink` text with a chip, never color-only. No emoji, no gradient, no diffuse shadow, no card-inside-card (the anti-reference law). These are the repo's first `<input>`/`<checkbox>` controls: styled locally in the island's module with `tokens.css` values; **no promotion to `packages/ui`** (a second consumer does not exist — CLAUDE.md's primitive rule).

Client plumbing: `apps/web/src/attach/attach-client.ts` (fetch wrappers over the four attach endpoints + delete; `NEXT_PUBLIC_API_URL`, `credentials: "include"`, `Content-Type: application/json` on writes — deliberately triggering preflight, the completions-client posture; strict-parse every response, failures → `undefined`) and `src/attach/use-attach-state.ts`. Both are one hop from `app/page` via the island → **wall duty (napkin rule):** `eslint.config.mjs` free-play group and dynamic-import regex gain `**/attach`, `**/attach/**`, `**/hub-attach` by name, with T-LINT probes (§10).

### D16 — Already-attached accounts (Q-edge): same email may re-request (resend); a different email is refused; email change is out of scope

**Decision:** at `POST /attach/request`, if the session user already holds a verified email: requesting the **same** (normalized) address is allowed — it is a resend, and its confirm is an idempotent re-stamp (holder = requester → no merge, same UPDATE); requesting a **different** address is `409 email-already-attached` — email *change* is a real feature (old-address notification, grace period) that belongs to the settings/M4 surface, not to a side door in the attach flow. Recorded in ADR-0050 with the change-flow named as future work.

The request-side 409 alone leaves a **pending-token side door**: request a token for E2 while unattached, attach E1 via another token, then confirm the still-live E2 token inside its 30 minutes — with no re-check, confirm would silently *change* the verified email, the exact act this decision forbids. So **confirm re-checks on the resolved winner**: if the winner already holds a verified email different from the token's email → `409 email-already-attached`, token spent (it was atomically claimed; a stale intent is not resurrected). T-API-S79 pins it; recorded in ADR-0050.

### D17 — Docs bookkeeping: one omnibus ADR-0050; it amends nothing; the argued near-misses; CONTEXT.md and schema comments

**One ADR** (ADR-0050, Appendix A) carries D1–D16: they are one design — the attach system — exactly as ADR-0049 carried the merge as one design. Amendment audit, candidate by candidate:

- **ADR-0022 (consent narrowing):** D7 *resolves its recorded conditional* ("adds the explicit per-consent flag … **if an audit trail is needed**") by deciding the condition false in v1 and naming its revisit trigger — the conditional's own structure invites exactly this; no recorded sentence is contradicted. **No amendment.**
- **ADR-0049:** D5's guard is an addition discharging an externally recorded precondition; D8 executes what its decision 4 explicitly delegated ("their merge semantics belong to the attach ticket"). **No amendment** (argued in D5).
- **ADR-0003:** executed, not changed (threshold 5 in remote config; magic link; no password). **No amendment.**
- **ADR-0012:** executed; D7's flag reading follows ADR-0022's narrowing, which ADR-0012 already tolerates (0022 recorded the narrowing without amending 0012 — this plan does not reopen that). Its consequence sentence — "per-consent flag plus timestamp (when it was given or withdrawn)" — is not corrected either: the withdrawal-representability revisit trigger is where that sentence becomes true as written (the first withdrawal surface adds the flag columns); the argument is written into ADR-0050's Amends block so step 6 finds it recorded. **No amendment.**
- Consequence: **no reciprocal `Amended by:` line is owed anywhere**, and #58's reserved amendment space on ADR-0009/0026 is untouched (checked at §16).

`CONTEXT.md`: the **Attach** row gains the ADR-0050 citation, and one new row is added (the glossary's test — a tested, durable mechanism with invariants):

| Term (code) | pt-BR (UI) | Meaning |
|---|---|---|
| **Magic link** | Link mágico | The single-use emailed link that proves an email and executes attach, recovery, device move or merge-on-collision — one flow, no password. Its token is stored hash-only, expires in 30 minutes, and is spent by one atomic claim; the link lands on `/vincular` and only an explicit POST consumes it ([ADR-0003](./docs/adr/0003-anonymous-first-identity-with-email-recovery.md), [ADR-0050](./docs/adr/0050-email-attach-magic-link-tokens-consents-and-the-lgpd-minimum.md)). |

`schema.ts` comment corrections (comment-only beyond the real column/table changes): the users header's email bullet (uniqueness semantics now resolved: non-null ⇒ verified, one verified holder, the partial index) and the `updated_at` writer list (mergeAccounts + the attach-confirm and dismiss writers; deletion is a DELETE, not an UPDATE, and belongs to no `updated_at` list). `docs/README.md` gains this plan's row (ADRs owe none).

### D18 — Where the new table lives: schema in `packages/db`, exported via `@miolos/db/user`; token statements in `apps/api/src/attach/service.ts`

`attach_tokens` is a user-scoped table; ADR-0026 decision 5's rule puts it on `@miolos/db/user` (reachable only by `apps/api` and tests — `apps/web` mechanically cannot name it, which matters: `apps/web` imports the root entry for public reads under ADR-0014). The **statements** over it (mint, claim, rate-count, cleanup, holder lookup, liveness, consent-stamp, dismiss-stamp) live in `apps/api/src/attach/service.ts` — the `session/service.ts` precedent: auth plumbing is the api's, `packages/db` owns tables and cross-table *operations* (the merge), not route-shaped workflows. The `@miolos/db/user` export list gains exactly `attachTokens` (the table object) — **tripwire widened in the same commit** (`packages/db/test/user.test.ts`'s own contract). The root entry is untouched.

---

## 4. What already exists — the seams, verified

Every row re-verified against the working tree at `f0789f0`.

| Seam | Where | Use here |
|---|---|---|
| Token generate/hash (Web Crypto, edge-safe) | `apps/api/src/session/token.ts` | Reused as-is for magic-link tokens (D2) |
| Cookie build (manual, `COOKIE_DOMAIN`, Lax) | `apps/api/src/session/cookie.ts` | Confirm's Set-Cookie; D13 adds the clearing twin |
| `requireUserId` (never mints), `resolveSession`, `mintSession` | `apps/api/src/session/service.ts` | D4's request-time binding; `createSessionForUser` added beside them |
| Origin guard (deny on positive evidence, POST-shaped) | `apps/api/src/session/origin-guard.ts` | All four state-changing routes |
| Authenticated-WRITE gate order (guard→cross-site→415→401→400→logic; per-route errorResponse; corsHeaders credentials on every branch) | `apps/api/app/completions/route.ts` | The template for request/confirm/dismiss/delete |
| Authenticated-READ template (no-store every branch, no OPTIONS, no origin guard) | `apps/api/app/streak/route.ts` | `GET /attach/state` |
| Fail-closed secret precedent | `apps/api/app/cron/publish/route.ts:36` (`CRON_SECRET` → 401) | D11's `RESEND_API_KEY` → 503 |
| Config-derived value over HTTP | `apps/api/app/buffer-depth/route.ts` | D10's shape |
| `mergeAccounts` + its step-0/statement-1 seam | `packages/db/src/merge.ts:84-115` | D5's guard slots exactly there |
| The dormant merge surface + tripwire | `packages/db/src/user.ts`, `packages/db/test/user.test.ts` | First production caller; tripwire widened for `attachTokens` |
| Remote config: schema + accessor + surface wall | `packages/core/src/remote-config.ts`, `packages/db/src/{remote-config,publishing}.ts` | D10's tunable |
| Strict-contract register + "growth = new endpoint" TSDoc | `packages/core/src/contracts/streak.ts` | Every new contract imitates it |
| Seam-4 test architecture + `vi.mock("../src/db")` + `dbOverride` | `apps/api/test/streak.test.ts`, `merge-resolution.test.ts` | §10's api suites; the transport fake rides the same idiom |
| Mount-effect fetch hook, three honest states, no options | `apps/web/src/streak/use-streak.ts` | `use-attach-state` copies it |
| Hub island register (zero-state pinned for impeccable) | `apps/web/app/hub-streak.tsx` | `hub-attach` copies the posture |
| Static-page register (no dynamic, no db, messages-only, marker attr) | `apps/web/app/modo-livre/page.tsx` | `/privacidade`; `/vincular` follows the register **minus static rendering** — awaiting `searchParams` makes it request-rendered (§8) |
| Free-play wall groups + dynamic regex + probes; one-hop rule | `eslint.config.mjs`, `apps/web/test/eslint-free-play-wall.test.ts`, napkin | D15's bans |
| Route checkers | `apps/web/test/route-ssr.test.tsx` (T-WEB-S56 table), `.github/workflows/impeccable.yml` path/URL lists, `apps/web/scripts/route-client-js.mjs` (daily-strict by default) | Both new routes |
| Migration procedure + the users-INSERT trap | `packages/db/src/schema.ts:198-211`, ADR-0038 (h), plan 029 §12 risk 4 | §9's gate, quoted verbatim |
| PGlite replays committed migrations | `packages/db/src/testing.ts` (`createTestDb`) | §14's commit order: migration before any test that needs it |
| No password anywhere | grep (`password|senha`) — docs only | AC 5's grep gate |

---

## 5. Migration 0004 and `packages/db`

**Migration `0004` (via `db:generate`, SQL + `meta/` committed untouched):**

1. `attach_tokens` table (D2): `token_hash` text PK; `user_id` uuid not null FK → `users.id` `onDelete: "cascade"`; `email` text not null; `reminder_consent` boolean not null default false; `created_at` timestamptz not null defaultNow. Index `attach_tokens_user_id_idx` on `user_id` (the rate-count and cleanup scans; the sessions-index precedent). Header comment carries the D2 laws: hash-only, 30-minute predicate expiry, claim-by-DELETE, email rides here until verified.
2. `users.attach_prompt_dismissed_at` timestamptz **nullable** (D9) — every existing row satisfies it; comment states the prompt-lifecycle semantics and that it is deliberately NOT in the tombstone SET.
3. `users_verified_email_uq` — `uniqueIndex(…).on(users.email).where(isNotNull(users.emailVerifiedAt))` (D6; §13 risk 2 if drizzle-kit misgenerates).

**`packages/db/src/merge.ts` — D5's guard only**, between the winner/loser selection and statement 1: the winner-liveness read (≥ 1 session, else ≥ 1 non-null handle), throwing before any destructive statement; the "Step 0, the one read" comment updated to name the guard and cite the issue-#21 precondition; the statement-sequence comment extended. Nothing else in the file moves; T-DB-S16…S24 must stay green, with exactly one sanctioned test edit — D5's fixture-realism change in `merge.test.ts` (`createUser` gains a birth session; the old fixtures modeled session-less users that cannot exist in production).

**`packages/db/src/user.ts`:** `export { attachTokens } from "./schema";` added to the user surface; the export tripwire's expected list widened in the same commit.

`packages/db/src/schema.ts` also takes D17's comment corrections. No other db change; `listCompletionsForStreak` and the streak reader are reused, not modified.

---

## 6. `packages/core` — contracts and the remote-config tunable

New `packages/core/src/contracts/attach.ts` (strict throughout; every schema's TSDoc carries the ADR-0048 growth rule):

```ts
/** Normalization IS the boundary (D6): trim + lowercase before shape. */
export const attachEmailSchema = z.string().trim().toLowerCase().max(254).pipe(z.email());

export const attachRequestSchema = z.strictObject({
  email: attachEmailSchema,
  recoveryConsent: z.literal(true),   // the account function; a form without it is a 400
  reminderConsent: z.boolean(),       // explicit choice, no default (UI defaults unchecked)
});
export const attachRequestResponseSchema = z.strictObject({ sent: z.literal(true) });

export const attachConfirmSchema = z.strictObject({
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/), // 32 bytes base64url, the session-token shape
});
export const attachConfirmResponseSchema = z.strictObject({ merged: z.boolean() });

export const attachStateResponseSchema = z.strictObject({ eligible: z.boolean() });
export const attachDismissSchema = z.strictObject({}); // the client posts a literal {}; any key is a 400 (D-pinned, not step-5 latitude)
export const attachDismissResponseSchema = z.strictObject({ dismissed: z.literal(true) });
```

New `packages/core/src/contracts/account.ts`:

```ts
export const accountDeleteSchema = z.strictObject({ confirm: z.literal(true) });
export const accountDeleteResponseSchema = z.strictObject({ deleted: z.literal(true) });
```

Barrel re-exports for all of the above (+ inferred types). `remoteConfigSchema` gains `attachStreakThreshold: z.number().int().min(1).max(365).default(5)` — the existing whole-config fallback semantics apply unchanged (an invalid table value falls back to defaults with the once-per-process error). Exact zod-v4 spellings (`z.email()`, `.pipe`) follow the installed version at step 5; the *semantics* above are the contract.

---

## 7. `apps/api` — transport, attach service, five routes

**`src/email/transport.ts` + `src/email/copy.ts`** — D11 verbatim. `copy.ts` holds the pt-BR subject and body builders (subject e.g. `Seu link mágico do Miolos`; body: one sentence of purpose, the link, the 30-minute note, an ignore-if-not-you line). The transport reads `RESEND_API_KEY` at call time; a helper `isEmailConfigured()` is exported for the request route's fail-closed check and `GET /attach/state`'s dormancy conjunct.

**`src/attach/service.ts`** — the statements over `attachTokens` + the flow's `users` queries, each a small named function with the schema imports from `@miolos/db/user` / root: `cleanupStaleTokens(db, userId)` (rows older than the 1-hour rate window, NOT the 30-minute expiry — D12), `countRecentTokens(db, userId)` and `countRecentTokensForEmail(db, email)` (both over the 1-hour window — D12), `mintAttachToken(db, {userId, email, reminderConsent, tokenHash})`, `claimAttachToken(db, tokenHash)` (the atomic DELETE…RETURNING with the 30-minute predicate), `findVerifiedHolder(db, email)`, `userOwnsSession(db, userId)` (requester liveness), `attachEmailToUser(db, {userId, email, reminderConsent})` (the one UPDATE: email, `email_verified_at = now()`, `recovery_consent_at = now()`, conditional `reminder_consent_at`, explicit `updated_at = now()`), `dismissAttachPrompt(db, userId)` (guarded, idempotent), `getAttachAccountState(db, userId)` (email/dismissed for D10). No JS `Date` in any statement — DB `now()` only (the schema law).

**`src/session/service.ts`** gains `createSessionForUser(db, tokenHash, userId)` — insert one sessions row for an existing user (what `mintSession` cannot do: it always mints a new user). Confirm mints the token client-side of the DB via `generateSessionToken()`, stores the hash, sets the cookie with `buildSessionCookie(rawToken)`.

**Routes** (all `dynamic = "force-dynamic"`; writes follow the completions gate order with per-route `errorResponse` and `corsHeaders({credentials:true})` on every branch; writes export `OPTIONS = preflightResponse`):

- **`POST /attach/request`** (`app/attach/request/route.ts`): guard-degradation warn → cross-site 403 → JSON 415 → `requireUserId` 401 → body parse 400 → **fail-closed 503 when `!isEmailConfigured()` or `WEB_ORIGIN` unset** (before any DB write) → D16's 409 check (verified email present and ≠ requested) → `cleanupStaleTokens` → rate check 429 (per-user AND per-email, D12) → mint token → `sendMagicLinkEmail({to, url: `${WEB_ORIGIN}/vincular?token=${raw}`})` (send failure → 502; the row stays and expires) → `{sent: true}`.
- **`POST /attach/confirm`** (`app/attach/confirm/route.ts`): guard order as above but **no `requireUserId`** (D3 — the recovery browser may be cookieless; D4 is the authorization) → body parse 400 → `claimAttachToken` miss → **410 invalid-or-expired** → requester liveness miss → 410 → `findVerifiedHolder(email)`; if holder && holder ≠ requester → `mergeAccounts(db, requester, holder)` with D5's one retry (re-derive pair, retry once; still failing → 409) → **D16's confirm-side re-check** (resolved winner already holds a verified email ≠ token email → 409 `email-already-attached`, token spent) → `attachEmailToUser(winner)` — a unique-violation from `users_verified_email_uq` on this UPDATE (the concurrent-confirm window where the holder lookup returned null) is caught and mapped to the **same 409 request-a-new-link answer** as the exhausted retry (T-API-S73's shape) → `createSessionForUser(winner)` + `Set-Cookie` → `{merged}`.
- **`GET /attach/state`** (`app/attach/state/route.ts`): the READ template; D10's conjunction; `{eligible}`.
- **`POST /attach/dismiss`** (`app/attach/dismiss/route.ts`): WRITE template; body is `attachDismissSchema = z.strictObject({})` — the client posts a literal `{}`, any key (or a non-JSON body past the 415 gate) is a 400; pinned here at plan level, the Zod-at-every-boundary rule with nothing smuggled; response `{dismissed: true}`; `dismissAttachPrompt`.
- **`POST /account/delete`** (`app/account/delete/route.ts`): WRITE template; `{confirm: true}`; cascade delete; clearing Set-Cookie; `{deleted: true}`.

`.env.example` gains `RESEND_API_KEY`.

---

## 8. `apps/web` — prompt card, confirm page, policy page, walls and checkers

Per D14/D15, concretely:

- **i18n:** `routeSlugs` gains `attach: "vincular"`, `privacy: "privacidade"`; `routes.attach`, `routes.privacy`. `messages` gains `attach.*` (card, form, consent labels with the policy link text, sent state, errors), `confirm.*` (page title, button, result states: attached / merged-recovered / invalid-expired / conflict-retry), `privacy.*` (the whole policy), `deleteAccount.*` (section, two-step copy, terminal state). Components never carry string literals.
- **`app/hub-attach.tsx` + `hub-attach.module.css`** — D15's card; mounted from `app/page.tsx` after the game cards. The hub server component itself stays synchronous and fetch-free.
- **`src/attach/attach-client.ts` + `src/attach/use-attach-state.ts`** — D15's plumbing.
- **`app/vincular/page.tsx` + `page.module.css` + `app/vincular/attach-confirm.tsx`** — server shell in the modo-livre register **minus static rendering**: awaiting `searchParams` makes the route dynamically rendered by construction, so the honest claim is *request-rendered shell — no db import, no fetch, messages-only, marker attr `data-page="vincular"`, robots noindex via metadata* (the words and the rendering mode now match; moving the token read into the island via `useSearchParams` was rejected — it would cost a Suspense boundary and break the serializable-prop shape T-WEB-S139 pins). The shell reads `searchParams` (Next 16: awaited) and passes the token **string** (serializable) to the island; island states: missing/invalid token → explainer; ready → the one confirm button; posting → settle; success → result copy per `{merged}`; 410/409 → the re-request explainer linking home.
- **`app/privacidade/page.tsx` + `page.module.css` + `app/privacidade/delete-account.tsx`** — D14 + D13's island; `data-page="privacidade"`.
- **Walls:** `eslint.config.mjs` free-play static group + dynamic regex gain `**/attach`, `**/attach/**`, `**/hub-attach`; probes in `eslint-free-play-wall.test.ts` (T-LINT-S26…S28). The db wall needs no change (`attach_tokens` is only reachable via `@miolos/db/user`, already banned from `apps/web`).
- **Checkers:** `route-ssr.test.tsx` ROUTES table gains `/vincular` and `/privacidade` rows (inside T-WEB-S56 — the burn precedent, no new id); `.github/workflows/impeccable.yml` preflight path list + both detect URL lists gain both routes with marker greps; `route-client-js.mjs` needs no code change (both routes are daily-strict by construction) — run it and show both routes clean.
- **Bundle:** `/` gains the attach island; publish before/after first-load figures for `/` and **every** route in the PR; never retune a budget (§9).

---

## 9. Gates and rituals

Every node/pnpm/npx command behind the environment preamble: `source ~/.nvm/nvm.sh && nvm use default >/dev/null && …`. Outputs pasted in the PR (the evidence rule — "should pass" is not a result).

```
rm -rf apps/web/.next && pnpm typecheck        # ALWAYS the rm first (stale .next/types)
pnpm lint
pnpm test                                       # full suite (WSL2 flake: --force --concurrency=1, say so if used)
cd apps/web && pnpm build && pnpm bundle-check  # build BEFORE bundle-check (wiping .next deletes its stats);
                                                # bundle-check only from apps/web
npx impeccable detect                           # UI ships: required (CLAUDE.md)
npx impeccable detect --no-config               # the POSITIVE CONTROL beside EVERY local scan —
                                                # a scan that finds nothing without proving it CAN find
                                                # something is the silent-green trap (plan 025 / handoff 024)
git diff origin/main...HEAD -- packages/db/migrations   # shows EXACTLY migration 0004 (+meta), argued in the PR
grep -rn "password\|senha" apps packages --include="*.ts" --include="*.tsx"  # AC 5: no production hit
```

**Impeccable carries two repo conventions, not just the command:** (1) each local scan runs beside its `--no-config` positive control, above; (2) `.impeccable/config.json` wildcard-ignores the low-contrast/cream-palette findings (#51), so the detector cannot vouch for the card's new color pairs — the PR carries **hand-computed contrast arithmetic** for every new surface: the submit button's `--ink-on-accent` label on the accent fill, input text and labels in `--ink` on card paper, and the inline error state, each against WCAG AA.

Zod at every boundary: every route parses requests and parses its own response before `Response.json` (the strict-on-both-ends discipline); `localStorage` is not used by this ticket at all. Property floors per ADR-0023 where properties are real (§10 — the normalization property; nothing else here is a genuine property, and none is forced). Pre-commit never bypassed.

**Migration gate — the procedure, quoted exactly** (`packages/db/src/schema.ts:198-203`, the repo's canonical statement):

> MIGRATION `0003_omniscient_venom.sql`, and it reaches Neon BY HAND via `DATABASE_URL_UNPOOLED` — nothing in CI or Vercel runs migrations. `db:migrate` (`drizzle-kit migrate`) must NEVER be pointed at Neon: it reconciles `migrations/meta/_journal.json` against a bookkeeping table it maintains inside the target database, and every migration in this repo was applied with `psql -f`, which writes no such row. `db:generate` is the only half of the pair this repo uses.

And the deploy-order law, ADR-0038 consequence (h) as applied to `users` by plan 029 §12 risk 4:

> it needs migration `0004` hand-applied to Neon via `DATABASE_URL_UNPOOLED`, and **adding *any* column to the `users` pgTable changes the INSERT column list drizzle emits for every writer — `mintSession`'s `insert(users).values({})` included — so a deploy preceding the apply 500s `POST /session`** (the ADR-0038 (h) trap, measured against drizzle-orm 0.45.2).

D9's `attach_prompt_dismissed_at` springs exactly this trap — and it fires at the **first branch push**, not at merge: preview deploys share the production Neon database (handoff 019: `DATABASE_URL` is set on Preview — same rows), so the branch's very first Vercel preview runs `mintSession`'s INSERT against unmigrated `users` and preview `POST /session` 500s until 0004 is applied. **Migration 0004 reaches Neon BEFORE the branch is first pushed** (§15 step 0 — run immediately after commit 2 exists locally; local commits are unaffected). Applying early is a non-event (nullable column, new empty table, partial index over an all-null set). **Drizzle column-list audit** (every writer of any table gaining a column): `users` gains one column → writers are `mintSession` (`insert(users).values({})` — the trap above; no code change, deploy order is the fix), `mergeAccounts`' users UPDATE (explicit SET — unaffected), and this ticket's own new UPDATE writers (written post-migration by construction). `attach_tokens` is new (no pre-existing writer). `completions` gains nothing — T-DB-S24's column tripwire stays green untouched. PGlite ordering: `createTestDb` replays committed migrations, so **the migration commit precedes every test that touches the new columns** (§14).

---

## 10. Test plan and reserved ids

Frontier at `f0789f0` (`docs/agents/test-ids.md`, re-derived by grep before allocation and again at step 8): next free `T-CORE-S49`, `T-DB-S26`, `T-API-S57`, `T-WEB-S135`, `T-LINT-S26`. This plan reserves **T-CORE-S49…S58**, **T-DB-S26…S33**, **T-API-S57…S81**, **T-WEB-S135…S150**, **T-LINT-S26…S30** (contiguous; tails are review-round headroom, **burned if unspent**). The plan-review round spent the api headroom (S79/S80) and extended the api range contiguously by one (S81) — the range stays gap-free; step-6 additions extend contiguously the same way. Ids on `it(...)` in core/db/api; on `describe(...)` in `apps/web` (the recorded conventions).

**`packages/core/test/attach-contract.test.ts`** (+ the property file beside it):

| Id | Assertion |
|---|---|
| T-CORE-S49 | `attachEmailSchema` normalizes (trim + lowercase) and rejects non-emails, overlong input, empties |
| T-CORE-S50 | **Property (fast-check, `numRuns: 100`):** normalization is idempotent — any string that parses re-parses to the same value (`parse(parse(x)) === parse(x)`), and every parsed output is already trimmed/lowercased. The one genuine property here; nothing else is forced into property shape |
| T-CORE-S51 | `recoveryConsent` accepts only literal `true` (false/absent/other → fail); `reminderConsent` is a required boolean with **no default** |
| T-CORE-S52 | `attachConfirmSchema`: exactly the 43-char base64url shape; padded/longer/shorter/other-alphabet rejected |
| T-CORE-S53 | Every new response schema is strict: an extra key fails the parse (the strict-on-both-ends pin, all five response schemas in one table test) |
| T-CORE-S54 | `remoteConfigSchema.attachStreakThreshold`: default 5; out-of-range/non-int falls back whole-config (existing semantics); `defaultRemoteConfig` carries both keys |
| S55–S58 | Reserved headroom |

**`packages/db/test/attach-schema.test.ts` + additions to `merge.test.ts`** (PGlite over the real committed 0004):

| Id | Assertion |
|---|---|
| T-DB-S26 | **The winner-liveness guard (precondition 1):** a tombstone-shaped winner (fixture: sessions stripped, handles nulled — manufactured directly) → `mergeAccounts` throws, and the would-be loser's full state (sessions, completions, users row) is byte-unchanged: no destructive statement ran |
| T-DB-S27 | Guard green paths: a normal merge passes the guard; the double-run (T-DB-S20's discipline) still snapshots identical — the guard never breaks operation idempotence |
| T-DB-S28 | `attach_tokens` facts: `created_at` is DB-side; the user cascade deletes the rows; PK rejects a duplicate hash |
| T-DB-S29 | `users_verified_email_uq`: two rows may not both hold the same email verified (second write throws); the same email verified + a NULL-email row coexist; two NULL-verified rows coexist (multiple-NULL semantics) |
| S30–S33 | Reserved headroom (S30 earmarked: the tripwire widening itself needs no id — `user.test.ts`'s own contract) |

**`apps/api/test/attach.test.ts` (+ `attach-state.test.ts`, `account-delete.test.ts`)** — seam-4 architecture: PGlite via `createTestDb`, `vi.mock("../src/db")`, **`vi.mock("../src/email/transport")`**, real route handlers with real `NextRequest`, real minted sessions, `vi.stubEnv` for `RESEND_API_KEY`/`WEB_ORIGIN`, tokens harvested from the transport mock's URL argument:

| Id | Assertion |
|---|---|
| T-API-S57 | request: cross-site positive evidence → 403 before any DB touch |
| T-API-S58 | request: non-JSON content type → 415 |
| T-API-S59 | request: no session → 401 |
| T-API-S60 | request: invalid body (bad email; `recoveryConsent` false/absent) → 400 |
| T-API-S61 | **Fail-closed:** `RESEND_API_KEY` unset → 503, zero token rows minted, transport never called (same for `WEB_ORIGIN` unset) |
| T-API-S62 | request happy path: one token row, **hash-only** (raw token absent from the DB, its hash present); transport called once with the normalized address and a `${WEB_ORIGIN}/vincular?token=` URL carrying a 43-char token |
| T-API-S63 | request writes **nothing to `users`**: consents and email columns unchanged after request — AC 3's "saving the streak never signs the player up for mail", first half; `reminder_consent` rides the token row per the checkbox |
| T-API-S64 | rate-limit boundary: three tokens with **injected `created_at` 31 minutes old** (expired, but inside the rate window) → the 4th request still 429s with no send — the fixture that catches a cleanup-before-count loosening, which four quick requests cannot; rows older than 1 hour ARE deleted on request (the cleanup, D12) |
| T-API-S65 | D16: verified email already attached — different address → 409; same address → 200 resend |
| T-API-S66 | confirm happy path (no collision): token consumed; winner gets `email` + `email_verified_at` + `recovery_consent_at` (reminder stays NULL when unchecked); `completions` untouched (AC 5); response `{merged:false}` with a Set-Cookie whose token resolves via `requireUserId` to the winner |
| T-API-S67 | reminder consent: token `true` → `reminder_consent_at` stamped; token `false` on an account with a pre-existing stamp → value untouched (unchecked ≠ withdrawal, D7) |
| T-API-S68 | single-use: second confirm of the same token → 410, state unchanged (the atomic-claim pin at the seam) |
| T-API-S69 | expiry: a token whose `created_at` is rewound 31 minutes → 410, one generic error (no oracle) |
| T-API-S70 | **merge-on-collision:** holder X (verified E, history) + requester B (history) → `{merged:true}`; winner per created_at; loser tombstoned (handles null, zero sessions/completions); E on the winner; the new cookie's `GET /streak` serves the **merged** streak (AC 2 + AC 5 in one) |
| T-API-S71 | **recovery and device move, by name:** fresh empty account B requests with E (attached to old X); after confirm the clicking browser resolves to X's full history — the cleared-site-data user and the second device are this same fixture |
| T-API-S72 | tombstoned requester: token's user stripped of sessions between request and confirm → 410, no write anywhere |
| T-API-S73 | D5 at the route: first `mergeAccounts` throws (guard), the route re-derives and retries once; a persistent failure → 409 and the token is spent (pinned honestly) |
| T-API-S74 | state: eligibility flips with the streak crossing the threshold **and** with a live `remote_config` row (threshold 3 fixture) — read from remote config, not a constant |
| T-API-S75 | state: suppressed by attached email; by `dismissed_at`; by unconfigured transport; 401 without session; `Cache-Control: no-store` on every branch |
| T-API-S76 | dismiss: stamps `dismissed_at` with explicit `updated_at`; idempotent re-post touches zero rows; 401/403 guards; a non-empty body → 400 (`z.strictObject({})`) |
| T-API-S77 | delete: cascade removes users+sessions+completions+hint_grants+attach_tokens; clearing Set-Cookie present; `{confirm:true}` literal required (400 otherwise) |
| T-API-S78 | delete ≠ tombstone: after deletion, `POST /session` mints a **fresh** id (no resurrection, no merge); a merge-tombstone is unreachable by this route (no session resolves to it) |
| T-API-S79 | D16 at confirm — the pending-token side door, closed: winner holds verified E1, a still-live token for E2 is confirmed → 409, token spent, email unchanged |
| T-API-S80 | unique-violation on the attach UPDATE (manufactured: `attachEmailToUser` made to throw the `users_verified_email_uq` violation once, via a `vi.spyOn` on the service — the concurrent-confirm window) → 409 in T-API-S73's shape, token spent |
| T-API-S81 | per-email cap (D12): three tokens for the same normalized email minted by three distinct fresh users → a 4th fresh user's request for that email → 429 with no send (the mint-fresh-users mail-bombing shape, closed for one inbox) |

**`apps/web/test/`** (`hub-attach.test.tsx`, `attach-confirm.test.tsx`, `privacidade.test.tsx`; ids on `describe`):

| Id | Assertion |
|---|---|
| T-WEB-S135 | hub card: absent on server render and while state is unresolved; renders when the mocked client resolves `eligible:true`; all copy from `messages` |
| T-WEB-S136 | dismiss: *"agora não"* calls the dismiss client and the card leaves; no localStorage anywhere in the attach modules |
| T-WEB-S137 | form: reminder checkbox **unchecked by default**; submit disabled/blocked until recovery is checked; posts the normalized payload shape |
| T-WEB-S138 | sent state replaces the form and shows the address; error states render inline from `messages` |
| T-WEB-S139 | `/vincular`: token from `searchParams` reaches the island as a string (serializable props only); missing token → explainer state |
| T-WEB-S140 | confirm island: posts `{token}`; renders attached vs merged result per `{merged}`; 410 → the re-request explainer |
| T-WEB-S141 | `/privacidade`: static render; copy externalized; states `privacidade@miolos.app` and both deletion paths (matching D13's shipped reality) |
| T-WEB-S142 | delete island: two-step confirm; calls the delete client only after the second step; terminal state |
| T-WEB-S143 | hub nav carries the real `/privacidade` link; consent label links `/privacidade`; both via `routes` (never literals) |
| T-WEB-S144 | a11y pins: labels bound to inputs (`htmlFor`/id), checkboxes are native inputs, dismiss/submit are buttons |
| S145–S150 | Reserved headroom (the `/vincular` + `/privacidade` `route-ssr` rows ride T-WEB-S56's table — the burn precedent, no new id) |

**`apps/web/test/eslint-free-play-wall.test.ts`:** T-LINT-S26 (static group bans `**/attach`, `**/attach/**`), T-LINT-S27 (dynamic-import regex mirrors), T-LINT-S28 (`**/hub-attach` one-hop ban); S29–S30 headroom.

**TDD seams for `/implement` (step 5):** contracts first (S49–S54, red-green, no DB), then migration + db suites (S26–S29 — needs the committed SQL), then the api seams (S57–S81; transport and db mocked per the idiom, the confirm suite driven by harvested tokens), then web (S135–S144), walls last. Typecheck and the file under work run continuously; the full suite once at the end.

**Existing tests knowingly edited (regression net, no new ids):** `packages/db/test/user.test.ts` (tripwire list + `attachTokens`), `packages/db/test/merge.test.ts` (the D5-sanctioned fixture-realism edit: `createUser` gains a birth session and session-count/snapshot assertions rebase — the guard itself asserts every real minted user is born with a session, and the old fixtures modeled users that cannot exist in production), `apps/web/test/route-ssr.test.tsx` (two ROUTES rows), `eslint.config.mjs` probes' fixtures. Anything else red is investigated as a finding, not silenced.

---

## 11. What cannot be verified in this environment

Stated per the evidence rule; the PR repeats this table.

| Cannot do here | Substitute, and who does the real thing |
|---|---|
| A real email sent, delivered, and clicked | The transport seam is faked (T-API-S62) and the harvested-URL confirm pins the loop's mechanics end-to-end; the real send is §15's post-activation smoke (Fernando, a real mailbox) |
| Resend account, DNS (SPF/DKIM), domain verification, `privacidade@` forwarding, `vercel env add` | §15's wizard — all pre-activation, none pre-push |
| Migration 0004 against real Neon | PGlite replays the identical committed SQL; the hand-apply (`psql "$DATABASE_URL_UNPOOLED" -f …`) is §15 step 0, **pre-push** (before the branch's first push — preview deploys share the production Neon DB, §9), with its output pasted into the PR by whoever runs it |
| The first live production `mergeAccounts` (handoff 030 §6's standing duty) | T-API-S70/S71 at the seam; the live execution is §15's smoke: attach on device A, clear-and-recover on device B |
| A true concurrent-merge race | D5's guard is deterministic and T-DB-S26 manufactures the post-race state directly; no test here can schedule a real interleaving (the plan-029 §10 acceptance, inherited) |
| `impeccable detect` against a production preview | Run locally per the gate (each scan beside its `--no-config` positive control, §9); the CI job runs against the Vercel preview on the PR as always |
| The attach card's **rendered** state under impeccable | Preview and any unkeyed environment never render the card — D11's transport conjunct holds `eligible: false` without `RESEND_API_KEY` — so the repo's first form controls ship without impeccable coverage of their rendered state (the hub-streak zero-state precedent, accepted again by name). Substitute: §9's hand-computed contrast arithmetic for every new surface + T-WEB-S135…S138/S144's pins; the real rendered card is checked live in §15 step 6's post-activation smoke |
| Deliverability/spam placement of the magic-link mail | Out of any test's reach; §15 smoke + the no-pixel plain-text body is the best structural lever |

---

## 12. What is deliberately NOT in this slice

- **Sending any reminder email, push, the service worker, habitual-time derivation** — #32, which reads `reminder_consent_at` from the canonical account and nothing else here.
- **Consent withdrawal UI and withdrawal-timestamp representability** — the settings/M4 surface; D7 names it as ADR-0022's recorded revisit trigger. Deletion (D13) is the v1 total-revocation path.
- **Email change for an attached account** — D16's 409; a real flow with its own safeguards, M4/settings.
- **The full LGPD pass** (data inventory, DPO, telemetry review, policy revision) — M4 per ADR-0012.
- **Social login** (`apple_id`/`google_id` writers) — post-launch per ADR-0003.
- **Global token sweep / nightly consistency checks** — the nightly ticket (D12 hands it the expired-token sweep beside its existing merge-integrity duties).
- **Per-IP/global rate limiting, captcha** — revisit triggers named in D12.
- **#58, #29, #30, #83** — untouched, per their own tickets; no rider.

---

## 13. Deviation / risk register

1. **`GET /attach/state` cost on the hub** (a second authenticated read beside `/streak`). Accepted by D10's reasoning; if step 6 flags it, the answer is recorded there — merging payloads is what ADR-0048 forbids. No latitude.
2. **drizzle-kit cannot cleanly generate the partial unique index** (first in repo). Response: commit whatever `db:generate` emits **untouched** if correct; if it misbehaves, drop the index from 0004 and ship layers 1–2 of D6 alone, stating it in the PR with the follow-up chore named — never hand-edit SQL (the plan-014 rule). The flow invariant carries the semantics either way.
3. **Bundle: the hub island moves every measured delta** (1.7 KB slack on nonogram). Response: publish before/after for `/` and every route; if any budget breaks, attribute first (`route-client-js.mjs` output), slim the island (no new deps, zod already rides `/`), and only then discuss budgets with Fernando — never silently retune (napkin rule).
4. **The guard changes `mergeAccounts` and its tests are load-bearing** (T-DB-S16…S24). Response: the guard is one read + one throw before statement 1. Exactly one test edit is sanctioned in advance (D5, §10): `merge.test.ts`'s `createUser` gains a birth session, because the old fixtures model session-less users that cannot exist in production — the very state the guard asserts against. Beyond that fixture-realism change (and its rebased session counts), if any existing merge test goes red, the change — not the test — is wrong (T-DB-S27 exists to pin that the double-run survives).
5. **Zod v4 API drift** on `.trim().toLowerCase().pipe(z.email())` spellings. Response: semantics are fixed (D6), spelling follows the installed zod at step 5; T-CORE-S49/S50 pin the behavior, not the spelling.
6. **Set-Cookie on a credentialed XHR from `api.miolos.app`** — works in prod under `COOKIE_DOMAIN=miolos.app` (the `POST /session` bootstrap precedent does exactly this daily); local dev has no shared domain, same as every existing flow. No new mechanism.
7. **A crash between merge and `attachEmailToUser`** leaves merged histories with no email attached and a spent token. Accepted: re-request re-attaches; every component is idempotent; recorded in ADR-0050 (the D1 crash note).
8. **Fernando overrides** pre-planned: stricter "exactly once" (stamp on first render) — D9 argues against, one column write moves if he insists; mailto-only deletion — D13 argues against (an unverifiable "works"); a separate `/vincular/confirmar` route — cosmetic, one more checker row everywhere. None blocking.

---

## 14. Commit and PR plan

One branch: **`feat/21-email-attach-magic-link`**. Sequence (each green under pre-commit; PGlite forces the migration before its dependents):

1. `docs: plan 031 for #21 and its README row` — this file + the `docs/README.md` row.
2. `feat(db): migration 0004 — attach_tokens, attach_prompt_dismissed_at, verified-email partial unique index` — schema.ts (+ comment corrections), generated SQL + meta, `user.ts` export + tripwire widening, tests T-DB-S28/S29.
3. `feat(db): winner-liveness guard in mergeAccounts (issue #21 precondition 1)` — the guard + tests T-DB-S26/S27 + the sanctioned `merge.test.ts` fixture-realism edit (D5: `createUser` gains a birth session).
4. `feat(core): attach and account contracts; attachStreakThreshold in remote config` — §6 + tests T-CORE-S49…S54.
5. `feat(api): email transport (Resend via fetch, fail-closed) and the attach service` — transport, copy, service, `createSessionForUser`, `.env.example`.
6. `feat(api): attach request/confirm/state/dismiss and account delete routes` — five routes + tests T-API-S57…S81.
7. `feat(web): privacy policy page, self-service deletion, and the attach client module` — i18n, `/privacidade`, delete island, **`src/attach/attach-client.ts` (all five wrappers — the delete island consumes its delete wrapper here, so the module lands with its first consumer and commit 7 typechecks standalone under pre-commit; commit 8's islands consume the rest)**, checkers rows, tests T-WEB-S141…S143 (its share).
8. `feat(web): attach prompt card and the /vincular confirm page` — hub island, `src/attach/use-attach-state.ts`, `/vincular`, wall bans + probes, remaining T-WEB + T-LINT tests, impeccable.yml lists.
9. `docs: ADR-0050, CONTEXT.md magic-link row, test-id frontier` — Appendix A as a real file (status flips to Accepted at merge), CONTEXT.md edits, `docs/agents/test-ids.md` frontier re-derived by grep.

**Push-order dependency (§9's gate):** local commits may proceed freely, but the branch's **first push waits on migration 0004 being applied to Neon** (§15 step 0) — the first push triggers a Vercel *preview* deploy, and previews share the production Neon DB (handoff 019), so an unapplied 0004 500s preview `POST /session` immediately, not at merge. Mechanically: the moment commit 2 exists locally, the session generates §15's wizard script (the wizard-skill pattern) and stops for Fernando with the exact psql command; the pasted psql output is the completion evidence, landing in the PR description — the branch is pushed and the PR opened only after the apply, so the evidence precedes the first preview. The merge inherits the same guarantee for free.

**Step-5 execution is deliberately serial on the single branch — no parallel subagent split:** commits 7 and 8 both touch shared web files (`messages.ts`, `eslint.config.mjs`, `impeccable.yml`, `route-ssr.test.tsx`), and serializing is cheaper than partitioning ownership of four shared files.

**PR description:** what changed; every gate's real output inline (§9's list, bundle before/after for every route including `/`); the §11 cannot-verify table; the §15 checklist with pre-push vs pre-activation marked; the §9 contrast arithmetic for the card's new surfaces; the AC 5 grep output; the D-register decisions Fernando may override (D9's exactly-once reading, D13's real-deletion choice, D15's placement, D16's 409, the 30-minute TTL) — **none blocking except step 0 of §15**, which by then has already gated the first push. Closes #21.

Step 6 runs the standard parallel lenses (correctness; **security** — the first production `mergeAccounts` caller, a cookie-setting unauthenticated endpoint, and both recorded preconditions deserve that lens's full attention; quality; performance; ADR/CONTEXT adherence; issue adherence). Reviewers default to rejecting; dismissals in writing.

---

## 15. Human steps — the wizard-shaped checklist

Everything the sandbox cannot do, ordered. **Only step 0 gates the branch's first push (and therefore the merge)**; the code merges dormant and fail-closed (D11 — without `RESEND_API_KEY`, the request route 503s and the prompt never appears; the policy page and deletion are live immediately, which is what AC 4 needs).

**Pre-push (blocking — before the branch's first push):**

0. **Apply migration 0004 to Neon** — before the branch is first pushed, because preview deploys share the production Neon DB (handoff 019) and the first preview would 500 `POST /session` until this runs. **Mechanism (the wizard-skill pattern):** the moment commit 2 exists locally, the session generates this step's interactive wizard script (show the command, wait, capture the output) and asks Fernando explicitly to run, from a machine with the credential:
   `psql "$DATABASE_URL_UNPOOLED" -f packages/db/migrations/0004_<generated-name>.sql`
   (never `drizzle-kit migrate` — the documented hand-apply procedure quoted in §9). **Completion evidence = the pasted psql output, in the PR before the branch is pushed.** Applying early is a non-event (nullable column, new empty table, partial index over an all-null set); the unsafe order is deploy-before-apply (§9).

**Pre-activation (any time after merge; the feature stays dormant until 4):**

1. **Resend account** — create at resend.com; add domain `miolos.app` (or subdomain `mail.miolos.app` if Resend recommends it for the return-path — follow the dashboard).
2. **DNS in Vercel** — add the SPF/DKIM (and return-path/DMARC) records Resend's dashboard lists, on the Vercel DNS zone for `miolos.app`; wait for Resend to show the domain verified.
3. **`privacidade@miolos.app` forwarding** — set up email forwarding for the address to Fernando's real inbox (Vercel domain email forwarding or an equivalent); send a test mail and confirm receipt. The policy page already publishes the address.
4. **The key:** create a Resend API key (sending-only scope) and
   `vercel env add RESEND_API_KEY production` (and `preview` if preview flows should send) on **miolos-api**. Never committed anywhere. If `vercel env pull` is used locally: revert the `.gitignore` line it appends (napkin).
5. **Optional tuning** — the threshold defaults to 5 in code; to tune without a deploy:
   `INSERT INTO remote_config (key, value) VALUES ('attachStreakThreshold', '5') ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = now();`
   (shape per the existing `bufferDepth` row; only needed to change the value).
6. **Post-deploy smoke — the first live `mergeAccounts` (handoff 030 §6's standing duty):** on device A with a streak ≥ threshold, confirm the prompt appears; attach a real email; click the link; confirm the success state and that the streak survives. Then on device B (or A with site data cleared): play once, request attach with the same email, click the link, and confirm the old streak is recovered and `GET /streak` agrees. Check the mail landed in inbox, not spam. Finally, visit `/privacidade` and run one throwaway account through deletion.

---

## 16. Exit criteria

| Claim | Discharged by |
|---|---|
| All five ACs met with machine-checkable evidence | §0's mapping; §10's suites green; §9's gate outputs pasted |
| Both issue-comment preconditions discharged and tested | D5 + T-DB-S26/S27, T-API-S73 (serialization); D4 + T-API-S66/S70/S72 (verified identities; no request-supplied id reaches `mergeAccounts` — asserted by code review at step 6 against the confirm route) |
| Migration 0004 committed, PGlite-replayed, and applied to Neon before the branch's first push (preview shares the prod DB, §9) | Commit 2; §15 step 0's wizard-run psql output pasted in the PR before the push; the migrations diff in the PR |
| The feature merges dormant and fail-closed | T-API-S61 (503, zero side effects) + T-API-S75 (state ineligible when unconfigured) |
| No password anywhere; strict contracts on both ends; no localStorage in attach | The §9 grep; T-CORE-S53; T-WEB-S136 |
| impeccable + bundle gates with fresh before/after figures for every route including `/`; every local impeccable scan beside its `--no-config` positive control; hand-computed contrast arithmetic for the card's new surfaces in the PR | §9 (the silent-green trap and the #51 wildcard-ignore); §13 risk 3's discipline |
| ADR-0050 exists, amends nothing, and no reciprocal `Amended by:` line is owed anywhere; #58's amendment space untouched | D17's audit; step-6 ADR-adherence lens re-checks |
| CONTEXT.md carries the Magic link row and the Attach citation; schema comments true again; `docs/README.md` carries plan 031's row; test-id frontier re-derived at step 8, unspent tails recorded burned | Commits 1 and 9 |
| Step-6 review closes on an empty blocking pass, dismissals written down | §14 |

---

## Appendix A — Draft ADR-0050 (to be created as `docs/adr/0050-email-attach-magic-link-tokens-consents-and-the-lgpd-minimum.md`)

Status convention: "Proposed" in the draft; the real file carries **"Accepted — \<merge date\>"** — Fernando's merge is the acceptance.

```markdown
# ADR-0050 — Email attach: magic-link tokens, verified-email uniqueness, consents, and the LGPD minimum

**Status:** Proposed — 2026-08-13 (issue #21)
**Depends on:** ADR-0003, ADR-0009, ADR-0012, ADR-0013, ADR-0022, ADR-0025, ADR-0026, ADR-0048, ADR-0049
**Amends:** nothing — deliberately. Every decision below either resolves a
recorded silence (email uniqueness — schema.ts's "uniqueness semantics land
with the attach/merge ticket"; consent merge semantics — ADR-0049 decision 4's
explicit delegation), resolves a recorded conditional (ADR-0022's "adds the
explicit per-consent flag … if an audit trail is needed" — decided not needed
in v1, revisit trigger below), or adds a guard discharging the two security
preconditions recorded on issue #21 without contradicting any sentence of
ADR-0049. One near-miss deserves its argument written down: ADR-0012's own
consequence sentence promises a "per-consent flag plus timestamp (when it
was given or withdrawn)". Resolving ADR-0022's conditional does NOT correct
that sentence, because the resolution decides only v1 *storage* — and the
withdrawal-representability revisit trigger is exactly where ADR-0012's
fuller shape becomes true: the first withdrawal surface (settings / M4)
adds the flag columns and makes withdrawal timestamps representable, at
which point ADR-0012's sentence is satisfied as written rather than
amended. Recorded here so the step-6 ADR-adherence lens finds the argument,
not a silence.

## Context

ADR-0003 promised the magic-link attach at streak ≥ 5; ADR-0012 tied the LGPD
minimum to it; ADR-0049 built the merge and named #21 its first production
caller, owner of "everything HTTP: collision detection by email, uniqueness
semantics, consents, transport". Issue #21's comment added two security
preconditions from PR #86's review: serialize merges touching a common user
(pg_advisory_lock unavailable over neon-http), and derive both merge ids from
verified identities. Nothing about tokens, transport, uniqueness, consents,
prompting or deletion was recorded. This ADR records all of it as one design.

## Decision

1. **One flow, four verbs.** POST /attach/request (authenticated) mints a
   token and emails a link; POST /attach/confirm (driven from the /vincular
   page) claims it, merges on collision, writes the email to the winner, and
   sets a fresh session cookie. Attach, recovery, device move and
   merge-on-collision are the same flow: recovery and device move are a
   collision whose requester is a fresh, empty account. No flow variants —
   ADR-0049's one-function rule extended to HTTP.
2. **Tokens: the sessions idiom plus expiry and single use.** `attach_tokens`
   stores only the SHA-256 hex of a 32-byte Web-Crypto token (hash PK), the
   requester (FK cascade), the normalized email, the reminder-consent choice,
   and a DB-clock `created_at`. Expiry is a DB-side predicate (30 minutes) on
   the claim; single use IS the claim: one atomic
   `DELETE … RETURNING` — race-safe without a transaction. Unknown, expired
   and spent tokens are indistinguishable (410). `users.email` is written
   only at confirm, so on `users`, non-null email implies verified.
3. **The link lands on the web; the POST consumes.** The emailed URL is
   `{WEB_ORIGIN}/vincular?token=…` (pt-BR route, ADR-0013; nothing hardcodes
   the apex); the page shows one explicit button whose POST to the api —
   behind the origin guard and the JSON gate — is the only consumer. Email
   scanners prefetch GETs; a GET here consumes nothing. Possession of the
   inbox is the trust model (a forwarded link is a handed-over account);
   single-use + 30 minutes bound it.
4. **Both merge ids are verified identities (precondition 2).** The pair is
   always (token.user_id — bound by requireUserId at request time, stored
   server-side) and (the verified holder of the token's email — one DB
   lookup). The clicking browser's cookie never chooses the pair; the
   request body contains only the token. The clicking browser is
   authenticated AS the winner, never merged into it.
5. **Serialization is a winner-liveness guard (precondition 1).** Inside
   `mergeAccounts`, between winner selection and the first destructive
   statement: the selected winner must still own ≥ 1 session or ≥ 1 identity
   handle — i.e., must not be a tombstone (every live account owns a session
   by construction; only tombstones own none). On failure the operation
   throws before touching anything; the confirm route re-derives the pair
   and retries once, then 409s. Route-level single-flight was rejected:
   stateless Vercel functions share no memory, so a route lock is fiction.
   This is an addition, not an amendment: no sentence of ADR-0049 is
   contradicted; sessions are still remapped first among writes.
6. **Verified-email uniqueness, three layers.** The Zod boundary normalizes
   (trim + lowercase) every email; the flow keeps at most one verified
   holder (the merge nulls the loser's email before the winner gains it —
   no transient two-holder state exists); and a partial unique index on
   users(email) WHERE email_verified_at IS NOT NULL backstops the one race
   the flow cannot close (two concurrent confirms of the same email onto
   different winners fail loudly rather than forking the identity). The
   confirm route catches exactly that unique violation — the window where
   its holder lookup returned null — and maps it to the same 409
   request-a-new-link answer as an exhausted merge retry (decision 5); the
   token is already spent either way.
7. **Consents: timestamp-only stands.** ADR-0022's conditional is resolved:
   no explicit flag columns in v1, because no withdrawal surface exists in
   v1 — the revisit trigger is the first withdrawal surface (settings / M4
   LGPD pass). The two timestamp columns ARE the independent flags (NULL =
   not consented; a timestamp = consented then). recoveryConsent is a
   literal-true in the request contract (attaching is the recovery consent,
   ADR-0012's purpose limitation); reminderConsent is an explicit boolean
   riding the token and stamped on the winner at confirm only when true —
   an unchecked box is the absence of new consent, never a withdrawal.
   Deletion (decision 12) is v1's total-revocation path.
8. **Consent merge semantics (ADR-0049 decision 4's delegation).** The
   winner's consents stand; the loser's timestamps remain on the tombstone —
   never copied (a consent is an act at a moment, not a mergeable maximum)
   and never nulled (they are evidence). A tombstone holds no identity
   handle, so they are not reachable personal data.
9. **The prompt is server-owned and has one lifecycle per account.**
   Eligibility = streak ≥ attachStreakThreshold (remote config, default 5,
   ADR-0003) AND email IS NULL AND attach_prompt_dismissed_at IS NULL AND
   the transport is configured. Served as one boolean by GET /attach/state
   (a new strict contract — ADR-0048's growth rule; the threshold never
   ships to the client). Dismissal stamps users.attach_prompt_dismissed_at,
   permanently. localStorage was rejected: it re-prompts exactly the
   cleared-site-data user the feature serves.
10. **Transport: Resend over plain fetch, fail-closed, dormant until keyed.**
    No SDK (zero new dependencies). RESEND_API_KEY unset → the request route
    503s before any side effect AND /attach/state reports ineligible, so the
    whole feature is dormant until `vercel env add` — the grantHints posture
    applied to a flow. Plain-text mail, no pixels. pt-BR mail copy lives in
    apps/api/src/email/copy.ts — the api's one externalized-copy module.
11. **Rate limit: 3 requests per rolling hour per user AND per normalized
    email**, both counted from attach_tokens rows (multiple outstanding
    tokens are allowed precisely so the rows are the ledger). Opportunistic
    cleanup deletes rows older than the ONE-HOUR rate window, not the
    30-minute expiry — cleanup at 30 minutes would empty the band the count
    needs and silently double the limit; expired-but-recent rows serve as
    the ledger for their remaining half hour (a deliberate 30-minute
    data-hygiene cost). The per-email cap is the cheap closer for the
    bypass composition recorded honestly here: POST /session mints users
    unthrottled (ADR-0022's acceptance), so a per-user cap alone is
    per-attacker-unlimited; mail-bombing one inbox is closed, while fresh
    users × many addresses (Resend quota, sender reputation) remains the
    accepted v1 risk. Revisit: first abuse signal or #32's send
    infrastructure. The global sweep of abandoned rows joins the
    nightly-check ticket.
12. **Deletion is real, immediate, and self-service.** POST /account/delete
    (authenticated, literal confirm) cascade-deletes the user; the cookie is
    cleared; the next visit mints a fresh empty identity. Structurally
    distinct from tombstones: a tombstone owns no session, so no cookie can
    ever aim this route at one — deletion and ADR-0049's "retained forever"
    never conflict. The /privacidade page hosts the UI and publishes
    privacidade@miolos.app as the human-channel fallback (ADR-0012's
    "how to request deletion", both ways).

## Rejected

- **A signed stateless token:** ADR-0022's own reasoning — every request
  touches the DB; a signing-secret lifecycle buys nothing.
- **Tokens as users columns:** several may be outstanding, and any users
  column change re-springs the INSERT-column-list deploy trap for no gain.
- **GET-consumed links:** broken by scanner prefetch; outside the
  POST-shaped origin guard.
- **A hard unique index on email, or none:** under decision 2 (non-null ⇒
  verified) a plain unique index is materially equivalent to the partial
  one — the partial shape is kept for self-description and robustness to
  future states where unverified emails might exist on users, not for
  correctness today; no index at all leaves the concurrent-confirm fork
  open.
- **Explicit consent boolean columns now:** an audit trail without a
  withdrawal surface is dead weight; ADR-0022 named the condition and it is
  not met.
- **localStorage "exactly once", and stamp-on-first-render:** the first
  re-prompts the feature's own audience; the second burns the product's one
  ask on a glimpse.
- **Appending the threshold or eligibility to /streak:** forbidden by
  ADR-0048's strict-contract rule; a new endpoint is the recorded shape.
- **A mailto-only deletion path:** "works" would rest on an unverifiable
  inbox; the cascade already exists and testably works.
- **Merging the clicking browser's account implicitly:** no verified
  identity requested that merge; it would let a forwarded link swallow a
  bystander's history.

## Consequences

- The first production caller of `mergeAccounts` exists; handoff 030 §6's
  post-deploy smoke (the first live merge) is owed by this ticket's
  activation checklist.
- users gains its second and third UPDATE writers — attach-confirm and
  dismiss (mergeAccounts was the first; deletion is a DELETE, not an
  UPDATE, and writes no updated_at); every UPDATE sets updated_at
  explicitly — the schema comment is corrected with this ADR.
- A crash between merge and the email write leaves merged histories with no
  email and a spent token; a re-request heals it. Idempotence remains the
  recovery mechanism end to end.
- Email change for an attached account is deliberately unsupported: 409 at
  request, re-checked at confirm on the resolved winner (a still-live
  pending token for a different email cannot become a silent change — 409,
  token spent); it is a settings/M4 flow with its own safeguards.
- The reminder channel remains dormant: #21 stores consent; only #32 may
  send, and only to reminder-consent holders (ADR-0012).
- "Magic link" enters CONTEXT.md as a durable term.
```
