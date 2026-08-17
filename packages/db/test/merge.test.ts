import { mergeCompletions } from "@miolos/core";
import { asc, eq, getTableColumns, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  isWinnerLivenessError,
  listCompletionsForMerge,
  mergeAccounts,
} from "../src/merge";
import {
  completions,
  hintGrants,
  medalGrants,
  sessions,
  users,
} from "../src/schema";
import { createTestDb } from "../src/testing";

// The merge suite (issue #20, ADR-0009/ADR-0026/ADR-0049, plan 029 §6/§9).
// What is pinned here and nowhere else: the SQL realization of
// union-earliest-dedupe (two statements, because ON CONFLICT DO NOTHING
// alone keeps the winner's LATER row), the tombstone (sessions remapped,
// loser emptied and retained), operation-level idempotence ("run it twice,
// get the same account" — which is also the crash recovery, D7), and the
// agreement bridge pinning the pure function and the SQL to one semantics.
let ctx: Awaited<ReturnType<typeof createTestDb>>;

// Hook budget 30_000 ms. The arithmetic, both measured figures, the uncapped
// worst case and the re-derivation tripwire live once, beside `createTestDb`
// in `@miolos/db/testing` (ADR-0055 decision 1 as amended by #114; ADR-0057).
// Do not restate them here — 26 copies rot 26 ways.
beforeAll(async () => {
  ctx = await createTestDb();
}, 30_000);

/** One truncate spelling for every reset this file performs. */
async function reset(): Promise<void> {
  await ctx.db.execute(
    sql`truncate table users, completions, hint_grants, medal_grants cascade`,
  );
}

beforeEach(reset);

afterAll(async () => {
  await ctx.close();
});

// Pinned birthdays so D8's winner rule is applied by hand in fixtures:
// the OLDER account wins, and every expectation below is computable a
// priori rather than guessed from the return value.
const OLDER = new Date("2026-01-01T12:00:00.000Z");
const NEWER = new Date("2026-06-01T12:00:00.000Z");

// Unique per fixture user, never reset: birth hashes only need to never
// collide, and the truncate in beforeEach removes the rows themselves.
let birthSessionCounter = 0;

/**
 * A fresh identity with a PINNED `created_at`/`updated_at` — `updated_at`
 * pinned too, so "advanced" and "never bumped" are exact comparisons
 * against a known instant instead of a race with the DB clock — and a
 * BIRTH SESSION, because every real minted user is born with one
 * (`mintSession`'s own two inserts) and the D5 winner-liveness guard
 * asserts exactly that: the old session-less fixtures modeled users that
 * cannot exist in production (plan 031 D5's sanctioned fixture-realism
 * edit). T-DB-S26 manufactures its tombstone-shaped winner by stripping
 * this session again, deliberately.
 */
async function createUser(createdAt: Date): Promise<string> {
  const inserted = await ctx.db
    .insert(users)
    .values({ createdAt, updatedAt: createdAt })
    .returning();
  const user = inserted[0];
  if (!user) {
    throw new Error("users insert returned no row");
  }
  birthSessionCounter += 1;
  await ctx.db.insert(sessions).values({
    tokenHash: `birth-hash-${birthSessionCounter}`,
    userId: user.id,
  });
  return user.id;
}

/**
 * A history row with a chosen completion instant (the streak.test.ts
 * idiom): T15:00:00Z is 12:00 in São Paulo, so `onDay(d)` sits inside its
 * own SP day (on time) and `onDay(other)` for a different date is late.
 */
function onDay(date: string, time = "15:00:00"): Date {
  return new Date(`${date}T${time}Z`);
}

async function insertCompletion(init: {
  userId: string;
  game: "binairo" | "sudoku" | "nonogram" | "termo";
  date: string;
  completedAt: Date;
  outcome?: "won" | "lost";
  elapsedMs?: number;
  guesses?: number;
}): Promise<void> {
  await ctx.db.insert(completions).values({
    userId: init.userId,
    game: init.game,
    date: init.date,
    completedAt: init.completedAt,
    outcome: init.outcome ?? "won",
    elapsedMs: init.elapsedMs ?? 61_000,
    hintsUsed: 0,
    guesses: init.guesses,
  });
}

