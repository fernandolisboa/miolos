import { attachStateResponseSchema } from "@miolos/core";
import { sessions, sql, users } from "@miolos/db";
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

import { GET } from "../app/attach/state/route";
import { addDays } from "../src/publishing/dates";
import { SESSION_COOKIE_NAME } from "../src/session/cookie";
import { generateSessionToken, hashSessionToken } from "../src/session/token";

let ctx: Awaited<ReturnType<typeof createTestDb>>;

vi.mock("../src/db", () => ({
  getDb: () => ctx.db,
}));

vi.mock("../src/email/transport", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../src/email/transport")>();
  return { ...actual, sendMagicLinkEmail: vi.fn() };
});

beforeAll(async () => {
  ctx = await createTestDb();
}, 30_000);

beforeEach(async () => {
  await ctx.db.execute(
    sql`truncate table users, daily_puzzles, remote_config cascade`,
  );
  vi.stubEnv("RESEND_API_KEY", "re_test_key");
  vi.stubEnv("WEB_ORIGIN", "https://miolos.app");
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
  return new NextRequest("http://localhost:3001/attach/state", {
    method: "GET",
    headers,
  });
}

async function readEligible(token: string): Promise<boolean> {
  const response = await GET(stateRequest(token));
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  return attachStateResponseSchema.parse(await response.json()).eligible;
}

describe("GET /attach/state — server-owned eligibility (D9/D10)", () => {
  it("T-API-S74: eligibility flips with the streak crossing a threshold read from a LIVE remote_config row, never a compiled constant", async () => {
    await ctx.db
      .insert(remoteConfig)
      .values({ key: "attachStreakThreshold", value: 3 });
    const today = await todaySaoPaulo(ctx.db);
    const { token, userId } = await createSession();

    await insertOnTimeWin(userId, today);
    await insertOnTimeWin(userId, addDays(today, -1));
    expect(await readEligible(token)).toBe(false);

    await insertOnTimeWin(userId, addDays(today, -2));
    expect(await readEligible(token)).toBe(true);
  });

  it("T-API-S75: suppressed by an attached email, by dismissal, and by an unconfigured transport; 401 without a session; no-store on every branch", async () => {
    await ctx.db
      .insert(remoteConfig)
      .values({ key: "attachStreakThreshold", value: 1 });
    const today = await todaySaoPaulo(ctx.db);
    const { token, userId } = await createSession();
    await insertOnTimeWin(userId, today);
    expect(await readEligible(token)).toBe(true);

    vi.stubEnv("RESEND_API_KEY", undefined);
    expect(await readEligible(token)).toBe(false);
    vi.stubEnv("RESEND_API_KEY", "re_test_key");

    await ctx.db
      .update(users)
      .set({ attachPromptDismissedAt: sql`now()` })
      .where(sql`id = ${userId}`);
    expect(await readEligible(token)).toBe(false);
    await ctx.db
      .update(users)
      .set({ attachPromptDismissedAt: null })
      .where(sql`id = ${userId}`);
    expect(await readEligible(token)).toBe(true);

    await ctx.db
      .update(users)
      .set({ email: "jogadora@example.com", emailVerifiedAt: sql`now()` })
      .where(sql`id = ${userId}`);
    expect(await readEligible(token)).toBe(false);

    const unauthenticated = await GET(stateRequest());
    expect(unauthenticated.status).toBe(401);
    expect(await unauthenticated.json()).toEqual({ error: "no-session" });
    expect(unauthenticated.headers.get("cache-control")).toBe("no-store");

    const routeModule = await import("../app/attach/state/route");
    expect(Object.keys(routeModule).sort()).toEqual(["GET", "dynamic"]);
  });

  it("T-API-S84: the dormancy conjunct is the FULL switch — a keyed environment with WEB_ORIGIN unset reports ineligible (step-7 finding H)", async () => {
    await ctx.db
      .insert(remoteConfig)
      .values({ key: "attachStreakThreshold", value: 1 });
    const today = await todaySaoPaulo(ctx.db);
    const { token, userId } = await createSession();
    await insertOnTimeWin(userId, today);
    expect(await readEligible(token)).toBe(true);

    vi.stubEnv("WEB_ORIGIN", undefined);
    expect(await readEligible(token)).toBe(false);
    vi.stubEnv("WEB_ORIGIN", "https://miolos.app");
    expect(await readEligible(token)).toBe(true);
  });
});
