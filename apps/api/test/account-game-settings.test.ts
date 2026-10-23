import { eq, sessions, sql, users } from "@miolos/db";
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

import * as stateRoute from "../app/account/game-settings/state/route";
import * as writeRoute from "../app/account/game-settings/route";
import { generateSessionToken, hashSessionToken } from "../src/session/token";
import { jsonHeaders } from "./push-helpers";

let ctx: Awaited<ReturnType<typeof createTestDb>>;

vi.mock("../src/db", () => ({
  getDb: () => ctx.db,
}));

beforeAll(async () => {
  ctx = await createTestDb();
}, 30_000);

beforeEach(async () => {
  await ctx.db.execute(sql`truncate table users cascade`);
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

async function storedSettings(userId: string): Promise<unknown> {
  const rows = await ctx.db
    .select({ settings: users.gameSettings })
    .from(users)
    .where(eq(users.id, userId));
  const row = rows[0];
  if (!row) {
    throw new Error("user row is gone");
  }
  return row.settings;
}

function write(headers: Headers, body: string): Promise<Response> {
  return writeRoute.POST(
    new NextRequest("http://localhost:3001/account/game-settings", {
      method: "POST",
      headers,
      body,
    }),
  );
}

function readState(token?: string): Promise<Response> {
  return stateRoute.GET(
    new NextRequest("http://localhost:3001/account/game-settings/state", {
      headers: jsonHeaders(token),
    }),
  );
}

const SETTINGS = {
  showClock: false,
  games: { binairo: { firstValue: 0 }, nonogram: { lineCross: "off" } },
};

describe("GET /account/game-settings/state and POST /account/game-settings (#317, ADR-0149)", () => {
  it("T-API-S364: a fresh account holds no copy; a write replaces the whole copy and the read returns it; a stored copy out of bounds reads as none", async () => {
    const { token, userId } = await createSession();

    const fresh = await readState(token);
    expect(fresh.status).toBe(200);
    expect(await fresh.json()).toEqual({ settings: null });

    const saved = await write(
      jsonHeaders(token),
      JSON.stringify({ settings: SETTINGS }),
    );
    expect(saved.status).toBe(200);
    expect(await saved.json()).toEqual({ saved: true });
    expect(await storedSettings(userId)).toEqual(SETTINGS);
    expect(await (await readState(token)).json()).toEqual({
      settings: SETTINGS,
    });

    await write(
      jsonHeaders(token),
      JSON.stringify({ settings: { showClock: true } }),
    );
    expect(await (await readState(token)).json()).toEqual({
      settings: { showClock: true },
    });

    await ctx.db
      .update(users)
      .set({ gameSettings: [1, 2] })
      .where(eq(users.id, userId));
    const odd = await readState(token);
    expect(odd.status).toBe(200);
    expect(await odd.json()).toEqual({ settings: null });
  });

  it("T-API-S365: the write takes the shared preamble, refuses a payload over its bounds, and writes nothing; the read is 401 without a session", async () => {
    const { token, userId } = await createSession();
    const good = JSON.stringify({ settings: SETTINGS });
    const cross = jsonHeaders(token);
    cross.set("sec-fetch-site", "cross-site");
    const text = new Headers({ "content-type": "text/plain" });
    text.set("cookie", jsonHeaders(token).get("cookie") ?? "");
    const cases: { headers: Headers; body: string; status: number }[] = [
      { headers: cross, body: good, status: 403 },
      { headers: text, body: good, status: 415 },
      { headers: jsonHeaders(), body: good, status: 401 },
      { headers: jsonHeaders(token), body: "{", status: 400 },
      {
        headers: jsonHeaders(token),
        body: JSON.stringify({ settings: null }),
        status: 400,
      },
      {
        headers: jsonHeaders(token),
        body: JSON.stringify({ settings: SETTINGS, userId }),
        status: 400,
      },
      {
        headers: jsonHeaders(token),
        body: JSON.stringify({ settings: { a: { b: { c: { d: true } } } } }),
        status: 400,
      },
      {
        headers: jsonHeaders(token),
        body: JSON.stringify({ settings: { note: "x".repeat(5000) } }),
        status: 400,
      },
    ];
    for (const { headers, body, status } of cases) {
      const response = await write(headers, body);
      expect(response.status, String(status)).toBe(status);
      expect(response.headers.get("access-control-allow-origin")).toBe(
        "https://miolos.app",
      );
    }
    expect(await storedSettings(userId)).toBeNull();
    expect(Object.keys(writeRoute).sort()).toEqual([
      "OPTIONS",
      "POST",
      "dynamic",
    ]);

    expect((await readState()).status).toBe(401);
  });
});
