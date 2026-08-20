import type { MergeableCompletion } from "@miolos/core";
import { and, asc, eq, inArray, isNotNull, or, sql } from "drizzle-orm";

import type { Db } from "./client";
import {
  completions,
  hintGrants,
  medalGrants,
  pushSubscriptions,
  sessions,
  users,
} from "./schema";

/**
 * The account-merge operation (ADR-0009 executed; ADR-0049) — a merge
 * spans `completions`, `sessions` and `users`, which is beyond
 * completions.ts's remit, so it lives here. User-scoped: reachable only
 * through `@miolos/db/user` (ADR-0026 decision 5), never the root entry.
 *
 * NO JS `Date` appears in any statement in this file (completions.ts's
 * header law, inherited verbatim): every timestamp the operation touches
 * is COPIED column data or DB-side `now()`.
 */

/**
 * The winner-liveness guard's discriminable signature (step-7 finding C on
 * #21). Shared by the guard's `throw` below and the predicate beside it,
 * so the two cannot drift.
 */
const WINNER_LIVENESS_SIGNATURE = "owns no session or identity handle";

/**
 * True exactly when `error` is the winner-liveness guard's throw — the one
 * failure `mergeAccounts` raises BEFORE any destructive statement (a
 * concurrent merge tombstoned the selected winner). Callers may retry on
 * this and ONLY this: any other mid-merge failure may have landed after a
 * destructive statement, must surface loudly (the confirm route rethrows
 * it into a 500), and is healed by re-running the merge — never by a
 * silent catch. The message-predicate idiom mirrors the api layer's
 * `isVerifiedEmailUniqueViolation`.
 */
export function isWinnerLivenessError(error: unknown): boolean {
  return (
    error instanceof Error && error.message.includes(WINNER_LIVENESS_SIGNATURE)
  );
}

/**
 * The opaque ordering key `mergeCompletions` compares and never parses
 * (plan 029 D3): a FIXED-WIDTH UTC instant via `to_char`, so lexicographic
 * order IS chronological order. Produced in SQL, which keeps ADR-0026's
 * "no JavaScript timezone arithmetic exists anywhere on this path"
 * literally true — the only JS operation on this key is `<`.
 */
