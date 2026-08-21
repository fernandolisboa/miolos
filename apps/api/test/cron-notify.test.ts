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

// The dispatcher suite (#146, plan 063 §7; ADR-0064 decisions 6–9,
// ADR-0067). Two seams: the ROUTE as a function (auth, dormancy, contract
// shape — the cron-publish.test.ts harness) and the TICK via
// `runNotifyTick` with explicit `{today, hour}` fixtures and a FAKE
// injected transport recording calls — no `vi.mock` of web-push anywhere,
// which is the point of the injection. Every behavioral test is
// real-clock-free: fixtures set every `completed_at` explicitly (SP is
// UTC-3, no DST, so `<date> <hh>:<mm>:00-03` is exact).
let ctx: Awaited<ReturnType<typeof createTestDb>>;

// A call-counting getDb mock: T-API-S143 asserts the 503 fires with ZERO
// DB statements, and "getDb was never constructed" is the cheapest honest
// spelling of that (the route builds its handle before any statement).
const getDbCalls = { count: 0 };
vi.mock("../src/db", () => ({
  getDb: () => {
    getDbCalls.count += 1;
    return ctx.db;
  },
}));

const SECRET = "test-cron-secret";

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

/** A completion with an EXPLICIT SP write instant (the notify.test.ts fixture). */
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

/** Days back from TODAY without touching a real clock — pure string math on
 *  a fixed August fixture (all days stay inside the month). */
function daysBack(n: number): string {
  return `2026-08-${String(20 - n).padStart(2, "0")}`;
}

/** A recording transport whose per-call result is scripted. */
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
    // 401 precedes everything: no DB handle was ever constructed.
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
    // Zero DB statements across all three: the handle was never built,
    // and nothing was claimed.
    expect(getDbCalls.count).toBe(0);
    expect(await ledgerRows()).toHaveLength(0);
  });
});

describe("runNotifyTick — the tick seam (ADR-0064 decisions 6/7, ADR-0067)", () => {
  it("T-API-S144: the claim lands BEFORE the transport is invoked, and the payload carries computeStreak's exact number in the §4.8 pt-BR copy — n≥2 and n=1 both", async () => {
    // A three-day streak ending yesterday: today-3, today-2, yesterday —
    // computeStreak(rows, TODAY) = 3 with today uncounted.
    const userId = await createUser();
    await subscribe(userId);
    await insertCompletion({ userId, date: daysBack(3), hour: HOUR });
    await insertCompletion({ userId, date: daysBack(2), hour: HOUR });
    await insertCompletion({ userId, date: daysBack(1), hour: HOUR });

    // The order pin: the ledger row must exist at the moment the transport
    // runs — claim-first is decision 7's whole mechanism.
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

    // n = 1 takes the singular — a fresh user with only yesterday counted.
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
    // The second tick's candidate list already excludes the claimed user
    // (the prefilter), so candidates = 0 — and had the prefilter raced,
    // the claim itself would still have blocked the send.
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
    // Every row was attempted (the prune never starves a sibling)…
    expect(calls.map((call) => call.endpoint).sort()).toEqual(
      [dead404, dead410, alive].sort(),
    );
    // …and exactly the dead endpoints are gone.
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
    // The row stays (a 500 is the push service's bad day, not the
    // endpoint's death) and the claim stands.
    expect(await ctx.db.select().from(pushSubscriptions)).toHaveLength(1);
    expect(await ledgerRows()).toHaveLength(1);

    // No retry: the claimed user is out of every later tick this day.
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

    // The serial pin: a send begins only after the previous one settled.
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

describe("POST /cron/notify — the response contract (ADR-0067 decision 4)", () => {
  it("T-API-S149: the real route body strict-parses, its counters match the seeded scenario, and the per-line cron-notify log is emitted", async () => {
    // An empty database is the expected first-tick reality: zero
    // candidates whatever the real clock's hour is — which is what makes
    // this route-level test deterministic without faking the DB clock.
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
