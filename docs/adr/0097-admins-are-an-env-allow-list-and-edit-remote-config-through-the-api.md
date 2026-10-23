# ADR-0097 — Admins are an env allow-list of user ids and edit remote config through the API, one key at a time

**Status:** Accepted — 2026-10-13 (issue #304)
**Superseded in part by:** [ADR-0100](./0100-admins-and-superusers-are-attached-emails-in-admin-users.md) (#314) — decisions 1 and 2: admins and superusers are attached emails in `admin_users`, managed on `/admin`, and the state is a union on `role`. Decisions 3–5 stand.
**Amended by:** [ADR-0154](./0154-profanity-as-a-termo-guess-is-a-remote-config-switch-off-by-default.md) (#435) — decision 5 and the out-of-scope "non-numeric keys": a boolean key is a switch row.
**Depends on:** [ADR-0022](./0022-opaque-session-tokens-in-a-sessions-table.md), [ADR-0024](./0024-buffer-stores-validated-content-reads-strip-inside-the-wall.md)
**Amends:** [ADR-0025](./0025-remote-config-is-a-database-table.md) (the table now has a writer reached from a client, and invalid values fall back per key); [ADR-0048](./0048-the-streak-is-a-client-fetched-server-computed-value.md) (decision 3: a scoped exception for the admin-only state response)

## Context

Tuning a `remote_config` key meant an SQL session on the production database. Fernando wants to change the tunables from a page, without a deploy and without a database client. That needs an idea of who an admin is, and a write path from the browser to a table the web app must never name.

## Decision

1. **An admin is a user id listed in `ADMIN_USER_IDS`** on `apps/api` (comma-separated). `isAdmin` (`apps/api/src/admin/allow-list.ts`) reads it on every request; unset or empty admits nobody.
2. **`GET /admin/state`** answers `{ userId, config }` to any session: the effective config for an admin, `null` for everyone else. A non-admin learns only their own id, which is what they copy into the list.
3. **`POST /admin/config`** takes one `{ key, value }`, validated by `adminConfigWriteSchema` against that key's field in `remoteConfigSchema`, behind `writePreamble`, then `isAdmin`. It upserts through `setRemoteConfigValue` (`@miolos/db/publishing`) and answers the re-read state. It fails closed with 503 while `WEB_ORIGIN` is unset.
4. **`getRemoteConfig` falls back per key.** An invalid stored row yields that key's default and one `console.error` per key per process; the other keys keep their stored values.
5. **`/admin` on the web** is a noindex client page reached by URL only, with one row per key, its bounds read from the schema.

## Consequences

- Granting admin is an env change plus an `apps/api` deploy with a real diff (turbo-ignore). Merging the admin's account away drops admin.
- There is no audit log; `updated_at` is the record.
- A new numeric key appears on the page once it has a schema field and a label in `messages.admin.keys` (a missing label is a type error).
- **A scoped exception to ADR-0048 decision 3:** a new key is appended to the strict admin response instead of a new endpoint. It is admin-only, and the skew window ends when both apps redeploy from the same commit, which a `packages/core` change forces. During the window the page shows "failed", never wrong data.
- ADR-0025's "client-serving code sees config effects, never the table" narrows: an admin's browser sees config values through the API. `apps/web` still never names the table.

## Rejected

- **A `users.role` column.** A migration, a grant path and a role model for one member.
- **Writes from `apps/web` straight to the database.** It would put `/publishing` behind the db wall's back.

Out of scope: the hint allowance key (#304 PR 2), killing a daily from the page, an audit log, a read-only health view, remote feature flags, non-numeric keys, rate limiting.
