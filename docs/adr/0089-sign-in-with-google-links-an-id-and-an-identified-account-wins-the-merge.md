# ADR-0089 — Sign in with Google links an id, and an identified account wins the merge

**Status:** Accepted — 2026-09-28 (issue #280)
**Depends on:** [ADR-0003](./0003-anonymous-first-identity-with-email-recovery.md), [ADR-0022](./0022-opaque-session-tokens-in-a-sessions-table.md), [ADR-0048](./0048-the-streak-is-a-client-fetched-server-computed-value.md), [ADR-0049](./0049-account-merge-one-pure-function-one-idempotent-operation.md), [ADR-0050](./0050-email-attach-magic-link-tokens-consents-and-the-lgpd-minimum.md)
**Amends:** ADR-0003 (*"Social login … remains a post-launch upgrade"*: Google ships now, at Fernando's request of 2026-09-28; Apple stays post-launch). ADR-0049 decision 3 (the winner rule) and decision 4 (the tombstone statement). ADR-0050 decision 5 (*"the holder is always older and therefore the winner"*: an email holder now wins over an anonymous requester whatever their ages).

## Context

`users.google_id` (nullable, unique) has existed since M0 for this. Signing in must carry a streak to any device, like the magic link, and be undone in Ajustes. Two gaps appeared once a second identity handle exists: `mergeAccounts` picked the older account even when the newer one held the handle, and its tombstone statement dropped the loser's Google id.

## Decision

1. **An OAuth code flow run by `apps/api`, scope `openid` only.** `GET /auth/google/start` sets a `__Host-miolos_google` cookie (state + PKCE verifier, 10 minutes) and redirects to Google with `prompt=select_account`; `GET /auth/google/callback` checks the state, exchanges the code with the client secret, and keeps only `sub`. The ID token comes straight from Google's token endpoint over TLS, which stands in for its signature (OIDC Core 3.1.3.7). No nonce: PKCE, the state cookie and the server-side exchange already bind the flow. The `__Host-` prefix stops a sibling subdomain planting a flow (ADR-0022's shared-domain risk would otherwise let it link an attacker's Google to a victim's account).
2. **Resolution.** Holder = the account whose `google_id` is `sub`; requester = the presented session. No requester: the holder, or a new account linked to `sub`. No holder: link `sub` to the requester (one Google per account; otherwise `conflict`). Anonymous requester: `mergeAccounts(requester, holder)`. Identified requester (email or Google): **switch** to the holder and merge nothing, with its own `switched` notice. The email flow merges two identified accounts because the email is re-written by the confirm with a fresh consent act; here nothing would re-write the email, and a shared browser's other account must not be swallowed by a Google click.
3. **A fresh session every time.** Every successful callback deletes the presented session row and mints a new one. A token someone else may know never ends up on the Google account. Unlike ADR-0050 decision 13, the winner's other sessions are kept: the browser proved the Google account itself, and revoking would sign out every other device at each sign-in.
4. **The winner rule (amends ADR-0049 decision 3).** An account holding an identity handle beats one holding none; then older `created_at`; then lower id. Still a function of the data, order-independent, and stable across a re-run. Otherwise an older anonymous device signing in would strip the handles off the account the player owns.
5. **The tombstone statement carries the Google id (amends decision 4).** One statement empties the loser and sets `google_id` on a winner that has none, reading the loser through a CTE so the unique index never sees it twice. Emails are not carried: the email flow re-writes them. A winner already linked to another Google keeps its own; the loser's is dropped (accepted residual: two Google accounts each linked to a different Miolos account, then merged by email).
6. **Its own read.** `GET /account/google` returns `unavailable | unlinked | linked`, a new strict contract per ADR-0048 decision 3, not a field on `/account/state`. It reads `linked` even when unconfigured, so a linked player can always unlink. `POST /account/unlink-google` nulls the id.
7. **Dormant until keyed.** Without `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `WEB_ORIGIN`, start and callback answer 503 before reading anything, and Ajustes shows no card.

## Consequences

- A crash inside the anonymous-merge arm has ADR-0050 decision 5's holder-wins residual: the device's completions may strand on the tombstone. A retried sign-in resolves as holder = requester and does not re-run the merge.
- A Google-linked account without an email still gets the streak-5 email prompt; email is also the reminder channel.
- The only data from Google is `sub`. `/privacidade` says so.