/** A session row with a literal token hash — the table stores only hashes. */
async function insertSession(userId: string, tokenHash: string): Promise<void> {
  await ctx.db.insert(sessions).values({ tokenHash, userId });
}

/** A dormant-in-prod grant row (no writer exists in v1) so the loser-side hint_grants cleanup is observable. */
async function insertHintGrant(userId: string, date: string): Promise<void> {
  await ctx.db
    .insert(hintGrants)
    .values({ userId, date, source: "rewarded-ad", hints: 3 });
}

/** A curated grant row (no code writer exists in v1 — the operator ritual's
 *  shape, ADR-0052) with an optional PINNED granted_at, so earliest-wins
 *  assertions compare exact instants instead of racing the DB clock. */
async function insertMedalGrant(
  userId: string,
  medalId: string,
  grantedAt?: Date,
): Promise<void> {
  await ctx.db
    .insert(medalGrants)
    .values(
      grantedAt === undefined
        ? { userId, medalId }
        : { userId, medalId, grantedAt },
    );
}

/** Deterministic full-state snapshot for the double-run and no-op checks. */
async function snapshotState(): Promise<{
  users: unknown[];
  sessions: unknown[];
  completions: unknown[];
  hintGrants: unknown[];
  medalGrants: unknown[];
}> {
  return {
    users: await ctx.db.select().from(users).orderBy(asc(users.id)),
    sessions: await ctx.db
      .select()
      .from(sessions)
      .orderBy(asc(sessions.tokenHash)),
    completions: await ctx.db
      .select()
      .from(completions)
      .orderBy(
        asc(completions.userId),
        asc(completions.game),
        asc(completions.date),
      ),
    hintGrants: await ctx.db
      .select()
      .from(hintGrants)
      .orderBy(asc(hintGrants.id)),
    medalGrants: await ctx.db
      .select()
      .from(medalGrants)
      .orderBy(asc(medalGrants.userId), asc(medalGrants.medalId)),
  };
}

