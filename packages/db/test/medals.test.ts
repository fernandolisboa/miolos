import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { listMedalGrants } from "../src/medals";
import { medalGrants, users } from "../src/schema";
import { createTestDb } from "../src/testing";

let ctx: Awaited<ReturnType<typeof createTestDb>>;

beforeAll(async () => {
  ctx = await createTestDb();
}, 30_000);

beforeEach(async () => {
  await ctx.db.execute(sql`truncate table users, medal_grants cascade`);
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

async function insertGrant(userId: string, medalId: string): Promise<void> {
  await ctx.db.insert(medalGrants).values({ userId, medalId });
}

function messages(error: unknown): string {
  let out = "";
  let current: unknown = error;
  while (current instanceof Error) {
    out += current.message;
    current = current.cause;
  }
  return out;
}

async function thrownBy(statement: Promise<unknown>): Promise<unknown> {
  try {
    await statement;
    return undefined;
  } catch (error) {
    return error;
  }
}

describe("listMedalGrants (ADR-0052)", () => {
  it("T-DB-S37: the caller's grant ids in deterministic order, granted_at never selected, other users' rows absent", async () => {
    const userId = await createUser();
    const otherUserId = await createUser();

    await insertGrant(userId, "founder");
    await insertGrant(userId, "bug-reporter");
    await insertGrant(otherUserId, "founder");

    const grants = await listMedalGrants(ctx.db, userId);

    expect(grants).toEqual(["bug-reporter", "founder"]);
    expect(await listMedalGrants(ctx.db, otherUserId)).toEqual(["founder"]);

    expect(await listMedalGrants(ctx.db, await createUser())).toEqual([]);
  });
});

describe("the migration's constraints (ADR-0006 guard, ADR-0052)", () => {
  it("T-DB-S38: medal_grants' column set is exactly the grant-event shape", async () => {
    const result = await ctx.db.execute(
      sql`select column_name from information_schema.columns
           where table_schema = 'public' and table_name = 'medal_grants'
           order by column_name`,
    );
    expect(result.rows.map((row) => row["column_name"])).toEqual([
      "granted_at",
      "medal_id",
      "user_id",
    ]);
  });

  it("T-DB-S39: the public base-table set deep-equals the audited set — no wallet, ledger, XP or ranking table exists anywhere in the schema", async () => {
    const result = await ctx.db.execute(
      sql`select table_name from information_schema.tables
           where table_schema = 'public' and table_type = 'BASE TABLE'
           order by table_name`,
    );
    expect(result.rows.map((row) => row["table_name"])).toEqual([
      "attach_tokens",
      "completions",
      "consent_events",
      "daily_puzzles",
      "hint_grants",
      "medal_grants",

      "notification_sends",

      "push_subscriptions",
      "remote_config",
      "sessions",

      "user_seen_days",
      "users",
    ]);
  });

  it("T-DB-S40: the CHECK and PK reached the database — bad ids fail by name, duplicates fail, on conflict do nothing inserts zero", async () => {
    const userId = await createUser();

    const uppercase = await thrownBy(
      ctx.db.execute(
        sql`insert into medal_grants (user_id, medal_id)
            values (${userId}, 'Founder')`,
      ),
    );
    expect(messages(uppercase)).toContain("medal_grants_medal_id_check");

    const overlong = await thrownBy(
      ctx.db.execute(
        sql`insert into medal_grants (user_id, medal_id)
            values (${userId}, ${"a".repeat(65)})`,
      ),
    );
    expect(messages(overlong)).toContain("medal_grants_medal_id_check");

    await insertGrant(userId, "founder");
    const duplicate = await thrownBy(
      ctx.db.execute(
        sql`insert into medal_grants (user_id, medal_id)
            values (${userId}, 'founder')`,
      ),
    );
    expect(messages(duplicate)).toContain("medal_grants_user_id_medal_id_pk");

    await ctx.db.execute(
      sql`insert into medal_grants (user_id, medal_id)
          values (${userId}, 'founder')
          on conflict (user_id, medal_id) do nothing`,
    );
    expect(await ctx.db.select().from(medalGrants)).toHaveLength(1);
  });

  it("T-DB-S43: the forbidden-vocabulary column scan returns zero rows across all public tables", async () => {
    const result = await ctx.db.execute(
      sql`select table_name, column_name from information_schema.columns
           where table_schema = 'public'
             and column_name ~ '(balance|wallet|coin|point|credit|score|level|rank|xp)'
             and not (table_name = 'push_subscriptions' and column_name = 'endpoint')`,
    );
    expect(result.rows).toEqual([]);
  });
});
