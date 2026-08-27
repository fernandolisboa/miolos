import { notificationsStateResponseSchema } from "@miolos/core";
import { pushSubscriptions, sessions, sql, users } from "@miolos/db";
import { remoteConfig, todaySaoPaulo } from "@miolos/db/publishing";
import { createTestDb } from "@miolos/db/testing";
import { completions } from "@miolos/db/user";
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

import { GET } from "../app/notifications/state/route";
import {
  DELETE as subscriptionsDelete,
  POST as subscriptionsPost,
} from "../app/push/subscriptions/route";
import { addDays } from "../src/publishing/dates";
import { SESSION_COOKIE_NAME } from "../src/session/cookie";
import { generateSessionToken, hashSessionToken } from "../src/session/token";
import { jsonHeaders, subscriptionsRequest } from "./push-helpers";

let ctx: Awaited<ReturnType<typeof createTestDb>>;

vi.mock("../src/db", () => ({
  getDb: () => ctx.db,
}));

beforeAll(async () => {
  ctx = await createTestDb();
}, 30_000);

beforeEach(async () => {
  await ctx.db.execute(
    sql`truncate table users, daily_puzzles, remote_config cascade`,
  );
  vi.stubEnv("WEB_ORIGIN", "https://miolos.app");
  vi.stubEnv("VAPID_PUBLIC_KEY", "BTestPublicKey");
  vi.stubEnv("VAPID_PRIVATE_KEY", "test-private-key");
  vi.stubEnv("VAPID_SUBJECT", "mailto:privacidade@miolos.app");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

afterAll(async () => {
  await ctx.close();
});

async function createSession(): Promise<{ token: string; userId: string }> {
  const inserted = await ctx.db.insert(users).values({}).returning();
  const user = inserted[0];
  if (!user) {
    throw new Error("users insert returned no row");
  }
  const token = generateSessionToken();
  await ctx.db
    .insert(sessions)
    .values({ tokenHash: await hashSessionToken(token), userId: user.id });
  return { token, userId: user.id };
}

async function insertOnTimeWin(userId: string, date: string): Promise<void> {
  await ctx.db.insert(completions).values({
    userId,
    game: "binairo",
    date,
    outcome: "won",
    completedAt: new Date(`${date}T15:00:00Z`),
    elapsedMs: 61_000,
    hintsUsed: 0,
    onTime: true,
  });
}

function stateRequest(token?: string): NextRequest {
  const headers = new Headers();
  if (token !== undefined) {
    headers.set("cookie", `${SESSION_COOKIE_NAME}=${token}`);
  }
  return new NextRequest("http://localhost:3001/notifications/state", {
    method: "GET",
    headers,
  });
}

async function readState(
  token: string,
): Promise<{ eligible: boolean; vapidPublicKey: string | null }> {
  const response = await GET(stateRequest(token));
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  return notificationsStateResponseSchema.parse(await response.json());
}

async function seedStreakOfThree(userId: string): Promise<void> {
  const today = await todaySaoPaulo(ctx.db);
  await insertOnTimeWin(userId, today);
  await insertOnTimeWin(userId, addDays(today, -1));
  await insertOnTimeWin(userId, addDays(today, -2));
}

describe("GET /notifications/state — server-owned eligibility (#145, ADR-0064)", () => {
  it("T-API-S124: the happy path answers eligible with the public key — streak >= the default 3, undismissed, configured — and 401 without a session; the READ template exports GET only", async () => {
    const { token, userId } = await createSession();

    const today = await todaySaoPaulo(ctx.db);
    await insertOnTimeWin(userId, today);
    await insertOnTimeWin(userId, addDays(today, -1));
    expect(await readState(token)).toEqual({
      eligible: false,
      vapidPublicKey: "BTestPublicKey",
    });

    await insertOnTimeWin(userId, addDays(today, -2));
    expect(await readState(token)).toEqual({
      eligible: true,
      vapidPublicKey: "BTestPublicKey",
    });

    const unauthenticated = await GET(stateRequest());
    expect(unauthenticated.status).toBe(401);
    expect(await unauthenticated.json()).toEqual({ error: "no-session" });
    expect(unauthenticated.headers.get("cache-control")).toBe("no-store");

    const routeModule = await import("../app/notifications/state/route");
    expect(Object.keys(routeModule).sort()).toEqual(["GET", "dynamic"]);
  });

  it("T-API-S125: dormancy is the FULL VAPID triple — each var missing alone answers {eligible:false, vapidPublicKey:null}, and the subscribe verbs 503 BEFORE any side effect", async () => {
    const { token, userId } = await createSession();
    await seedStreakOfThree(userId);

    expect(await readState(token)).toEqual({
      eligible: true,
      vapidPublicKey: "BTestPublicKey",
    });

    for (const name of [
      "VAPID_PUBLIC_KEY",
      "VAPID_PRIVATE_KEY",
      "VAPID_SUBJECT",
    ] as const) {
      vi.stubEnv(name, undefined);
      expect(await readState(token), name).toEqual({
        eligible: false,
        vapidPublicKey: null,
      });

      const posted = await subscriptionsPost(
        subscriptionsRequest("POST", {
          headers: jsonHeaders(token),
          body: "{malformed",
        }),
      );
      expect(posted.status, name).toBe(503);
      expect(await posted.json()).toEqual({ error: "push-not-configured" });
      const deleted = await subscriptionsDelete(
        subscriptionsRequest("DELETE", {
          headers: jsonHeaders(token),
          body: "{malformed",
        }),
      );
      expect(deleted.status, name).toBe(503);
      expect(await ctx.db.select().from(pushSubscriptions)).toEqual([]);

      vi.stubEnv(name, "restored-for-next-leg");
    }
  });

  it("T-API-S126: dismissed answers false, below-threshold answers false, and a LIVE remote_config row overrides the compiled default", async () => {
    const { token, userId } = await createSession();
    await seedStreakOfThree(userId);
    expect((await readState(token)).eligible).toBe(true);

    await ctx.db
      .update(users)
      .set({ pushPromptDismissedAt: sql`now()` })
      .where(sql`id = ${userId}`);
    expect(await readState(token)).toEqual({
      eligible: false,
      vapidPublicKey: "BTestPublicKey",
    });
    await ctx.db
      .update(users)
      .set({ pushPromptDismissedAt: null })
      .where(sql`id = ${userId}`);
    expect((await readState(token)).eligible).toBe(true);

    await ctx.db
      .insert(remoteConfig)
      .values({ key: "pushOptInStreakThreshold", value: 5 });
    expect((await readState(token)).eligible).toBe(false);
    await ctx.db
      .update(remoteConfig)
      .set({ value: 2 })
      .where(sql`key = 'pushOptInStreakThreshold'`);
    expect((await readState(token)).eligible).toBe(true);
  });
});