describe("mergeAccounts — completions (ADR-0009, ADR-0026, ADR-0049)", () => {
  it("T-DB-S16: disjoint histories land whole on the winner with completed_at COPIED — an on-time row stays on time — and the loser holds zero", async () => {
    const winner = await createUser(OLDER);
    const loser = await createUser(NEWER);
    await insertCompletion({
      userId: winner,
      game: "binairo",
      date: "2026-08-01",
      completedAt: onDay("2026-08-01"),
    });
    await insertCompletion({
      userId: loser,
      game: "sudoku",
      date: "2026-08-02",
      completedAt: onDay("2026-08-02"),
    });

    const result = await mergeAccounts(ctx.db, winner, loser);
    expect(result).toEqual({ winnerId: winner, loserId: loser });

    const rows = await listCompletionsForMerge(ctx.db, winner);
    expect(rows).toHaveLength(2);
    // The moved row derives on time AFTER the merge: completed_at was
    // copied, never re-stamped — a defaultNow() re-stamp would have put
    // the instant outside 2026-08-02 and reclassified the row as late
    // (completions.ts's own warning, at merge scale).
    const moved = rows.find((row) => row.game === "sudoku");
    expect(moved).toEqual({
      game: "sudoku",
      date: "2026-08-02",
      outcome: "won",
      onTime: true,
      // The fixed-width to_char projection, pinned once: lexicographic
      // order on this key IS chronological order (plan 029 D3).
      completedAtOrder: "2026-08-02T15:00:00.000000Z",
    });
    expect(await listCompletionsForMerge(ctx.db, loser)).toEqual([]);
  });

  it("T-DB-S17: collisions — the earliest wins in both directions, an exact tie keeps the winner's row, and an on-time survivor never becomes late", async () => {
    const winner = await createUser(OLDER);
    const loser = await createUser(NEWER);
    // Loser earlier: the winner's LATER duplicate must be dropped first —
    // ON CONFLICT DO NOTHING alone would keep it (D6's statement (i)).
    await insertCompletion({
      userId: winner,
      game: "binairo",
      date: "2026-08-01",
      completedAt: onDay("2026-08-01", "18:00:00"),
      elapsedMs: 111,
    });
    await insertCompletion({
      userId: loser,
      game: "binairo",
      date: "2026-08-01",
      completedAt: onDay("2026-08-01", "15:00:00"),
      elapsedMs: 222,
    });
    // Winner earlier: the conflict keeps exactly the row ADR-0009 names.
    await insertCompletion({
      userId: winner,
      game: "sudoku",
      date: "2026-08-02",
      completedAt: onDay("2026-08-02", "15:00:00"),
      elapsedMs: 333,
    });
    await insertCompletion({
      userId: loser,
      game: "sudoku",
      date: "2026-08-02",
      completedAt: onDay("2026-08-02", "18:00:00"),
      elapsedMs: 444,
    });
    // Exact tie: strict < in statement (i), so the winner's row survives —
    // agreeing with the pure function's first-argument rule (T-CORE-S38).
    await insertCompletion({
      userId: winner,
      game: "nonogram",
      date: "2026-08-03",
      completedAt: onDay("2026-08-03", "15:00:00"),
      elapsedMs: 555,
    });
    await insertCompletion({
      userId: loser,
      game: "nonogram",
      date: "2026-08-03",
      completedAt: onDay("2026-08-03", "15:00:00"),
      elapsedMs: 666,
    });

    await mergeAccounts(ctx.db, winner, loser);

    const raw = await ctx.db
      .select()
      .from(completions)
      .orderBy(asc(completions.game));
    expect(raw.map((row) => row.userId)).toEqual([winner, winner, winner]);
    // elapsed_ms identifies WHOSE row survived; completed_at shows it was
    // carried, not re-stamped.
    expect(
      raw.map((row) => ({
        game: row.game,
        elapsedMs: row.elapsedMs,
        completedAt: row.completedAt.toISOString(),
      })),
    ).toEqual([
      {
        game: "binairo",
        elapsedMs: 222,
        completedAt: "2026-08-01T15:00:00.000Z",
      },
      {
        game: "nonogram",
        elapsedMs: 555,
        completedAt: "2026-08-03T15:00:00.000Z",
      },
      {
        game: "sudoku",
        elapsedMs: 333,
        completedAt: "2026-08-02T15:00:00.000Z",
      },
    ]);
    // The never-downgrade corollary (ADR-0026's consequence): every
    // survivor here is the EARLIEST instant for its key and derives on
    // time — a merge can never downgrade an on-time completion to late.
    const projected = await listCompletionsForMerge(ctx.db, winner);
    expect(projected.every((row) => row.onTime)).toBe(true);
  });
});

