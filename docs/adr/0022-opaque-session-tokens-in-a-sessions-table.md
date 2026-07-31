# ADR-0022: Opaque session tokens in a `sessions` table

Status: Accepted
Date: 2026-07-31
Relates to: ADR-0003 (anonymous-first identity), ADR-0009 (account merge), ADR-0012 (minimal LGPD), ADR-0013 (canonical domain), ADR-0014 (data-access split)

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
  is bumped only when more than 1 hour stale (one conditional DB-side
  update), so hot paths stay write-free; a session is *stale* when
  `last_seen_at` is over 400 days old — a future prune cron may delete stale
  rows, not this ticket.
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
