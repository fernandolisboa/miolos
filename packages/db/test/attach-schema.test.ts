import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { attachTokens, users } from "../src/schema";
import { createTestDb } from "../src/testing";

// Migration 0004's two structures at the row level (#21, ADR-0050): the
// attach_tokens table (the sessions idiom plus expiry and single use — the
// STATEMENTS over it live in apps/api/src/attach/service.ts and are pinned
// at that seam) and the verified-email partial unique index, the mechanical
// backstop of D6's one-verified-holder invariant.
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

/** A fresh anonymous identity — the FK parent every token row needs. */
async function createUser(): Promise<string> {
  const inserted = await ctx.db.insert(users).values({}).returning();
  const user = inserted[0];
  if (!user) {
    throw new Error("users insert returned no row");
  }
  return user.id;
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

describe("attach_tokens (migration 0004, ADR-0050 decision 2)", () => {
  it("T-DB-S28: created_at is DB-side, the user cascade deletes the rows, and the hash PK rejects a duplicate", async () => {
    const userId = await createUser();
    // No createdAt supplied: the DB clock is the only clock (schema.ts law).
    await ctx.db.insert(attachTokens).values({
      tokenHash: "hash-1",
      userId,
      email: "jogador@example.com",
    });

    const rows = await ctx.db.select().from(attachTokens);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.createdAt).toBeInstanceOf(Date);
    // reminder_consent defaults false: the unchecked box is the default at
    // the row level too, not only in the UI (AC 3).
    expect(rows[0]?.reminderConsent).toBe(false);

    // The hash is the PK: a second row under the same hash is impossible.
    const duplicate = await thrownBy(
      ctx.db.insert(attachTokens).values({
        tokenHash: "hash-1",
        userId,
        email: "outra@example.com",
      }),
    );
    expect(duplicate).toBeInstanceOf(Error);
    expect(messages(duplicate)).toContain("attach_tokens");

    // Deleting the user cascades the tokens away — which is also why the
    // delete route (D13) needs no token cleanup of its own.
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

    // A second VERIFIED holder of the same email throws loudly — the
    // concurrent-confirm fork the flow alone cannot close (D6 layer 3).
    const rival = await createUser();
    const thrown = await thrownBy(
      ctx.db
        .update(users)
        .set({ email: "uma@example.com", emailVerifiedAt: sql`now()` })
        .where(eq(users.id, rival)),
    );
    expect(thrown).toBeInstanceOf(Error);
    expect(messages(thrown)).toContain("users_verified_email_uq");

    // The index is PARTIAL: the same email UNVERIFIED coexists (a state
    // #21's flow never creates — email is written only at confirm — but the
    // index must stay robust to futures where it might exist).
    const unverified = await createUser();
    expect(
      await thrownBy(
        ctx.db
          .update(users)
          .set({ email: "uma@example.com" })
          .where(eq(users.id, unverified)),
      ),
    ).toBeUndefined();

    // And a second unverified row under the same email coexists too —
    // the exemption is the predicate, not Postgres NULL semantics alone.
    const unverified2 = await createUser();
    expect(
      await thrownBy(
        ctx.db
          .update(users)
          .set({ email: "uma@example.com" })
          .where(eq(users.id, unverified2)),
      ),
    ).toBeUndefined();

    // Multiple NULL emails coexist (every anonymous row today).
    expect(await ctx.db.select().from(users)).toHaveLength(4);
  });
});