describe("mergeAccounts — tombstone (ADR-0022, ADR-0049 decision 4)", () => {
  it("T-DB-S18: every loser session is remapped to the winner; the winner's own sessions are untouched", async () => {
    const winner = await createUser(OLDER);
    const loser = await createUser(NEWER);
    await insertSession(winner, "hash-winner-1");
    await insertSession(loser, "hash-loser-1");
    await insertSession(loser, "hash-loser-2");

    await mergeAccounts(ctx.db, winner, loser);

    // AC 3 at the row level: the cookie→identity mapping is ONE select on
    // sessions.token_hash (service.ts), so after the remap the loser's
    // cookies resolve to the merged identity through the only mechanism
    // that exists. Remap, never delete: a deleted session would re-mint —
    // the revived empty account ADR-0009 forbids. Baseline +2: the two
    // birth sessions the createUser fixture now mints (D5 fixture realism)
    // are remapped exactly like the explicit ones.
    const rows = await ctx.db
      .select()
      .from(sessions)
      .orderBy(asc(sessions.tokenHash));
    expect(rows).toHaveLength(5);
    expect(rows.every((row) => row.userId === winner)).toBe(true);
    expect(rows.map((row) => row.tokenHash)).toEqual(
      expect.arrayContaining(["hash-loser-1", "hash-loser-2", "hash-winner-1"]),
    );
  });

  it("T-DB-S19: the loser row is emptied of every identity handle and RETAINED with updated_at advanced, its hint grants deleted; an all-null anonymous loser never bumps at all", async () => {
    const winner = await createUser(OLDER);
    const loser = await createUser(NEWER);
    // No production writer of users identity columns exists yet (#21 owns
    // the first email write), so the fixture writes directly — without a
    // non-null handle, "updated_at advanced" would be unobservable under
    // D7 step 5's idempotence guard.
    const consentAt = new Date("2026-07-01T12:00:00.000Z");
    await ctx.db
      .update(users)
      .set({ email: "loser@example.com", recoveryConsentAt: consentAt })
      .where(eq(users.id, loser));
    await ctx.db
      .update(users)
      .set({ email: "winner@example.com" })
      .where(eq(users.id, winner));
    await insertSession(loser, "hash-loser-1");
    await insertCompletion({
      userId: loser,
      game: "binairo",
      date: "2026-08-01",
      completedAt: onDay("2026-08-01"),
    });
    // A grant on the loser (fixture-written; no production writer exists in
    // v1) so the "emptied" assertion below actually bites.
    await insertHintGrant(loser, "2026-08-01");

    await mergeAccounts(ctx.db, winner, loser);

    const loserRows = await ctx.db
      .select()
      .from(users)
      .where(eq(users.id, loser));
    const tombstone = loserRows[0];
    // Retained, never deleted: a session-less, handle-less row is
    // permanently unresurrectable — no code path mints a session against
    // an existing user (ADR-0049 decision 4).
    expect(tombstone).toBeDefined();
    expect(tombstone?.email).toBeNull();
    expect(tombstone?.emailVerifiedAt).toBeNull();
    expect(tombstone?.appleId).toBeNull();
    expect(tombstone?.googleId).toBeNull();
    // Consent timestamps are LGPD evidence and deliberately NOT touched —
    // their merge semantics belong to #21 (plan 029 D9).
    expect(tombstone?.recoveryConsentAt?.toISOString()).toBe(
      consentAt.toISOString(),
    );
    expect(tombstone?.updatedAt.getTime()).toBeGreaterThan(NEWER.getTime());
    // Emptied: zero completions, zero sessions, zero hint grants — no row
    // of any account-scoped table keeps referencing the tombstone. Grants
    // are DELETED, never carried to the winner (ADR-0049 decision 6:
    // day-scoped, structurally expiring — not history).
    expect(
      await ctx.db
        .select()
        .from(completions)
        .where(eq(completions.userId, loser)),
    ).toEqual([]);
    expect(
      await ctx.db.select().from(sessions).where(eq(sessions.userId, loser)),
    ).toEqual([]);
    expect(
      await ctx.db
        .select()
        .from(hintGrants)
        .where(eq(hintGrants.userId, loser)),
    ).toEqual([]);
    // The winner's identity columns are untouched.
    const winnerRow = (
      await ctx.db.select().from(users).where(eq(users.id, winner))
    )[0];
    expect(winnerRow?.email).toBe("winner@example.com");

    // The corollary D7 step 5 states: an all-null anonymous loser — the
    // only kind that exists before #21 writes an email — never matches the
    // guard, so its updated_at never bumps at all.
    const winner2 = await createUser(OLDER);
    const loser2 = await createUser(NEWER);
    await mergeAccounts(ctx.db, winner2, loser2);
    const anonymous = (
      await ctx.db.select().from(users).where(eq(users.id, loser2))
    )[0];
    expect(anonymous?.updatedAt.toISOString()).toBe(NEWER.toISOString());
  });
});

