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
  notificationSends,
  pushSubscriptions,
  sessions,
  userSeenDays,
  users,
} from "../src/schema";
import { createTestDb } from "../src/testing";

let ctx: Awaited<ReturnType<typeof createTestDb>>;

beforeAll(async () => {
  ctx = await createTestDb();
}, 30_000);

async function reset(): Promise<void> {
  await ctx.db.execute(
    sql`truncate table users, completions, hint_grants, medal_grants cascade`,
  );
}

beforeEach(reset);

afterAll(async () => {
  await ctx.close();
});

const OLDER = new Date("2026-01-01T12:00:00.000Z");
const NEWER = new Date("2026-06-01T12:00:00.000Z");

let birthSessionCounter = 0;

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

  onTime: boolean;
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
    onTime: init.onTime,
  });
}

async function insertSession(userId: string, tokenHash: string): Promise<void> {
  await ctx.db.insert(sessions).values({ tokenHash, userId });
}

async function insertHintGrant(userId: string, date: string): Promise<void> {
  await ctx.db
    .insert(hintGrants)
    .values({ userId, date, source: "rewarded-ad", hints: 3 });
}

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

async function insertPushSubscription(
  userId: string,
  endpoint: string,
): Promise<void> {
  await ctx.db
    .insert(pushSubscriptions)
    .values({ endpoint, userId, p256dh: "p256dh-key", auth: "auth-key" });
}

async function insertSeenDay(userId: string, date: string): Promise<void> {
  await ctx.db.insert(userSeenDays).values({ userId, date });
}

async function insertNotificationSend(
  userId: string,
  date: string,
  sentAt: Date,
): Promise<void> {
  await ctx.db
    .insert(notificationSends)
    .values({ userId, date, channel: "push", sentAt });
}

