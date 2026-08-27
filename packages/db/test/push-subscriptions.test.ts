import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { pushSubscriptions, users } from "../src/schema";
import { createTestDb } from "../src/testing";

let ctx: Awaited<ReturnType<typeof createTestDb>>;

beforeAll(async () => {
  ctx = await createTestDb();
}, 30_000);

beforeEach(async () => {
  await ctx.db.execute(sql`truncate table users cascade`);
});

afterAll(async () => {
  await ctx.close();
});

async function createUser(): Promise<string> {
  const inserted = await ctx.db.insert(users).values({}).returning();
  const user = inserted[0];
  if (!user) {
    throw new Error("users insert returned no row");
  }
  return user.id;
}

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

    const pk = await ctx.db.execute(
      sql`select kcu.column_name
            from information_schema.table_constraints tc
            join information_schema.key_column_usage kcu
              on tc.constraint_name = kcu.constraint_name
           where tc.table_name = 'push_subscriptions'
             and tc.constraint_type = 'PRIMARY KEY'`,
    );
    expect(pk.rows.map((row) => row["column_name"])).toEqual(["endpoint"]);

    const indexes = await ctx.db.execute(
      sql`select indexname from pg_indexes
           where tablename = 'push_subscriptions' order by indexname`,
    );
    expect(indexes.rows.map((row) => row["indexname"])).toEqual([
      "push_subscriptions_pkey",
      "push_subscriptions_user_id_idx",
    ]);

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

    const userId = await createUser();
    const rows = await ctx.db
      .select({ pushPromptDismissedAt: users.pushPromptDismissedAt })
      .from(users)
      .where(eq(users.id, userId));
    expect(rows).toEqual([{ pushPromptDismissedAt: null }]);
  });
});