describe("mergeAccounts — idempotence and the winner rule (ADR-0009, ADR-0049)", () => {
  it("T-DB-S20: run it twice, get the same account — the full users+sessions+completions+hint_grants+medal_grants state after run one deep-equals run two", async () => {
    const winner = await createUser(OLDER);
    const loser = await createUser(NEWER);
    await ctx.db
      .update(users)
      .set({ email: "loser@example.com" })
      .where(eq(users.id, loser));
    await insertSession(winner, "hash-winner-1");
    await insertSession(loser, "hash-loser-1");
    // Collisions in both directions, a disjoint row, and a lost Termo, so
    // the second run crosses every statement's path.
    await insertCompletion({
      userId: winner,
      game: "binairo",
      date: "2026-08-01",
      completedAt: onDay("2026-08-01", "18:00:00"),
    });
    await insertCompletion({
      userId: loser,
      game: "binairo",
      date: "2026-08-01",
      completedAt: onDay("2026-08-01", "15:00:00"),
    });
    await insertCompletion({
      userId: winner,
      game: "sudoku",
      date: "2026-08-02",
      completedAt: onDay("2026-08-02", "15:00:00"),
    });
    await insertCompletion({
      userId: loser,
      game: "sudoku",
      date: "2026-08-02",
      completedAt: onDay("2026-08-02", "18:00:00"),
    });
    await insertCompletion({
      userId: loser,
      game: "termo",
      date: "2026-08-03",
      completedAt: onDay("2026-08-03"),
      outcome: "lost",
      guesses: 6,
    });
    // Grants on BOTH sides: the loser's exercises the hint_grants delete on
    // both runs; the winner's must survive untouched — asserted DIRECTLY
    // below, because a snapshot alone cannot see an unscoped DELETE (both
    // runs would deep-equal an identical zero-grant state).
    await insertHintGrant(winner, "2026-08-01");
    await insertHintGrant(loser, "2026-08-01");
    // Medal grants on BOTH sides too (the same precedent): the loser's
    // exercises the union+delete pair on both runs, and the winner's own
    // grant surviving WITH ITS OWN granted_at is asserted directly below.
    const winnerGrantedAt = new Date("2026-07-01T12:00:00.000Z");
    await insertMedalGrant(winner, "founder", winnerGrantedAt);
    await insertMedalGrant(loser, "bug-reporter", NEWER);

    const first = await mergeAccounts(ctx.db, winner, loser);
    const afterFirst = await snapshotState();
    // Exactly the winner's grant survives run one: the delete is scoped to
    // the loser, not the table.
    const survivingGrants = await ctx.db.select().from(hintGrants);
    expect(survivingGrants).toHaveLength(1);
    expect(survivingGrants[0]?.userId).toBe(winner);
    // The winner's own medal grant survives with its own granted_at (an
    // unscoped DELETE or a re-stamp would both be invisible to the
    // snapshot's double-run equality); the loser's rode the union over.
    const survivingMedals = await ctx.db
      .select()
      .from(medalGrants)
      .orderBy(asc(medalGrants.medalId));
    expect(
      survivingMedals.map((row) => ({
        userId: row.userId,
        medalId: row.medalId,
        grantedAt: row.grantedAt.toISOString(),
      })),
    ).toEqual([
      {
        userId: winner,
        medalId: "bug-reporter",
        grantedAt: NEWER.toISOString(),
      },
      {
        userId: winner,
        medalId: "founder",
        grantedAt: winnerGrantedAt.toISOString(),
      },
    ]);

    // The second run is not just a test: it is D7's crash-recovery
    // mechanism, and it must change NOTHING — updated_at included (the
    // identity-handle guard is what makes step 5 a zero-row no-op here).
    const second = await mergeAccounts(ctx.db, winner, loser);
    expect(second).toEqual(first);
    expect(await snapshotState()).toEqual(afterFirst);
  });

  it("T-DB-S21: the winner is a function of the data — argument order is irrelevant, older created_at wins, an exact tie falls to the lower id", async () => {
    const a = await createUser(OLDER);
    const b = await createUser(NEWER);
    expect(await mergeAccounts(ctx.db, a, b)).toEqual({
      winnerId: a,
      loserId: b,
    });

    // Fresh identical fixture, reversed argument order: same winner.
    await reset();
    const a2 = await createUser(OLDER);
    const b2 = await createUser(NEWER);
    expect(await mergeAccounts(ctx.db, b2, a2)).toEqual({
      winnerId: a2,
      loserId: b2,
    });

    // Explicit-equal created_at: the lexicographically lower uuid wins.
    await reset();
    const c = await createUser(OLDER);
    const d = await createUser(OLDER);
    const [lower, higher] = c < d ? [c, d] : [d, c];
    expect(await mergeAccounts(ctx.db, c, d)).toEqual({
      winnerId: lower,
      loserId: higher,
    });
  });

  it("T-DB-S22: the agreement bridge — the pure function's prediction over pre-merge rows equals what the operation leaves on the winner", async () => {
    // created_at pinned, so D8's rule applied by hand names the winner
    // BEFORE the merge runs: `expected` is computable without guessing
    // roles. The fixture deliberately includes on-time, late and lost rows
    // plus collisions in both directions — late rows included so a future
    // forgotten column (#58's stored on_time) shows up as a red agreement
    // test, not silent data loss (plan 029 D13).
    const winner = await createUser(OLDER);
    const loser = await createUser(NEWER);
    // Winner: an on-time win, a LATE win (completed the day after), and a
    // collision-B row (earlier than the loser's).
    await insertCompletion({
      userId: winner,
      game: "binairo",
      date: "2026-08-01",
      completedAt: onDay("2026-08-01"),
    });
    await insertCompletion({
      userId: winner,
      game: "sudoku",
      date: "2026-08-02",
      completedAt: onDay("2026-08-03", "10:00:00"),
    });
    await insertCompletion({
      userId: winner,
      game: "nonogram",
      date: "2026-08-04",
      completedAt: onDay("2026-08-04", "18:00:00"),
    });
    // Loser: a lost on-time Termo, a disjoint on-time win, a collision-A
    // row (earlier than the winner's) and a collision-B row (later).
    await insertCompletion({
      userId: loser,
      game: "termo",
      date: "2026-08-05",
      completedAt: onDay("2026-08-05"),
      outcome: "lost",
      guesses: 6,
    });
    await insertCompletion({
      userId: loser,
      game: "sudoku",
      date: "2026-08-06",
      completedAt: onDay("2026-08-06"),
    });
    await insertCompletion({
      userId: loser,
      game: "nonogram",
      date: "2026-08-04",
      completedAt: onDay("2026-08-04", "15:00:00"),
    });
    await insertCompletion({
      userId: loser,
      game: "binairo",
      date: "2026-08-01",
      completedAt: onDay("2026-08-01", "20:00:00"),
    });

    // Read-only reuse — the nightly-check/support-preview shape (AC 4):
    // no write path was needed to predict the merged history.
    const winnerRows = await listCompletionsForMerge(ctx.db, winner);
    const loserRows = await listCompletionsForMerge(ctx.db, loser);
    const expected = mergeCompletions(winnerRows, loserRows);

    const returned = await mergeAccounts(ctx.db, winner, loser);
    expect(returned).toEqual({ winnerId: winner, loserId: loser });

    // Canonicalized before comparing: the reader returns
    // completed_at-ascending, the pure function (date, game)-ascending —
    // merge(after, []) is the function's own order (plan 029 T-DB-S22).
    const after = await listCompletionsForMerge(ctx.db, returned.winnerId);
    expect(mergeCompletions(after, [])).toEqual(expected);
  });

  it("T-DB-S23: merging an account with itself is a no-op; an unknown id throws before any statement runs", async () => {
    const a = await createUser(OLDER);
    await insertSession(a, "hash-a-1");
    await insertCompletion({
      userId: a,
      game: "binairo",
      date: "2026-08-01",
      completedAt: onDay("2026-08-01"),
    });
    const before = await snapshotState();

    expect(await mergeAccounts(ctx.db, a, a)).toEqual({
      winnerId: a,
      loserId: a,
    });
    expect(await snapshotState()).toEqual(before);

    // A merge against a typo must be loud, not creative (plan 029 D10).
    const ghost = "00000000-0000-4000-8000-000000000000";
    await expect(mergeAccounts(ctx.db, a, ghost)).rejects.toThrow(/unknown/);
    await expect(mergeAccounts(ctx.db, ghost, a)).rejects.toThrow(/unknown/);
    await expect(mergeAccounts(ctx.db, ghost, ghost)).rejects.toThrow(
      /unknown/,
    );
    expect(await snapshotState()).toEqual(before);
  });
});