async function snapshotState(): Promise<{
  users: unknown[];
  sessions: unknown[];
  completions: unknown[];
  hintGrants: unknown[];
  medalGrants: unknown[];
  pushSubscriptions: unknown[];
  userSeenDays: unknown[];
  notificationSends: unknown[];
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
    pushSubscriptions: await ctx.db
      .select()
      .from(pushSubscriptions)
      .orderBy(asc(pushSubscriptions.endpoint)),

    userSeenDays: await ctx.db
      .select()
      .from(userSeenDays)
      .orderBy(asc(userSeenDays.userId), asc(userSeenDays.date)),

    notificationSends: await ctx.db
      .select()
      .from(notificationSends)
      .orderBy(
        asc(notificationSends.userId),
        asc(notificationSends.date),
        asc(notificationSends.channel),
      ),
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
      onTime: true,
    });
    await insertCompletion({
      userId: loser,
      game: "sudoku",
      date: "2026-08-02",
      completedAt: onDay("2026-08-02"),
      onTime: true,
    });

    const result = await mergeAccounts(ctx.db, winner, loser);
    expect(result).toEqual({ winnerId: winner, loserId: loser });

    const rows = await listCompletionsForMerge(ctx.db, winner);
    expect(rows).toHaveLength(2);

    const moved = rows.find((row) => row.game === "sudoku");
    expect(moved).toEqual({
      game: "sudoku",
      date: "2026-08-02",
      outcome: "won",
      onTime: true,

      completedAtOrder: "2026-08-02T15:00:00.000000Z",
    });
    expect(await listCompletionsForMerge(ctx.db, loser)).toEqual([]);
  });

  it("T-DB-S17: collisions — the earliest wins in both directions, an exact tie keeps the winner's row, and an on-time survivor never becomes late", async () => {
    const winner = await createUser(OLDER);
    const loser = await createUser(NEWER);

    await insertCompletion({
      userId: winner,
      game: "binairo",
      date: "2026-08-01",
      completedAt: onDay("2026-08-01", "18:00:00"),
      onTime: true,
      elapsedMs: 111,
    });
    await insertCompletion({
      userId: loser,
      game: "binairo",
      date: "2026-08-01",
      completedAt: onDay("2026-08-01", "15:00:00"),
      onTime: true,
      elapsedMs: 222,
    });

    await insertCompletion({
      userId: winner,
      game: "sudoku",
      date: "2026-08-02",
      completedAt: onDay("2026-08-02", "15:00:00"),
      onTime: true,
      elapsedMs: 333,
    });
    await insertCompletion({
      userId: loser,
      game: "sudoku",
      date: "2026-08-02",
      completedAt: onDay("2026-08-02", "18:00:00"),
      onTime: true,
      elapsedMs: 444,
    });

    await insertCompletion({
      userId: winner,
      game: "nonogram",
      date: "2026-08-03",
      completedAt: onDay("2026-08-03", "15:00:00"),
      onTime: true,
      elapsedMs: 555,
    });
    await insertCompletion({
      userId: loser,
      game: "nonogram",
      date: "2026-08-03",
      completedAt: onDay("2026-08-03", "15:00:00"),
      onTime: true,
      elapsedMs: 666,
    });

    await mergeAccounts(ctx.db, winner, loser);

    const raw = await ctx.db
      .select()
      .from(completions)
      .orderBy(asc(completions.game));
    expect(raw.map((row) => row.userId)).toEqual([winner, winner, winner]);

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
      onTime: true,
    });

    await insertHintGrant(loser, "2026-08-01");

    await mergeAccounts(ctx.db, winner, loser);

    const loserRows = await ctx.db
      .select()
      .from(users)
      .where(eq(users.id, loser));
    const tombstone = loserRows[0];

    expect(tombstone).toBeDefined();
    expect(tombstone?.email).toBeNull();
    expect(tombstone?.emailVerifiedAt).toBeNull();
    expect(tombstone?.appleId).toBeNull();
    expect(tombstone?.googleId).toBeNull();

    expect(tombstone?.recoveryConsentAt?.toISOString()).toBe(
      consentAt.toISOString(),
    );
    expect(tombstone?.updatedAt.getTime()).toBeGreaterThan(NEWER.getTime());

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

    const winnerRow = (
      await ctx.db.select().from(users).where(eq(users.id, winner))
    )[0];
    expect(winnerRow?.email).toBe("winner@example.com");

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
  it("T-DB-S20: run it twice, get the same account — the full users+sessions+completions+hint_grants+medal_grants+push_subscriptions+user_seen_days+notification_sends state after run one deep-equals run two", async () => {
    const winner = await createUser(OLDER);
    const loser = await createUser(NEWER);
    await ctx.db
      .update(users)
      .set({ email: "loser@example.com" })
      .where(eq(users.id, loser));
    await insertSession(winner, "hash-winner-1");
    await insertSession(loser, "hash-loser-1");

    await insertPushSubscription(winner, "https://push.example.org/w1");
    await insertPushSubscription(loser, "https://push.example.org/l1");

    await insertSeenDay(winner, "2026-08-01");
    await insertSeenDay(winner, "2026-08-02");
    await insertSeenDay(loser, "2026-08-02");
    await insertSeenDay(loser, "2026-08-03");

    await insertNotificationSend(winner, "2026-08-02", OLDER);
    await insertNotificationSend(loser, "2026-08-02", NEWER);
    await insertNotificationSend(loser, "2026-08-03", NEWER);

    await insertCompletion({
      userId: winner,
      game: "binairo",
      date: "2026-08-01",
      completedAt: onDay("2026-08-01", "18:00:00"),
      onTime: true,
    });
    await insertCompletion({
      userId: loser,
      game: "binairo",
      date: "2026-08-01",
      completedAt: onDay("2026-08-01", "15:00:00"),
      onTime: true,
    });
    await insertCompletion({
      userId: winner,
      game: "sudoku",
      date: "2026-08-02",
      completedAt: onDay("2026-08-02", "15:00:00"),
      onTime: true,
    });
    await insertCompletion({
      userId: loser,
      game: "sudoku",
      date: "2026-08-02",
      completedAt: onDay("2026-08-02", "18:00:00"),
      onTime: true,
    });
    await insertCompletion({
      userId: loser,
      game: "termo",
      date: "2026-08-03",
      completedAt: onDay("2026-08-03"),
      onTime: true,
      outcome: "lost",
      guesses: 6,
    });

    await insertHintGrant(winner, "2026-08-01");
    await insertHintGrant(loser, "2026-08-01");

    const winnerGrantedAt = new Date("2026-07-01T12:00:00.000Z");
    await insertMedalGrant(winner, "founder", winnerGrantedAt);
    await insertMedalGrant(loser, "bug-reporter", NEWER);

    const first = await mergeAccounts(ctx.db, winner, loser);
    const afterFirst = await snapshotState();

    const survivingGrants = await ctx.db.select().from(hintGrants);
    expect(survivingGrants).toHaveLength(1);
    expect(survivingGrants[0]?.userId).toBe(winner);

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

    await reset();
    const a2 = await createUser(OLDER);
    const b2 = await createUser(NEWER);
    expect(await mergeAccounts(ctx.db, b2, a2)).toEqual({
      winnerId: a2,
      loserId: b2,
    });

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
    const winner = await createUser(OLDER);
    const loser = await createUser(NEWER);

    await insertCompletion({
      userId: winner,
      game: "binairo",
      date: "2026-08-01",
      completedAt: onDay("2026-08-01"),
      onTime: true,
    });
    await insertCompletion({
      userId: winner,
      game: "sudoku",
      date: "2026-08-02",
      completedAt: onDay("2026-08-03", "10:00:00"),
      onTime: false,
    });
    await insertCompletion({
      userId: winner,
      game: "nonogram",
      date: "2026-08-04",
      completedAt: onDay("2026-08-04", "18:00:00"),
      onTime: true,
    });

    await insertCompletion({
      userId: loser,
      game: "termo",
      date: "2026-08-05",
      completedAt: onDay("2026-08-05"),
      onTime: true,
      outcome: "lost",
      guesses: 6,
    });
    await insertCompletion({
      userId: loser,
      game: "sudoku",
      date: "2026-08-06",
      completedAt: onDay("2026-08-06"),
      onTime: true,
    });
    await insertCompletion({
      userId: loser,
      game: "nonogram",
      date: "2026-08-04",
      completedAt: onDay("2026-08-04", "15:00:00"),
      onTime: true,
    });
    await insertCompletion({
      userId: loser,
      game: "binairo",
      date: "2026-08-01",
      completedAt: onDay("2026-08-01", "20:00:00"),
      onTime: true,
    });

    const winnerRows = await listCompletionsForMerge(ctx.db, winner);
    const loserRows = await listCompletionsForMerge(ctx.db, loser);
    const expected = mergeCompletions(winnerRows, loserRows);

    const returned = await mergeAccounts(ctx.db, winner, loser);
    expect(returned).toEqual({ winnerId: winner, loserId: loser });

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
      onTime: true,
    });
    const before = await snapshotState();

    expect(await mergeAccounts(ctx.db, a, a)).toEqual({
      winnerId: a,
      loserId: a,
    });
    expect(await snapshotState()).toEqual(before);

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
    //

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

      "on_time",
    ].sort();
    expect(liveColumns).toEqual(repointedColumns);
  });
});

