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

import * as stateRoute from "../app/account/telemetry/state/route";
import * as writeRoute from "../app/account/telemetry/route";
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

async function optedOutAt(userId: string): Promise<Date | null> {
  const rows = await ctx.db
    .select({ at: users.telemetryOptOutAt })
    .from(users)
    .where(eq(users.id, userId));
  const row = rows[0];
  if (!row) {
    throw new Error("user row is gone");
  }
  return row.at;
}

function write(headers: Headers, body: string): Promise<Response> {
  return writeRoute.POST(
    new NextRequest("http://localhost:3001/account/telemetry", {
      method: "POST",
      headers,
      body,
    }),
  );
}

function setSending(token: string, sending: boolean): Promise<Response> {
  return write(jsonHeaders(token), JSON.stringify({ sending }));
}

function readState(token?: string): Promise<Response> {
  return stateRoute.GET(
    new NextRequest("http://localhost:3001/account/telemetry/state", {
      headers: jsonHeaders(token),
    }),
  );
}

describe("GET /account/telemetry/state and POST /account/telemetry (#37, ADR-0148)", () => {
  it("T-API-S360: a fresh account is sending; turning it off stamps the opt-out once, a repeat keeps the first instant, and turning it on clears it", async () => {
    const { token, userId } = await createSession();

    const fresh = await readState(token);
    expect(fresh.status).toBe(200);
    expect(await fresh.json()).toEqual({ sending: true });

    const off = await setSending(token, false);
    expect(off.status).toBe(200);
    expect(await off.json()).toEqual({ sending: false });
    const first = await optedOutAt(userId);
    expect(first).toBeInstanceOf(Date);
    expect(await (await readState(token)).json()).toEqual({ sending: false });

    await setSending(token, false);
    expect(await optedOutAt(userId)).toEqual(first);

    const on = await setSending(token, true);
    expect(await on.json()).toEqual({ sending: true });
    expect(await optedOutAt(userId)).toBeNull();
    expect(await (await readState(token)).json()).toEqual({ sending: true });
  });

  it("T-API-S361: the write takes the shared preamble — 403 cross-site, 415 non-JSON, 401 without a session, 400 on a bad body — and writes nothing; the read is 401 without a session", async () => {
    const { token, userId } = await createSession();
    const good = JSON.stringify({ sending: false });
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
        body: JSON.stringify({ sending: "no" }),
        status: 400,
      },
      {
        headers: jsonHeaders(token),
        body: JSON.stringify({ sending: false, userId }),
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
    expect(await optedOutAt(userId)).toBeNull();
    expect(Object.keys(writeRoute).sort()).toEqual([
      "OPTIONS",
      "POST",
      "dynamic",
    ]);

    expect((await readState()).status).toBe(401);
  });
});
