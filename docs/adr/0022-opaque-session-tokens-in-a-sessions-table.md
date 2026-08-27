# ADR-0022 — Opaque session tokens in a `sessions` table

**Status:** Accepted — 2026-07-31
**Depends on:** [ADR-0003](./0003-anonymous-first-identity-with-email-recovery.md), [ADR-0009](./0009-account-merge-recomputes-from-the-union-of-completions.md), [ADR-0012](./0012-minimal-lgpd-ships-with-email-attach.md), [ADR-0013](./0013-canonical-domain-and-pt-br-routes.md), [ADR-0014](./0014-apps-web-reads-the-database-directly-for-public-pages.md)

*Numbering note: 0019–0021 were reserved by in-flight game-engine streams when this ADR was written; 0022 was the next free number.*

## Context

Issue #15 gives every visitor a durable anonymous identity with no interaction:
first request mints a user, every later request resolves to the same user. The
identity carrier must survive for months (it protects a streak, the product's
core mechanic), must be revocable, and must support the ADR-0009 account merge.
The candidate mechanisms were a signed stateless token (JWT-style) and an
opaque random token backed by a server-side table.

## Decision

An **opaque random session token in a `sessions` table** — no JWT.

- The token is 32 bytes (256 bits, above the 128-bit floor) from Web Crypto
  `crypto.getRandomValues`, base64url-encoded (43 characters).
- The server stores only the **SHA-256 hex hash** of the token as
  `sessions.token_hash` (primary key), alongside `user_id` (FK → `users.id`,
  cascade on delete), `created_at`, and `last_seen_at` — all `timestamptz`
  with DB-side defaults. A database leak leaks no usable credentials, and
  lookup-by-hash means no timing-sensitive comparison exists anywhere.
- The client holds the token in a cookie named `miolos_session`:
  `HttpOnly; SameSite=Lax; Path=/; Max-Age=34560000` (400 days, the Chrome
  cap), plus `Secure` when `COOKIE_DOMAIN` is set or `NODE_ENV` is
  `production`, plus `Domain=<COOKIE_DOMAIN>` when that env var is set
  (prod: `miolos.app`, so web and api subdomains share it; never hardcoded,
  per ADR-0013).
- **Sliding lifetime, no server-side hard expiry in M0.** Every successful
  resolve re-emits `Set-Cookie`, restarting the 400-day window. HttpOnly
  server-set cookies are exempt from Safari ITP's 7-day cap. `last_seen_at`
  is bumped only when more than 1 hour stale (the UPDATE statement is sent
  only when the selected value already looks stale, and its DB-side
  predicate is the race guard), so a fresh resolve is a single query and
  writes nothing; a session is *stale* when
  `last_seen_at` is over 400 days old — a future prune cron may delete stale
  rows, not this ticket.
- **`last_seen_at` may never become security-load-bearing as it stands.**
  It is bumped on reads, cross-site top-level GETs included: `authenticatedRead`
  applies no origin guard, by design, so under `SameSite=Lax` any third-party
  page can refresh a victim's `last_seen_at` with a link. Idle expiry, re-auth
  or any other rule that reads it as evidence of the *user's* activity is
  therefore defeatable by a link click. Revisit CSRF on GETs first — the prune
  cron above is safe only because deleting a row nobody touched is not a
  security decision.
- **Cross-site mint guard.** `POST /session` rejects with 403 — no
  `Set-Cookie`, no DB write — when the request carries *positive evidence*
  of being cross-site: `Sec-Fetch-Site: cross-site`, or an `Origin` header
  present that differs from `WEB_ORIGIN` (checked only when `WEB_ORIGIN` is
  set). This closes the Lax cookie-overwrite identity wipe: a cross-site
  top-level form POST arrives cookieless under `SameSite=Lax`, would mint a
  fresh user, and its first-party `Set-Cookie` would overwrite the victim's
  identity — ADR-0003's named worst failure, inflictable by a link click.
  Requests lacking both headers (curl, tests, old clients) and
  `Sec-Fetch-Site: same-origin/same-site/none` are allowed — deny on
  evidence, never require proof — so non-browser clients keep working.

## Why not a signed stateless token

Every identity-bearing request already touches the database — streaks are
computed server-side (a project invariant), so statelessness buys nothing.
The opaque token plus table gives revocation (delete the row) and the
ADR-0009 merge remap (repoint `user_id`) for free, with no signing-secret
lifecycle to manage. A raw user id as the cookie value was also rejected:
forgeable and enumerable.

## Consequences

- One indexed lookup per authenticated request (primary-key hash lookup).
- The account-merge ticket must remap or delete the sessions of the losing
  account.
- **The mint endpoint is unauthenticated and unthrottled in M0.** A script
  can flood `users`/`sessions` with inert rows (non-browser clients send no
  `Sec-Fetch-Site`, so the cross-site guard intentionally does not close
  this). Accepted because flood-minted rows are unreferenced and harmless,
  and Vercel's platform firewall is the backstop. Revisit before public
  launch, at the first abuse signal, or alongside the first real
  rate-limiting need (ADR-0006 hint grants) — whichever comes first.
- Concurrent cookieless requests may each mint a user; the browser keeps the
  last `Set-Cookie` and the loser rows are unreferenced orphans. The hard
  guarantee is: same cookie → same user, always.
- **Consent columns are timestamp-only in M0, a narrowing of ADR-0012's
  "per-consent flag plus timestamp".** `users.recovery_consent_at` /
  `users.reminder_consent_at` carry NULL = not consented (reminders default
  off structurally) and a timestamp = consented at that moment; the flag is
  derivable, the timestamp is the evidence. What timestamp-only cannot
  represent is the *withdrawal* moment — withdrawing nulls the column and
  loses when it happened. The columns are unused until the email-attach
  ticket (ADR-0012 ties consent capture to attach), which adds the explicit
  per-consent flag — making withdrawal timestamps representable — if an
  audit trail is needed. Additive, cheap, and no data exists to migrate
  before then.
- **The origin guard fails open without `WEB_ORIGIN`.** When the env var is
  unset, the `Origin`-mismatch arm is disabled and only
  `Sec-Fetch-Site: cross-site` blocks — which pre-16.4 Safari never sends.
  In practice an unset prod value is self-announcing (no CORS grant, so the
  web bootstrap cannot work at all), and the route logs a loud error once
  per instance when `NODE_ENV=production` and `WEB_ORIGIN` is missing. A
  hard startup assertion was rejected because previews legitimately run
  without a `WEB_ORIGIN` grant.
- **Never host untrusted content on a `miolos.app` subdomain.** With
  `Domain=miolos.app`, any sibling subdomain can plant a `miolos_session`
  cookie (session fixation: the attacker mints a valid token via curl and
  fixes it onto victims, who then silently ride the attacker's identity).
  Same primitive as the accepted shared-Domain cookie-overwrite risk; the
  mitigation is operational — vendor/status/preview subdomains must never
  serve third-party-controlled content.
- **`COOKIE_DOMAIN` is set-once.** Toggling it after real cookies exist
  makes browsers hold both a host-only and a `Domain` cookie under the same
  name; the api resolves whichever the browser sends first and can never
  evict the other form — a sticky, browser-order-dependent identity. Set it
  before first production traffic and do not change it; if it ever must
  change, the resolve path has to expire the other variant explicitly.
