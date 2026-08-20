import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { pushSubscriptions, users } from "../src/schema";
import { createTestDb } from "../src/testing";

// Migration 0007's table at the row level (#145, ADR-0064; the #32 shape
// §2): push_subscriptions — endpoint PK (the browser install's capability
// URL), user FK cascade, the RFC 8291 client keys, and created_at as the
// consent evidence (the ADR-0022 idiom). The STATEMENTS over it live in
// apps/api/src/push/service.ts and are pinned at that seam; the merge remap
// (statement 1b) is pinned in merge.test.ts (T-DB-S67).
let ctx: Awaited<ReturnType<typeof createTestDb>>;

// Hook budget 30_000 ms, over vitest's bare 10_000 ms hook default. The
// measured figures behind it — isolated, capped, uncapped and CI — why it is
// not re-derived, and the re-derivation tripwire live once, beside
// `createTestDb` in `@miolos/db/testing` (ADR-0055 decision 1 as amended by
// #114; ADR-0057). Do not restate them here — 26 copies rot 26 ways.
beforeAll(async () => {
  ctx = await createTestDb();
}, 30_000);

beforeEach(async () => {
  await ctx.db.execute(sql`truncate table users cascade`);
});

afterAll(async () => {
  await ctx.close();
});

/** A fresh anonymous identity — the FK parent every subscription needs. */
async function createUser(): Promise<string> {
  const inserted = await ctx.db.insert(users).values({}).returning();
  const user = inserted[0];
  if (!user) {
    throw new Error("users insert returned no row");
  }
  return user.id;
}

/** Runs `statement` and returns whatever it threw (undefined when it did not). */
async function thrownBy(statement: Promise<unknown>): Promise<unknown> {
  try {
    await statement;
    return undefined;
  } catch (error) {
    return error;
  }
}

describe("push_subscriptions (migration 0007, ADR-0064)", () => {
  it("T-DB-S66: the column set is pinned exactly — endpoint PK, user FK cascade, the two RFC 8291 keys, DB-side created_at — with the user index present", async () => {
    // The exact column set (the T-DB-20 idiom): a column named like a
    // balance, a stored habitual window (the #32 shape derives it at read
    // time), or a separate consent flag (the timestamp IS the consent
    // evidence) all fail this list on arrival.
    const columns = await ctx.db.execute(
      sql`select column_name, is_nullable, data_type
            from information_schema.columns
           where table_schema = 'public' and table_name = 'push_subscriptions'
           order by column_name`,
    );
    expect(
      columns.rows.map((row) => [
        row["column_name"],
        row["is_nullable"],
        row["data_type"],
      ]),
    ).toEqual([
      ["auth", "NO", "text"],
      ["created_at", "NO", "timestamp with time zone"],
      ["endpoint", "NO", "text"],
      ["p256dh", "NO", "text"],
      ["user_id", "NO", "uuid"],
    ]);

    // The PK is the endpoint — the browser install is the authority for
    // its own capability URL, so uniqueness is per install, never per user.
    const pk = await ctx.db.execute(
      sql`select kcu.column_name
            from information_schema.table_constraints tc
            join information_schema.key_column_usage kcu
              on tc.constraint_name = kcu.constraint_name
           where tc.table_name = 'push_subscriptions'
             and tc.constraint_type = 'PRIMARY KEY'`,
    );
    expect(pk.rows.map((row) => row["column_name"])).toEqual(["endpoint"]);

    // The user index (the sessions-index precedent): the dispatcher's read
    // and the merge remap both scan by user.
    const indexes = await ctx.db.execute(
      sql`select indexname from pg_indexes
           where tablename = 'push_subscriptions' order by indexname`,
    );
    expect(indexes.rows.map((row) => row["indexname"])).toEqual([
      "push_subscriptions_pkey",
      "push_subscriptions_user_id_idx",
    ]);

    // Row level: created_at is DB-side (no JS Date in any insert — the
    // schema.ts law), several rows per user is the design (phone +
    // desktop), a duplicate endpoint is impossible as a bare INSERT (the
    // service's upsert is the only re-subscribe path), and the user
    // cascade deletes the rows — which is why account deletion needs no
    // subscription cleanup of its own.
    const userId = await createUser();
    await ctx.db.insert(pushSubscriptions).values([
      {
        endpoint: "https://push.example.org/send/phone",
        userId,
        p256dh: "p1",
        auth: "a1",
      },
      {
        endpoint: "https://push.example.org/send/desktop",
        userId,
        p256dh: "p2",
        auth: "a2",
      },
    ]);
    const rows = await ctx.db.select().from(pushSubscriptions);
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.createdAt instanceof Date)).toBe(true);

    const duplicate = await thrownBy(
      ctx.db.insert(pushSubscriptions).values({
        endpoint: "https://push.example.org/send/phone",
        userId,
        p256dh: "p3",
        auth: "a3",
      }),
    );
    expect(duplicate).toBeInstanceOf(Error);

    await ctx.db.delete(users).where(eq(users.id, userId));
    expect(await ctx.db.select().from(pushSubscriptions)).toEqual([]);
  });
});

describe("users.push_prompt_dismissed_at (migration 0007, #145, ADR-0064)", () => {
  it("T-DB-S69: the column exists on users, is nullable with no default, and a freshly minted user has it NULL", async () => {
    // The migration's own shape, read from the live catalog (the T-DB-S62
    // clone): nullable, no default — every existing row satisfies it
    // instantly, which is what made applying 0007 ahead of the deploy a
    // provable non-event.
    const catalog = await ctx.db.execute(sql`
      select is_nullable, column_default, data_type
        from information_schema.columns
       where table_name = 'users' and column_name = 'push_prompt_dismissed_at'
    `);
    expect(catalog.rows).toEqual([
      {
        is_nullable: "YES",
        column_default: null,
        data_type: "timestamp with time zone",
      },
    ]);

    // A mint-shaped insert (`values({})` — mintSession's own statement):
    // the fact starts NULL, i.e. "never dismissed", for every new identity.
    const userId = await createUser();
    const rows = await ctx.db
      .select({ pushPromptDismissedAt: users.pushPromptDismissedAt })
      .from(users)
      .where(eq(users.id, userId));
    expect(rows).toEqual([{ pushPromptDismissedAt: null }]);
  });
});