describe("mergeAccounts — the repoint column-list tripwire (ADR-0049, step-6 finding)", () => {
  it("T-DB-S24: the completions column set derived from the live schema deep-equals the names the repoint statement carries", () => {
    // CONTRACT — what drift this catches: mergeAccounts' statement (ii)
    // spells the completions column list by hand (an INSERT … SELECT with
    // an explicit list), so a future migration that adds a column — #58's
    // stored on_time is the named candidate — would otherwise let merged
    // rows silently take that column's DEFAULT while directly-written rows
    // carry a real value. Deriving the column set MECHANICALLY from the
    // drizzle table object makes the suite go red the moment schema and
    // statement disagree; the fix is one name in merge.ts's statement (ii)
    // and one name below.
    //
    // The names are deliberately spelled a SECOND time here rather than
    // shared as an exported list interpolated into the SQL: the statement
    // stays a readable, parameterized literal, and the tripwire's whole
    // job is to make the two spellings disagree loudly.
    const liveColumns = Object.values(getTableColumns(completions))
      .map((column) => column.name)
      .sort();
    const repointedColumns = [
      "user_id",
      "game",
      "date",
      "completed_at",
      "outcome",
      "elapsed_ms",
      "hints_used",
      "guesses",
    ].sort();
    expect(liveColumns).toEqual(repointedColumns);
  });
});

