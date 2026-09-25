import type { StreakReminder } from "@miolos/core";
import { pushSubscriptions, sql, users } from "@miolos/db";
import { notificationSends } from "@miolos/db/user";
import { createTestDb } from "@miolos/db/testing";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { ReminderSend } from "../src/email/transport";
import { runNotifyTick } from "../src/notify/dispatcher";
import type { NudgeSend, SendResult } from "../src/notify/transport";

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

const TODAY = "2026-08-20";
const HOUR = 20;

function daysBack(n: number): string {
  return `2026-08-${String(20 - n).padStart(2, "0")}`;
}

async function createReminderUser(email: string): Promise<string> {
  const inserted = await ctx.db
    .insert(users)
    .values({
      email,
      emailVerifiedAt: new Date(0),
      reminderConsentAt: new Date(0),
    })
    .returning();
  const user = inserted[0];
  if (!user) {
    throw new Error("users insert returned no row");
  }
  return user.id;
}

let endpointCounter = 0;

async function subscribe(userId: string): Promise<string> {
  endpointCounter += 1;
  const endpoint = `https://push.example.org/email-suite/${endpointCounter}`;
  await ctx.db
    .insert(pushSubscriptions)
    .values({ endpoint, userId, p256dh: "p", auth: "a" });
  return endpoint;
}

async function insertCompletion(userId: string, date: string): Promise<void> {
  await ctx.db.execute(sql`
    insert into completions
      (user_id, game, date, completed_at, outcome, elapsed_ms, hints_used, guesses, on_time)
    values
      (${userId}::uuid, 'binairo', ${date}::date,
       ${`${date} ${HOUR}:00:00-03`}::timestamptz, 'won', 1000, 0, null, true)
  `);
}

async function ledger(): Promise<{ userId: string; channel: string }[]> {
  return ctx.db
    .select({
      userId: notificationSends.userId,
      channel: notificationSends.channel,
    })
    .from(notificationSends);
}

function fakeEmail(ok = true): {
  send: ReminderSend;
  calls: StreakReminder[];
} {
  const calls: StreakReminder[] = [];
  const send: ReminderSend = (reminder) => {
    calls.push(reminder);
    return Promise.resolve(ok);
  };
  return { send, calls };
}

function fakePush(result: SendResult = { ok: true }): {
  send: NudgeSend;
  calls: string[];
} {
  const calls: string[] = [];
  const send: NudgeSend = (subscription) => {
    calls.push(subscription.endpoint);
    return Promise.resolve(result);
  };
  return { send, calls };
}

function tick(
  sendPush: NudgeSend,
  sendEmail: ReminderSend,
): ReturnType<typeof runNotifyTick> {
  return runNotifyTick(ctx.db, {
    today: TODAY,
    hour: HOUR,
    sendPush,
    sendEmail,
  });
}

describe("runNotifyTick — the email arm (#199, ADR-0083)", () => {
  it("T-API-S189: the email claim lands BEFORE the transport is invoked, and the transport gets the account's address and computeStreak's number", async () => {
    const userId = await createReminderUser("ana@example.org");
    await insertCompletion(userId, daysBack(2));
    await insertCompletion(userId, daysBack(1));

    const claimedAtSendTime: boolean[] = [];
    const calls: StreakReminder[] = [];
    const sendEmail: ReminderSend = async (reminder) => {
      claimedAtSendTime.push(
        (await ledger()).some((row) => row.channel === "email"),
      );
      calls.push(reminder);
      return true;
    };

    const result = await tick(fakePush().send, sendEmail);
    expect(result.email).toEqual({
      candidates: 1,
      claimed: 1,
      sent: 1,
      failed: 0,
    });
    expect(claimedAtSendTime).toEqual([true]);
    expect(calls).toEqual([{ to: "ana@example.org", streak: 2 }]);
    expect(await ledger()).toEqual([{ userId, channel: "email" }]);
  });

  it("T-API-S190: a dual-consent user with a live subscription gets push only — no email send and no email ledger row (Q1 = 1a)", async () => {
    const userId = await createReminderUser("ana@example.org");
    await subscribe(userId);
    await insertCompletion(userId, daysBack(1));

    const push = fakePush();
    const email = fakeEmail();
    const result = await tick(push.send, email.send);

    expect(result.push.sent).toBe(1);
    expect(result.email).toEqual({
      candidates: 0,
      claimed: 0,
      sent: 0,
      failed: 0,
    });
    expect(push.calls).toHaveLength(1);
    expect(email.calls).toHaveLength(0);
    expect(await ledger()).toEqual([{ userId, channel: "push" }]);
  });

  it("T-API-S191: when every subscription answers 410 the push arm prunes them, and the email arm then reaches the user in the same tick", async () => {
    const userId = await createReminderUser("ana@example.org");
    await subscribe(userId);
    await insertCompletion(userId, daysBack(1));

    const email = fakeEmail();
    const result = await tick(
      fakePush({ ok: false, statusCode: 410 }).send,
      email.send,
    );

    expect(result.push.pruned).toBe(1);
    expect(result.email.sent).toBe(1);
    expect(email.calls).toEqual([{ to: "ana@example.org", streak: 1 }]);
    expect((await ledger()).map((row) => row.channel).sort()).toEqual([
      "email",
      "push",
    ]);
  });

  it("T-API-S192: two ticks send one email; a failed send keeps its claim, counts `failed`, and is not retried", async () => {
    const delivered = await createReminderUser("ana@example.org");
    const refused = await createReminderUser("bia@example.org");
    await insertCompletion(delivered, daysBack(1));
    await insertCompletion(refused, daysBack(1));

    const calls: string[] = [];
    const sendEmail: ReminderSend = (reminder) => {
      calls.push(reminder.to);
      return Promise.resolve(reminder.to === "ana@example.org");
    };

    const first = await tick(fakePush().send, sendEmail);
    const second = await tick(fakePush().send, sendEmail);

    expect(first.email).toEqual({
      candidates: 2,
      claimed: 2,
      sent: 1,
      failed: 1,
    });
    expect(second.email).toEqual({
      candidates: 0,
      claimed: 0,
      sent: 0,
      failed: 0,
    });
    expect(calls.sort()).toEqual(["ana@example.org", "bia@example.org"]);
    expect(await ledger()).toHaveLength(2);
  });
});
