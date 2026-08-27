import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  claimNudgeSend,
  listPushNudgeCandidates,
  readTickInstant,
} from "../src/notify";
import { notificationSends, pushSubscriptions, users } from "../src/schema";
import { createTestDb } from "../src/testing";

//

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

let endpointCounter = 0;

async function subscribe(userId: string): Promise<void> {
  endpointCounter += 1;
  await ctx.db.insert(pushSubscriptions).values({
    endpoint: `https://push.example/${endpointCounter}`,
    userId,
    p256dh: "p",
    auth: "a",
  });
}

async function insertCompletion(init: {
  userId: string;
  date: string;
  hour: number;
  minute?: number;
  outcome?: "won" | "lost";
  onTime?: boolean;
}): Promise<void> {
  const hh = String(init.hour).padStart(2, "0");
  const mm = String(init.minute ?? 0).padStart(2, "0");
  const instant = `${init.date} ${hh}:${mm}:00-03`;
  await ctx.db.execute(sql`
    insert into completions
      (user_id, game, date, completed_at, outcome, elapsed_ms, hints_used, guesses, on_time)
    values
      (${init.userId}::uuid, 'binairo', ${init.date}::date,
       ${instant}::timestamptz, ${init.outcome ?? "won"}::text,
       1000, 0, null, ${init.onTime ?? true}::boolean)
  `);
}

const TODAY = "2026-08-20";
const YESTERDAY = "2026-08-19";

describe("notification_sends schema (#146, ADR-0064 d7)", () => {
  it("T-DB-S77: the column set, composite PK, channel CHECK and FK cascade reached the database", async () => {
    const columns = await ctx.db.execute(
      sql`select column_name from information_schema.columns
           where table_schema = 'public' and table_name = 'notification_sends'
           order by column_name`,
    );
    expect(columns.rows.map((row) => row["column_name"])).toEqual([
      "channel",
      "date",
      "sent_at",
      "user_id",
    ]);

    const userId = await createUser();

    let thrown: unknown;
    try {
      await ctx.db.execute(sql`
        insert into notification_sends (user_id, date, channel)
        values (${userId}::uuid, ${TODAY}::date, 'sms')
      `);
    } catch (error) {
      thrown = error;
    }
    let messages = "";
    let current: unknown = thrown;
    while (current instanceof Error) {
      messages += current.message;
      current = current.cause;
    }
    expect(messages).toContain("notification_sends_channel_check");

    await claimNudgeSend(ctx.db, { userId, date: TODAY, channel: "push" });
    let duplicate: unknown;
    try {
      await ctx.db.execute(sql`
        insert into notification_sends (user_id, date, channel)
        values (${userId}::uuid, ${TODAY}::date, 'push')
      `);
    } catch (error) {
      duplicate = error;
    }
    expect(duplicate).toBeInstanceOf(Error);

    await ctx.db.execute(sql`delete from users where id = ${userId}::uuid`);
    expect(await ctx.db.select().from(notificationSends)).toHaveLength(0);
  });
});

describe("claimNudgeSend (#146, ADR-0064 d7 — claim-first)", () => {
  it("T-DB-S78: the first claim owns the send, a replay owns nothing, channels claim independently", async () => {
    const userId = await createUser();

    expect(
      await claimNudgeSend(ctx.db, { userId, date: TODAY, channel: "push" }),
    ).toBe(true);

    expect(
      await claimNudgeSend(ctx.db, { userId, date: TODAY, channel: "push" }),
    ).toBe(false);
    expect(await ctx.db.select().from(notificationSends)).toHaveLength(1);

    expect(
      await claimNudgeSend(ctx.db, { userId, date: TODAY, channel: "email" }),
    ).toBe(true);

    expect(
      await claimNudgeSend(ctx.db, {
        userId,
        date: YESTERDAY,
        channel: "push",
      }),
    ).toBe(true);
    expect(await ctx.db.select().from(notificationSends)).toHaveLength(3);
  });
});

