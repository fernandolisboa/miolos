# Implementation plan — Issue #20: Account-merge recompute

**Issue:** [#20](https://github.com/fernandolisboa/miolos/issues/20) — M1's last ticket. Unblocked; blocks [#21](https://github.com/fernandolisboa/miolos/issues/21) (email attach), which owns the HTTP seam.
**Governing ADRs:** [ADR-0009](../adr/0009-account-merge-recomputes-from-the-union-of-completions.md) (the merge rule: union, earliest wins, recompute, tombstone), [ADR-0026](../adr/0026-completions-are-write-once-rows-on-time-is-derived.md) (the fixed conflict resolution and the write-once PK), [ADR-0022](../adr/0022-opaque-session-tokens-in-a-sessions-table.md) (the cookie→identity mechanism the tombstone operates on), [ADR-0048](../adr/0048-the-streak-is-a-client-fetched-server-computed-value.md) (`computeStreak` is reused unchanged), [ADR-0008](../adr/0008-completion-and-streak-semantics-across-play-modes.md) (the three verbs), [ADR-0023](../adr/0023-proved-not-sampled-property-testing.md) (property run counts), [ADR-0003](../adr/0003-anonymous-first-identity-with-email-recovery.md) (why the collision exists at all).
**Proposed ADR:** ADR-0049 — full draft in Appendix A, created as a real file at implementation time. It **amends nothing** (§3 D14): #58 is already queued to amend ADR-0009 and ADR-0026, and this ticket must not collide with that.
**Snapshot:** written against `main` at `616c35b`. Point-in-time; where a later ADR disagrees, the ADR wins.

The hard part of this ticket is not the union-earliest-dedupe — that is a ~30-line pure function. The hard parts are (a) making acceptance criterion 3 *observable* — "the losing account's cookie resolves to the merged identity" is a claim about `sessions` rows that `packages/core` cannot even see — and (b) executing a multi-table operation on a driver that has **no interactive transactions** (`apps/api/src/session/service.ts:56-57` records this for `mintSession`). §3 D1 settles the seam split; D7 turns the missing transaction into the design: the operation's idempotence *is* its crash recovery, which is exactly ADR-0009's "run it twice, get the same account" made operational.

---

## Table of contents

- §0. Acceptance criteria → plan mapping
- §1. Scope boundary
- §2. Read first
- §3. Fixed decisions (D1–D16)
- §4. What already exists — the seams, verified
- §5. `packages/core` — `mergeCompletions`, the pure function
- §6. `packages/db` — `mergeAccounts`, the reader, and the tripwire
- §7. `apps/api` — the AC-3 seam test (no production change)
- §8. Gates and rituals
- §9. Test plan and reserved ids
- §10. What cannot be verified in this environment
- §11. What is deliberately NOT in this slice
- §12. Deviation / risk register
- §13. Commit and PR plan
- §14. Exit criteria
- Appendix A. Draft ADR-0049

---

## 0. Acceptance criteria → plan mapping

| AC | Claim | Where the plan discharges it |
|---|---|---|
| 1 | Property tests prove: idempotent (merging twice = merging once), deterministic, union-earliest-dedupe, no real completion ever lost | §5 + §9: T-CORE-S42 (determinism, permutation invariance), T-CORE-S43 (union-earliest-dedupe; every surviving row is reference-identical to an input row; every (game, date) key survives), T-CORE-S44 (pure-level idempotence), all fast-check at `numRuns: 100` (ADR-0023 floor). Operation-level idempotence — ADR-0009's "run it twice, get the same account" — is T-DB-S20 at the PGlite seam (§3 D10). "No real completion ever lost" is stated honestly: the colliding duplicate for a (game, date) both accounts hold **is dropped by design** ("the earliest completion wins and the other row is dropped", ADR-0009); what is never lost is the *key* (every puzzle either account completed stays completed) and the *rows* (every survivor is an untouched input row — lost and late rows included, because #29's fail row and time stats need them) |
| 2 | The merged streak never shrinks below what either input's completion history supports without cause | §3 D11: T-CORE-S45 proves `streak(merged) ≥ max(streak(a), streak(b))` (same `today`) whenever the two inputs' (game, date) keys are disjoint — the two-devices-different-days case ADR-0009's consequence describes — via counted-day-set union equality; T-CORE-S46 proves the merge never *invents* a day (general inputs). The one "with cause" case — a cross-account collision where the **earlier** row is a lost Termo and the later a won one — is pinned by name as unit T-CORE-S39, because it is the write-once counterfactual (ADR-0026 decision 1: had both plays happened on one account, the 15:00 win could never have been written after the 10:00 loss closed the daily), not a bug. Surfaced to Fernando in the PR (§13) |
| 3 | Tombstone semantics defined and tested: the losing account's cookie resolves to the merged identity | §3 D9 defines the semantics (remap sessions, never delete; empty and retain the loser row; no marker column, no migration); T-DB-S18/S19 test them at the PGlite seam; **T-API-S54 tests the AC's own sentence** at the seam that can actually observe cookie→identity: a real hashed-token session for the loser, `mergeAccounts`, then `requireUserId(db, loserToken)` returns the winner and `GET /streak` under the loser's cookie serves the **merged** streak |
| 4 | The same function is reusable by the attach flow, nightly consistency checks, and support tooling — no flow-specific variants | §3 D2/D4: one exported `mergeCompletions`, no mode parameter, no I/O, no clock, no db handle — it consumes already-fetched rows and returns data, exactly like `computeStreak` (`packages/core/src/streak.ts:75-78`). Read-only reuse (what a nightly check or a support preview needs) is *demonstrated*, not asserted: T-DB-S22 uses it read-only against fetched rows to predict what the db operation must produce, and the two must agree. The attach flow's consumption is demonstrated by T-API-S54 driving `mergeAccounts` exactly as #21 will |

The issue body's "union both accounts' completion rows, dedupe per (canonical user, puzzle) keeping the earliest, recompute everything derived (streak, stats, rule-derived medals), union-and-dedupe curated medal grants" names two things that do not exist (stats — #29; medals and curated grants — #30, both M3). §3 D4/D5 make "recompute everything derived" mean something true today and binding tomorrow, and name what #29/#30 owe.

---

## 1. Scope boundary

**In scope**

