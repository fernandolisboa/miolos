import { adminStateResponseSchema } from "@miolos/core";
import { sessions, sql, users } from "@miolos/db";
import { getRemoteConfig, remoteConfig } from "@miolos/db/publishing";
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

import * as configRoute from "../app/admin/config/route";
import * as stateRoute from "../app/admin/state/route";
import { isAdmin } from "../src/admin/allow-list";
import { SESSION_COOKIE_NAME } from "../src/session/cookie";
import { generateSessionToken, hashSessionToken } from "../src/session/token";
import { jsonHeaders } from "./push-helpers";

const WEB = "https://miolos.app";
const DEFAULTS = {
  bufferDepth: 7,
  attachStreakThreshold: 5,
  pushOptInStreakThreshold: 3,
  freeHintsPerPuzzle: 3,
};

let ctx: Awaited<ReturnType<typeof createTestDb>>;

vi.mock("../src/db", () => ({
  getDb: () => ctx.db,
}));

beforeAll(async () => {
  ctx = await createTestDb();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
}, 30_000);

beforeEach(async () => {
  await ctx.db.execute(sql`truncate table users cascade`);
  await ctx.db.execute(sql`truncate table remote_config`);
  vi.stubEnv("WEB_ORIGIN", WEB);
  vi.stubEnv("ADMIN_USER_IDS", undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

afterAll(async () => {
  await ctx.close();
  vi.restoreAllMocks();
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

async function createAdmin(): Promise<{ token: string; userId: string }> {
  const session = await createSession();
  vi.stubEnv("ADMIN_USER_IDS", session.userId);
  return session;
}

function stateRequest(token?: string): NextRequest {
  const headers = new Headers();
  if (token !== undefined) {
    headers.set("cookie", `${SESSION_COOKIE_NAME}=${token}`);
  }
  return new NextRequest("http://localhost:3001/admin/state", { headers });
}

function writeConfig(headers: Headers, body: string): Promise<Response> {
  return configRoute.POST(
    new NextRequest("http://localhost:3001/admin/config", {
      method: "POST",
      headers,
      body,
    }),
  );
}

async function readState(token: string) {
  const response = await stateRoute.GET(stateRequest(token));
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("access-control-allow-origin")).toBe(WEB);
  expect(response.headers.get("access-control-allow-credentials")).toBe("true");
  return adminStateResponseSchema.parse(await response.json());
}

async function storedRows() {
  return (await ctx.db.select().from(remoteConfig)).map(({ key, value }) => ({
    key,
    value,
  }));
}

describe("isAdmin reads ADMIN_USER_IDS on every call (ADR-0097)", () => {
  it("T-API-S290: unset, empty or only commas admits nobody; a listed id matches whole, trimmed and in any case", () => {
    const id = "0b6f3c1e-2d4a-4e8b-9f10-3a5c7d9e1f20";
    expect(isAdmin(id)).toBe(false);
    for (const value of ["", " , ", ",,", "someone-else", id.slice(0, 8)]) {
      vi.stubEnv("ADMIN_USER_IDS", value);
      expect(isAdmin(id), JSON.stringify(value)).toBe(false);
    }
    vi.stubEnv("ADMIN_USER_IDS", `other, ${id.toUpperCase()} ,`);
    expect(isAdmin(id)).toBe(true);
    expect(isAdmin(`${id}0`)).toBe(false);
    expect(isAdmin("")).toBe(false);
  });
});

describe("GET /admin/state", () => {
  it("T-API-S291: 401 without a session or with an unknown token, uncached and credentialed", async () => {
    for (const token of [undefined, generateSessionToken()]) {
      const response = await stateRoute.GET(stateRequest(token));
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: "no-session" });
      expect(response.headers.get("cache-control")).toBe("no-store");
    }
    expect(Object.keys(stateRoute).sort()).toEqual(["GET", "dynamic"]);
  });

  it("T-API-S292: a non-admin, or anyone while the list is unset, reads only their own id and a null config", async () => {
    await ctx.db.insert(remoteConfig).values({ key: "bufferDepth", value: 12 });
    const viewer = await createSession();
    expect(await readState(viewer.token)).toEqual({
      userId: viewer.userId,
      config: null,
    });

    const admin = await createAdmin();
    expect(await readState(viewer.token)).toEqual({
      userId: viewer.userId,
      config: null,
    });
    vi.stubEnv("ADMIN_USER_IDS", "");
    expect(await readState(admin.token)).toEqual({
      userId: admin.userId,
      config: null,
    });
  });

  it("T-API-S293: an admin reads the effective config, an invalid stored row showing its key's default", async () => {
    const admin = await createAdmin();
    expect(await readState(admin.token)).toEqual({
      userId: admin.userId,
      config: DEFAULTS,
    });

    await ctx.db.insert(remoteConfig).values([
      { key: "bufferDepth", value: 12 },
      { key: "attachStreakThreshold", value: "five" },
    ]);
    expect(await readState(admin.token)).toEqual({
      userId: admin.userId,
      config: { ...DEFAULTS, bufferDepth: 12 },
    });
  });
});

describe("POST /admin/config", () => {
  it("T-API-S294: the write preamble answers 403 cross-site, 415, 401 and 400 with the CORS grant, and OPTIONS is a 204 preflight", async () => {
    const { token } = await createAdmin();
    const good = JSON.stringify({ key: "bufferDepth", value: 9 });
    const cross = jsonHeaders(token);
    cross.set("sec-fetch-site", "cross-site");
    const text = new Headers({ "content-type": "text/plain" });
    text.set("cookie", jsonHeaders(token).get("cookie") ?? "");

    for (const { headers, body, status, error } of [
      { headers: cross, body: good, status: 403, error: "cross-site" },
      {
        headers: text,
        body: good,
        status: 415,
        error: "unsupported-media-type",
      },
      { headers: jsonHeaders(), body: good, status: 401, error: "no-session" },
      {
        headers: jsonHeaders(token),
        body: "{",
        status: 400,
        error: "invalid-body",
      },
    ]) {
      const response = await writeConfig(headers, body);
      expect(response.status, error).toBe(status);
      expect(await response.json()).toEqual({ error });
      expect(response.headers.get("access-control-allow-origin")).toBe(WEB);
    }
    expect(await storedRows()).toEqual([]);

    const preflight = configRoute.OPTIONS();
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("access-control-allow-methods")).toBe(
      "POST, OPTIONS",
    );
    expect(Object.keys(configRoute).sort()).toEqual([
      "OPTIONS",
      "POST",
      "dynamic",
    ]);
  });

  it("T-API-S295: a signed-in non-admin gets 403 not-admin and writes nothing, also while the list is unset", async () => {
    const viewer = await createSession();
    const body = JSON.stringify({ key: "bufferDepth", value: 9 });
    const response = await writeConfig(jsonHeaders(viewer.token), body);
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "not-admin" });

    await createAdmin();
    const listed = await writeConfig(jsonHeaders(viewer.token), body);
    expect(listed.status).toBe(403);
    expect(await storedRows()).toEqual([]);
  });

  it("T-API-S296: an admin's out-of-bounds, fractional, string, unknown-key or extra-property write is a 400 that writes nothing", async () => {
    const { token } = await createAdmin();
    for (const body of [
      { key: "bufferDepth", value: 31 },
      { key: "bufferDepth", value: 0 },
      { key: "pushOptInStreakThreshold", value: 366 },
      { key: "bufferDepth", value: 7.5 },
      { key: "bufferDepth", value: "7" },
      { key: "someFutureTunable", value: 3 },
      { key: "bufferDepth" },
      { key: "bufferDepth", value: 9, extra: true },
    ]) {
      const response = await writeConfig(
        jsonHeaders(token),
        JSON.stringify(body),
      );
      expect(response.status, JSON.stringify(body)).toBe(400);
    }
    expect(await storedRows()).toEqual([]);
  });

  it("T-API-S297: an admin's valid write persists and answers the re-read state, and repairs an invalid row", async () => {
    const admin = await createAdmin();
    await ctx.db
      .insert(remoteConfig)
      .values({ key: "attachStreakThreshold", value: "five" });

    const first = await writeConfig(
      jsonHeaders(admin.token),
      JSON.stringify({ key: "bufferDepth", value: 9 }),
    );
    expect(first.status).toBe(200);
    expect(first.headers.get("access-control-allow-origin")).toBe(WEB);
    expect(adminStateResponseSchema.parse(await first.json())).toEqual({
      userId: admin.userId,
      config: { ...DEFAULTS, bufferDepth: 9 },
    });

    const repaired = await writeConfig(
      jsonHeaders(admin.token),
      JSON.stringify({ key: "attachStreakThreshold", value: 8 }),
    );
    expect(adminStateResponseSchema.parse(await repaired.json())).toEqual({
      userId: admin.userId,
      config: { ...DEFAULTS, bufferDepth: 9, attachStreakThreshold: 8 },
    });
    expect(await getRemoteConfig(ctx.db)).toEqual({
      ...DEFAULTS,
      bufferDepth: 9,
      attachStreakThreshold: 8,
    });
  });

  it("T-API-S298: with WEB_ORIGIN unset the write fails closed with 503 and writes nothing", async () => {
    const { token } = await createAdmin();
    vi.stubEnv("WEB_ORIGIN", "");
    const response = await writeConfig(
      jsonHeaders(token),
      JSON.stringify({ key: "bufferDepth", value: 9 }),
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "web-origin-unconfigured" });
    expect(await storedRows()).toEqual([]);
  });
});
