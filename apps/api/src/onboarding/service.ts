import { eq, sql, users, type Db } from "@miolos/db";

/**
 * The onboarding statements (#35, ADR-0061) — the attach/service.ts
 * precedent: auth plumbing is the api's; `packages/db` owns tables and
 * cross-table OPERATIONS (the merge), never route-shaped workflows. Takes
 * the db, returns plain data — no Response construction here.
 *
 * NO JS `Date` appears in any statement (the schema.ts law): the stamp is
 * DB-side `now()`.
 */

/**
 * The account half of GET /onboarding/state (the getAttachAccountState
 * shape): the seen timestamp, compared to NULL by the route and never
 * shipped to the client (ADR-0048 decision 3).
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
 * The explicit, permanent acknowledgement (the dismissAttachPrompt shape):
 * idempotent by the DB-side guard — a re-post matches zero rows, never
 * re-bumps `updated_at` and never moves the recorded moment.
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