describe("listPushNudgeCandidates — the at-risk conjunction (#146, ADR-0064 d6)", () => {
  it("T-DB-S79: yesterday won∧on-time + today empty ⇒ candidate; a counted today, a lost or late-only yesterday, no subscription, or a push ledger row each exclude — an email ledger row does not", async () => {
    const candidate = await createUser();
    await subscribe(candidate);
    await insertCompletion({ userId: candidate, date: YESTERDAY, hour: 20 });

    const doneToday = await createUser();
    await subscribe(doneToday);
    await insertCompletion({ userId: doneToday, date: YESTERDAY, hour: 20 });
    await insertCompletion({ userId: doneToday, date: TODAY, hour: 9 });

    const lostYesterday = await createUser();
    await subscribe(lostYesterday);
    await insertCompletion({
      userId: lostYesterday,
      date: YESTERDAY,
      hour: 20,
      outcome: "lost",
    });

    const lateYesterday = await createUser();
    await subscribe(lateYesterday);
    await insertCompletion({
      userId: lateYesterday,
      date: YESTERDAY,
      hour: 20,
      onTime: false,
    });

    const unsubscribed = await createUser();
    await insertCompletion({ userId: unsubscribed, date: YESTERDAY, hour: 20 });

    const claimed = await createUser();
    await subscribe(claimed);
    await insertCompletion({ userId: claimed, date: YESTERDAY, hour: 20 });
    await claimNudgeSend(ctx.db, {
      userId: claimed,
      date: TODAY,
      channel: "push",
    });

    const emailClaimed = await createUser();
    await subscribe(emailClaimed);
    await insertCompletion({ userId: emailClaimed, date: YESTERDAY, hour: 20 });
    await claimNudgeSend(ctx.db, {
      userId: emailClaimed,
      date: TODAY,
      channel: "email",
    });

    const found = await listPushNudgeCandidates(ctx.db, {
      today: TODAY,
      hour: 20,
    });
    expect(found.sort()).toEqual([candidate, emailClaimed].sort());

    await insertCompletion({
      userId: candidate,
      date: TODAY,
      hour: 8,
      outcome: "lost",
    });
    const stillAtRisk = await listPushNudgeCandidates(ctx.db, {
      today: TODAY,
      hour: 20,
    });
    expect(stillAtRisk).toContain(candidate);
  });

  it("T-DB-S79a: a user with several endpoints appears exactly once", async () => {
    const candidate = await createUser();
    await subscribe(candidate);
    await subscribe(candidate);
    await insertCompletion({ userId: candidate, date: YESTERDAY, hour: 20 });

    const found = await listPushNudgeCandidates(ctx.db, {
      today: TODAY,
      hour: 20,
    });
    expect(found).toEqual([candidate]);
  });
});

describe("listPushNudgeCandidates — the habitual hour (#146, ADR-0064 d1)", () => {
  it("T-DB-S80: the median of per-counted-day EARLIEST instants, floored to the hour, over the 21-day window — even counts take the lower-middle sample, one sample is enough", async () => {
    const median = await createUser();
    await subscribe(median);
    await insertCompletion({ userId: median, date: "2026-08-17", hour: 8 });
    await insertCompletion({ userId: median, date: "2026-08-18", hour: 9 });

    await ctx.db.execute(sql`
      insert into completions
        (user_id, game, date, completed_at, outcome, elapsed_ms, hints_used, guesses, on_time)
      values
        (${median}::uuid, 'sudoku', '2026-08-18'::date,
         '2026-08-18 23:00:00-03'::timestamptz, 'won', 1000, 0, null, true)
    `);
    await insertCompletion({ userId: median, date: YESTERDAY, hour: 21 });
    expect(
      await listPushNudgeCandidates(ctx.db, { today: TODAY, hour: 9 }),
    ).toEqual([median]);
    expect(
      await listPushNudgeCandidates(ctx.db, { today: TODAY, hour: 23 }),
    ).toEqual([]);

    const lateHabit = await createUser();
    await subscribe(lateHabit);
    await insertCompletion({
      userId: lateHabit,
      date: YESTERDAY,
      hour: 21,
      minute: 40,
    });
    expect(
      await listPushNudgeCandidates(ctx.db, { today: TODAY, hour: 21 }),
    ).toEqual([lateHabit]);
    expect(
      await listPushNudgeCandidates(ctx.db, { today: TODAY, hour: 22 }),
    ).toEqual([]);
  });

  it("T-DB-S80a: a day at today − 22 contributes no sample, today − 21 does; an even sample count takes percentile_disc's lower-middle", async () => {
    const boundary = await createUser();
    await subscribe(boundary);

    await insertCompletion({ userId: boundary, date: "2026-07-29", hour: 3 });

    await insertCompletion({ userId: boundary, date: "2026-07-30", hour: 5 });

    await insertCompletion({ userId: boundary, date: YESTERDAY, hour: 20 });

    expect(
      await listPushNudgeCandidates(ctx.db, { today: TODAY, hour: 5 }),
    ).toEqual([boundary]);
    expect(
      await listPushNudgeCandidates(ctx.db, { today: TODAY, hour: 20 }),
    ).toEqual([]);

    expect(
      await listPushNudgeCandidates(ctx.db, { today: TODAY, hour: 3 }),
    ).toEqual([]);
  });
});

describe("readTickInstant (#146, ADR-0068 d3)", () => {
  it("T-DB-S81: one statement answers an ISO SP date and an hour in 0..23 — the one real-clock test, range-only assertions", async () => {
    const instant = await readTickInstant(ctx.db);
    expect(instant.today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Number.isInteger(instant.hour)).toBe(true);
    expect(instant.hour).toBeGreaterThanOrEqual(0);
    expect(instant.hour).toBeLessThanOrEqual(23);
  });
});
