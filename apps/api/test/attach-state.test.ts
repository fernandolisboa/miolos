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

// Seam 4 for GET /attach/state (D9/D10): the real handler over PGlite with
// a LIVE remote_config row, so "read from remote config" is pinned against
// the table rather than a compiled constant.
let ctx: Awaited<ReturnType<typeof createTestDb>>;

vi.mock("../src/db", () => ({
  getDb: () => ctx.db,
}));

vi.mock("../src/email/transport", () => ({
  MAGIC_LINK_SENDER: "Miolos <conta@miolos.app>",
  isEmailConfigured: () => Boolean(process.env.RESEND_API_KEY),
  sendMagicLinkEmail: vi.fn(),
}));

// PGlite boot measures ~1.2 s locally and CI runners are ~3–4× slower
// (plan 017 §15's timeout arithmetic).
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
    // Threshold 3 in the table: the compiled default is 5, so a streak of
    // exactly 3 answers TRUE only if the row is actually read.
    await ctx.db
      .insert(remoteConfig)
      .values({ key: "attachStreakThreshold", value: 3 });
    const today = await todaySaoPaulo(ctx.db);
    const { token, userId } = await createSession();

    await insertOnTimeWin(userId, today);
    await insertOnTimeWin(userId, addDays(today, -1));
    expect(await readEligible(token)).toBe(false); // streak 2 < 3

    await insertOnTimeWin(userId, addDays(today, -2));
    expect(await readEligible(token)).toBe(true); // streak 3 >= 3
  });

  it("T-API-S75: suppressed by an attached email, by dismissal, and by an unconfigured transport; 401 without a session; no-store on every branch", async () => {
    // Threshold 1 so a single on-time win is the eligible baseline —
    // proved TRUE first, so each suppression below is non-vacuous.
    await ctx.db
      .insert(remoteConfig)
      .values({ key: "attachStreakThreshold", value: 1 });
    const today = await todaySaoPaulo(ctx.db);
    const { token, userId } = await createSession();
    await insertOnTimeWin(userId, today);
    expect(await readEligible(token)).toBe(true);

    // Transport unconfigured: the dormancy switch (D11) — the prompt never
    // renders a form whose submit would 503.
    vi.stubEnv("RESEND_API_KEY", undefined);
    expect(await readEligible(token)).toBe(false);
    vi.stubEnv("RESEND_API_KEY", "re_test_key");

    // Dismissed: the one lifecycle per account, terminally retired.
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

    // Attached: email non-null retires the prompt for good.
    await ctx.db
      .update(users)
      .set({ email: "jogadora@example.com", emailVerifiedAt: sql`now()` })
      .where(sql`id = ${userId}`);
    expect(await readEligible(token)).toBe(false);

    // 401 without a session, carrying the same no-store discipline.
    const unauthenticated = await GET(stateRequest());
    expect(unauthenticated.status).toBe(401);
    expect(await unauthenticated.json()).toEqual({ error: "no-session" });
    expect(unauthenticated.headers.get("cache-control")).toBe("no-store");

    // No OPTIONS export: the READ template (the streak route's own pin).
    const routeModule = await import("../app/attach/state/route");
    expect(Object.keys(routeModule).sort()).toEqual(["GET", "dynamic"]);
  });
});
