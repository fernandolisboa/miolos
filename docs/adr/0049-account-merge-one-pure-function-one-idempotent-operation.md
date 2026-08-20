# ADR-0049 — Account merge: one pure function, one idempotent operation, tombstone by remap

**Status:** Accepted — 2026-08-13
**Depends on:** [ADR-0003](./0003-anonymous-first-identity-with-email-recovery.md), [ADR-0008](./0008-completion-and-streak-semantics-across-play-modes.md), [ADR-0009](./0009-account-merge-recomputes-from-the-union-of-completions.md), [ADR-0022](./0022-opaque-session-tokens-in-a-sessions-table.md), [ADR-0023](./0023-proved-not-sampled-property-testing.md), [ADR-0026](./0026-completions-are-write-once-rows-on-time-is-derived.md), [ADR-0048](./0048-the-streak-is-a-client-fetched-server-computed-value.md)
**Amends:** the merge-repoint consequence of
[ADR-0026](./0026-completions-are-write-once-rows-on-time-is-derived.md) —
*"The merge re-points with `ON CONFLICT (user_id, game, date) DO NOTHING`
**after ordering the source rows by `completed_at` ascending**, so the
surviving row is the earliest completion"* — whose sufficiency claim does not
hold: the ordered repoint ALONE does not deliver earliest-wins when the
winning account already holds a LATER row for the same key, and decision 2's
strictly-earlier DELETE completes it. Scope: only that sentence's "so";
its ordering prescription (ascending, `completed_at` copied) stands, and
every other decision below resolves a silence in ADR-0009/ADR-0026 (winner
selection, tombstone mechanism, played-row collisions) without contradicting
a recorded sentence. #58's queued amendments to both ADRs are untouched —
multiple `Amended by:` lines are additive.

## Context

