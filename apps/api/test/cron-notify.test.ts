import { cronNotifyResponseSchema, type PushNudgePayload } from "@miolos/core";
import { pushSubscriptions, sql, users } from "@miolos/db";
import { notificationSends } from "@miolos/db/user";
import { createTestDb } from "@miolos/db/testing";
import { NextRequest } from "next/server";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { POST } from "../app/cron/notify/route";
import { runNotifyTick } from "../src/notify/dispatcher";
import type { NudgeSend, SendResult } from "../src/notify/transport";

let ctx: Awaited<ReturnType<typeof createTestDb>>;

const getDbCalls = { count: 0 };
vi.mock("../src/db", () => ({
  getDb: () => {
    getDbCalls.count += 1;
    return ctx.db;
  },
}));

const SECRET = "test-cron-secret";

beforeAll(async () => {
  ctx = await createTestDb();
}, 30_000);

beforeEach(async () => {
  await ctx.db.execute(sql`truncate table users cascade`);
  getDbCalls.count = 0;
  vi.stubEnv("CRON_SECRET", SECRET);
  vi.stubEnv("VAPID_PUBLIC_KEY", "BTestPublicKey");
  vi.stubEnv("VAPID_PRIVATE_KEY", "test-private-key");
  vi.stubEnv("VAPID_SUBJECT", "mailto:privacidade@miolos.app");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

afterAll(async () => {
  await ctx.close();
});

function notifyRequest(authorization?: string): NextRequest {
  const headers = new Headers();
  if (authorization !== undefined) {
    headers.set("authorization", authorization);
  }
  return new NextRequest("http://localhost:3001/cron/notify", {
    method: "POST",
    headers,
  });
}

async function createUser(): Promise<string> {
  const inserted = await ctx.db.insert(users).values({}).returning();
  const user = inserted[0];
  if (!user) {
    throw new Error("users insert returned no row");
  }
  return user.id;
}

let endpointCounter = 0;

async function subscribe(userId: string): Promise<string> {
  endpointCounter += 1;
  const endpoint = `https://push.example.org/send/${endpointCounter}`;
  await ctx.db
    .insert(pushSubscriptions)
    .values({ endpoint, userId, p256dh: "p", auth: "a" });
  return endpoint;
}

async function insertCompletion(init: {
  userId: string;
  date: string;
  hour: number;
  game?: string;
}): Promise<void> {
  const hh = String(init.hour).padStart(2, "0");
  await ctx.db.execute(sql`
    insert into completions
      (user_id, game, date, completed_at, outcome, elapsed_ms, hints_used, guesses, on_time)
    values
      (${init.userId}::uuid, ${init.game ?? "binairo"}::text, ${init.date}::date,
       ${`${init.date} ${hh}:00:00-03`}::timestamptz, 'won', 1000, 0, null, true)
  `);
}

async function ledgerRows(): Promise<unknown[]> {
  return ctx.db.select().from(notificationSends);
}

const TODAY = "2026-08-20";
const HOUR = 20;

function daysBack(n: number): string {
  return `2026-08-${String(20 - n).padStart(2, "0")}`;
}

function fakeSend(
  script: (subscription: { endpoint: string }) => SendResult = () => ({
    ok: true,
  }),
): {
  send: NudgeSend;
  calls: { endpoint: string; payload: PushNudgePayload }[];
} {
  const calls: { endpoint: string; payload: PushNudgePayload }[] = [];
  const send: NudgeSend = (subscription, payload) => {
    calls.push({ endpoint: subscription.endpoint, payload });
    return Promise.resolve(script(subscription));
  };
  return { send, calls };
}

describe("POST /cron/notify — auth (plan 014 D15, the shared extraction)", () => {
  it("T-API-S142: unset CRON_SECRET → 401 even with a bearer; a missing and a mismatched bearer → 401 — and no tick runs", async () => {
    vi.stubEnv("CRON_SECRET", undefined);
    expect((await POST(notifyRequest(`Bearer ${SECRET}`))).status).toBe(401);

    vi.stubEnv("CRON_SECRET", SECRET);
    expect((await POST(notifyRequest())).status).toBe(401);
    expect((await POST(notifyRequest("Bearer wrong"))).status).toBe(401);

    expect(getDbCalls.count).toBe(0);
  });
});

describe("POST /cron/notify — dormancy (the isPushConfigured triple)", () => {
  it("T-API-S143: any VAPID var unset → 503 BEFORE any DB statement", async () => {
    for (const missing of [
      "VAPID_PUBLIC_KEY",
      "VAPID_PRIVATE_KEY",
      "VAPID_SUBJECT",
    ]) {
      vi.stubEnv(missing, undefined);
      const response = await POST(notifyRequest(`Bearer ${SECRET}`));
      expect(response.status, missing).toBe(503);
      vi.stubEnv(missing, "restored");
    }

    expect(getDbCalls.count).toBe(0);
    expect(await ledgerRows()).toHaveLength(0);
  });
});

describe("runNotifyTick — the tick seam (ADR-0064 decisions 6/7, ADR-0068)", () => {
  it("T-API-S144: the claim lands BEFORE the transport is invoked, and the payload carries computeStreak's exact number in the §4.8 pt-BR copy — n≥2 and n=1 both", async () => {
    const userId = await createUser();
    await subscribe(userId);
    await insertCompletion({ userId, date: daysBack(3), hour: HOUR });
    await insertCompletion({ userId, date: daysBack(2), hour: HOUR });
    await insertCompletion({ userId, date: daysBack(1), hour: HOUR });

    const claimedAtSendTime: boolean[] = [];
    const calls: PushNudgePayload[] = [];
    const send: NudgeSend = async (_subscription, payload) => {
      claimedAtSendTime.push((await ledgerRows()).length === 1);
      calls.push(payload);
      return { ok: true };
    };

    const result = await runNotifyTick(ctx.db, {
      today: TODAY,
      hour: HOUR,
      send,
    });
    expect(result).toEqual({
      candidates: 1,
      claimed: 1,
      sent: 1,
      pruned: 0,
      failed: 0,
    });
    expect(claimedAtSendTime).toEqual([true]);
    expect(calls).toEqual([
      {
        title: "Miolos",
        body: "Sua sequência de 3 dias termina à meia-noite, no horário de Brasília. Jogue hoje para mantê-la.",
      },
    ]);

    await ctx.db.execute(sql`truncate table users cascade`);
    const single = await createUser();
    await subscribe(single);
    await insertCompletion({ userId: single, date: daysBack(1), hour: HOUR });
    const singular = fakeSend();
    await runNotifyTick(ctx.db, {
      today: TODAY,
      hour: HOUR,
      send: singular.send,
    });
    expect(singular.calls.map((call) => call.payload.body)).toEqual([
      "Sua sequência de 1 dia termina à meia-noite, no horário de Brasília. Jogue hoje para mantê-la.",
    ]);
  });

  it("T-API-S145: two ticks with the same {today, hour} send exactly once — the ledger's write-once double-block", async () => {
    const userId = await createUser();
    await subscribe(userId);
    await insertCompletion({ userId, date: daysBack(1), hour: HOUR });

    const { send, calls } = fakeSend();
    const first = await runNotifyTick(ctx.db, {
      today: TODAY,
      hour: HOUR,
      send,
    });
    const second = await runNotifyTick(ctx.db, {
      today: TODAY,
      hour: HOUR,
      send,
    });

    expect(first.sent).toBe(1);

    expect(second).toEqual({
      candidates: 0,
      claimed: 0,
      sent: 0,
      pruned: 0,
      failed: 0,
    });
    expect(calls).toHaveLength(1);
    expect(await ledgerRows()).toHaveLength(1);
  });

  it("T-API-S146: a counted today produces no candidate, no claim and no send", async () => {
    const userId = await createUser();
    await subscribe(userId);
    await insertCompletion({ userId, date: daysBack(1), hour: HOUR });
    await insertCompletion({ userId, date: TODAY, hour: 9 });

    const { send, calls } = fakeSend();
    const result = await runNotifyTick(ctx.db, {
      today: TODAY,
      hour: HOUR,
      send,
    });
    expect(result).toEqual({
      candidates: 0,
      claimed: 0,
      sent: 0,
      pruned: 0,
      failed: 0,
    });
    expect(calls).toHaveLength(0);
    expect(await ledgerRows()).toHaveLength(0);
  });

  it("T-API-S147: a 404 and a 410 each prune exactly that endpoint row — the sibling survives, is still sent to, and `pruned` counts them", async () => {
    const userId = await createUser();
    const dead404 = await subscribe(userId);
    const dead410 = await subscribe(userId);
    const alive = await subscribe(userId);
    await insertCompletion({ userId, date: daysBack(1), hour: HOUR });

    const { send, calls } = fakeSend((subscription) => {
      if (subscription.endpoint === dead404) {
        return { ok: false, statusCode: 404 };
      }
      if (subscription.endpoint === dead410) {
        return { ok: false, statusCode: 410 };
      }
      return { ok: true };
    });
    const result = await runNotifyTick(ctx.db, {
      today: TODAY,
      hour: HOUR,
      send,
    });
    expect(result).toEqual({
      candidates: 1,
      claimed: 1,
      sent: 1,
      pruned: 2,
      failed: 0,
    });

    expect(calls.map((call) => call.endpoint).sort()).toEqual(
      [dead404, dead410, alive].sort(),
    );

    const remaining = await ctx.db
      .select({ endpoint: pushSubscriptions.endpoint })
      .from(pushSubscriptions);
    expect(remaining).toEqual([{ endpoint: alive }]);
  });

  it("T-API-S148: a non-404/410 failure keeps the row, keeps the claim, counts `failed` — and the next tick does NOT retry (decision 7's priced residual as behavior)", async () => {
    const userId = await createUser();
    await subscribe(userId);
    await insertCompletion({ userId, date: daysBack(1), hour: HOUR });

    const { send, calls } = fakeSend(() => ({ ok: false, statusCode: 500 }));
    const result = await runNotifyTick(ctx.db, {
      today: TODAY,
      hour: HOUR,
      send,
    });
    expect(result).toEqual({
      candidates: 1,
      claimed: 1,
      sent: 0,
      pruned: 0,
      failed: 1,
    });

    expect(await ctx.db.select().from(pushSubscriptions)).toHaveLength(1);
    expect(await ledgerRows()).toHaveLength(1);

    const retry = await runNotifyTick(ctx.db, {
      today: TODAY,
      hour: HOUR,
      send,
    });
    expect(retry).toEqual({
      candidates: 0,
      claimed: 0,
      sent: 0,
      pruned: 0,
      failed: 0,
    });
    expect(calls).toHaveLength(1);
  });

  it("T-API-S150: a multi-subscription user takes ONE claim and one send per row, serially", async () => {
    const userId = await createUser();
    const first = await subscribe(userId);
    const second = await subscribe(userId);
    await insertCompletion({ userId, date: daysBack(1), hour: HOUR });

    let inFlight = 0;
    let overlapped = false;
    const calls: string[] = [];
    const send: NudgeSend = async (subscription) => {
      inFlight += 1;
      if (inFlight > 1) {
        overlapped = true;
      }
      await Promise.resolve();
      calls.push(subscription.endpoint);
      inFlight -= 1;
      return { ok: true };
    };

    const result = await runNotifyTick(ctx.db, {
      today: TODAY,
      hour: HOUR,
      send,
    });
    expect(result).toEqual({
      candidates: 1,
      claimed: 1,
      sent: 2,
      pruned: 0,
      failed: 0,
    });
    expect(overlapped).toBe(false);
    expect(calls.sort()).toEqual([first, second].sort());
    expect(await ledgerRows()).toHaveLength(1);
  });
});

describe("POST /cron/notify — the response contract (ADR-0068 decision 4)", () => {
  it("T-API-S149: the real route body strict-parses, its counters match the seeded scenario, and the per-line cron-notify log is emitted", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const response = await POST(notifyRequest(`Bearer ${SECRET}`));
    expect(response.status).toBe(200);
    const body: unknown = await response.json();
    expect(cronNotifyResponseSchema.parse(body)).toEqual({
      candidates: 0,
      claimed: 0,
      sent: 0,
      pruned: 0,
      failed: 0,
    });

    const lines = logSpy.mock.calls
      .map((call) => String(call[0]))
      .filter((line) => line.includes('"event":"cron-notify"'));
    expect(lines).toHaveLength(1);
    const parsed: unknown = JSON.parse(lines[0] ?? "{}");
    expect(parsed).toMatchObject({
      event: "cron-notify",
      candidates: 0,
      sent: 0,
    });
  });
});
