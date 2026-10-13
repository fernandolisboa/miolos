import { adminStateResponseSchema, type AdminMemberRole } from "@miolos/core";
import { sessions, sql, users } from "@miolos/db";
import {
  getRemoteConfig,
  listAdminMembers,
  remoteConfig,
  upsertAdminMember,
} from "@miolos/db/publishing";
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
  type MockInstance,
} from "vitest";

import * as configRoute from "../app/admin/config/route";
import * as membersRoute from "../app/admin/members/route";
import * as stateRoute from "../app/admin/state/route";
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
let info: MockInstance<typeof console.info>;

vi.mock("../src/db", () => ({
  getDb: () => ctx.db,
}));

beforeAll(async () => {
  ctx = await createTestDb();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  info = vi.spyOn(console, "info").mockImplementation(() => undefined);
}, 30_000);

beforeEach(async () => {
  info.mockClear();
  await ctx.db.execute(sql`truncate table users cascade`);
  await ctx.db.execute(sql`truncate table remote_config`);
  await ctx.db.execute(sql`truncate table admin_users`);
  vi.stubEnv("WEB_ORIGIN", WEB);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

afterAll(async () => {
  await ctx.close();
  vi.restoreAllMocks();
});

type Session = { token: string; userId: string; email: string | null };

let sessionCount = 0;

async function createSession(email: string | null = null): Promise<Session> {
  const inserted = await ctx.db
    .insert(users)
    .values({ email, emailVerifiedAt: email === null ? null : new Date() })
    .returning();
  const user = inserted[0];
  if (!user) {
    throw new Error("users insert returned no row");
  }
  const token = generateSessionToken();
  await ctx.db
    .insert(sessions)
    .values({ tokenHash: await hashSessionToken(token), userId: user.id });
  return { token, userId: user.id, email };
}

async function createMember(
  role: AdminMemberRole,
): Promise<Session & { email: string }> {
  sessionCount += 1;
  const email = `${role}-${sessionCount}@example.com`;
  await upsertAdminMember(ctx.db, email, role);
  const session = await createSession(email);
  return { ...session, email };
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

function writeMembers(
  method: "POST" | "DELETE",
  headers: Headers,
  body: string,
): Promise<Response> {
  return membersRoute[method](
    new NextRequest("http://localhost:3001/admin/members", {
      method,
      headers,
      body,
    }),
  );
}

async function expectWritePreamble(
  token: string,
  good: string,
  send: (headers: Headers, body: string) => Promise<Response>,
): Promise<void> {
  const cross = jsonHeaders(token);
  cross.set("sec-fetch-site", "cross-site");
  const text = new Headers({ "content-type": "text/plain" });
  text.set("cookie", jsonHeaders(token).get("cookie") ?? "");

  for (const { headers, body, status, error } of [
    { headers: cross, body: good, status: 403, error: "cross-site" },
    { headers: text, body: good, status: 415, error: "unsupported-media-type" },
    { headers: jsonHeaders(), body: good, status: 401, error: "no-session" },
    {
      headers: jsonHeaders(token),
      body: "{",
      status: 400,
      error: "invalid-body",
    },
  ]) {
    const response = await send(headers, body);
    expect(response.status, error).toBe(status);
    expect(await response.json()).toEqual({ error });
    expect(response.headers.get("access-control-allow-origin")).toBe(WEB);
  }
}

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

  it("T-API-S292: a non-member reads role none and their attached email, or null for no verified email, and never the config", async () => {
    await ctx.db.insert(remoteConfig).values({ key: "bufferDepth", value: 12 });
    await createMember("superuser");

    const anonymous = await createSession();
    expect(await readState(anonymous.token)).toEqual({
      role: "none",
      email: null,
    });

    const attached = await createSession("zeca@example.com");
    expect(await readState(attached.token)).toEqual({
      role: "none",
      email: "zeca@example.com",
    });

    const pending = await createSession();
    await ctx.db
      .update(users)
      .set({ email: "caio@example.com" })
      .where(sql`${users.id} = ${pending.userId}`);
    await upsertAdminMember(ctx.db, "caio@example.com", "superuser");
    expect(await readState(pending.token)).toEqual({
      role: "none",
      email: null,
    });
  });

  it("T-API-S293: an admin reads the effective config and no members, an invalid stored row showing its key's default", async () => {
    const admin = await createMember("admin");
    expect(await readState(admin.token)).toEqual({
      role: "admin",
      email: admin.email,
      config: DEFAULTS,
    });

    await ctx.db.insert(remoteConfig).values([
      { key: "bufferDepth", value: 12 },
      { key: "attachStreakThreshold", value: "five" },
    ]);
    expect(await readState(admin.token)).toEqual({
      role: "admin",
      email: admin.email,
      config: { ...DEFAULTS, bufferDepth: 12 },
    });
  });

  it("T-API-S313: a superuser reads the config and every member, sorted by email", async () => {
    await upsertAdminMember(ctx.db, "zeca@example.com", "admin");
    await upsertAdminMember(ctx.db, "ana@example.com", "admin");
    const superuser = await createMember("superuser");
    await ctx.db.insert(remoteConfig).values({ key: "bufferDepth", value: 12 });

    expect(await readState(superuser.token)).toEqual({
      role: "superuser",
      email: superuser.email,
      config: { ...DEFAULTS, bufferDepth: 12 },
      members: [
        { email: "ana@example.com", role: "admin" },
        { email: superuser.email, role: "superuser" },
        { email: "zeca@example.com", role: "admin" },
      ],
    });
  });
});

describe("POST /admin/config", () => {
  it("T-API-S294: the write preamble answers 403 cross-site, 415, 401 and 400 with the CORS grant, and OPTIONS is a 204 preflight", async () => {
    const { token } = await createMember("admin");
    await expectWritePreamble(
      token,
      JSON.stringify({ key: "bufferDepth", value: 9 }),
      writeConfig,
    );
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

  it("T-API-S295: a signed-in non-member gets 403 not-admin and writes nothing, with or without an attached email", async () => {
    await createMember("superuser");
    const body = JSON.stringify({ key: "bufferDepth", value: 9 });
    for (const viewer of [
      await createSession(),
      await createSession("zeca@example.com"),
    ]) {
      const response = await writeConfig(jsonHeaders(viewer.token), body);
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ error: "not-admin" });
    }
    expect(await storedRows()).toEqual([]);
  });

  it("T-API-S296: an admin's out-of-bounds, fractional, string, unknown-key or extra-property write is a 400 that writes nothing", async () => {
    const { token } = await createMember("admin");
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
    const admin = await createMember("admin");
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
      role: "admin",
      email: admin.email,
      config: { ...DEFAULTS, bufferDepth: 9 },
    });

    const repaired = await writeConfig(
      jsonHeaders(admin.token),
      JSON.stringify({ key: "attachStreakThreshold", value: 8 }),
    );
    expect(adminStateResponseSchema.parse(await repaired.json())).toEqual({
      role: "admin",
      email: admin.email,
      config: { ...DEFAULTS, bufferDepth: 9, attachStreakThreshold: 8 },
    });
    expect(await getRemoteConfig(ctx.db)).toEqual({
      ...DEFAULTS,
      bufferDepth: 9,
      attachStreakThreshold: 8,
    });
  });

  it("T-API-S298: with WEB_ORIGIN unset the write fails closed with 503 and writes nothing", async () => {
    const { token } = await createMember("admin");
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

describe("/admin/members (ADR-0100)", () => {
  it("T-API-S314: the write preamble answers 403 cross-site, 415, 401 and 400 on POST and DELETE, and OPTIONS is a 204 preflight for both", async () => {
    const { token } = await createMember("superuser");
    const before = await listAdminMembers(ctx.db);

    for (const method of ["POST", "DELETE"] as const) {
      await expectWritePreamble(
        token,
        JSON.stringify({ email: "bia@example.com", role: "admin" }),
        (headers, body) => writeMembers(method, headers, body),
      );
    }
    for (const [method, body] of [
      ["POST", { email: "bia@example.com", role: "none" }],
      ["POST", { email: "not-an-email", role: "admin" }],
      ["POST", { email: "bia@example.com", role: "admin", extra: true }],
      ["DELETE", {}],
      ["DELETE", { email: "bia@example.com", role: "admin" }],
    ] as const) {
      const response = await writeMembers(
        method,
        jsonHeaders(token),
        JSON.stringify(body),
      );
      expect(response.status, JSON.stringify(body)).toBe(400);
    }
    expect(await listAdminMembers(ctx.db)).toEqual(before);

    const preflight = membersRoute.OPTIONS();
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("access-control-allow-methods")).toBe(
      "POST, DELETE, OPTIONS",
    );
    expect(Object.keys(membersRoute).sort()).toEqual([
      "DELETE",
      "OPTIONS",
      "POST",
      "dynamic",
    ]);
  });

  it("T-API-S315: an admin or a non-member gets 403 not-superuser on both methods and writes nothing", async () => {
    const superuser = await createMember("superuser");
    const callers = [
      await createMember("admin"),
      await createSession(),
      await createSession("zeca@example.com"),
    ];
    const before = await listAdminMembers(ctx.db);
    for (const caller of callers) {
      for (const [method, body] of [
        ["POST", { email: "zeca@example.com", role: "superuser" }],
        ["DELETE", { email: superuser.email }],
      ] as const) {
        const response = await writeMembers(
          method,
          jsonHeaders(caller.token),
          JSON.stringify(body),
        );
        expect(response.status, method).toBe(403);
        expect(await response.json()).toEqual({ error: "not-superuser" });
      }
    }
    expect(await listAdminMembers(ctx.db)).toEqual(before);
  });

  it("T-API-S316: an upsert normalises the email, adds or changes the role, answers the state and logs the write", async () => {
    const superuser = await createMember("superuser");

    const added = await writeMembers(
      "POST",
      jsonHeaders(superuser.token),
      JSON.stringify({ email: "  Bia@Example.COM ", role: "admin" }),
    );
    expect(added.status).toBe(200);
    expect(added.headers.get("access-control-allow-origin")).toBe(WEB);
    expect(added.headers.get("access-control-allow-credentials")).toBe("true");
    expect(adminStateResponseSchema.parse(await added.json())).toEqual({
      role: "superuser",
      email: superuser.email,
      config: DEFAULTS,
      members: [
        { email: "bia@example.com", role: "admin" },
        { email: superuser.email, role: "superuser" },
      ],
    });

    const promoted = await writeMembers(
      "POST",
      jsonHeaders(superuser.token),
      JSON.stringify({ email: "bia@example.com", role: "superuser" }),
    );
    expect(promoted.status).toBe(200);
    expect(await listAdminMembers(ctx.db)).toEqual([
      { email: "bia@example.com", role: "superuser" },
      { email: superuser.email, role: "superuser" },
    ]);
    expect(info.mock.calls).toEqual([
      [
        "admin member upsert",
        { userId: superuser.userId, email: "bia@example.com", role: "admin" },
      ],
      [
        "admin member upsert",
        {
          userId: superuser.userId,
          email: "bia@example.com",
          role: "superuser",
        },
      ],
    ]);
  });

  it("T-API-S317: a removal answers the state; an absent email is a 200 that logs nothing", async () => {
    const superuser = await createMember("superuser");
    await upsertAdminMember(ctx.db, "bia@example.com", "admin");
    const remaining = {
      role: "superuser",
      email: superuser.email,
      config: DEFAULTS,
      members: [{ email: superuser.email, role: "superuser" }],
    };

    const removed = await writeMembers(
      "DELETE",
      jsonHeaders(superuser.token),
      JSON.stringify({ email: "BIA@example.com" }),
    );
    expect(removed.status).toBe(200);
    expect(adminStateResponseSchema.parse(await removed.json())).toEqual(
      remaining,
    );
    expect(info.mock.calls).toEqual([
      [
        "admin member remove",
        { userId: superuser.userId, email: "bia@example.com" },
      ],
    ]);

    const absent = await writeMembers(
      "DELETE",
      jsonHeaders(superuser.token),
      JSON.stringify({ email: "bia@example.com" }),
    );
    expect(absent.status).toBe(200);
    expect(adminStateResponseSchema.parse(await absent.json())).toEqual(
      remaining,
    );
    expect(info).toHaveBeenCalledTimes(1);
  });

  it("T-API-S318: removing or demoting the last superuser is a 409 that changes nothing; beside a second superuser, self-demotion is a 200", async () => {
    const superuser = await createMember("superuser");
    await upsertAdminMember(ctx.db, "bia@example.com", "admin");
    const before = await listAdminMembers(ctx.db);

    for (const [method, body] of [
      ["DELETE", { email: superuser.email }],
      ["POST", { email: superuser.email, role: "admin" }],
    ] as const) {
      const response = await writeMembers(
        method,
        jsonHeaders(superuser.token),
        JSON.stringify(body),
      );
      expect(response.status, method).toBe(409);
      expect(await response.json()).toEqual({ error: "last-superuser" });
      expect(response.headers.get("access-control-allow-origin")).toBe(WEB);
    }
    expect(await listAdminMembers(ctx.db)).toEqual(before);
    expect(info).not.toHaveBeenCalled();

    await upsertAdminMember(ctx.db, "bia@example.com", "superuser");
    const demoted = await writeMembers(
      "POST",
      jsonHeaders(superuser.token),
      JSON.stringify({ email: superuser.email, role: "admin" }),
    );
    expect(demoted.status).toBe(200);
    expect(adminStateResponseSchema.parse(await demoted.json())).toEqual({
      role: "admin",
      email: superuser.email,
      config: DEFAULTS,
    });
  });

  it("T-API-S319: with WEB_ORIGIN unset both writes fail closed with 503 and write nothing", async () => {
    const superuser = await createMember("superuser");
    vi.stubEnv("WEB_ORIGIN", "");
    for (const [method, body] of [
      ["POST", { email: "bia@example.com", role: "admin" }],
      ["DELETE", { email: superuser.email }],
    ] as const) {
      const response = await writeMembers(
        method,
        jsonHeaders(superuser.token),
        JSON.stringify(body),
      );
      expect(response.status, method).toBe(503);
      expect(await response.json()).toEqual({
        error: "web-origin-unconfigured",
      });
    }
    expect(await listAdminMembers(ctx.db)).toEqual([
      { email: superuser.email, role: "superuser" },
    ]);
  });

  it("T-API-S320: the role is read on every request: a table admin writes config, and after a removal or an email detach the next write is 403", async () => {
    const superuser = await createMember("superuser");
    const removed = await createMember("admin");
    const detached = await createMember("admin");
    const body = JSON.stringify({ key: "bufferDepth", value: 9 });
    for (const admin of [removed, detached]) {
      const response = await writeConfig(jsonHeaders(admin.token), body);
      expect(response.status).toBe(200);
    }

    const removal = await writeMembers(
      "DELETE",
      jsonHeaders(superuser.token),
      JSON.stringify({ email: removed.email }),
    );
    expect(removal.status).toBe(200);
    await ctx.db
      .update(users)
      .set({ email: null, emailVerifiedAt: null })
      .where(sql`${users.id} = ${detached.userId}`);

    for (const admin of [removed, detached]) {
      const response = await writeConfig(jsonHeaders(admin.token), body);
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ error: "not-admin" });
    }
  });
});