ADR-0009 fixed the merge rule (union completions, earliest wins, recompute
everything derived, tombstone the loser) and ADR-0026 fixed its conflict
resolution in SQL, but four things stayed unrecorded: which account wins;
what "tombstone" mechanically is; what happens when the colliding rows
disagree on outcome (only Termo can lose); and how a multi-table operation
runs on a driver with no interactive transactions (`Db` is
neon-http | PGlite; neon-http cannot open one). Issue #20 builds the merge
ahead of its first caller (#21, the magic-link attach), so these become
schema-adjacent decisions that must be written down before live data meets
them.

## Decision

1. **Two layers, one semantics.** `mergeCompletions(canonical, other)` in
   `packages/core` is the union-earliest-dedupe as a pure function: rows in,
   merged rows out, no clock, no I/O, no flow variants — the attach flow,
   nightly consistency checks and support tooling all consume the same
   function, read-only callers included. `mergeAccounts(db, a, b)` on
   `@miolos/db/user` executes the same semantics in SQL and carries the
   identity work (sessions, tombstone). A PGlite agreement test pins that
   the two can never drift: the pure function's output over both accounts'
   fetched rows equals what the operation leaves on the winner.
2. **Earliest-wins is realized as two statements**, because
   `ON CONFLICT DO NOTHING` alone keeps the *winner's later* row when the
   loser holds an earlier one: (i) delete the winner's strictly-later
   duplicate wherever the loser's row for the same (game, date) is earlier
   (ADR-0009: "the other row is dropped"); (ii) repoint the loser's rows in
   ADR-0026's prescribed shape — ordered by `completed_at` ascending,
   `ON CONFLICT (user_id, game, date) DO NOTHING` — with `completed_at`
   COPIED, never re-stamped (re-stamping reclassifies on-time as late);
   then the loser's originals are deleted. Exact ties keep the winner's
   row; the pure function mirrors this as "the canonical argument wins
   ties". The dedupe key orders ROWS, not verbs: where the earlier
   colliding row is a lost Termo and the later an on-time win, the loss
   survives and the day stops counting — the write-once counterfactual
   (under ADR-0026 decision 1, the later win could never have been
   recorded on a single account), and the "cause" in #20's "never shrinks
   without cause". Statement (i) is the amendment the header records:
   ADR-0026's consequence claimed the ordered repoint alone makes the
   earliest row survive, which fails exactly when the winner already holds
   the later row — the prescription is kept, its sufficiency corrected.
3. **The winner is deterministic from the data:** older `created_at`, exact
   ties to the lower id, selected DB-side. Run it twice — or in either
   argument order — and the same account is canonical. ADR-0009's
   rejection of "richer account wins wholesale" is a data rule and stands:
   the winner's rows go through the same union as the loser's.
4. **Tombstone = remap + empty + retain.** Every loser session is
   REMAPPED to the winner (ADR-0022's "remap or delete" resolved: delete
   is forbidden — a deleted session makes the browser re-mint via
   `POST /session`, which is exactly the revived empty account ADR-0009
   forbids). The loser `users` row is emptied of every identity handle
   (`email`, `email_verified_at`, `apple_id`, `google_id` → null;
   `updated_at` set DB-side) and RETAINED forever: no code path mints a
   session against an existing user, so a session-less, handle-less row is
   permanently unresurrectable. Consent timestamps are not touched — they
   are LGPD evidence and their merge semantics belong to the attach ticket.
   No `merged_into` marker ships in v1: the remap alone discharges the
   cookie guarantee and the hottest auth path stays untouched; the revisit
   trigger is the first ticket that needs to distinguish a tombstone from
   a fresh anonymous row (nightly consistency checks or support tooling),
   which also inherits the `users`-INSERT column-list trap the migration
   would spring.
5. **No transaction — idempotence is the recovery.** neon-http has no
   interactive transactions (it does expose non-interactive `db.batch()`,
   but the PGlite driver in the union `Db` type has no `batch`, so no
   single code path over the union can use it — and the winner-select
   read must precede the writes anyway). The operation is therefore an
   ordered sequence of individually idempotent statements, sessions
   remapped FIRST (the cookie guarantee holds from the earliest moment
   and later-resolving writes already land on the winner), and the
   tombstone-emptying UPDATE guarded to match only a loser still holding
   an identity handle, so a re-run touches zero rows and never re-bumps
   `updated_at`. Every crash point is repaired by running the merge again
   with the same ids — ADR-0009's "run it twice, get the same account" is
   the integrity mechanism, pinned at the PGlite seam by a full-state
   double-run snapshot. Merging an account with itself is a no-op; an
   unknown id throws.
6. **Derived state is never copied; the merge returns history.** The
   merged account's streak is `computeStreak` over the merged rows
   (ADR-0048, unchanged); Dia Perfeito, distributions and rule-derived
   medals will be #29/#30's pure derivations over the same rows with zero
   merge changes. Lost and late rows survive the union — they are history
   (#29's fail row and calendar need them); exclusion is the derivations'
   job. `mergeAccounts` is the single place account-scoped tables acquire
   merge duties: #30 adds its curated-grants union-and-dedupe statement
   there; the loser's hint grants are DELETED, never carried to the
   winner — "emptied" means no row of any account-scoped table keeps
   referencing the tombstone, and grants are day-scoped convenience that
   expires structurally at the next rollover, not history (writer-less in
   v1; the rewarded-ad ticket inherits the decision point of whether
   same-day grants should instead be repointed). #58 needs no special
   case here: `on_time` is row data carried
   through the union, and its stored column, when it lands, joins the
   repoint statement's explicit column list.
   *Annotation (#35, ADR-0061):* #35 added the first `users`-COLUMN merge
   duty — statement 5d, folding `onboarding_seen_at` and
   `attach_prompt_dismissed_at` onto the winner earliest-wins (the latter
   closing [#134](https://github.com/fernandolisboa/miolos/issues/134));
   three columns as of #145, which folded `push_prompt_dismissed_at` in
   ([ADR-0064](./0064-streak-at-risk-is-a-derived-decision.md)).
   *Annotation (#58, [ADR-0066](./0066-a-late-sync-is-credited-from-a-server-seen-day.md)):*
   the "#58 needs no special case here" prediction held, and the seat was
   consumed exactly as reserved — the stored `on_time` joined the repoint
   statement's explicit column list (T-DB-S24), and `user_seen_days`
   acquired its merge duty here as statements 4b/4c: union onto the winner
   `ON CONFLICT DO NOTHING` (a date is the whole fact — no earliest-wins to
   arbitrate), then the loser's delete ("emptied" means EMPTIED). Both
   individually idempotent (T-DB-S74; T-DB-S20's double-run snapshot).
   The decision's "tables" names the seat, not the shape of the fact: the
   duty is still acquired in `mergeAccounts`, so nothing here goes false.

## Rejected

- **Deleting the loser's sessions or the loser row:** both paths end in a
  re-mint — the revived empty account, ADR-0009's named failure.
- **A `merged_into` pointer chased by `resolveSession`:** an extra hop on
  every authenticated request plus a hand-applied migration, buying
  nothing the remap doesn't already give the cookie guarantee.
- **Caller-assigned winner roles:** moves determinism to every future
  caller and invites "the device that clicked the link wins", which is not
  a function of the data.
- **A mode parameter (`attach` / `nightly` / `support`):** #20's AC 4
  names this the anti-goal; one function, no variants.
- **Filtering lost/late rows out of the union:** destroys #29's fail-row
  and calendar data; the merge is a history operation.
- **"A completion always beats a played row" in the dedupe:** would order
  the conflict by outcome before time, contradicting ADR-0026's fixed
  ordering and the write-once counterfactual; rejectable only by amending
  ADR-0026.

## Consequences

- #21 calls `mergeAccounts` from the magic-link route and owns everything
  HTTP: collision detection by email, uniqueness semantics, consents,
  transport. Until then the operation is production-dormant, tested
  machinery (the `grantHints` posture).
- The first UPDATE writer of `users` exists; the schema comment saying
  otherwise is corrected with this ADR.
- A request that resolved the loser's session before the remap can strand
  a row on the tombstone after the repoint; re-running the merge heals it,
  and permanent detection belongs to the nightly-check ticket.
- The merged streak can exceed either input's (fuller calendar — correct,
  not a bug, per ADR-0009) and can, in exactly one collision shape (an
  earlier lost Termo), read lower than one input's: decision 2's
  counterfactual, property- and unit-pinned.
- "Tombstone" enters CONTEXT.md as a durable term.
