# ADR-0100 — Admins and superusers are attached emails in `admin_users`

**Status:** Accepted — 2026-10-13 (issue #314)
**Depends on:** [ADR-0022](./0022-opaque-session-tokens-in-a-sessions-table.md), [ADR-0038](./0038-migrations-reach-neon-by-hand.md), [ADR-0050](./0050-email-attach-magic-link-tokens-consents-and-the-lgpd-minimum.md), [ADR-0089](./0089-sign-in-with-google-links-an-id-and-an-identified-account-wins-the-merge.md)
**Supersedes in part:** [ADR-0097](./0097-admins-are-an-env-allow-list-and-edit-remote-config-through-the-api.md) decisions 1 and 2 (the env allow-list of user ids, and the `{ userId, config }` state). Decisions 3–5 stand.
**Amends:** [ADR-0048](./0048-the-streak-is-a-client-fetched-server-computed-value.md) decision 3 — ADR-0097's in-place exception covered appended keys; it now also covers reshaping the strict admin state, on the same terms.

## Context

Granting admin meant copying a user id into `ADMIN_USER_IDS` and redeploying `apps/api`. Fernando wants to grant and revoke from `/admin`, with nothing in env, and to name people by the email they attach rather than by an opaque id.

## Decision

1. **A table, keyed by email.** `admin_users (email text primary key, role text, added_at)`, roles `superuser | admin`, the email lowercase by CHECK. No foreign key: merge and account deletion do not touch it. The committed migration only creates the table; the repo is public, so the first superusers are inserted by hand (ADR-0038 (h)).
2. **The role is read per request.** `adminRoleOf` joins the session's user to `admin_users` on `users.email`, only when `email_verified_at` is set. Detaching the email or removing the row revokes on the next request.
3. **`GET /admin/state` is a union on `role`:** `none` with the attached email or `null`; `admin` with the config; `superuser` with the config and every member.
4. **`POST` and `DELETE /admin/members`**, superuser only, upsert `{ email, role }` and remove `{ email }`, behind `writePreamble`, answering the re-read state. Admins edit config only.
5. **The last superuser is kept by one locking statement.** Each write (`upsertAdminMember`, `removeAdminMember`) opens with `superusers as (select … where role = 'superuser' for update)` and refuses, in the same statement, when its target is the only superuser and the write demotes or deletes it; the route answers 409 `last-superuser`. Under READ COMMITTED a second writer blocks on the first one's row locks, then re-checks each locked row against `role = 'superuser'` and drops the rows the first one demoted or deleted, so it counts the superusers that are left. A read-then-write check would let two concurrent demotions each see two superusers and leave none. A superuser added concurrently may be missed, which only refuses a write that could have passed.
6. **Each successful member write is logged** with the actor's id and the target email: the log is the only record of who granted what.

## Consequences

- A mistyped superuser email hands the whole admin plane to whoever owns that address, bounded only by the guard; "bounded by the config schema" holds for admins only.
- An added email grants the role to whoever later verifies that address. There is no invite.
- Google sign-in keeps only `sub` (ADR-0089 decision 1), so a Google-only account is never a member; a Gmail row counts once that address is attached in Ajustes.
- The guard counts rows, not reachable accounts. If every superuser's email becomes unreachable, recovery is SQL.
- One email maps to one account (ADR-0050). Deleting an account leaves its staff row, inert until someone verifies that email again.
- Skew: until both apps redeploy from one commit, `/admin` shows "unavailable", never wrong data.

## Rejected

- **Any env list** — a deploy per grant. **`users.role`** — merge would have to carry it. **Rows keyed by user id** — ids are opaque, and an account merge strands them. **Admins managing members.** **A read-then-write guard** (decision 5). **Seeding in the committed migration** — it would publish the emails.

Out of scope: per-player settings (#300), invite email, an audit table, rate limiting, roles beyond these two.
