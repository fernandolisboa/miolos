import { eq, pushSubscriptions, sql, users, type Db } from "@miolos/db";

export const PUSH_SUBSCRIPTION_CEILING = 10;

export async function upsertSubscription(
  db: Db,
  init: {
    userId: string;
    endpoint: string;
    p256dh: string;
    auth: string;
  },
): Promise<{ stored: boolean; inserted: boolean }> {
  const held = await db
    .select({ endpoint: pushSubscriptions.endpoint })
    .from(pushSubscriptions)
    .where(
      sql`${pushSubscriptions.endpoint} = ${init.endpoint}
            and ${pushSubscriptions.userId} = ${init.userId}::uuid`,
    )
    .limit(1);

  const inserted = await db
    .insert(pushSubscriptions)
    .select(
      sql`select ${init.endpoint}::text, ${init.userId}::uuid, ${init.p256dh}::text, ${init.auth}::text, now()
        where (
          select count(*) from ${pushSubscriptions}
          where ${pushSubscriptions.userId} = ${init.userId}::uuid
        ) < ${PUSH_SUBSCRIPTION_CEILING}
        or exists (
          select 1 from ${pushSubscriptions}
          where ${pushSubscriptions.endpoint} = ${init.endpoint}::text
            and ${pushSubscriptions.userId} = ${init.userId}::uuid
        )`,
    )
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: {
        userId: init.userId,
        p256dh: init.p256dh,
        auth: init.auth,

        createdAt: sql`case
          when ${pushSubscriptions.userId} = ${init.userId}
          then ${pushSubscriptions.createdAt}
          else now() end`,
      },
    })
    .returning();
  const stored = inserted.length > 0;
  return { stored, inserted: stored && held.length === 0 };
}

export async function listSubscriptions(
  db: Db,
  userId: string,
): Promise<{ endpoint: string; p256dh: string; auth: string }[]> {
  return db
    .select({
      endpoint: pushSubscriptions.endpoint,
      p256dh: pushSubscriptions.p256dh,
      auth: pushSubscriptions.auth,
    })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));
}

export async function pruneSubscription(
  db: Db,
  endpoint: string,
): Promise<void> {
  await db
    .delete(pushSubscriptions)
    .where(eq(pushSubscriptions.endpoint, endpoint));
}

export async function deleteSubscription(
  db: Db,
  userId: string,
  endpoint: string,
): Promise<void> {
  await db.delete(pushSubscriptions).where(
    sql`${pushSubscriptions.endpoint} = ${endpoint}
          and ${pushSubscriptions.userId} = ${userId}`,
  );
}

export async function getPushAccountState(
  db: Db,
  userId: string,
): Promise<{ pushPromptDismissedAt: Date | null } | undefined> {
  const rows = await db
    .select({ pushPromptDismissedAt: users.pushPromptDismissedAt })
    .from(users)
    .where(eq(users.id, userId));
  return rows[0];
}

export async function dismissPushPrompt(db: Db, userId: string): Promise<void> {
  await db
    .update(users)
    .set({ pushPromptDismissedAt: sql`now()`, updatedAt: sql`now()` })
    .where(
      sql`${users.id} = ${userId} and ${users.pushPromptDismissedAt} is null`,
    );
}