function completedAtOrderSql() {
  return sql<string>`to_char(${completions.completedAt} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;
}

/**
 * The reader for merge previews, nightly checks and the agreement test:
 * one user's rows shaped for `mergeCompletions` (ADR-0009). UNFILTERED,
 * like listCompletionsForStreak and for the same reason — lost and late
 * rows are history, and the pure derivations own exclusion. Ordered by
 * completed_at ascending — ADR-0026's prescribed source order, and
 * readable fixtures.
 */
export async function listCompletionsForMerge(
  db: Db,
  userId: string,
): Promise<MergeableCompletion[]> {
  return db
    .select({
      game: completions.game,
      date: completions.date,
      outcome: completions.outcome,
      onTime: completions.onTime,
      completedAtOrder: completedAtOrderSql(),
    })
    .from(completions)
    .where(eq(completions.userId, userId))
    .orderBy(asc(completions.completedAt));
}

/**
 * ADR-0009 executed (ADR-0049): sessions remapped FIRST among writes (the
 * winner-liveness guard between selection and remap is a READ — issue #21
 * precondition 1, ADR-0050 decision 5), earliest-wins repoint (D6's two
 * statements — `ON CONFLICT DO NOTHING` alone would keep the winner's
 * LATER row), loser emptied and retained as a tombstone. The winner is
 * deterministic from the data: older `created_at`, exact ties to the
 * lower id, selected DB-side (D8).
 *
 * No transaction is usable over the union `Db` (D7: neon-http is
 * non-interactive-only, PGlite has no batch) — every statement is
 * individually idempotent and RE-RUNNING THE MERGE IS THE CRASH RECOVERY
 * ("run it twice, get the same account", pinned by T-DB-S20). `a === b`
 * is a no-op. Throws on an unknown id: a merge against a typo must be
 * loud, not creative.
 *
 * EXTENSION POINT, consumed by #30 and #145 as reserved (ADR-0049
 * decision 6): curated medal grants acquired their merge duty here —
 * statements 5b/5c below, union-EARLIEST-dedupe then the loser's delete
 * (ADR-0052) — and push subscriptions acquired theirs as statement 1b
 * (repoint, the sessions precedent; ADR-0064). Future account-scoped
 * tables still acquire theirs HERE — the rewarded-ad ticket's same-day
 * hint grants if it ever wants them repointed instead (hint grants are
 * DELETED, never carried — day-scoped, structurally expiring, writer-less
 * in v1, plan 029 D12). #58 consumed the seat twice as reserved: its
 * stored on_time joined the repoint statement's explicit column list, and
 * `user_seen_days` acquired its merge duty as statements 4b/4c (union then
 * empty — ADR-0066).
 */
export async function mergeAccounts(
  db: Db,
  a: string,
  b: string,
): Promise<{ winnerId: string; loserId: string }> {
  // Step 0: existence check and winner selection in a single DB-side
  // ORDER BY — no JS Date comparison enters this package. (One more read
  // follows — the winner-liveness guard below — before any write runs.)
  const candidates = await db
    .select({ id: users.id })
    .from(users)
    .where(inArray(users.id, [a, b]))
    .orderBy(asc(users.createdAt), asc(users.id));
  const found = new Set(candidates.map((row) => row.id));
  for (const id of [a, b]) {
    if (!found.has(id)) {
      throw new Error(`mergeAccounts: unknown user id ${id}`);
    }
  }
  if (a === b) {
    return { winnerId: a, loserId: a };
  }
  const winnerId = candidates[0]?.id;
  const loserId = candidates[1]?.id;
  if (winnerId === undefined || loserId === undefined) {
    // Unreachable: both ids were just found, and a !== b.
    throw new Error("mergeAccounts: winner selection returned too few rows");
  }

  // Step 0b — the winner-liveness guard (issue #21 precondition 1,
  // ADR-0050 decision 5): the selected winner must still own >= 1 session
  // or >= 1 identity handle, i.e. must NOT be a tombstone. Why this
  // predicate is exactly "not a tombstone": every minted user is born with
  // a session (mintSession's two inserts), sessions are never deleted in
  // v1 (no prune exists; account deletion removes the whole user), and a
  // tombstone is precisely the row whose sessions were remapped away and
  // whose handles were nulled. Without the guard, merge(A,B) racing
  // merge(B,C) could strand C's history on B's tombstone — and
  // pg_advisory_lock is unavailable over stateless neon-http, so an
  // in-operation re-check is the serialization mechanism. The throw sits
  // BEFORE any destructive statement; the loser needs no symmetric guard
  // (a tombstoned loser contributes zero rows harmlessly, and merging into
  // a healed state is what idempotent re-run already covers). The re-run
  // discipline survives: after run one the winner owns the union of
  // sessions, so the guard passes and every statement no-ops (T-DB-S27).
  const winnerSessions = await db
    .select({ userId: sessions.userId })
    .from(sessions)
    .where(eq(sessions.userId, winnerId))
    .limit(1);
  if (winnerSessions.length === 0) {
    const winnerHandles = await db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.id, winnerId),
          or(
            isNotNull(users.email),
            isNotNull(users.emailVerifiedAt),
            isNotNull(users.appleId),
            isNotNull(users.googleId),
          ),
        ),
      )
      .limit(1);
    if (winnerHandles.length === 0) {
      throw new Error(
        `mergeAccounts: winner ${winnerId} ${WINNER_LIVENESS_SIGNATURE} (concurrent merge?)`,
      );
    }
  }

  // 1. The remap FIRST: AC 3's property — the loser's cookie resolves to
  //    the merged identity — holds from the earliest possible moment, and
  //    every request resolving after this statement already writes to the
  //    winner (shrinking the stranded-row race, plan 029 §12 risk 5).
  //    Remap, never delete (ADR-0022's choice resolved): a deleted session
  //    re-mints via POST /session — the revived empty account ADR-0009
  //    forbids.
  await db
    .update(sessions)
    .set({ userId: winnerId })
    .where(eq(sessions.userId, loserId));

  // 1b. The loser's push subscriptions follow the merged identity (#145,
  //     ADR-0064 — the sessions precedent above, and the extension point
  //     ADR-0049 decision 6 reserves, consumed as reserved). Repoint, never
  //     delete: a device's push channel belongs to whoever that browser now
  //     is, and deleting would silently withdraw a consent the player gave.
  //     NOT revoked — ADR-0050 decision 13 is about cookie takeover, not
  //     this. No conflict is possible (endpoint is a globally unique PK and
  //     the PK does not move); trivially idempotent (a re-run matches zero
  //     rows — T-DB-S67, and T-DB-S20's double-run snapshot by
  //     construction).
  await db
    .update(pushSubscriptions)
    .set({ userId: winnerId })
    .where(eq(pushSubscriptions.userId, loserId));

  // 2. Statement (i): drop the winner's STRICTLY-LATER duplicate wherever
  //    the loser holds an earlier row for the same puzzle (ADR-0009: "the
  //    other row is dropped"). Strict <, so an exact tie keeps the
  //    winner's row — the pure function's first-argument tie rule.
  await db.execute(sql`
    delete from completions w
      using completions l
      where w.user_id = ${winnerId} and l.user_id = ${loserId}
        and w.game = l.game and w.date = l.date
        and l.completed_at < w.completed_at
  `);

  // 3. Statement (ii): repoint the loser's rows, ADR-0026's prescribed
  //    shape verbatim — ordered by completed_at ascending, ON CONFLICT DO
  //    NOTHING. completed_at is COPIED, never defaultNow(): re-stamping
  //    would move the recorded write instant (recordCompletion's own
  //    warning, at merge scale). The column list is exhaustive over
  //    today's schema — MECHANICALLY pinned by T-DB-S24, which derives the
  //    live column set from the drizzle table and fails the suite the day
  //    a new column would silently default on merged rows. #58's stored
  //    on_time is in this list as its own comments always promised:
  //    COPIED, never recomputed — this union moves rows, it computes
  //    nothing (ADR-0066's invariant sentence; ADR-0009 untouched).
  //
  //    A FALSIFIED CORNER, RECORDED NOT PATCHED (#58, ADR-0066; pinned by
  //    T-CORE-S106): ADR-0026's "a merge can never downgrade an on-time
  //    completion to a late one" was a THEOREM of the read-time derivation
  //    (earliest instant ⇒ most on-time). With the credit it is falsified:
  //    an earlier LATE row (archive, unseen sync) beats a later CREDITED
  //    row for the same puzzle, and earliest-wins keeps the late one — a
  //    merge can therefore visibly break a streak the user saw. Fernando's
  //    2026-08-02 call: the merge "needs no special case"; earliest-wins
  //    stays, and ADR-0026's sentence is amended rather than defended.
  await db.execute(sql`
    insert into completions
      (user_id, game, date, completed_at, outcome, elapsed_ms, hints_used, guesses, on_time)
    select ${winnerId}::uuid, game, date, completed_at, outcome, elapsed_ms, hints_used, guesses, on_time
      from completions where user_id = ${loserId}
      order by completed_at asc
    on conflict (user_id, game, date) do nothing
  `);

  // 4. Statement (iii): the loser's originals go, now that every key
  //    survives on the winner.
  await db.delete(completions).where(eq(completions.userId, loserId));

  // 4b. The loser's seen days UNION onto the winner (#58, ADR-0066;
  //     T-DB-S74) — ADR-0049 decision 6's extension point consumed in the
  //     completions idiom: copied dates, ON CONFLICT DO NOTHING on the
  //     composite PK, individually idempotent (a re-run selects zero loser
  //     rows). A date is the whole fact, so there is no earliest-wins or
  //     least() to arbitrate — presence is presence. The union COMPUTES
  //     NOTHING and no streak ever reads this table (ADR-0066's invariant
  //     sentence; ADR-0009 untouched).
  await db.execute(sql`
    insert into user_seen_days (user_id, date)
    select ${winnerId}::uuid, date
      from user_seen_days where user_id = ${loserId}
    on conflict (user_id, date) do nothing
  `);
  // 4c. The loser's seen-day rows go — "emptied" means EMPTIED; no row may
  //     keep referencing the tombstone (ADR-0049 decision 6). Trivially
  //     idempotent.
  await db.execute(sql`delete from user_seen_days where user_id = ${loserId}`);

  // 5. The loser's hint grants go with the rest of the loser-row cleanup:
  //    "emptied" means EMPTIED — no row may keep referencing the tombstone
  //    (ADR-0049 decision 6). Deleted, never carried to the winner: grants
  //    are day-scoped convenience that expires structurally at the next
  //    rollover, not history. Trivially idempotent (a re-run deletes zero
  //    rows) and crash-prefix-safe: a crash before this statement leaves
  //    only unreadable rows the re-run removes.
  await db.delete(hintGrants).where(eq(hintGrants.userId, loserId));

  // 5b. #30's curated medal grants: union-EARLIEST-dedupe (ADR-0009's
  //     union-and-dedupe sentence in its own earliest-wins posture;
  //     ADR-0049 decision 6's reserved seat). granted_at is COPIED, never
  //     defaultNow() — re-stamping would move the recorded grant event.
  //     On a shared medal the EARLIEST granted_at wins regardless of side:
  //     least() in the conflict arm — one statement where completions
  //     needed two, because a grant has exactly one merge-relevant column
  //     (ADR-0052). Column list hand-spelled, pinned by T-DB-S42.
  //     Individually idempotent: a re-run selects zero loser rows, and
  //     least() is stable under reapplication.
  await db.execute(sql`
    insert into medal_grants (user_id, medal_id, granted_at)
    select ${winnerId}::uuid, medal_id, granted_at
      from medal_grants where user_id = ${loserId}
    on conflict (user_id, medal_id)
    do update set granted_at = least(medal_grants.granted_at, excluded.granted_at)
  `);
  // 5c. The loser's grant rows go — "emptied" means EMPTIED; no row may
  //     keep referencing the tombstone. Trivially idempotent.
  await db.delete(medalGrants).where(eq(medalGrants.userId, loserId));

  // 5d. The three once-per-account timestamps fold onto the winner
  //     EARLIEST-WINS (#35's `onboarding_seen_at`, ADR-0061;
  //     `attach_prompt_dismissed_at`, shipped unmerged since #21 — #134's
  //     defect, closed here; and #145's `push_prompt_dismissed_at`,
  //     ADR-0064, the third column of the same fold). Statement 5b's
  //     `least()` idiom adapted from a conflict arm to a self-join UPDATE:
  //     Postgres `least()` ignores NULL arguments, so either side
  //     suffices, and when both are set the earlier survives (the evidence
  //     property; nothing reads any of the values — every reader compares
  //     to NULL). This is the FIRST statement that writes the WINNER's
  //     updated_at (statement 6 bumps the loser's); schema.ts's writer
  //     list names it. The guard is an OR over the three per-column
  //     `is not null` + strict `<` conditions — a single-column guard
  //     would skip rows the other columns need, and `least()` on a column
  //     whose arm did not fire is a no-op (`least(x, NULL) = x`,
  //     `least(x, y >= x) = x`), so the statement never moves a value
  //     backwards. Individually idempotent: a re-run matches ZERO rows and
  //     never re-bumps updated_at (T-DB-S20's full-state double-run
  //     snapshot; T-DB-S64; T-DB-S68). The loser's own values are
  //     deliberately NOT nulled — not identity handles, so they stay out
  //     of statement 6's SET, resolving to nobody on the tombstone. Runs
  //     before 6 to keep the file's narrative (fold every account-scoped
  //     fact into the winner, then empty the shell); crash-prefix-safe
  //     either way, since 6 touches none of the three columns.
  await db.execute(sql`
    update users w
       set onboarding_seen_at =
             least(w.onboarding_seen_at, l.onboarding_seen_at),
           attach_prompt_dismissed_at =
             least(w.attach_prompt_dismissed_at, l.attach_prompt_dismissed_at),
           push_prompt_dismissed_at =
             least(w.push_prompt_dismissed_at, l.push_prompt_dismissed_at),
           updated_at = now()
      from users l
     where w.id = ${winnerId}::uuid
       and l.id = ${loserId}::uuid
       and (
             (l.onboarding_seen_at is not null
              and (w.onboarding_seen_at is null
                   or l.onboarding_seen_at < w.onboarding_seen_at))
          or (l.attach_prompt_dismissed_at is not null
              and (w.attach_prompt_dismissed_at is null
                   or l.attach_prompt_dismissed_at < w.attach_prompt_dismissed_at))
          or (l.push_prompt_dismissed_at is not null
              and (w.push_prompt_dismissed_at is null
                   or l.push_prompt_dismissed_at < w.push_prompt_dismissed_at))
           )
  `);

  // 6. Empty the shell: every identity handle nulled — current AND future
  //    (the social ids have no writer today, so nulling them is provably
  //    inert) — so no handle can ever resolve to a tombstone. Consent
  //    timestamps deliberately untouched: LGPD evidence, #21's semantics.
  //    updated_at set explicitly to DB-side now() (schema.ts's own
  //    instruction). The identity-handle guard makes this statement
  //    individually idempotent like the other five: a re-run finds every
  //    handle already null and touches ZERO rows — never re-bumping
  //    updated_at (T-DB-S20's full-state double-run snapshot).
  await db
    .update(users)
    .set({
      email: null,
      emailVerifiedAt: null,
      appleId: null,
      googleId: null,
      updatedAt: sql`now()`,
    })
    .where(
      and(
        eq(users.id, loserId),
        or(
          isNotNull(users.email),
          isNotNull(users.emailVerifiedAt),
          isNotNull(users.appleId),
          isNotNull(users.googleId),
        ),
      ),
    );

  return { winnerId, loserId };
}
