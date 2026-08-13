import type { MergeableCompletion } from "@miolos/core";
import { and, asc, eq, inArray, isNotNull, or, sql } from "drizzle-orm";

import type { Db } from "./client";
import { onTimeSql } from "./completions";
import { completions, sessions, users } from "./schema";

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
      onTime: onTimeSql(),
      completedAtOrder: completedAtOrderSql(),
    })
    .from(completions)
    .where(eq(completions.userId, userId))
    .orderBy(asc(completions.completedAt));
}

/**
 * ADR-0009 executed (ADR-0049): sessions remapped FIRST, earliest-wins
 * repoint (D6's two statements — `ON CONFLICT DO NOTHING` alone would keep
 * the winner's LATER row), loser emptied and retained as a tombstone. The
 * winner is deterministic from the data: older `created_at`, exact ties to
 * the lower id, selected DB-side (D8).
 *
 * No transaction is usable over the union `Db` (D7: neon-http is
 * non-interactive-only, PGlite has no batch) — every statement is
 * individually idempotent and RE-RUNNING THE MERGE IS THE CRASH RECOVERY
 * ("run it twice, get the same account", proved by T-DB-S20). `a === b`
 * is a no-op. Throws on an unknown id: a merge against a typo must be
 * loud, not creative.
 *
 * EXTENSION POINT: account-scoped tables acquire their merge duty HERE —
 * #30's curated medal grants (union-and-dedupe), the rewarded-ad ticket's
 * same-day hint grants if it ever cares (ADR-0049; hint grants are NOT
 * carried today — day-scoped, structurally expiring, writer-less in v1,
 * plan 029 D12). #58's stored on_time joins the repoint statement's
 * explicit column list when it lands.
 */
export async function mergeAccounts(
  db: Db,
  a: string,
  b: string,
): Promise<{ winnerId: string; loserId: string }> {
  // Step 0, the one read: existence check and winner selection in a single
  // DB-side ORDER BY — no JS Date comparison enters this package.
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
  //    would reclassify an on-time completion as late (recordCompletion's
  //    own warning, at merge scale). The column list is exhaustive over
  //    today's schema; #58's stored on_time joins it when it lands.
  await db.execute(sql`
    insert into completions
      (user_id, game, date, completed_at, outcome, elapsed_ms, hints_used, guesses)
    select ${winnerId}::uuid, game, date, completed_at, outcome, elapsed_ms, hints_used, guesses
      from completions where user_id = ${loserId}
      order by completed_at asc
    on conflict (user_id, game, date) do nothing
  `);

  // 4. Statement (iii): the loser's originals go, now that every key
  //    survives on the winner.
  await db.delete(completions).where(eq(completions.userId, loserId));

  // 5. Empty the shell: every identity handle nulled — current AND future
  //    (the social ids have no writer today, so nulling them is provably
  //    inert) — so no handle can ever resolve to a tombstone. Consent
  //    timestamps deliberately untouched: LGPD evidence, #21's semantics.
  //    updated_at set explicitly to DB-side now() (schema.ts's own
  //    instruction). The identity-handle guard makes this statement
  //    individually idempotent like the other four: a re-run finds every
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
