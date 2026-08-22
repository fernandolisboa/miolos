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
 * The account-merge operation — spans `completions`, `sessions` and
 * `users`, beyond completions.ts's remit. User-scoped: reachable only
 * through `@miolos/db/user`, never the root entry.
 *
 * NO JS `Date` appears in any statement in this file: every timestamp the
 * operation touches is COPIED column data or DB-side `now()`.
 */

/** Shared by the winner-liveness guard's `throw` and `isWinnerLivenessError`, so the two spellings cannot drift. */
const WINNER_LIVENESS_SIGNATURE = "owns no session or identity handle";

/**
 * True exactly when `error` is the winner-liveness guard's throw — the
 * one failure `mergeAccounts` raises BEFORE any destructive statement.
 * Callers may retry on this and ONLY this: any other mid-merge failure
 * may have landed after a destructive statement, must surface loudly, and
 * is healed by re-running the merge — never by a silent catch.
 */
export function isWinnerLivenessError(error: unknown): boolean {
  return (
    error instanceof Error && error.message.includes(WINNER_LIVENESS_SIGNATURE)
  );
}

/**
 * The opaque ordering key `mergeCompletions` compares and never parses: a
 * FIXED-WIDTH UTC instant via `to_char`, so lexicographic order IS
 * chronological order. Produced in SQL — the only JS operation on this
 * key is `<`.
 */
