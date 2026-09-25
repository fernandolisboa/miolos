import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { attachTokens, users } from "../src/schema";
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

describe("attach_tokens (migration 0004, ADR-0050 decision 2)", () => {
  it("T-DB-S28: created_at is DB-side, the user cascade deletes the rows, and the hash PK rejects a duplicate", async () => {
    const userId = await createUser();

    await ctx.db.insert(attachTokens).values({
      tokenHash: "hash-1",
      userId,
      email: "jogador@example.com",
    });

    const rows = await ctx.db.select().from(attachTokens);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.createdAt).toBeInstanceOf(Date);

    expect(rows[0]?.reminderConsent).toBe(false);

    const duplicate = await thrownBy(
      ctx.db.insert(attachTokens).values({
        tokenHash: "hash-1",
        userId,
        email: "outra@example.com",
      }),
    );
    expect(duplicate).toBeInstanceOf(Error);
    expect(messages(duplicate)).toContain("attach_tokens");

    await ctx.db.delete(users).where(eq(users.id, userId));
    expect(await ctx.db.select().from(attachTokens)).toEqual([]);
  });
});

describe("users_verified_email_uq (migration 0004, ADR-0050 decision 6)", () => {
  it("T-DB-S29: at most one VERIFIED holder per email; unverified and NULL rows are exempt", async () => {
    const holder = await createUser();
    await ctx.db
      .update(users)
      .set({ email: "uma@example.com", emailVerifiedAt: sql`now()` })
      .where(eq(users.id, holder));

    const rival = await createUser();
    const thrown = await thrownBy(
      ctx.db
        .update(users)
        .set({ email: "uma@example.com", emailVerifiedAt: sql`now()` })
        .where(eq(users.id, rival)),
    );
    expect(thrown).toBeInstanceOf(Error);
    expect(messages(thrown)).toContain("users_verified_email_uq");

    const unverified = await createUser();
    expect(
      await thrownBy(
        ctx.db
          .update(users)
          .set({ email: "uma@example.com" })
          .where(eq(users.id, unverified)),
      ),
    ).toBeUndefined();

    const unverified2 = await createUser();
    expect(
      await thrownBy(
        ctx.db
          .update(users)
          .set({ email: "uma@example.com" })
          .where(eq(users.id, unverified2)),
      ),
    ).toBeUndefined();

    expect(await ctx.db.select().from(users)).toHaveLength(4);
  });
});

describe("consent withdrawal columns (migration 0012, ADR-0082 decision 1)", () => {
  it("T-DB-S90: users carries two nullable timestamptz withdrawal columns with no default, so a fresh row reads never-withdrawn", async () => {
    const columns = await ctx.db.execute(
      sql`select column_name, data_type, is_nullable, column_default
           from information_schema.columns
           where table_schema = 'public' and table_name = 'users'
             and column_name like '%_consent_withdrawn_at'
           order by column_name`,
    );
    expect(columns.rows).toEqual([
      {
        column_name: "recovery_consent_withdrawn_at",
        data_type: "timestamp with time zone",
        is_nullable: "YES",
        column_default: null,
      },
      {
        column_name: "reminder_consent_withdrawn_at",
        data_type: "timestamp with time zone",
        is_nullable: "YES",
        column_default: null,
      },
    ]);

    const userId = await createUser();
    const rows = await ctx.db.select().from(users).where(eq(users.id, userId));
    expect(rows[0]?.recoveryConsentWithdrawnAt).toBeNull();
    expect(rows[0]?.reminderConsentWithdrawnAt).toBeNull();
  });
});
