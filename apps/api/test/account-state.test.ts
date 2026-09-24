import { accountStateResponseSchema } from "@miolos/core";
import { sessions, sql, users } from "@miolos/db";
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

import { GET } from "../app/account/state/route";
import { SESSION_COOKIE_NAME } from "../src/session/cookie";
import { generateSessionToken, hashSessionToken } from "../src/session/token";

const WEB = "https://miolos.app";

let ctx: Awaited<ReturnType<typeof createTestDb>>;

vi.mock("../src/db", () => ({
  getDb: () => ctx.db,
}));

beforeAll(async () => {
  ctx = await createTestDb();
}, 30_000);

beforeEach(async () => {
  await ctx.db.execute(sql`truncate table users cascade`);
  vi.stubEnv("WEB_ORIGIN", WEB);
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

function stateRequest(token?: string): NextRequest {
  const headers = new Headers();
  if (token !== undefined) {
    headers.set("cookie", `${SESSION_COOKIE_NAME}=${token}`);
  }
  return new NextRequest("http://localhost:3001/account/state", {
    method: "GET",
    headers,
  });
}

function expectReadHeaders(response: Response): void {
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("access-control-allow-origin")).toBe(WEB);
  expect(response.headers.get("access-control-allow-credentials")).toBe("true");
}

describe("GET /account/state", () => {
  it("T-API-S200: 401 without a session or with an unknown token, uncached and credentialed", async () => {
    for (const token of [undefined, generateSessionToken()]) {
      const response = await GET(stateRequest(token));
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: "no-session" });
      expectReadHeaders(response);
    }
  });

  it("T-API-S201: an anonymous account reads no email and no reminder consent", async () => {
    const { token } = await createSession();
    const response = await GET(stateRequest(token));
    expect(response.status).toBe(200);
    expectReadHeaders(response);
    expect(accountStateResponseSchema.parse(await response.json())).toEqual({
      email: null,
      reminderConsent: false,
    });
  });

  it("T-API-S202: an attached account reads its own email in full and whether reminder consent is stamped", async () => {
    const { token, userId } = await createSession();
    const other = await createSession();
    await ctx.db
      .update(users)
      .set({
        email: "outra@example.com",
        emailVerifiedAt: sql`now()`,
        reminderConsentAt: sql`now()`,
      })
      .where(sql`id = ${other.userId}`);
    await ctx.db
      .update(users)
      .set({ email: "jogadora@example.com", emailVerifiedAt: sql`now()` })
      .where(sql`id = ${userId}`);

    const read = async () =>
      accountStateResponseSchema.parse(
        await (await GET(stateRequest(token))).json(),
      );
    expect(await read()).toEqual({
      email: "jogadora@example.com",
      reminderConsent: false,
    });

    await ctx.db
      .update(users)
      .set({ reminderConsentAt: sql`now()` })
      .where(sql`id = ${userId}`);
    expect(await read()).toEqual({
      email: "jogadora@example.com",
      reminderConsent: true,
    });
  });
});