function completedAtOrderSql() {
  return sql<string>`to_char(${completions.completedAt} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;
}

/**
 * One user's rows shaped for `mergeCompletions` (ADR-0009). UNFILTERED,
 * like `listCompletionsForStreak` and for the same reason: the pure
 * derivations own exclusion. Ordered by `completed_at` ascending.
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
 * Sessions remapped FIRST among writes (the winner-liveness guard between
 * selection and remap is a READ), earliest-wins repoint for completions,
 * loser emptied and retained as a tombstone. The winner is deterministic
 * from the data: older `created_at`, exact ties to the lower id, selected
 * DB-side.
 *
 * No transaction is usable over the union `Db`: neon-http is
 * non-interactive-only and PGlite has no batch. Every statement below is
 * therefore individually idempotent, and RE-RUNNING THE MERGE IS THE
 * CRASH RECOVERY — "run it twice, get the same account". `a === b` is a
 * no-op. Throws on an unknown id: a merge against a typo must be loud,
 * not creative.
 *
 * Every account-scoped table added since acquires its own merge duty
 * here, in the same idiom as the statements below: repoint if the row
 * follows the identity (sessions, push subscriptions), union-and-dedupe
 * if it accumulates (completions, seen days, medal grants).
 */
export async function mergeAccounts(
  db: Db,
  a: string,
  b: string,
): Promise<{ winnerId: string; loserId: string }> {
  // Existence check and winner selection in one DB-side ORDER BY — no JS
  // Date comparison. (One more read — the winner-liveness guard — follows
  // before any write runs.)
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

  // The winner-liveness guard: the selected winner must still own >= 1
  // session or >= 1 identity handle — i.e. must NOT be a tombstone. Every
  // minted user is born with a session, sessions are never deleted in v1,
  // and a tombstone is precisely the row whose sessions were remapped
  // away and whose handles were nulled. Without the guard, merge(A,B)
  // racing merge(B,C) could strand C's history on B's tombstone —
  // pg_advisory_lock is unavailable over stateless neon-http, so this
  // in-operation re-check is the serialization mechanism. The throw sits
  // BEFORE any destructive statement; the loser needs no symmetric guard
  // (a tombstoned loser contributes zero rows harmlessly). The re-run
  // discipline survives: after run one the winner owns the union of
  // sessions, so the guard passes and every statement no-ops.
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

  // 1. The remap FIRST: the loser's cookie resolves to the merged
  //    identity from the earliest possible moment, shrinking the
  //    stranded-row race window. Remap, never delete: a deleted session
  //    re-mints via POST /session, reviving an empty account.
  await db
    .update(sessions)
    .set({ userId: winnerId })
    .where(eq(sessions.userId, loserId));

  // 1b. The loser's push subscriptions follow the merged identity, the
  //     sessions precedent above. Repoint, never delete: a device's push
  //     channel belongs to whoever that browser now is, and deleting
  //     would silently withdraw a consent the player gave. No conflict is
  //     possible (the PK is the endpoint, which does not move); trivially
  //     idempotent (a re-run matches zero rows).
  await db
    .update(pushSubscriptions)
    .set({ userId: winnerId })
    .where(eq(pushSubscriptions.userId, loserId));

  // 2. Drop the winner's STRICTLY-LATER duplicate wherever the loser
  //    holds an earlier row for the same puzzle. Strict <, so an exact
  //    tie keeps the winner's row — the pure function's first-argument
  //    tie rule.
  await db.execute(sql`
    delete from completions w
      using completions l
      where w.user_id = ${winnerId} and l.user_id = ${loserId}
        and w.game = l.game and w.date = l.date
        and l.completed_at < w.completed_at
  `);

  // 3. Repoint the loser's rows, ordered by completed_at ascending, ON
  //    CONFLICT DO NOTHING. completed_at is COPIED, never defaultNow():
  //    re-stamping would move the recorded write instant. The column list
  //    is exhaustive over today's schema — a test derives the live column
  //    set from the drizzle table and fails the suite the day a new
  //    column would silently default on merged rows. on_time is in this
  //    list: COPIED, never recomputed — this union moves rows, it
  //    computes nothing.
  //
  //    A FALSIFIED CORNER, RECORDED NOT PATCHED: earliest-wins can drop a
  //    later CREDITED row in favor of an earlier LATE one for the same
  //    puzzle, visibly breaking a streak the user saw. Fernando's
  //    2026-08-02 call: the merge needs no special case; earliest-wins
  //    stays.
  await db.execute(sql`
    insert into completions
      (user_id, game, date, completed_at, outcome, elapsed_ms, hints_used, guesses, on_time)
    select ${winnerId}::uuid, game, date, completed_at, outcome, elapsed_ms, hints_used, guesses, on_time
      from completions where user_id = ${loserId}
      order by completed_at asc
    on conflict (user_id, game, date) do nothing
  `);

  // 4. The loser's originals go, now that every key survives on the
  //    winner.
  await db.delete(completions).where(eq(completions.userId, loserId));

  // 4b. The loser's seen days UNION onto the winner: copied dates, ON
  //     CONFLICT DO NOTHING on the composite PK, individually idempotent.
  //     A date is the whole fact, so there is no earliest-wins to
  //     arbitrate — presence is presence, and no streak ever reads this
  //     table.
  await db.execute(sql`
    insert into user_seen_days (user_id, date)
    select ${winnerId}::uuid, date
      from user_seen_days where user_id = ${loserId}
    on conflict (user_id, date) do nothing
  `);
  // 4c. The loser's seen-day rows go — "emptied" means EMPTIED. Trivially
  //     idempotent.
  await db.execute(sql`delete from user_seen_days where user_id = ${loserId}`);

  // 5. The loser's hint grants go, deleted rather than carried: grants
  //    are day-scoped convenience that expires structurally at the next
  //    rollover, not history. Trivially idempotent.
  await db.delete(hintGrants).where(eq(hintGrants.userId, loserId));

  // 5b. Curated medal grants: union-EARLIEST-dedupe. granted_at is
  //     COPIED, never defaultNow(). On a shared medal the EARLIEST
  //     granted_at wins regardless of side: least() in the conflict arm —
  //     one statement where completions needed two, because a grant has
  //     exactly one merge-relevant column. Individually idempotent:
  //     least() is stable under reapplication.
  await db.execute(sql`
    insert into medal_grants (user_id, medal_id, granted_at)
    select ${winnerId}::uuid, medal_id, granted_at
      from medal_grants where user_id = ${loserId}
    on conflict (user_id, medal_id)
    do update set granted_at = least(medal_grants.granted_at, excluded.granted_at)
  `);
  // 5c. The loser's grant rows go — "emptied" means EMPTIED. Trivially
  //     idempotent.
  await db.delete(medalGrants).where(eq(medalGrants.userId, loserId));

  // 5d. The three once-per-account timestamps fold onto the winner
  //     EARLIEST-WINS, adapting 5b's least() idiom from a conflict arm to
  //     a self-join UPDATE: Postgres least() ignores NULL arguments, so
  //     either side suffices, and when both are set the earlier survives.
  //     This is the FIRST statement that writes the WINNER's updated_at
  //     (statement 6 bumps the loser's). The guard is an OR over the
  //     three per-column `is not null` + strict `<` conditions — a
  //     single-column guard would skip rows the other columns need.
  //     Individually idempotent: a re-run matches ZERO rows and never
  //     re-bumps updated_at. The loser's own values are deliberately NOT
  //     nulled — they stay out of statement 6's SET, resolving to nobody
  //     on the tombstone.
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

  // 5e. The loser's notification-send ledger rows UNION onto the winner.
  //     Without this, a same-day merge of a claimed loser into an
  //     unclaimed at-risk winner RE-NUDGES the winner. sent_at is COPIED,
  //     never now(); a PK collision keeps the winner's row — the row's
  //     whole function is "do not send again", so whichever survives is
  //     immaterial. Individually idempotent.
  await db.execute(sql`
    insert into notification_sends (user_id, date, channel, sent_at)
    select ${winnerId}::uuid, date, channel, sent_at
      from notification_sends where user_id = ${loserId}
    on conflict (user_id, date, channel) do nothing
  `);
  // 5f. The loser's ledger rows go — "emptied" means EMPTIED. Trivially
  //     idempotent.
  await db.execute(
    sql`delete from notification_sends where user_id = ${loserId}`,
  );

  // 6. Empty the shell: every identity handle nulled so no handle can
  //    ever resolve to a tombstone. Consent timestamps deliberately
  //    untouched (LGPD evidence). The identity-handle guard makes this
  //    idempotent: a re-run finds every handle already null and touches
  //    ZERO rows, never re-bumping updated_at.
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