- `mergeCompletions` in a new `packages/core/src/merge.ts` with the `MergeableCompletion` row type, exported from the barrel; unit and fast-check property tests (§5, §9). No new dependency: `fast-check@4.9.0` is already a `packages/core` devDep (shipped by #19).
- `mergeAccounts` and `listCompletionsForMerge` in a new `packages/db/src/merge.ts`, exported via `@miolos/db/user`, with the `T-DB-9e` export tripwire widened **in the same commit** (`packages/db/test/user.test.ts:100-111` — "widening this surface fails the suite" is that file's own contract) (§6).
- The AC-3 test at the `apps/api` seam — a **test file only**; zero production `apps/api` diff (§7).
- ADR-0049 as a real file (Appendix A); a **Tombstone** row in `CONTEXT.md`; the `packages/db/src/schema.ts:47-49` comment ("the first writer is the email-attach ticket") corrected to name the merge operation; `docs/agents/test-ids.md` frontier re-derived at step 8.
- This plan file and its `docs/README.md` row (added with this document).

**Out of scope** — §11 carries the full list with reasons and destinations. Headlines: the magic-link/attach HTTP seam, email uniqueness semantics and consent capture (**#21**); stats and Dia Perfeito (**#29**); medals and the curated-grants table with its union-on-merge (**#30**); the stored `on_time` column and its ADR amendments (**#58**, decided 2026-08-02, not implemented — handoff 028 §1: "do not implement it as a rider on another ticket"); the server day-truth payload (**#83**).

**Not touched at all:** `apps/web` (zero diff of any kind — no UI, no client module, no wall change), `packages/games`, `packages/ui`, `packages/db/src/schema.ts` **except the one comment** (no column, no table, no index — §3 D9's no-migration decision), `packages/db/migrations/` (no `0004`; `git diff --exit-code origin/main...HEAD -- packages/db/migrations` is step-8 evidence), `apps/api` production code (`app/`, `src/`), every existing contract in `packages/core/src/contracts/`, `eslint.config.mjs`. A diff in any of these at step 6 is a finding by itself.

---

## 2. Read first (in this order)

1. `CLAUDE.md` — verification gates, evidence rule, project invariants.
2. ADR-0009 and ADR-0026 — the merge rule and its **fixed** conflict resolution ("re-points with `ON CONFLICT (user_id, game, date) DO NOTHING` after ordering the source rows by `completed_at` ascending … Any other order silently violates both ADRs", ADR-0026 consequences). ADR-0022's consequence: "The account-merge ticket must remap or delete the sessions of the losing account" — this plan chooses **remap** and argues delete is forbidden (§3 D9).
3. Issue [#58](https://github.com/fernandolisboa/miolos/issues/58) and Fernando's 2026-08-02 decision — binding *forward-compat* context (§3 D13), **not** #20 scope. Its own words: "Account merge already unions completions (ADR-0009) and **needs no special case**."
4. `CONTEXT.md` — this plan uses its verbs exactly: **Completion (on time)**, **Late completion**, **Played**, **Streak / Sequência**, **Merge** (`CONTEXT.md:21` — "union of completions, dedupe per puzzle keeping the earliest, everything derived recomputed").
5. `packages/core/src/streak.ts` — the register the new module imitates (header discipline, `readonly` interfaces, no clock, no I/O; "the account merge, nightly checks and support tooling reuse it unchanged").
6. `packages/db/src/completions.ts` and `packages/db/src/schema.ts:127-240` — the row shape, `onTimeSql()`, the merge-duty comment at `:151-155`, and the write-once machinery the merge must not violate in spirit.
7. `apps/api/src/session/service.ts` — the entire cookie→identity path (one SELECT on `sessions.token_hash`), and the `mintSession` comment recording that neon-http has no interactive transactions.
8. `packages/core/test/streak.test.ts` and `streak-properties.test.ts` — the exact test-file shapes to imitate (builders, `numRuns: 100`, domain-shaped generators).

---

## 3. Fixed decisions

Settled here so step 5 implements rather than re-litigates. Each resolves one or more of the open questions the step-1 exploration surfaced. D8 (winner rule), D9 (no audit column) and D11's carve-out case are product-visible; Fernando can override any of them in the PR without blocking.

### D1 — #20 ships two layers: the pure function in `packages/core` AND the executable operation in `packages/db`; #21 wires the HTTP seam

The evidence cuts both ways and is resolved here, not dodged. *For pure-core-only:* the issue title ("in `packages/core`"), the spec's seam table (merge at seam 2), ADR-0009's "pure function … merge is just one caller". *Against:* AC 3 is a sentence about `sessions` and `users` — tables `packages/core` cannot import (`tsconfig` `types: []`, dependencies = zod only), cannot see, and cannot test; ADR-0026's consequence prescribes the merge's **SQL**; ADR-0022's consequence assigns "the account-merge ticket" the session remap.

**Decision:** #20 ships (a) `mergeCompletions` — the union-earliest-dedupe as a pure, role-free, property-tested function (seam 2), and (b) `mergeAccounts` — the transaction-shaped db operation on `@miolos/db/user` that executes the same semantics in SQL and carries the tombstone (seam: PGlite). AC 3 is then testable where it is observable: the db seam for the row operations, plus one `apps/api` test driving the real `requireUserId`/`GET /streak` (§7). #21 consumes `mergeAccounts` from its magic-link route and owns everything HTTP: collision detection by email, transport, consents, uniqueness semantics (`schema.ts:31-33` explicitly defers "uniqueness semantics … with the attach/merge ticket" — deferred *again*, to #21, because uniqueness is meaningless before an email writer exists).

An alternative reading — tombstone lands in `apps/api` with #21 — was rejected because it would ship #20 with AC 3 untestable (nothing in #20's scope could observe a cookie) and would split "tombstone semantics defined and tested" from the operation that creates tombstones.

### D2 — `mergeCompletions(canonical, other)`: role-free data in, merged rows out; concrete row type, carried by reference; first-argument tie rule

```ts
export function mergeCompletions(
  canonical: readonly MergeableCompletion[],
  other: readonly MergeableCompletion[],
): MergeableCompletion[];
```

- **Consumes already-fetched rows, returns data** — the `computeStreak` shape. No db handle, no clock, no I/O, no Zod (pure arithmetic over an already-typed shape; validation belongs to the boundaries that produce rows). This is what makes AC 4's three callers real: an attach flow, a nightly check and a support tool run in different processes with different transaction boundaries, and a read-only caller (nightly, support preview) must be able to ask "what *would* the merged history be" without a write path.
- **No roles beyond the tie rule.** Union-earliest-dedupe is symmetric except for exact ordering-key ties; the parameter names encode the one asymmetry: on an exact tie, the `canonical` side's row survives. This mirrors the db operation, where the winner's existing row survives a tie (D6's strict inequality), so callers pass the winner's rows first. Winner *selection* is not this function's job (D8) — a pure function choosing winners would need `created_at`, dragging identity data into a row-arithmetic module.
- **Concrete signature — no generic.** An earlier draft made this `<T extends MergeableCompletion>` "for #29's future stat fields"; that consumer does not exist, which makes the type parameter dead API surface — exactly the pattern handoff 028 §2 flags as a HIGH finding (the `useStreak` `enabled`/`refreshKey` precedent), so it is cut here. What the #58 forward-compat actually needs is already delivered without it: survivors are returned **by reference** (§5 step 4), so `onTime` is row data carried through the union unchanged, never recomputed, never special-cased (D13). When a future ticket brings a *real* caller with wider rows, widening the signature then is non-breaking under structural typing.
- **No filtering.** Lost and late rows are history — #29's fail row and time statistics need them — and the merge is a history union, not a streak. `computeStreak` is the only filter (ADR-0048's own design, plan 027 D3).
- **Two-account, per ADR-0009.** A third device merges by repeated application, which idempotence makes well-defined (T-CORE-S44 pins re-merge stability). Associativity across three inputs is **not claimed** — exact-tie resolution makes it unprovable in general, and nothing on record needs it.

### D3 — The row type carries an opaque ordering key; `completedAt` stays hidden; the #18 tension is documented, not reopened

"Earliest wins" needs a total order that `CompletionRecord` deliberately hides — "`completedAt` is deliberately absent … exposing it invites JS timezone arithmetic" (`packages/db/src/completions.ts:29-30`, #18's closed decision). The alternatives: let the DB do dedupe entirely and have core prove semantics only abstractly (rejected: then no caller could *compute* a merged history read-only, gutting AC 4), or expose the raw instant (rejected: reopens #18).

**Decision:** a new merge-only row type whose ordering key is **opaque and compared, never parsed**:

```ts
export interface MergeableCompletion {
  readonly game: Game;
  readonly date: string; // 'YYYY-MM-DD', the puzzle's own SP day
  readonly outcome: CompletionOutcome;
  readonly onTime: boolean; // row data, carried unchanged (#58's decided direction)
  /**
   * Opaque, totally ordered, fixed-width key supplied by the row's producer —
   * today the DB projects a fixed-width UTC instant string (§6). Core compares
   * it lexicographically and NEVER parses it: no timestamp arithmetic, no
   * timezone, no Date enters this module (the #18 discipline, kept).
   */
  readonly completedAtOrder: string;
}
```

The key is produced in SQL (`to_char(completed_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')` — fixed width, so lexicographic order *is* chronological order), which keeps ADR-0026's "no JavaScript timezone arithmetic exists anywhere on this path" literally true: the only JS operation on the key is `<`. `CompletionRecord` is untouched; the streak path is untouched. `MergeableCompletion` structurally extends `StreakRow` (`{date, outcome, onTime}` plus two fields), so `computeStreak(mergedRows, today)` typechecks directly — one row fetch serves both the merge and the recompute.

### D4 — "Recompute everything derived" means: derived values are never copied; the merged account's derived state is whatever the pure derivations produce over the merged rows

Stats and medals do not exist (verified: no medals table, no stats module, no Dia Perfeito function anywhere — grep; they are #29's and #30's, both M3). Building them here would duplicate two tickets' ACs; pretending to "recompute" them would be a vacuous claim.

**Decision:** the merge returns the merged **history**; derivation is the existing pure functions' job. Today that is `computeStreak(mergeCompletions(w, l), today)` — proved at T-CORE-S45/S46 and observed end-to-end at T-API-S54 (the merged streak served by the real route). The extension point is named in `merge.ts`'s header and in ADR-0049: **when #29 (Dia Perfeito, distributions, time stats) and #30 (rule-derived medals) land their derivations as pure functions over completion rows — which their own ACs require — they run over `mergeCompletions`' output with zero merge changes.** What #29/#30 owe the merge: nothing but purity. What the merge owes them: it already delivers it — lost rows survive the union (the fail row's data), late rows survive (shown-distinctly calendar data), `guesses` rides the db operation's column list (§6).

### D5 — Curated medal grants: #30's obligation, with its seat at the table reserved by name

No grant table exists, and #30's own AC already says "curated grants are explicit rows **that survive merge by union-and-dedupe**". **Decision:** #20 builds nothing for them; `mergeAccounts` is documented (header comment + ADR-0049 consequence) as **the single place account-scoped tables acquire merge duties** — #30 adds its curated-grants union statement inside `mergeAccounts` with its own tests, exactly as it adds the table. A merge-time TODO that named a nonexistent table was considered and dropped: a comment is not a seam, and the ADR consequence is the durable pointer.

### D6 — The db operation realizes ADR-0026's fixed resolution as two statements, because `ON CONFLICT DO NOTHING` alone cannot make the earliest win

The tension, stated: ADR-0026's consequence compresses the mechanism into one sentence ("re-points with `ON CONFLICT … DO NOTHING` after ordering the source rows by `completed_at` ascending, so the surviving row is the earliest"). Taken literally as a single repoint, that sentence cannot deliver its own promise: when the **winner already holds a later row** for the same (game, date), inserting the loser's earlier row hits the conflict and `DO NOTHING` keeps the *later* row — violating ADR-0009's "the earliest completion wins" in exactly the case both ADRs care about. And within a single source account the `ORDER BY` is inert anyway, since the PK makes per-account keys unique.

**Decision:** the earliest-wins semantics both ADRs fix are realized as:

```sql
-- (i) Drop the winner's STRICTLY-LATER duplicate wherever the loser holds
--     an earlier row for the same puzzle (ADR-0009: "the other row is
--     dropped"). Strict <, so an exact tie keeps the winner's row — the
--     pure function's first-argument tie rule (D2).
DELETE FROM completions w
  USING completions l
  WHERE w.user_id = $winner AND l.user_id = $loser
    AND w.game = l.game AND w.date = l.date
    AND l.completed_at < w.completed_at;

-- (ii) Repoint the loser's rows, ADR-0026's prescribed shape verbatim:
--      ordered by completed_at ascending, ON CONFLICT DO NOTHING.
--      completed_at is COPIED, never defaultNow(): re-stamping would
--      reclassify an on-time completion as late — recordCompletion's own
--      warning (completions.ts:118-121), at merge scale.
INSERT INTO completions
  (user_id, game, date, completed_at, outcome, elapsed_ms, hints_used, guesses)
SELECT $winner, game, date, completed_at, outcome, elapsed_ms, hints_used, guesses
  FROM completions WHERE user_id = $loser
  ORDER BY completed_at ASC
ON CONFLICT (user_id, game, date) DO NOTHING;

-- (iii) The loser's originals go, now that every key survives on the winner.
DELETE FROM completions WHERE user_id = $loser;
```

After (i), the only remaining conflicts in (ii) are keys where the winner's row is the earliest (or ties), so `DO NOTHING` keeps exactly the row ADR-0009 names. Statement (ii) keeps the prescribed `ORDER BY` even though it is inert for a single source: it is the recorded shape, it costs nothing, and it stays correct if a future n-source variant ever feeds this statement. This reading is recorded in ADR-0049 so ADR-0026's sentence and the two-statement realization can never be played against each other in review. **The column list in (ii) is exhaustive over today's schema and carries a breadcrumb comment: #58's stored `on_time`, when it lands, joins this list** (and T-DB-S22's late-row fixtures would catch its omission — §9).

The write-once rule is not violated in spirit: ADR-0009 *is* the sanctioned exception ("the other row is dropped"), and the counterfactual holds — the merged table ends exactly as if all play had happened on one account under write-once from the start (D11's carve-out is this counterfactual biting).

### D7 — No transaction: an idempotent, ordered statement sequence, sessions first; re-running the merge is the recovery mechanism

`Db` is the union `NeonHttpDatabase | PgliteDatabase` (`packages/db/src/client.ts:26`), and neon-http has **no interactive transactions** — `mintSession`'s own comment accepts a two-statement crash window for exactly this reason (`service.ts:54-57`). Stated precisely rather than overstated: drizzle 0.45.2's neon-http driver *does* expose non-interactive `db.batch()` (`neon-http/session.js:117-132`, routed through `client.transaction()`); only interactive `transaction()` throws. `batch` is still unusable here for two real reasons: the PGlite driver in the union `Db` type has no `batch`, so no single code path over the union can call it; and the winner-select read (D8) must precede the writes, which a one-shot batch cannot express. So the design cannot lean on a transaction, and does not try to.

**Decision:** `mergeAccounts` runs this sequence, every statement individually idempotent:

0. *(read)* Validate both users exist; pick the winner DB-side (D8). `a === b` → return without touching anything.
1. `UPDATE sessions SET user_id = $winner WHERE user_id = $loser` — the remap **first**: AC 3's property holds from the earliest possible moment, and every request that resolves its cookie after this statement already writes to the winner, shrinking the stranded-row race (§12 risk 5) to requests already in flight.
2. Statement (i) of D6 — drop the winner's strictly-later duplicates.
3. Statement (ii) — repoint, ordered, conflict-do-nothing.
4. Statement (iii) — delete the loser's completion rows.
5. `UPDATE users SET email = null, email_verified_at = null, apple_id = null, google_id = null, updated_at = now() WHERE id = $loser AND (email IS NOT NULL OR email_verified_at IS NOT NULL OR apple_id IS NOT NULL OR google_id IS NOT NULL)` — empty the shell (D9). `updated_at` set explicitly to DB-side `now()`, per the schema's own instruction (`schema.ts:47-49`). **The identity-handle guard is what makes this statement individually idempotent like the other four:** an unguarded `WHERE id = $loser` matches the loser row on every run and bumps `updated_at` again, falsifying "every statement individually idempotent" and failing T-DB-S20's full-state double-run snapshot; with the guard, a re-run finds every handle already null and touches zero rows. Corollary, stated where T-DB-S19 pins it (§9): an all-null anonymous loser — the only kind that exists before #21 writes an email — never matches the guard, so its `updated_at` never bumps at all.

Crash analysis, per gap: after 1 — the cookie already resolves to the winner; all data still on the loser; re-run completes. After 2 — the winner lost its later duplicates, but the loser still holds the earlier rows for those exact keys; re-run repoints them; no key is ever without a row on *some* account. After 3 — rows exist on both; re-run's step 2 deletes nothing (equal `completed_at` is not strictly less), step 3 all-conflicts, step 4 cleans up. After 4 — only the tombstone-emptying remains. Every intermediate state is repaired by calling `mergeAccounts` again with the same two ids — which is also T-DB-S20's operation-level idempotence proof. **ADR-0009's "run it twice, get the same account" is therefore not just a test; it is the integrity mechanism.** No JS `Date` appears in any statement (the file-header rule of `completions.ts` carries over): every timestamp the operation touches is copied column data or DB-side `now()`.

### D8 — The winner is chosen DB-side and deterministically: older `created_at`, ties broken by lower `id`

AC 1 demands determinism, and ADR-0009's "run it twice, get the same account" demands the *same canonical id* both times — so the winner must be a function of the inputs, not of call order or of which device clicked the magic link. Letting the caller assign roles was rejected: it moves the determinism obligation to every future caller and invites #21 to encode "the account the link was clicked from", which is not derivable from the data.

**Decision:** inside `mergeAccounts`, `SELECT id FROM users WHERE id IN ($a, $b) ORDER BY created_at ASC, id ASC LIMIT 1` — the older account wins; an exact-timestamp tie falls to the lexicographically lower uuid. DB-side, so no JS `Date` comparison enters `packages/db`. Rationale for *older*: the longer-lived id is the one more likely referenced anywhere else, and the rule is stable under re-runs by construction. Note ADR-0009's rejection of "richer account wins wholesale" is a **data** rule (completions must union, not transfer wholesale) and is untouched by any winner-selection rule — the winner's *id* survives; the winner's *data* still goes through the same union as the loser's. T-DB-S21 proves argument-order invariance. `mergeAccounts` returns `{ winnerId, loserId }` so #21 can point the fresh magic-link session and its response at the canonical id. Fernando can swap the rule (e.g. "the account holding the verified email wins" once #21 exists) in the PR without blocking; the tests parameterize on the returned roles.

### D9 — Tombstone semantics: sessions remapped (never deleted); the loser row emptied of identity handles and retained forever; no marker column, no migration

The report's four options weighed: **(A)** sessions repoint only; **(B)** a `merged_into` column + `resolveSession` hop; **(C)** both; **(D)** definitional only. **Decision: (A) plus emptying — and never deleting the loser row.** The semantics, as ADR-0049 records them:

1. **Every session of the loser is repointed to the winner.** The cookie→identity mapping is one SELECT on `sessions.token_hash` (`service.ts:34-38`) and nothing else in the system translates a cookie into a user — so after the remap, the old anonymous cookie resolves to the merged identity through the only mechanism that exists, and continues to: nothing ever re-points sessions except a merge, and `mintSession` only ever creates *new* users (`service.ts:66-72`). ADR-0022 offered "remap **or delete**"; delete is rejected outright, because a deleted session makes the browser cookieless-equivalent, `SessionBootstrap` re-mints via `POST /session`, and the browser now holds a fresh empty identity — **precisely the "revived empty account" ADR-0009 forbids.** `sessions_user_id_idx` (`schema.ts:70`) covers the remap scan.
2. **The loser `users` row is emptied and retained.** Emptied: zero completions (moved), zero sessions (moved), and all four identity handles nulled — `email`, `email_verified_at`, `apple_id`, `google_id` — so **no identity handle, current or future, can ever resolve to a tombstone** (a retained email would make every later magic-link lookup for that address find the shell forever). All four are nullable; the social ids have no writer today, so nulling them is a provably inert statement that fixes the invariant now rather than in the social-login ticket. Consent timestamps are deliberately **not** touched: they are LGPD evidence with no writer until #21, and consent semantics at merge are #21's (surfaced in the PR). Retained: deleting the row would cascade nothing *after* the remap, but retention is what makes "can never resurrect" structural — no code path mints a session against an existing user, so a session-less, handle-less row is permanently unreachable.
3. **"Forever", honestly bounded:** the cookie maps to the merged identity for as long as its session row lives (sliding 400-day lifetime, no prune exists). If a future prune ever deletes a stale remapped session, that browser re-mints a *genuinely new* account — the same outcome as any expired visitor, and not a revival: the loser identity itself can never be re-issued.

**(B)/(C) — the `merged_into` audit column — is deliberately deferred, with its cost stated:** it needs migration `0004` hand-applied to Neon via `DATABASE_URL_UNPOOLED`, and adding *any* column to the `users` pgTable changes the INSERT column list drizzle emits for **every** writer — `mintSession`'s `insert(users).values({})` included — so a deploy preceding the apply 500s `POST /session` (the ADR-0038 (h) trap, `schema.ts:205-210`, measured against drizzle-orm 0.45.2). That operational risk buys nothing AC 3 needs: the remap alone discharges the cookie claim, and `resolveSession` — the hottest authenticated path — stays byte-identical. What the column *would* buy is auditability (a shell distinguishable from a fresh anonymous user) for support tooling and the nightly consistency check; the revisit trigger is **the ticket that builds either of those**, named in ADR-0049. Non-blocking Fernando override: if he wants the marker now, §12 risk 4 pre-plans it.

### D10 — Idempotence is proved at both levels, because the AC and the ADR mean different things by it

The AC's "merging twice = merging once" is pure-level: `mergeCompletions(mergeCompletions(a, b), b)` deep-equals `mergeCompletions(a, b)` — fast-check, T-CORE-S44 (also `merge(m, [])` and `merge(m, m)` fixed points). ADR-0009's "run it twice, get the same account" is operation-level: calling `mergeAccounts(db, a, b)` a second time changes **nothing** — T-DB-S20 snapshots the full `users` + `sessions` + `completions` state after the first run and deep-equals it after the second, `users.updated_at` included (D7 step 5's identity-handle guard is what makes the second run touch zero rows there). D7 makes the second one load-bearing (it is the crash-recovery property). `mergeAccounts(db, a, a)` is a documented no-op returning `{ winnerId: a, loserId: a }`; an unknown id throws (T-DB-S23) — a merge against a typo must be loud, not creative.

### D11 — AC 2's testable statements, including the honest carve-out

The positive half is ADR-0009's own consequence ("the merged account may end up with a *longer* streak … correct, not a bug"). The negative half becomes:

- **T-CORE-S45 (property):** for inputs with **disjoint (game, date) keys** — generated by partitioning the games between the two inputs over one shared date window, the "two devices, fuller calendar" shape — every row survives, so `countedDays(merged) = countedDays(a) ∪ countedDays(b)`, and therefore `streak(merged) ≥ max(streak(a), streak(b))` for the same `today`, with strict growth exercised by the interleaved calendars.
- **T-CORE-S46 (property, general inputs):** the merge never invents a day — every surviving row is an input row, so `countedDays(merged) ⊆ countedDays(a) ∪ countedDays(b)`.
- **T-CORE-S39 (unit, the "with cause" case, by name):** both accounts hold a Termo row for day *d*; the **earlier** is a loss (10:00), the later an on-time win (15:00). Earliest-wins keeps the loss; day *d* stops counting; the merged streak can read *lower* than the win-holding input's. This is not a defect and not discretion: the loss row participates in dedupe because the PK dedupes rows, not verbs (ADR-0026's fixed resolution orders by `completed_at` with no outcome filter), and the result is exactly the one-account counterfactual — under write-once, the 15:00 win could never have been recorded after the 10:00 loss closed the daily ("a loss followed by an archive replay does not reopen the daily", ADR-0008 via ADR-0026's context). AC 2's "without cause" is this cause. Only Termo can produce it (only Termo loses). Recorded in ADR-0049 and surfaced to Fernando in the PR as a named product fact, non-blocking.

An unconditional `merged ≥ max` was rejected as a claim because T-CORE-S39's case falsifies it — a property test would have found the falsification at run one, which is the point of writing properties before code.

### D12 — `hint_grants` are not carried, and why that is safe rather than lazy

No writer exists (`grantHints` is dormant, caller-free — its own header), so **no grant row can exist at merge time in v1: the question is structurally moot today.** Defined anyway so nobody wonders later: grants are day-scoped convenience, not history — the day key *is* the expiry (`schema.ts:242-258`), reads are by the resolved user id (which after the merge is the winner), and a stray grant left on the tombstone is unreadable and expires at the next rollover. Worst imaginable future cost: the rest of one day's extra hints. If the rewarded-ad ticket lands before this posture is revisited, that ticket decides whether a merge repoints same-day grants; `mergeAccounts`' header names it beside #30's seat (D5).

### D13 — #58 forward-compat: consumed, not implemented

Three obligations, all discharged by construction: `onTime` is row data the pure function carries through the union unchanged (by-reference survivors, D2 — no recompute, no timestamp consulted, no "user was online" record consulted); the merge takes **no special case** for late-sync (#58's decision text: the merge "needs no special case" — so none is carved); and the db operation's explicit column list carries the breadcrumb for #58's stored column (D6). When #58 lands, the only merge-adjacent change is mechanical: one column name in statement (ii)'s list — and T-DB-S22's fixtures deliberately include late rows so a forgotten column shows up as a red agreement test, not silent data loss.

### D14 — ADR-0049 records; it amends nothing

Tombstone semantics, the winner rule, the earliest-wins realization and the no-transaction design are each "a technical decision of any weight" (CLAUDE.md). One ADR carries them because they are one design. It **amends neither ADR-0009 nor ADR-0026**: every decision here resolves a silence (winner selection, tombstone mechanism, played-row collisions, statement realization) without contradicting a recorded sentence — and #58 is already queued to amend both ADRs, so gratuitous `Amends:` headers now would create the reciprocal-line collision handoff 028 §2 warns about. Consequence: **no reciprocal `Amended by:` edits are owed anywhere** (checked at §14). Next free ADR number: `0049`. An ADR owes no `docs/README.md` row (handoff 028 §3); this plan owes one (added with this document).

### D15 — `CONTEXT.md` gains a **Tombstone** row; the Merge row stands

"Tombstone" graduates from ADR prose to a tested, durable concept with invariants (D9), so the glossary — the thing test names and issue titles must not drift from — gets one row (committed in §13's docs commit; `CONTEXT.md` is maintained by `/domain-modeling` and this is exactly its "record an architectural decision's vocabulary" case). The row's exact text, fixed here so step 5 transcribes rather than improvises the ubiquitous language:

| Term (code) | pt-BR (UI) | Meaning |
|---|---|---|
| **Tombstone** | — | The losing `users` row after a merge: its sessions are remapped to the canonical (winning) user and the row itself is emptied of every identity handle (`email`, `email_verified_at`, `apple_id`, `google_id`) and retained, never deleted — so its anonymous token can never resurrect a second identity, and its cookie must map to the merged identity, not to a revived empty account ([ADR-0009](./docs/adr/0009-account-merge-recomputes-from-the-union-of-completions.md), [ADR-0049](./docs/adr/0049-account-merge-one-pure-function-one-idempotent-operation.md)). |

(No pt-BR entry — the tombstone is internal mechanism, never user-facing, like the glossary's **Merge** and **Buffer** rows.) The **Merge** row (`CONTEXT.md:21`) is already accurate and is not edited. "Canonical user" stays ADR vocabulary (it names the dedupe key's first component, nothing more) — folded into the Tombstone row's wording above rather than given its own row, to keep the glossary lean. Also in the docs commit: the `schema.ts:47-49` comment "Nothing updates users yet; the first writer is the email-attach ticket" is corrected — `mergeAccounts` becomes the first `users` UPDATE writer — a comment-only edit with zero SQL effect.

### D16 — No UI, no HTTP boundary, no lint surface, no bundle delta: the gates this ticket does and does not owe

- **No `impeccable detect`:** zero UI diff — `apps/web` is untouched entirely (§1). The gate binds on changes that touch UI; none does.
- **No new Zod contract:** this ticket adds no HTTP boundary — `mergeCompletions` and `mergeAccounts` are consumed server-side by #21 later; nothing new crosses the client/server line. Every existing boundary's contract is untouched. (The Zod-at-every-boundary gate is satisfied vacuously and said so in the PR.)
- **No ESLint change:** the free-play wall bans streak *modules* reachable from `apps/web`; `mergeCompletions` is a barrel export nothing in `apps/web` imports, `"sideEffects": false` tree-shakes it from every client chunk, and the db operation lives behind `@miolos/db/user`, which `apps/web` is already mechanically unable to import (ADR-0026 decision 5 + the db wall).
- **No `pnpm build`/`bundle-check` obligation:** with a zero `apps/web` diff there is no route or chunk to re-measure; stated in the PR rather than silently skipped. If step 6 finds any `apps/web` diff, that finding reinstates both.
- Owed as always: `pnpm typecheck` (after `rm -rf apps/web/.next`), `pnpm lint`, `pnpm test` (full suite), property tests at ≥100 runs, pre-commit intact, outputs pasted (§8).

---

## 4. What already exists — the seams, verified

Every row re-verified against the working tree at `616c35b`.

| Seam | Where | State |
|---|---|---|
| The pure recompute the merge reuses | `packages/core/src/streak.ts:75-101` — header: "the account merge, nightly checks and support tooling reuse it unchanged (ADR-0048)" | Shipped by #19; untouched here |
| `StreakRow` (no `game`, no ordering key) | `streak.ts:21-26` | Why D3's richer type must exist: the dedupe key is (game, date) and "earliest" needs an order |
| The unfiltered row reader | `packages/db/src/completions.ts:98-111` (`listCompletionsForStreak`) | The projection pattern and `onTimeSql()` (`:47-49`) the merge reader reuses |
| `onTime` derivation, one place one language | `completions.ts:41-49`; "#58, if it lands, replaces this producer … and nothing downstream" | D13 consumes this as row data |
| Write-once machinery + the never-restamp warning | `completions.ts:113-121` ("an upsert would bump `completed_at` and silently reclassify") | D6 copies `completed_at` for exactly this reason |
| The schema's merge duty, verbatim | `schema.ts:151-155` — repoint = CONFLICT op, ordered by `completed_at`, DO NOTHING | D6 realizes it; ADR-0049 records the two-statement reading |
| Composite PK `(user_id, game, date)` + `completions_user_date_idx` | `schema.ts:214-215, 236-238` | The dedupe key and the recompute's index |
| Cookie→identity = one SELECT | `apps/api/src/session/service.ts:30-51` (`resolveSession`), `:86-95` (`requireUserId`, never mints) | AC 3's entire mechanism; untouched by this plan |
| Sessions writer inventory | `mintSession` is the only production writer of `sessions` rows (grep) | D9's "nothing can revive the loser" argument |
| No interactive transactions on prod driver | `client.ts:26` (union `Db`); `service.ts:54-57` ("a transaction neon-http cannot interactively provide") | D7's whole premise |
| No tombstone/merge column, no migration 0004 | grep `merged_into|tombstone` over `apps/ packages/` — nothing; migrations `0000–0003` | D9 keeps it that way |
| `users.email` deliberately not unique | `schema.ts:31-33` — "Uniqueness semantics land with the attach/merge ticket" | Deferred again, to #21 (D1) |
| `users.updated_at` has no `$onUpdate` | `schema.ts:47-49` | D7 step 5 sets it explicitly; D15 corrects the "first writer" comment |
| The export tripwire | `packages/db/test/user.test.ts:100-111` (`T-DB-9e`, runtime exports only — types don't appear in `Object.keys`) | §6 widens it in the same commit as the new exports |
| PGlite over real migrations | `packages/db/src/testing.ts` (`createTestDb`) | The honest double for every db test |
| The seam-4 fixture idiom | `apps/api/test/streak.test.ts` — direct `db.insert(completions)` with explicit `completedAt` (`T15:00:00Z` = 12:00 SP, inside its own day); real hashed-token sessions | T-API-S54 copies it |
| `fast-check@4.9.0` in `packages/core` devDeps | `packages/core/package.json` (added by #19) | No dependency change anywhere in this ticket |
| Property-test house style | `packages/core/test/streak-properties.test.ts` — `{ numRuns: 100 }`, **no seed pin** (the in-package precedent; seed pinning is a `packages/games` idiom only), domain-shaped generators | §9 imitates it |
| Stats/medals/grants reality | No medals table/type/function, no stats module, no Dia Perfeito, `grantHints` caller-free | D4/D5/D12 |

---

## 5. `packages/core` — `mergeCompletions`, the pure function

New file `packages/core/src/merge.ts`, exported from the barrel (`src/index.ts`: `export { mergeCompletions, type MergeableCompletion } from "./merge";`). Header in the `streak.ts` register: names ADR-0009 ("merge is just one caller" — here is the merge), the three reusers, the no-clock/no-I/O/no-Zod rule, and D3's opaque-key discipline.

Types as in D3. **Algorithm** (spec, not pseudocode to be improved on):

1. Key = the pair (`game`, `date`) — ADR-0009's "(canonical user, puzzle id)" with the user dimension already fixed by the caller. Keys are compared as values; no date arithmetic, no `epochDay`, no parsing of any field occurs in this module.
2. Scan `canonical` first, then `other`, maintaining one kept row per key. A scanned row **replaces** the kept row only when its `completedAtOrder` is **strictly** smaller (lexicographic `<`). Consequences, each deliberate: earliest wins; an exact cross-input tie keeps the `canonical` side's row (the db operation's tie behavior, D6); an exact same-input tie keeps the first occurrence (deterministic; real inputs cannot produce same-input duplicate keys — the PK forbids them — but the function's behavior on them is defined and pinned, T-CORE-S41, rather than undefined).
3. Return the kept rows **sorted by (`date` ascending, `game` ascending)** — plain string comparisons. A deterministic output order makes deep-equality the whole idempotence assertion and keeps fixtures readable; callers needing another order sort themselves.
4. Rows are returned **by reference, never copied or mutated** — the output row for a key *is* one of the input rows (`===`), which is both the cheapest implementation and the strongest form of "carried through the union unchanged" (D13): a test can assert identity, not just equality.

No filtering of any kind (D2): lost rows, late rows and future-dated rows all survive the union — the merge is a history operation; `computeStreak` (and later #29/#30's derivations) own exclusion semantics.

Edge semantics fixed here (each a named unit test, §9): both inputs empty → `[]`; one empty → the other, sorted; the with-cause Termo collision (D11); ties (D2); same-input duplicates (step 2).

---

## 6. `packages/db` — `mergeAccounts`, the reader, and the tripwire

New file `packages/db/src/merge.ts` — a merge spans `completions`, `sessions` and `users`, which is beyond `completions.ts`'s remit. It inherits that file's header law verbatim: **no JS `Date` appears in any statement**; every timestamp is copied column data or DB-side `now()`.

```ts
/** The reader for merge previews, nightly checks and the agreement test:
 *  one user's rows shaped for `mergeCompletions` (ADR-0009). UNFILTERED,
 *  like listCompletionsForStreak and for the same reason. Ordered by
 *  completed_at ascending — ADR-0026's prescribed source order, and
 *  readable fixtures. */
export async function listCompletionsForMerge(
  db: Db,
  userId: string,
): Promise<MergeableCompletion[]>;

/** ADR-0009 executed (ADR-0049): sessions remapped first, earliest-wins
 *  repoint (D6's two statements), loser emptied and retained as a
 *  tombstone. No transaction is usable over the union Db (D7: neon-http
 *  is non-interactive-only, PGlite has no batch) — every statement is
 *  individually idempotent and re-running the merge is the crash
 *  recovery (run it twice, get the same account). a === b is a no-op.
 *  Throws on an unknown id.
 *  EXTENSION POINT: account-scoped tables acquire their merge duty HERE —
 *  #30's curated medal grants (union-and-dedupe), the rewarded-ad
 *  ticket's same-day hint grants if it ever cares (ADR-0049). #58's
 *  stored on_time joins the INSERT column list when it lands. */
export async function mergeAccounts(
  db: Db,
  a: string,
  b: string,
): Promise<{ winnerId: string; loserId: string }>;
```

- **Reader projection:** `game`, `date`, `outcome`, `onTime: onTimeSql()` (the one definition, reused — never respelled), `completedAtOrder` via the fixed-width `to_char` expression (D3). Exactly `MergeableCompletion`, nothing more — a support tool previewing a merge derives state; a future ticket with a real caller widens the projection and the signature together (D2).
- **Operation:** D7's six steps, D6's SQL. Statements (i)–(iii) go through `db.execute(sql\`…\`)` with bound parameters where the query builder cannot express them (`DELETE … USING`, `INSERT … SELECT … ON CONFLICT`); steps 1 and 5 use the builder (`db.update(sessions)…`, `db.update(users)…` — the `resolveSession` precedent proves `update` works on the union `Db`). Winner selection is one DB-side SELECT (D8).
- **Surface:** both functions exported from `packages/db/src/user.ts` (re-export from `./merge`) — user-scoped, `apps/api`-and-tests only, per ADR-0026 decision 5. **The `T-DB-9e` tripwire's expected list gains `listCompletionsForMerge` and `mergeAccounts` in the same commit** (types are invisible to `Object.keys`, so `MergeableCompletion` re-exported as type costs no tripwire row — it is exported from `@miolos/core` anyway). The root `@miolos/db` entry (pinned by its own tripwire in `test/published.test.ts`) is untouched.
- **No migration, no schema object change** — the one `schema.ts` edit is D15's comment correction.

---

## 7. `apps/api` — the AC-3 seam test (no production change)

No route, no handler, no service edit: #21 owns the HTTP seam, and until it lands `mergeAccounts` is production-dormant machinery with tests — the established `grantHints` posture. What #20 adds in `apps/api` is **one test file**, `apps/api/test/merge-resolution.test.ts`, because AC 3's sentence ("the losing account's cookie resolves to the merged identity") is only fully observable where real tokens are hashed and the real resolver runs:

- Fixtures per the `streak.test.ts` idiom: PGlite via `createTestDb`, two users each minted with a real session (`mintSession` with `hashSessionToken(token)`), histories manufactured by direct `db.insert(completions)` with explicit `completedAt` instants.
- T-API-S54: before the merge, each token resolves to its own user; after `mergeAccounts(db, a, b)`, `requireUserId(db, loserToken)` returns the **winner**, and the real `GET /streak` handler invoked with the loser's cookie serves the **merged** streak — the recompute observed end-to-end through the deployed read path, AC 3 and AC 4's attach-flow-readiness in one assertion. (`apps/api` importing `@miolos/db/user` is its sanctioned privilege.)

---

## 8. Gates and rituals

Per CLAUDE.md, outputs pasted in the PR. Every node/pnpm command behind `source ~/.nvm/nvm.sh && nvm use default >/dev/null &&`:

```
rm -rf apps/web/.next && pnpm typecheck   # ALWAYS the rm first (stale .next/types)
pnpm lint
pnpm test                                  # full suite
git diff --exit-code origin/main...HEAD -- packages/db/migrations
                                           # evidence of D9/D16: no migration on this
                                           # branch (migrations ONLY — schema.ts is NOT in
                                           # this gate, because D15's sanctioned comment
                                           # edit would force a non-zero exit). The PR
                                           # shows the schema.ts change as ordinary
                                           #   git diff origin/main...HEAD -- packages/db/src/schema.ts
                                           # output, argued comment-only.
```

Pre-commit (Husky + lint-staged + typecheck + tests) never bypassed. Property gate: every T-CORE property at `{ numRuns: 100 }` (ADR-0023's floor; the in-package no-seed-pin precedent). No `impeccable detect`, no `pnpm build`/`bundle-check`, no new Zod contract — each a D16 decision **stated in the PR**, never silently skipped. Heavy-suite note: if the full run flakes under parallel turbo on this WSL2 box, warm with `--concurrency=1` (handoff 028 §3) — and say so in the PR if used.

---

## 9. Test plan and reserved ids

Frontier at `616c35b` (`docs/agents/test-ids.md:34-40`, re-derived by grep before allocation and again at step 8): next free `T-CORE-S36`, `T-DB-S16`, `T-API-S54`, `T-WEB-S135`, `T-LINT-S26`. This plan reserves **T-CORE-S36…S48**, **T-DB-S16…S25**, **T-API-S54…S56** (contiguous; the tails are review-round headroom, **burned if unspent** per `test-ids.md:61-63`). **No T-WEB and no T-LINT ids are reserved** — `apps/web` and the lint walls take no diff (§1, D16), and reserving would burn slots for nothing. Ids go on `it(...)` in all three areas (the `test-ids.md` rule).

**`packages/core/test/merge.test.ts`** (units — imports from `"../src/index"`; local row builders with one-line TSDoc, `TODAY` constants, one `describe` naming ADR-0009/ADR-0026/ADR-0049):

| Id | Assertion |
|---|---|
| T-CORE-S36 | Disjoint inputs: output holds every row of both, **by reference** (`===` an input row), sorted by (date, game); no fabrication, no mutation of inputs |
| T-CORE-S37 | Shared key, earliest wins — both directions (canonical-earlier keeps canonical's; other-earlier keeps other's); the surviving row is **reference-identical** (`===`) to its input row, so `outcome`/`onTime` arrive untouched (the carried-unchanged claim, #58's obligation at unit level) |
| T-CORE-S38 | Exact `completedAtOrder` tie → the `canonical` side's row survives (the documented db-agreement rule, D2/D6) |
| T-CORE-S39 | **The "with cause" carve-out, by name:** earlier lost Termo vs later on-time won Termo on one (game, date) — the loss survives, the day stops counting, `computeStreak` over the merged rows reads lower than over the win-holding input alone; comment cites ADR-0008 rule 3 + the ADR-0026 write-once counterfactual (D11) |
| T-CORE-S40 | Empty edges: `merge([], [])` → `[]`; `merge(a, [])` and `merge([], b)` → the input, sorted |
| T-CORE-S41 | Same-input duplicate keys (impossible via the PK, defined anyway): earliest wins within a side; equal-order duplicates keep the first occurrence |

**`packages/core/test/merge-properties.test.ts`** (fast-check, every property `{ numRuns: 100 }`; generators shaped so collisions actually occur: dates as epoch-days via the `isoOf` idiom in a ~20-day window, games from `GAMES`, `completedAtOrder` as zero-padded fixed-width numeric strings — lexicographic = numeric, standing in for the DB's fixed-width instant; per-side keys kept unique via `fc.uniqueArray` on (game, date), mirroring the PK — the same domain-shaping remark the streak suite's header carries):

| Id | Property |
|---|---|
| T-CORE-S42 | Determinism + per-input permutation invariance: repeated calls deep-equal; shuffling either input (unique per-side keys, as the PK guarantees) changes nothing |
| T-CORE-S43 | Union-earliest-dedupe / no real completion lost: output keys = union of input keys (as sets, exactly once each); every output row is reference-identical to an input row for its key; no input row for a key has a strictly smaller `completedAtOrder` than that key's survivor |
| T-CORE-S44 | Idempotence: with `m = merge(a, b)` — `merge(m, b)`, `merge(m, [])` and `merge(m, m)` all deep-equal `m` |
| T-CORE-S45 | AC 2, the fuller calendar: inputs with game-partitioned (disjoint) keys over one date window → `countedDays(merged) = countedDays(a) ∪ countedDays(b)` and `streak(merged) ≥ max(streak(a), streak(b))` for the same generated `today` (counted-day extraction via `computeStreak`'s own semantics on constructed oracles) |
| T-CORE-S46 | Never invents a day (general inputs, collisions allowed): every merged counted day is a counted day of at least one input |
| S47–S48 | Reserved headroom |

**`packages/db/test/merge.test.ts`** (PGlite via `createTestDb`, the `user.test.ts` architecture: 30 s `beforeAll`, truncate-cascade `beforeEach`, `createUser()` helper; histories via direct `db.insert(completions)` with explicit `completedAt`; sessions via direct `db.insert(sessions)` with literal token hashes):

| Id | Assertion |
|---|---|
| T-DB-S16 | Disjoint histories: every loser row lands on the winner with `completed_at` **copied** (an on-time row inserted with an in-day instant still derives `onTime: true` after the merge — never re-stamped); the loser holds zero completions |
| T-DB-S17 | Collisions: loser-earlier → loser's row survives on the winner (winner's later dropped); winner-earlier → winner's kept; exact-`completed_at` tie → winner's kept (the D6 strict inequality, agreeing with T-CORE-S38); the never-downgrade corollary — an on-time survivor never becomes late |
| T-DB-S18 | Sessions remap: every loser session row points at the winner after the merge; the winner's own sessions untouched (AC 3 at the row level) |
| T-DB-S19 | Tombstone: the fixture gives the loser **at least one non-null identity handle** (a direct `db.update(users)` email write — no production writer exists yet), otherwise "`updated_at` advanced" is unobservable under D7 step 5's guard; after the merge the loser `users` row still **exists**; `email`/`email_verified_at`/`apple_id`/`google_id` are null; `updated_at` advanced; zero completions, zero sessions; the winner row's identity columns untouched. Stated explicitly: an all-null anonymous loser — the only kind that exists before #21 — never matches the guard and never bumps `updated_at` |
| T-DB-S20 | **Run it twice, get the same account:** full `users`+`sessions`+`completions` state snapshot after run one deep-equals the state after run two (D7's recovery property, ADR-0009's sentence) |
| T-DB-S21 | Winner selection: `mergeAccounts(db, a, b)` and `mergeAccounts(db, b, a)` (fresh identical fixtures) pick the same winner — older `created_at`; explicit-equal `created_at` falls to the lower id |
| T-DB-S22 | **The agreement bridge (AC 4):** both users' `created_at` pinned explicitly in the fixture so the winner is known a priori (D8's rule applied by hand — `expected` is computable before the merge without guessing roles; `mergeAccounts`' returned `{winnerId, loserId}` is then asserted against that pinned expectation); seed both accounts with on-time, late and lost rows plus collisions in both directions; `expected = mergeCompletions(winnerRows, loserRows)` from `listCompletionsForMerge` **before** the merge (read-only reuse, the nightly-check shape); after `mergeAccounts`, the post-merge fetch is **canonicalized before comparing** — `listCompletionsForMerge` returns `completed_at`-ascending (nondeterministic among equal instants) while `mergeCompletions` returns (date asc, game asc), so the test normalizes via `mergeCompletions(after, [])` (the function's own order; a plain (date, game) sort is equivalent) and deep-equals `expected` — the pure spec and the SQL realization can never drift apart unnoticed |
| T-DB-S23 | `mergeAccounts(db, a, a)` is a no-op returning `{ winnerId: a, loserId: a }` (state snapshot unchanged); an unknown id throws before any statement runs |
| S24–S25 | Reserved headroom. Plus, no id needed: the `T-DB-9e` export tripwire widened to the new surface in the same commit — the suite's own contract |

**`apps/api/test/merge-resolution.test.ts`** (§7's architecture):

| Id | Assertion |
|---|---|
| T-API-S54 | **AC 3's sentence at the cookie seam:** two minted users with real hashed-token sessions and distinct histories; after `mergeAccounts`, `requireUserId(db, loserToken)` returns the winner id, and the real `GET /streak` handler under the loser's cookie serves the **merged** streak (strictly greater than either input's on interleaved-calendar fixtures — the recompute observed through the deployed read path) |
| S55–S56 | Reserved headroom |

**TDD seams for `/implement` (step 5):** red-green at `packages/core` units first (S36–S41), then the properties (S42–S46), then the db operation against PGlite (S16–S23, the agreement test last — it needs both layers), then T-API-S54. Typecheck and the single file under work run continuously; the full suite once at the end.

**Existing tests knowingly edited (regression net, no new ids):** `packages/db/test/user.test.ts` — the `T-DB-9e` expected list (§6). Anything else red at step 5 is investigated as a finding, not silenced.

---

## 10. What cannot be verified in this environment

Stated per the evidence rule, with the honest substitute; the PR repeats this table.

| Cannot do here | Substitute, and who does the real thing |
|---|---|
| The merge against real Neon over neon-http | PGlite runs the identical statement sequence over the real committed migrations; the design deliberately assumes **no** transaction (D7), so sequential execution is the faithful model, not an approximation. The first production execution is #21's, behind its own tests |
| A real browser's cookie surviving a merge across devices | T-API-S54 exercises the real resolver with real hashed tokens; the browser half is one SELECT away from it (`service.ts:34-38`) and is #21's post-deploy smoke to observe live |
| Concurrent interleavings (a write racing the merge) | Named, bounded and accepted as §12 risk 5 — sessions-first ordering shrinks the window; re-running the merge heals a stranded row. No test here can schedule a true race |
| `to_char` microsecond formatting agreement between PGlite and Neon | Both are real Postgres (PGlite is Postgres compiled to wasm); T-DB-S22 exercises the expression against PGlite; the expression is standard `to_char` with no version-sensitive pattern. Residual risk named in §12 risk 3 |

---

## 11. What is deliberately NOT in this slice

- **The attach flow, magic link, email transport, collision detection, consent capture, email uniqueness, LGPD policy** — #21, which consumes `mergeAccounts` at the `apps/api` seam ("merge-on-collision covered at the `apps/api` seam with the email transport faked" is #21's own AC).
- **#58** — decided by Fernando (2026-08-02), not implemented, no rider here (D13). The merge is forward-compatible by construction and the PR states it in one sentence.
- **Stats, Dia Perfeito, distributions** — #29's pure derivations, which will run over merged rows with zero merge changes (D4).
- **Medals, the curated-grants table and its union-on-merge statement** — #30's, with its seat in `mergeAccounts` reserved by name (D5).
- **A `merged_into` audit column / migration 0004** — deferred with a named revisit trigger (D9); the operational trap it carries (`users` INSERT column list) is documented so the future ticket walks in with eyes open.
- **Nightly consistency checks and support tooling themselves** — future tickets; #20's obligation is the *shape* that lets them exist (read-only, caller-fetched-rows, no variants), demonstrated by T-DB-S22.
- **hint-grant carrying** (D12), **n-way single-call merges** (D2), **any `apps/web` surface** — the merge has no UI.

---

## 12. Deviation / risk register

Pre-agreed responses to what could force a change at step 5:

1. **Drizzle 0.45.2 cannot express `INSERT … SELECT … ORDER BY … ON CONFLICT` or `DELETE … USING` through the builder.** Response: `db.execute(sql\`…\`)` with bound parameters — already the plan's default for statements (i)–(iii) (§6); the SQL in D6 is the contract, the builder is a convenience. No semantic latitude.
2. **The union `Db` type rejects some builder call** (the known union-signature collapse that forced bare `.returning()` elsewhere). Response: the same repo precedent — fall back to the no-argument overload or raw SQL; never widen `Db`.
3. **`to_char` fixed-width assumption breaks** (a row with a pre-1000 year or `.US` deviating). Response: impossible for real rows (every `completed_at` is a DB-clock default), and T-DB-S22 would catch a formatting drift; if it ever fires, switch the key to `extract(epoch from completed_at)`-based zero-padded text — same opacity contract, no core change.
4. **Fernando wants the `merged_into` marker now.** Response: pre-planned — migration `0004` via `db:generate`, **applied to Neon by hand (`psql` + `DATABASE_URL_UNPOOLED`) before the PR merges** (the deploy-before-apply trap on `users` INSERTs, D9), the column nullable so every existing row satisfies it, `mergeAccounts` step 5 gains one SET clause **and its idempotence guard widens to `OR merged_into IS NULL`** (otherwise an all-null anonymous loser never receives the marker, and the statement stops being a zero-row no-op on re-run), T-DB-S19 gains one assertion, ADR-0049's decision 4 is rewritten before acceptance. Blocking only if he says so.
5. **A request that resolved the loser's session before step 1 writes a completion after step 4** — a stranded row on the tombstone. Accepted residual: window shrunk by sessions-first ordering; healed by re-running `mergeAccounts` (D7/D10); permanent detection belongs to the nightly-check ticket (named in ADR-0049). Not reachable at all until #21 gives the merge a production caller.
6. **The agreement test surfaces a genuine semantic gap between the pure function and the SQL** (e.g. an unforeseen tie case). Response: that is the test doing its job — fix whichever side diverged from ADR-0009/ADR-0026, never loosen the assertion; if the fix changes a documented rule (D2's tie), the ADR draft is updated before acceptance.
7. **`packages/core`'s no-purity-tripwire gap** (only `packages/games` has a purity test) tempts a reviewer to demand one here. Response: out of scope and said so — `tsconfig` `types: []` plus a zod-only dependency list is the existing mechanical guarantee; a core purity suite is a fine future chore ticket, not a rider (CLAUDE.md's "small improvement nobody asked for" rule).

---

## 13. Commit and PR plan

One branch: **`feat/20-account-merge-recompute`**. Commit sequence (each green under pre-commit):

1. `docs: plan 029 for #20 and its README row` — this file + the `docs/README.md` row (already written at step 2; committed here).
2. `feat(core): mergeCompletions — the union-earliest-dedupe over completion rows` — §5, barrel export, tests T-CORE-S36…S46.
3. `feat(db): mergeAccounts and listCompletionsForMerge on the user surface, tripwire widened` — §6, the `T-DB-9e` widening in the same commit, tests T-DB-S16…S23.
4. `test(api): the losing account's cookie resolves to the merged identity` — §7, test T-API-S54.
5. `docs: ADR-0049, the CONTEXT.md tombstone row, comment corrections, test-id frontier` — Appendix A as a real file (status flipped to Accepted at merge per the directory's convention); D15's `CONTEXT.md` row and `schema.ts` comment fix; `docs/agents/test-ids.md` frontier re-derived by grep.

**PR description** (per CLAUDE.md): what changed; every gate's real output inline (§8's list); the §10 cannot-verify table; the D16 statement of gates *not* owed and why (no UI → no impeccable; no HTTP boundary → no new contract; zero `apps/web` diff → no bundle run); the `git diff --exit-code origin/main...HEAD -- packages/db/migrations` evidence plus the `git diff origin/main...HEAD -- packages/db/src/schema.ts` output argued comment-only; **#58's status in one sentence** (decided 2026-08-02, not implemented, the merge is forward-compatible by construction and carries its column-list breadcrumb). Closes #20.

Step 6 runs the standard parallel lenses (correctness; security — the first `users` UPDATE writer and a multi-statement identity operation deserve that lens's full attention; quality; performance; ADR/CONTEXT adherence; issue adherence); reviewers default to rejecting; dismissals in writing.

### Decisions Fernando needs

**None blocking.** For the record, each overridable in the PR:

- **The winner rule** (D8): older `created_at`, ties to lower id. Alternatives (verified-email-holder wins; link-clicked-from wins) and why they were rejected are in ADR-0049; swapping is one SELECT plus T-DB-S21's expectations.
- **The with-cause carve-out** (D11 / T-CORE-S39): a cross-account collision whose earlier row is a lost Termo demotes that day in the merged streak — the write-once counterfactual, prescribed by ADR-0026's fixed ordering. If Fernando prefers "a completion always beats a played row" the dedupe rule changes (order by outcome then time), which **amends ADR-0026's fixed resolution** — a bigger step than it looks, stated so he can weigh it.
- **No `merged_into` audit column** (D9): deferred with §12 risk 4 pre-planned if he wants it now.
- **Consent timestamps untouched on both sides at merge** (D9): #21 owns consent semantics; flagged so #21's plan inherits the question explicitly.
- **`hint_grants` not carried** (D12): moot in v1; the rewarded-ad ticket inherits the decision point.
- **The D1 seam split, for the record**: the issue title says "in `packages/core`", but this plan also ships `packages/db/src/merge.ts` and one `apps/api` test file — because AC 3 is unobservable from core, ADR-0026's consequence prescribes the merge's SQL, and ADR-0022's consequence assigns the session remap to "the account-merge ticket" (D1). Non-blocking; recorded so the title/scope delta is blessed, not smuggled past in the diff.

---

## 14. Exit criteria

| Claim | Discharged by |
|---|---|
| All four ACs met with machine-checkable evidence | §0's mapping; §9's suites green; §8's gate outputs pasted in the PR |
| Union-earliest-dedupe, determinism, idempotence, no-loss **proved** at ≥100 runs; operation idempotence proved at the PGlite seam | T-CORE-S42…S46; T-DB-S20 |
| AC 3 observed at the seam that resolves cookies | T-API-S54 output in the PR |
| The pure spec and the SQL realization agree | T-DB-S22 |
| `pnpm typecheck` / `lint` / `test` green, outputs pasted; pre-commit intact, never bypassed | §8 |
| No migration, no schema object change, no `apps/web` diff, no contract change | `git diff --exit-code origin/main...HEAD -- packages/db/migrations`; the `schema.ts` diff shown via `git diff origin/main...HEAD -- packages/db/src/schema.ts` and argued comment-only; the diffstat itself; stated in the PR |
| ADR-0049 exists, amends nothing, and **no reciprocal `Amended by:` line is owed anywhere** (checked against every ADR it cites); #58's queued amendments to ADR-0009/0026 uncollided | §13 commit 5; ADR-0049's header |
| `docs/README.md` carries plan 029's row (ADRs owe none); `CONTEXT.md` carries the Tombstone row; the `schema.ts` first-writer comment is true again | §13 commits 1 and 5 |
| `test-ids.md` frontier re-derived by grep at step 8; unspent tails (T-CORE-S47/S48, T-DB-S24/S25, T-API-S55/S56) recorded as burned if unspent | §13 commit 5 |
| Step-6 review closes on an empty blocking pass, dismissals written down | §13 |

---

## Appendix A — Draft ADR-0049 (to be created as `docs/adr/0049-account-merge-one-pure-function-one-idempotent-operation.md`)

Status convention: the draft says "Proposed" because the plan predates acceptance; the real file carries **"Accepted — \<merge date\>"** per the directory's convention — Fernando's merge of the PR is the acceptance.

```markdown
# ADR-0049 — Account merge: one pure function, one idempotent operation, tombstone by remap

**Status:** Proposed — 2026-08-13 (issue #20)
**Depends on:** ADR-0003, ADR-0008, ADR-0009, ADR-0022, ADR-0023, ADR-0026, ADR-0048
**Amends:** nothing — deliberately. Every decision below resolves a silence in
ADR-0009/ADR-0026 (winner selection, tombstone mechanism, played-row
collisions, the SQL realization of "earliest wins") without contradicting a
recorded sentence; #58's queued amendments to both ADRs are untouched.

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
   without cause".
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
   the integrity mechanism, proved at the PGlite seam by a full-state
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
   there; hint grants are not carried (day-scoped, structurally expiring,
   writer-less in v1 — the rewarded-ad ticket inherits the decision
   point). #58 needs no special case here: `on_time` is row data carried
   through the union, and its stored column, when it lands, joins the
   repoint statement's explicit column list.

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
```