describe("mergeAccounts — the winner-liveness guard (issue #21 precondition 1, ADR-0050)", () => {
  it("T-DB-S26: a tombstone-shaped winner throws before any destructive statement — the would-be loser's full state is unchanged", async () => {
    // The hazard the guard closes: merge(A,B) racing merge(B,C), where B
    // loses the first merge and the second would then strand C's history
    // on B's tombstone. No test can schedule the real interleaving over
    // PGlite, so the POST-RACE state is manufactured directly: a winner
    // whose sessions were remapped away and whose handles are null — the
    // exact shape only a tombstone can have, because every real minted
    // user is born with a session and sessions are never deleted in v1.
    const tombstone = await createUser(OLDER);
    const victim = await createUser(NEWER);
    await ctx.db.delete(sessions).where(eq(sessions.userId, tombstone));
    await insertCompletion({
      userId: victim,
      game: "binairo",
      date: "2026-08-01",
      completedAt: onDay("2026-08-01"),
    });
    await insertHintGrant(victim, "2026-08-01");
    const before = await snapshotState();

    const thrown = await mergeAccounts(ctx.db, tombstone, victim).then(
      () => undefined,
      (error: unknown) => error,
    );
    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toMatch(
      /owns no session or identity handle/,
    );
    // The REAL guard throw satisfies the exported discriminant (step-7
    // finding C): the confirm route retries on exactly this predicate, so
    // the predicate and the throw are pinned against each other here —
    // and an arbitrary error must never satisfy it.
    expect(isWinnerLivenessError(thrown)).toBe(true);
    expect(isWinnerLivenessError(new Error("connection reset"))).toBe(false);
    expect(isWinnerLivenessError("not even an Error")).toBe(false);

    // Nothing moved: no session remap, no completion repoint or delete, no
    // hint-grant delete, no tombstone UPDATE — the guard sits before the
    // first write.
    expect(await snapshotState()).toEqual(before);
  });

  it("T-DB-S27: guard green paths — a session-less winner with an identity handle passes, and the double-run idempotence discipline survives the guard", async () => {
    // The handle arm, non-vacuous: a winner stripped of sessions but still
    // holding a verified email is NOT a tombstone (the tombstone UPDATE
    // nulls every handle), so the guard lets the merge proceed.
    const handleWinner = await createUser(OLDER);
    const handleLoser = await createUser(NEWER);
    await ctx.db.delete(sessions).where(eq(sessions.userId, handleWinner));
    await ctx.db
      .update(users)
      .set({ email: "titular@example.com", emailVerifiedAt: sql`now()` })
      .where(eq(users.id, handleWinner));
    expect(await mergeAccounts(ctx.db, handleWinner, handleLoser)).toEqual({
      winnerId: handleWinner,
      loserId: handleLoser,
    });

    // T-DB-S20's discipline under the guard: after run one the winner owns
    // the union of sessions, so the guard passes and the re-run — still
    // D7's crash recovery — changes nothing.
    await reset();
    const winner = await createUser(OLDER);
    const loser = await createUser(NEWER);
    await insertCompletion({
      userId: loser,
      game: "sudoku",
      date: "2026-08-02",
      completedAt: onDay("2026-08-02"),
    });
    const first = await mergeAccounts(ctx.db, winner, loser);
    const afterFirst = await snapshotState();
    const second = await mergeAccounts(ctx.db, winner, loser);
    expect(second).toEqual(first);
    expect(await snapshotState()).toEqual(afterFirst);
  });
});

