import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { listMedalGrants } from "../src/medals";
import { medalGrants, users } from "../src/schema";
import { createTestDb } from "../src/testing";

// The #30 medal-grants suite (ADR-0052). What is pinned here and nowhere
// else: the one reader's projection (`granted_at` never selected), the
// migration-0005 constraints reaching the database, and AC 3's mechanical
// teeth — the table-set pin, the grants column pin and the
// forbidden-vocabulary column scan. Rows are inserted DIRECTLY (the
// manufactured-rows precedent): no code writer exists in v1 — the grant
// mechanism is the documented operator ritual (ADR-0052).
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
  await ctx.db.execute(sql`truncate table users, medal_grants cascade`);
});

afterAll(async () => {
  await ctx.close();
});

/** A fresh anonymous identity — the FK parent every grant below needs. */
async function createUser(): Promise<string> {
  const inserted = await ctx.db.insert(users).values({}).returning();
  const user = inserted[0];
  if (!user) {
    throw new Error("users insert returned no row");
  }
  return user.id;
}

/** The operator ritual's own statement shape (ADR-0052): a direct insert. */
async function insertGrant(userId: string, medalId: string): Promise<void> {
  await ctx.db.insert(medalGrants).values({ userId, medalId });
}

/** Drizzle wraps the driver error; the constraint name lives down the cause chain. */
function messages(error: unknown): string {
  let out = "";
  let current: unknown = error;
  while (current instanceof Error) {
    out += current.message;
    current = current.cause;
  }
  return out;
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

describe("listMedalGrants (ADR-0052)", () => {
  it("T-DB-S37: the caller's grant ids in deterministic order, granted_at never selected, other users' rows absent", async () => {
    const userId = await createUser();
    const otherUserId = await createUser();
    // Inserted out of order on purpose: the reader's order is its own.
    await insertGrant(userId, "founder");
    await insertGrant(userId, "bug-reporter");
    await insertGrant(otherUserId, "founder");

    const grants = await listMedalGrants(ctx.db, userId);
    // medal_id ascending — deterministic, and exactly the id strings: the
    // projection carries NO granted_at (no date crosses the wire,
    // ADR-0052/D6 — its readers are the merge's least() and the
    // operator's audit queries).
    expect(grants).toEqual(["bug-reporter", "founder"]);
    expect(await listMedalGrants(ctx.db, otherUserId)).toEqual(["founder"]);

    // A user with no grants reads the honest empty list.
    expect(await listMedalGrants(ctx.db, await createUser())).toEqual([]);
  });
});

describe("the migration's constraints (ADR-0006 guard, ADR-0052)", () => {
  it("T-DB-S38: medal_grants' column set is exactly the grant-event shape", async () => {
    // A future `points`, `tier`, `progress` or `revoked_at` column is the
    // accumulable/rank state ADR-0006 forbids (revocation, if ever
    // needed, is a DELETE — grants are append-only events like hint
    // grants); this tripwire makes adding one fail the suite rather than
    // pass review.
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

  it("T-DB-S39: the public base-table set deep-equals the audited eight — no wallet, ledger, XP or ranking table exists anywhere in the schema", async () => {
    // AC 3's teeth (ADR-0052): any future wallet/ledger/XP/ranking TABLE
    // fails the suite rather than passing review. Drizzle's own
    // bookkeeping lives in the `drizzle` schema, so the public deep-equal
    // is sound. The RECORDED RESIDUAL, named rather than pretended away:
    // a wallet-as-VIEW, or accumulable state hidden inside jsonb
    // (`users.entitlements`, `remote_config.value`), passes this pin —
    // the AC's own words cover tables; T-DB-S43 narrows the column half.
    const result = await ctx.db.execute(
      sql`select table_name from information_schema.tables
           where table_schema = 'public' and table_type = 'BASE TABLE'
           order by table_name`,
    );
    expect(result.rows.map((row) => row["table_name"])).toEqual([
      "attach_tokens",
      "completions",
      "daily_puzzles",
      "hint_grants",
      "medal_grants",
      "remote_config",
      "sessions",
      "users",
    ]);
  });

  it("T-DB-S40: the CHECK and PK reached the database — bad ids fail by name, duplicates fail, on conflict do nothing inserts zero", async () => {
    const userId = await createUser();

    // The shape CHECK (never a membership CHECK — catalog/DB drift must
    // be a read-time no-op, not an insert-time failure): uppercase and
    // overlong ids fail naming the constraint.
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

    // The composite PK: a duplicate (user_id, medal_id) plain insert
    // fails; the operator ritual's ON CONFLICT DO NOTHING inserts zero.
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
    // AC 3's third tooth (ADR-0052): the table-set pin alone would miss a
    // `balance` column added to `users`, and only hint_grants and
    // medal_grants carry column pins — so every public column name is
    // scanned for the vetoed-concepts vocabulary (ADR-0006). The known
    // cost — a future legitimate column matching the pattern must edit
    // this test — is the point: that edit is the review moment AC 3
    // wants. The jsonb/view residual stays named in T-DB-S39's comment.
    const result = await ctx.db.execute(
      sql`select table_name, column_name from information_schema.columns
           where table_schema = 'public'
             and column_name ~ '(balance|wallet|coin|point|credit|score|level|rank|xp)'`,
    );
    expect(result.rows).toEqual([]);
  });
});
