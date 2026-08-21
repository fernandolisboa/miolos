import { eq, pushSubscriptions, sql, users, type Db } from "@miolos/db";

/**
 * The push statements (#145, ADR-0064) — the onboarding/service.ts
 * precedent: auth plumbing is the api's; `packages/db` owns tables and
 * cross-table OPERATIONS (the merge — statement 1b lives there), never
 * route-shaped workflows. Takes the db, returns plain data — no Response
 * construction here.
 *
 * NO JS `Date` appears in any statement (the schema.ts law): the stamp and
 * every created_at are DB-side `now()`/defaults.
 */

/**
 * The per-user subscription ceiling (#146, ADR-0067 decision 1 — the #145
 * step-6 residual closed). 10 covers any real device fleet (phone +
 * desktop + tablet + spare browsers) with slack; the threat is one session
 * inserting unbounded DISTINCT endpoints — attacker-invented https URLs
 * the Zod floor admits — that the dispatcher must then HTTP-request every
 * tick. A write-side ceiling bounds storage AND sends; a dispatch-side cap
 * would bound neither storage nor honesty.
 */
export const PUSH_SUBSCRIPTION_CEILING = 10;

/**
 * The subscribe write: an upsert on the endpoint PK, because the browser
 * install is the authority for its own capability URL — a re-subscribe
 * after key rotation updates the keys in place, and an endpoint whose
 * browser now carries a different session cookie follows that user (the
 * install IS the device; whoever it authenticates as owns its channel).
 * No transactions over neon-http: the upsert is the race-safety — two
 * concurrent POSTs of one endpoint both land, last write wins, one row.
 *
 * THE CEILING IS FOLDED INTO THE INSERT (#146, ADR-0067 decision 1 — the
 * `guardedInsertSelect` precedent in completions.ts, where check-then-act
 * was MEASURED broken): the proposed row is guarded by "the user is under
 * the ceiling, OR this exact (endpoint, user) row already exists". The
 * `exists` disjunct is load-bearing — without it, `ON CONFLICT DO UPDATE`
 * never fires at the cap because no row is proposed, and a key-rotation
 * re-subscribe on a full account would silently fail. And it is SCOPED to
 * the caller's `(endpoint, user_id)` on purpose: unscoped (`endpoint`
 * alone) it defeats the cap against its own threat model — the upsert
 * repoints an endpoint to the posting user (the `created_at` CASE below
 * exists precisely for that), so a second anonymous session could mint 10
 * attacker-invented endpoints and the first session could re-post them to
 * itself, `exists` passing each round, accumulating unbounded rows — the
 * exact residual this cap closes, re-opened through a side door.
 *
 * Returns whether a row landed, so the route can 429. At the cap: a NEW
 * endpoint stores nothing (429); a same-user re-subscribe of an existing
 * endpoint upserts normally; a CROSS-USER repoint also stores nothing
 * (429) — correct, since the repoint would raise the new owner's fan-out
 * past the ceiling. Honest residuals: (i) READ COMMITTED lets concurrent
 * in-flight inserts overshoot by the number in flight (ADR-0053
 * decision 13's exact bound); (ii) the at-cap cross-user-repoint refusal —
 * a full account cannot take over an endpoint another user holds until it
 * frees a slot.
 */
export async function upsertSubscription(
  db: Db,
  init: {
    userId: string;
    endpoint: string;
    p256dh: string;
    auth: string;
  },
): Promise<{ stored: boolean }> {
  // The select list's column order is the TABLE's (drizzle builds the
  // INSERT column list from the table object): endpoint, user_id, p256dh,
  // auth, created_at. `now()` written out — INSERT … SELECT has no DEFAULT
  // keyword (the guardedInsertSelect register); still no JS Date.
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
        // `created_at` is the consent evidence (ADR-0064 decision 2), so
        // it must attest to the CURRENT owner (#145 step-6 security 3): a
        // same-user re-subscribe after key rotation keeps the original
        // stamp — the consent act is unchanged — but a repoint to a
        // different account is a new consent by a new owner, so the stamp
        // refreshes. DB-side `now()`, per the schema.ts law.
        createdAt: sql`case
          when ${pushSubscriptions.userId} = ${init.userId}
          then ${pushSubscriptions.createdAt}
          else now() end`,
      },
    })
    .returning();
  return { stored: inserted.length > 0 };
}

/**
 * The dispatcher's fan-out read (#146): every subscription row a claimed
 * candidate owns, exactly the three fields a web-push send needs. Rides
 * `push_subscriptions_user_id_idx` — the index's own doc block names this
 * read. `created_at` deliberately not projected: consent evidence is not
 * send input.
 */
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

/**
 * The 404/410 prune (#146, ADR-0064 decision 9): delete by endpoint PK,
 * NO user scope — deliberately unlike `deleteSubscription` above, whose
 * own-rows-only conjunct is a SESSION-boundary defence (no session may
 * delete another account's channel). No session is on this path: the
 * dispatcher acts on rows it just read, and a 404/410 is the push
 * service's verdict about the ENDPOINT itself — whoever the row says owns
 * it, the capability URL is dead. Idempotent: pruning an already-pruned
 * endpoint removes zero rows.
 */
export async function pruneSubscription(
  db: Db,
  endpoint: string,
): Promise<void> {
  await db
    .delete(pushSubscriptions)
    .where(eq(pushSubscriptions.endpoint, endpoint));
}

/**
 * The unsubscribe write: own rows only — the endpoint AND the caller's
 * user id, so no session can delete another account's channel even by
 * knowing its capability URL. Idempotent: deleting an absent or
 * foreign-owned row removes zero rows, and the route answers
 * `{removed: true}` either way (the browser-side state is what the caller
 * is reconciling, not a row count).
 */
export async function deleteSubscription(
  db: Db,
  userId: string,
  endpoint: string,
): Promise<void> {
  // The compound where rides the sql template (the dismissPushPrompt
  // spelling below): apps/api deliberately takes no direct drizzle-orm
  // dependency — `@miolos/db` re-exports only `eq` and `sql`.
  await db.delete(pushSubscriptions).where(
    sql`${pushSubscriptions.endpoint} = ${endpoint}
          and ${pushSubscriptions.userId} = ${userId}`,
  );
}

/**
 * The account half of GET /notifications/state (the getOnboardingState
 * shape): the dismissal timestamp, compared to NULL by the route and never
 * shipped to the client (ADR-0048 decision 3).
 */
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

/**
 * The explicit, permanent dismissal (the markOnboardingSeen shape) —
 * decline and browser denial both land here, once per account: idempotent
 * by the DB-side guard — a re-post matches zero rows, never re-bumps
 * `updated_at` (it joins schema.ts's writer list) and never moves the
 * recorded moment.
 */
export async function dismissPushPrompt(db: Db, userId: string): Promise<void> {
  await db
    .update(users)
    .set({ pushPromptDismissedAt: sql`now()`, updatedAt: sql`now()` })
    .where(
      sql`${users.id} = ${userId} and ${users.pushPromptDismissedAt} is null`,
    );
}