describe("mergeAccounts — seen days union (#58, ADR-0066; ADR-0049 decision 6)", () => {
  it("T-DB-S74: the winner gets the loser's dates, overlaps conflict away, the loser is emptied, and a re-run is a no-op", async () => {
    const winner = await createUser(OLDER);
    const loser = await createUser(NEWER);
    await insertSeenDay(winner, "2026-08-01");
    await insertSeenDay(winner, "2026-08-02");
    await insertSeenDay(loser, "2026-08-02");
    await insertSeenDay(loser, "2026-08-03");

    await mergeAccounts(ctx.db, winner, loser);

    const rows = await ctx.db
      .select({ userId: userSeenDays.userId, date: userSeenDays.date })
      .from(userSeenDays)
      .orderBy(asc(userSeenDays.userId), asc(userSeenDays.date));

    expect(rows).toEqual([
      { userId: winner, date: "2026-08-01" },
      { userId: winner, date: "2026-08-02" },
      { userId: winner, date: "2026-08-03" },
    ]);

    await mergeAccounts(ctx.db, winner, loser);
    expect(
      await ctx.db
        .select({ userId: userSeenDays.userId, date: userSeenDays.date })
        .from(userSeenDays)
        .orderBy(asc(userSeenDays.userId), asc(userSeenDays.date)),
    ).toEqual(rows);
  });
});

describe("mergeAccounts — notification-sends union (#146, ADR-0068; ADR-0049 decision 6)", () => {
  it("T-DB-S82: the winner gets the loser's ledger rows, a PK collision keeps the winner's sent_at, the loser is emptied, and a re-run is a no-op", async () => {
    const winner = await createUser(OLDER);
    const loser = await createUser(NEWER);

    await insertNotificationSend(winner, "2026-08-02", OLDER);
    await insertNotificationSend(loser, "2026-08-02", NEWER);
    await insertNotificationSend(loser, "2026-08-03", NEWER);

    await mergeAccounts(ctx.db, winner, loser);

    const rows = await ctx.db
      .select({
        userId: notificationSends.userId,
        date: notificationSends.date,
        channel: notificationSends.channel,
        sentAt: notificationSends.sentAt,
      })
      .from(notificationSends)
      .orderBy(asc(notificationSends.userId), asc(notificationSends.date));

    expect(
      rows.map((row) => ({ ...row, sentAt: row.sentAt.toISOString() })),
    ).toEqual([
      {
        userId: winner,
        date: "2026-08-02",
        channel: "push",
        sentAt: OLDER.toISOString(),
      },
      {
        userId: winner,
        date: "2026-08-03",
        channel: "push",
        sentAt: NEWER.toISOString(),
      },
    ]);

    await mergeAccounts(ctx.db, winner, loser);
    expect(
      await ctx.db
        .select()
        .from(notificationSends)
        .orderBy(asc(notificationSends.userId), asc(notificationSends.date)),
    ).toHaveLength(2);
  });
});

