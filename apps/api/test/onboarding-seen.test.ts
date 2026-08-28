import { eq, sessions, sql, users } from "@miolos/db";
import { createTestDb } from "@miolos/db/testing";
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

import { OPTIONS, POST } from "../app/onboarding/seen/route";
import { SESSION_COOKIE_NAME } from "../src/session/cookie";
import { generateSessionToken, hashSessionToken } from "../src/session/token";
import { jsonHeaders, seenRequest } from "./onboarding-helpers";

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

async function userRow(userId: string) {
  const rows = await ctx.db.select().from(users).where(eq(users.id, userId));
  const row = rows[0];
  if (!row) {
    throw new Error(`no users row for ${userId}`);
  }
  return row;
}

describe("POST /onboarding/seen — the permanent, idempotent acknowledgement (#35, ADR-0061)", () => {
  it("T-API-S120: stamps onboarding_seen_at with explicit updated_at, and a re-post touches zero rows — neither stamp moves", async () => {
    const { token, userId } = await createSession();

    const response = await POST(
      seenRequest({ headers: jsonHeaders(token), body: "{}" }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ seen: true });

    const stamped = await userRow(userId);
    expect(stamped.onboardingSeenAt).toBeInstanceOf(Date);

    expect(stamped.updatedAt.toISOString()).toBe(
      stamped.onboardingSeenAt?.toISOString(),
    );

    const replay = await POST(
      seenRequest({ headers: jsonHeaders(token), body: "{}" }),
    );
    expect(replay.status).toBe(200);
    expect(await replay.json()).toEqual({ seen: true });
    expect(await userRow(userId)).toEqual(stamped);
  });

  it("T-API-S121: the write-route guards — 401 without a session, 403 cross-site, 415 non-JSON, 400 for any key and for a malformed body, an OPTIONS preflight — and none of them stamps", async () => {
    const { token, userId } = await createSession();

    const noSession = await POST(
      seenRequest({ headers: jsonHeaders(), body: "{}" }),
    );
    expect(noSession.status).toBe(401);
    expect(await noSession.json()).toEqual({ error: "no-session" });

    const crossHeaders = jsonHeaders(token);
    crossHeaders.set("sec-fetch-site", "cross-site");
    const crossSite = await POST(
      seenRequest({ headers: crossHeaders, body: "{}" }),
    );
    expect(crossSite.status).toBe(403);
    expect(await crossSite.json()).toEqual({ error: "cross-site" });

    const textHeaders = new Headers({ "content-type": "text/plain" });
    textHeaders.set("cookie", `${SESSION_COOKIE_NAME}=${token}`);
    const wrongType = await POST(
      seenRequest({ headers: textHeaders, body: "{}" }),
    );
    expect(wrongType.status).toBe(415);
    expect(await wrongType.json()).toEqual({
      error: "unsupported-media-type",
    });

    const smuggled = await POST(
      seenRequest({
        headers: jsonHeaders(token),
        body: JSON.stringify({ anything: true }),
      }),
    );
    expect(smuggled.status).toBe(400);
    expect(await smuggled.json()).toEqual({ error: "invalid-body" });

    const malformed = await POST(
      seenRequest({ headers: jsonHeaders(token), body: "{" }),
    );
    expect(malformed.status).toBe(400);

    expect(OPTIONS().status).toBe(204);

    expect((await userRow(userId)).onboardingSeenAt).toBeNull();
  });
});
