# ADR-0061 — "Seen the introduction" is a `users` timestamp, merged earliest-wins, never device storage

**Status:** Accepted — 2026-08-19 (issue #35, shipped in #150)
**Depends on:** [ADR-0003](./0003-anonymous-first-identity-with-email-recovery.md), [ADR-0022](./0022-opaque-session-tokens-in-a-sessions-table.md), [ADR-0048](./0048-the-streak-is-a-client-fetched-server-computed-value.md), [ADR-0049](./0049-account-merge-one-pure-function-one-idempotent-operation.md), [ADR-0050](./0050-email-attach-magic-link-tokens-consents-and-the-lgpd-minimum.md)

## Context

Issue #35's acceptance says the first-visit introduction shows once and
*"returning visitors never see it again (per identity, surviving
attach/merge)"*. The repo already ships this exact class of fact once —
`users.attach_prompt_dismissed_at` (#21, ADR-0050 decision 9) — but that
precedent is defective in the one respect the acceptance names:
`mergeAccounts` has no statement for it, so a dismissal is lost whenever the
dismissing account loses a merge ([#134](https://github.com/fernandolisboa/miolos/issues/134)).
The surface, copy and placement decisions are applications of settled law
(PRODUCT.md principle 4, ADR-0002, four shipped "after the game cards, never
a modal" comments) and live in plan 057, not here.

## Decision

1. **The fact is a nullable `timestamptz` column, `users.onboarding_seen_at`.**
   NULL = never acknowledged; a timestamp = the moment the introduction was
   acknowledged, and it never returns. A timestamp and not a boolean because
   that is the shipped idiom for once-per-account facts (`email_verified_at`,
   the consents, `attach_prompt_dismissed_at`; ADR-0022: *the flag is
   derivable, the timestamp is the evidence*), and because it makes the merge
   rule identical to every other merge rule in the codebase. A column and not
   a table because the fact is one bit per user forever: a table would owe a
   union statement, a tombstone delete (ADR-0049 decisions 4 and 6) and a
   join on every read, for nothing.

2. **`mergeAccounts` folds it onto the winner earliest-wins — statement 5d —
   and the same statement carries `attach_prompt_dismissed_at`, closing #134.**
   The shape is statement 5b's `least()` idiom as a self-join UPDATE, guarded
   `is not null` + strict `<` per column, OR-ed across the two columns, with
   `updated_at` set to DB-side `now()`. `least()` ignores NULLs, so either
   side suffices; both set keeps the earlier (the evidence property — nothing
   reads the value, both readers compare to NULL); a re-run matches zero rows
   (ADR-0049 decision 5's idempotence discipline). The loser's own values
   stay on the tombstone: they are not identity handles, so statement 6 never
   touches them. This is the first `users`-COLUMN merge duty and the first
   write of a WINNER's `updated_at` in the operation; ADR-0049 decision 6's
   "tables" names the seat, not the shape of the fact (annotated there).

3. **No device storage anywhere in the feature.** The fact is server-owned
   end to end: `GET /onboarding/state` serves one derived boolean (`show`),
   `POST /onboarding/seen` stamps once behind an `IS NULL` guard, and the
   timestamp never crosses the wire (ADR-0048 decision 3). A device store is
   per-device and survives neither cleared site data nor attach/merge — the
   two things the acceptance requires — and a hybrid local suppressor would
   be a second source of truth for one bit (ADR-0031's rejected list refuses
   the shape). The honest cost: a first visitor whose API call fails sees no
   introduction on that visit; it appears on the next one. That is the
   correct direction of failure — an unreachable server must never nag.

## Rejected

- **`localStorage` / a cookie / any hybrid** — fails "per identity, surviving
  attach/merge" by construction; the second-source-of-truth shape.
- **A `user_flags` or `onboarding_views` table** — three costs (union, delete,
  join), zero benefit for a one-bit-per-user fact.
- **A boolean column** — a fourth merge idiom (`OR`) for semantics the
  repo already merges three times as `least()` over timestamps.
- **A field appended to `GET /streak` or `/attach/state`** — forbidden by
  ADR-0048 decision 3: strict deployed schemas grow by NEW endpoints only.

## Consequences

- Migration `0006` is additive-nullable and reaches Neon before the branch's
  first push (ADR-0038 (h): any users column changes drizzle's INSERT column
  list for `mintSession`, and preview deploys share the production database).
- A player who dismissed the attach prompt no longer gets it back after
  losing a merge (#134 closed by decision 2's twin column).
- Nothing reads `onboarding_seen_at`'s value: two writers (the POST route,
  statement 5d), one reader (the GET route, comparing to NULL). A future
  consumer of the value re-opens the earliest-wins question before relying
  on it.
