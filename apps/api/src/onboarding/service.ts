import { eq, sql, users, type Db } from "@miolos/db";

/**
 * The onboarding statements — the attach/service.ts precedent: auth
 * plumbing is the api's; `packages/db` owns tables and cross-table
 * operations (the merge), never route-shaped workflows. Takes the db,
 * returns plain data — no Response construction here.
 *
 * No JS `Date` appears in any statement: the stamp is DB-side `now()`.
 *
 * See ADR-0061.
 */

/**
 * The account half of GET /onboarding/state: the seen timestamp, compared
 * to NULL by the route and never shipped to the client.
 */
export async function getOnboardingState(
  db: Db,
  userId: string,
): Promise<{ onboardingSeenAt: Date | null } | undefined> {
  const rows = await db
    .select({ onboardingSeenAt: users.onboardingSeenAt })
    .from(users)
    .where(eq(users.id, userId));
  return rows[0];
}

/**
 * The explicit, permanent acknowledgement: idempotent by the DB-side
 * guard — a re-post matches zero rows, never re-bumps `updated_at` and
 * never moves the recorded moment.
 */
export async function markOnboardingSeen(
  db: Db,
  userId: string,
): Promise<void> {
  await db
    .update(users)
    .set({ onboardingSeenAt: sql`now()`, updatedAt: sql`now()` })
    .where(sql`${users.id} = ${userId} and ${users.onboardingSeenAt} is null`);
}