describe("mergeAccounts — curated medal grants (#30, ADR-0052, ADR-0049 decision 6)", () => {
  it("T-DB-S41: union-earliest-dedupe — the loser's grants surface on the winner, a shared medal keeps the EARLIEST granted_at whichever side carried it, the winner's own grant survives directly, the loser is emptied, and a re-run is a full no-op", async () => {
    const winner = await createUser(OLDER);
    const loser = await createUser(NEWER);
    const early = new Date("2026-03-01T12:00:00.000Z");
    const late = new Date("2026-07-01T12:00:00.000Z");
    // One grant each side, disjoint — the plain union half.
    await insertMedalGrant(winner, "winner-only", early);
    await insertMedalGrant(loser, "loser-only", late);
    // Shared medals in BOTH directions (the least() pin): on one the
    // WINNER was granted first, on the other the LOSER was — the earliest
    // instant must win regardless of side. Plain DO NOTHING would keep
    // the later grant date whenever the loser was granted first — against
    // ADR-0009's earliest-wins posture.
    await insertMedalGrant(winner, "shared-winner-first", early);
    await insertMedalGrant(loser, "shared-winner-first", late);
    await insertMedalGrant(winner, "shared-loser-first", late);
    await insertMedalGrant(loser, "shared-loser-first", early);

    const first = await mergeAccounts(ctx.db, winner, loser);
    expect(first).toEqual({ winnerId: winner, loserId: loser });

    // The winner owns the union, granted_at COPIED (never re-stamped) and
    // earliest-wins on both shared medals; the winner's own disjoint
    // grant survives DIRECTLY (the T-DB-S20 precedent — a snapshot alone
    // cannot see an unscoped DELETE).
    const rows = await ctx.db
      .select()
      .from(medalGrants)
      .orderBy(asc(medalGrants.medalId));
    expect(
      rows.map((row) => ({
        userId: row.userId,
        medalId: row.medalId,
        grantedAt: row.grantedAt.toISOString(),
      })),
    ).toEqual([
      { userId: winner, medalId: "loser-only", grantedAt: late.toISOString() },
      {
        userId: winner,
        medalId: "shared-loser-first",
        grantedAt: early.toISOString(),
      },
      {
        userId: winner,
        medalId: "shared-winner-first",
        grantedAt: early.toISOString(),
      },
      {
        userId: winner,
        medalId: "winner-only",
        grantedAt: early.toISOString(),
      },
    ]);
    // Emptied means EMPTIED: no grant row keeps referencing the tombstone.
    expect(
      await ctx.db
        .select()
        .from(medalGrants)
        .where(eq(medalGrants.userId, loser)),
    ).toEqual([]);

    // The re-run is D7's crash recovery and changes NOTHING: zero loser
    // rows to select, and least(a, least(a, b)) = least(a, b).
    const afterFirst = await snapshotState();
    const second = await mergeAccounts(ctx.db, winner, loser);
    expect(second).toEqual(first);
    expect(await snapshotState()).toEqual(afterFirst);
  });

  it("T-DB-S42: the grants merge statement's hand-spelled column list equals the live drizzle column set of medal_grants", () => {
    // The T-DB-S24 sibling — the union statement (merge.ts 5b) spells the
    // medal_grants column list by hand, so a future column would
    // otherwise silently take its DEFAULT on merged rows while
    // directly-written rows carry a real value. Deriving the live set
    // MECHANICALLY from the drizzle table makes schema/statement drift a
    // red suite; the fix is one name in merge.ts's statement 5b and one
    // name below. The names are deliberately spelled a SECOND time here —
    // the tripwire's whole job is to make the two spellings disagree
    // loudly.
    const liveColumns = Object.values(getTableColumns(medalGrants))
      .map((column) => column.name)
      .sort();
    const unionColumns = ["user_id", "medal_id", "granted_at"].sort();
    expect(liveColumns).toEqual(unionColumns);
  });
});