describe("mergeAccounts — the winner-liveness guard (issue #21 precondition 1, ADR-0050)", () => {
  it("T-DB-S26: a tombstone-shaped winner throws before any destructive statement — the would-be loser's full state is unchanged", async () => {
    const tombstone = await createUser(OLDER);
    const victim = await createUser(NEWER);
    await ctx.db.delete(sessions).where(eq(sessions.userId, tombstone));
    await insertCompletion({
      userId: victim,
      game: "binairo",
      date: "2026-08-01",
      completedAt: onDay("2026-08-01"),
      onTime: true,
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

    expect(isWinnerLivenessError(thrown)).toBe(true);
    expect(isWinnerLivenessError(new Error("connection reset"))).toBe(false);
    expect(isWinnerLivenessError("not even an Error")).toBe(false);

    expect(await snapshotState()).toEqual(before);
  });

  it("T-DB-S27: guard green paths — a session-less winner with an identity handle passes, and the double-run idempotence discipline survives the guard", async () => {
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

    await reset();
    const winner = await createUser(OLDER);
    const loser = await createUser(NEWER);
    await insertCompletion({
      userId: loser,
      game: "sudoku",
      date: "2026-08-02",
      completedAt: onDay("2026-08-02"),
      onTime: true,
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

    await insertMedalGrant(winner, "winner-only", early);
    await insertMedalGrant(loser, "loser-only", late);

    await insertMedalGrant(winner, "shared-winner-first", early);
    await insertMedalGrant(loser, "shared-winner-first", late);
    await insertMedalGrant(winner, "shared-loser-first", late);
    await insertMedalGrant(loser, "shared-loser-first", early);

    const first = await mergeAccounts(ctx.db, winner, loser);
    expect(first).toEqual({ winnerId: winner, loserId: loser });

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

    expect(
      await ctx.db
        .select()
        .from(medalGrants)
        .where(eq(medalGrants.userId, loser)),
    ).toEqual([]);

    const afterFirst = await snapshotState();
    const second = await mergeAccounts(ctx.db, winner, loser);
    expect(second).toEqual(first);
    expect(await snapshotState()).toEqual(afterFirst);
  });

  it("T-DB-S42: the grants merge statement's hand-spelled column list equals the live drizzle column set of medal_grants", () => {
    const liveColumns = Object.values(getTableColumns(medalGrants))
      .map((column) => column.name)
      .sort();
    const unionColumns = ["user_id", "medal_id", "granted_at"].sort();
    expect(liveColumns).toEqual(unionColumns);
  });
});

describe("mergeAccounts — the once-per-account timestamps (#35, ADR-0061; #134, statement 5d)", () => {
  const EARLIER = new Date("2026-07-01T12:00:00.000Z");
  const LATER = new Date("2026-07-15T12:00:00.000Z");

  async function stamp(
    userId: string,
    values: {
      onboardingSeenAt?: Date;
      attachPromptDismissedAt?: Date;
    },
  ): Promise<void> {
    await ctx.db.update(users).set(values).where(eq(users.id, userId));
  }

  async function timestampsOf(userId: string): Promise<{
    onboardingSeenAt: Date | null;
    attachPromptDismissedAt: Date | null;
  }> {
    const rows = await ctx.db
      .select({
        onboardingSeenAt: users.onboardingSeenAt,
        attachPromptDismissedAt: users.attachPromptDismissedAt,
      })
      .from(users)
      .where(eq(users.id, userId));
    const row = rows[0];
    if (!row) {
      throw new Error(`no users row for ${userId}`);
    }
    return row;
  }

  it("T-DB-S63: either side suffices in both argument orders, both-stamped keeps the EARLIEST, and attach_prompt_dismissed_at rides the same statement — including the mixed case where only one column's arm fires", async () => {
    for (const reversed of [false, true]) {
      const winner = await createUser(OLDER);
      const loser = await createUser(NEWER);
      await stamp(loser, { onboardingSeenAt: EARLIER });
      const result = reversed
        ? await mergeAccounts(ctx.db, loser, winner)
        : await mergeAccounts(ctx.db, winner, loser);
      expect(result).toEqual({ winnerId: winner, loserId: loser });
      expect((await timestampsOf(winner)).onboardingSeenAt).toEqual(EARLIER);
      await reset();
    }

    {
      const winner = await createUser(OLDER);
      const loser = await createUser(NEWER);
      await stamp(winner, { onboardingSeenAt: EARLIER });
      await mergeAccounts(ctx.db, winner, loser);
      expect((await timestampsOf(winner)).onboardingSeenAt).toEqual(EARLIER);
      await reset();
    }

    {
      const winner = await createUser(OLDER);
      const loser = await createUser(NEWER);
      await stamp(winner, { onboardingSeenAt: LATER });
      await stamp(loser, { onboardingSeenAt: EARLIER });
      await mergeAccounts(ctx.db, winner, loser);
      expect((await timestampsOf(winner)).onboardingSeenAt).toEqual(EARLIER);
      await reset();
    }
    {
      const winner = await createUser(OLDER);
      const loser = await createUser(NEWER);
      await stamp(winner, { onboardingSeenAt: EARLIER });
      await stamp(loser, { onboardingSeenAt: LATER });
      await mergeAccounts(ctx.db, winner, loser);
      expect((await timestampsOf(winner)).onboardingSeenAt).toEqual(EARLIER);
      await reset();
    }

    {
      const winner = await createUser(OLDER);
      const loser = await createUser(NEWER);

      await stamp(winner, { attachPromptDismissedAt: EARLIER });
      await stamp(loser, {
        onboardingSeenAt: EARLIER,
        attachPromptDismissedAt: LATER,
      });
      await mergeAccounts(ctx.db, winner, loser);
      expect(await timestampsOf(winner)).toEqual({
        onboardingSeenAt: EARLIER,
        attachPromptDismissedAt: EARLIER,
      });
      await reset();
    }
    {
      const winner = await createUser(OLDER);
      const loser = await createUser(NEWER);
      await stamp(winner, { onboardingSeenAt: EARLIER });
      await stamp(loser, {
        onboardingSeenAt: LATER,
        attachPromptDismissedAt: EARLIER,
      });
      await mergeAccounts(ctx.db, winner, loser);
      expect(await timestampsOf(winner)).toEqual({
        onboardingSeenAt: EARLIER,
        attachPromptDismissedAt: EARLIER,
      });
      await reset();
    }
    {
      const winner = await createUser(OLDER);
      const loser = await createUser(NEWER);
      await stamp(loser, { attachPromptDismissedAt: EARLIER });
      await mergeAccounts(ctx.db, winner, loser);
      expect(await timestampsOf(winner)).toEqual({
        onboardingSeenAt: null,
        attachPromptDismissedAt: EARLIER,
      });
    }
  });

  it("T-DB-S64: a re-run matches zero rows — the winner's updated_at is not re-bumped — and the loser's own values are untouched by the tombstone SET", async () => {
    const winner = await createUser(OLDER);
    const loser = await createUser(NEWER);
    await stamp(loser, {
      onboardingSeenAt: EARLIER,
      attachPromptDismissedAt: LATER,
    });

    await mergeAccounts(ctx.db, winner, loser);

    const winnerAfterFirst = await ctx.db
      .select()
      .from(users)
      .where(eq(users.id, winner));
    expect(winnerAfterFirst[0]?.updatedAt.toISOString()).not.toBe(
      OLDER.toISOString(),
    );

    expect(await timestampsOf(loser)).toEqual({
      onboardingSeenAt: EARLIER,
      attachPromptDismissedAt: LATER,
    });

    const afterFirst = await snapshotState();
    await mergeAccounts(ctx.db, winner, loser);
    expect(await snapshotState()).toEqual(afterFirst);
  });
});

describe("mergeAccounts — push subscriptions and the push prompt (#145, ADR-0064, ADR-0049 decision 6)", () => {
  const EARLIER = new Date("2026-07-01T12:00:00.000Z");
  const LATER = new Date("2026-07-15T12:00:00.000Z");

  async function pushDismissedOf(userId: string): Promise<Date | null> {
    const rows = await ctx.db
      .select({ pushPromptDismissedAt: users.pushPromptDismissedAt })
      .from(users)
      .where(eq(users.id, userId));
    const row = rows[0];
    if (!row) {
      throw new Error(`no users row for ${userId}`);
    }
    return row.pushPromptDismissedAt;
  }

  it("T-DB-S67: statement 1b — the loser's subscriptions repoint to the winner, the tombstone holds none, the winner's own rows and keys are untouched, and a re-run is idempotent", async () => {
    const winner = await createUser(OLDER);
    const loser = await createUser(NEWER);

    await insertPushSubscription(winner, "https://push.example.org/w-phone");
    await insertPushSubscription(loser, "https://push.example.org/l-phone");
    await insertPushSubscription(loser, "https://push.example.org/l-desktop");

    const first = await mergeAccounts(ctx.db, winner, loser);
    expect(first).toEqual({ winnerId: winner, loserId: loser });

    const rows = await ctx.db
      .select()
      .from(pushSubscriptions)
      .orderBy(asc(pushSubscriptions.endpoint));

    expect(
      rows.map((row) => ({
        endpoint: row.endpoint,
        userId: row.userId,
        p256dh: row.p256dh,
        auth: row.auth,
      })),
    ).toEqual([
      {
        endpoint: "https://push.example.org/l-desktop",
        userId: winner,
        p256dh: "p256dh-key",
        auth: "auth-key",
      },
      {
        endpoint: "https://push.example.org/l-phone",
        userId: winner,
        p256dh: "p256dh-key",
        auth: "auth-key",
      },
      {
        endpoint: "https://push.example.org/w-phone",
        userId: winner,
        p256dh: "p256dh-key",
        auth: "auth-key",
      },
    ]);

    expect(
      await ctx.db
        .select()
        .from(pushSubscriptions)
        .where(eq(pushSubscriptions.userId, loser)),
    ).toEqual([]);

    const afterFirst = await snapshotState();
    const second = await mergeAccounts(ctx.db, winner, loser);
    expect(second).toEqual(first);
    expect(await snapshotState()).toEqual(afterFirst);
  });

  it("T-DB-S68: statement 5d folds push_prompt_dismissed_at earliest-wins — either side suffices in both argument orders, both-stamped keeps the EARLIEST whichever side carried it, and the never-dismissed pair stays NULL", async () => {
    for (const reversed of [false, true]) {
      const winner = await createUser(OLDER);
      const loser = await createUser(NEWER);
      await ctx.db
        .update(users)
        .set({ pushPromptDismissedAt: EARLIER })
        .where(eq(users.id, loser));
      const result = reversed
        ? await mergeAccounts(ctx.db, loser, winner)
        : await mergeAccounts(ctx.db, winner, loser);
      expect(result).toEqual({ winnerId: winner, loserId: loser });
      expect(await pushDismissedOf(winner)).toEqual(EARLIER);

      expect(await pushDismissedOf(loser)).toEqual(EARLIER);
      await reset();
    }

    {
      const winner = await createUser(OLDER);
      const loser = await createUser(NEWER);
      await ctx.db
        .update(users)
        .set({ pushPromptDismissedAt: EARLIER })
        .where(eq(users.id, winner));
      await mergeAccounts(ctx.db, winner, loser);
      expect(await pushDismissedOf(winner)).toEqual(EARLIER);
      await reset();
    }

    {
      const winner = await createUser(OLDER);
      const loser = await createUser(NEWER);
      await ctx.db
        .update(users)
        .set({ pushPromptDismissedAt: LATER })
        .where(eq(users.id, winner));
      await ctx.db
        .update(users)
        .set({ pushPromptDismissedAt: EARLIER })
        .where(eq(users.id, loser));
      await mergeAccounts(ctx.db, winner, loser);
      expect(await pushDismissedOf(winner)).toEqual(EARLIER);
      await reset();
    }
    {
      const winner = await createUser(OLDER);
      const loser = await createUser(NEWER);
      await ctx.db
        .update(users)
        .set({ pushPromptDismissedAt: EARLIER })
        .where(eq(users.id, winner));
      await ctx.db
        .update(users)
        .set({ pushPromptDismissedAt: LATER })
        .where(eq(users.id, loser));
      await mergeAccounts(ctx.db, winner, loser);
      expect(await pushDismissedOf(winner)).toEqual(EARLIER);
      await reset();
    }

    {
      const winner = await createUser(OLDER);
      const loser = await createUser(NEWER);
      await mergeAccounts(ctx.db, winner, loser);
      expect(await pushDismissedOf(winner)).toBeNull();
    }
  });
});
