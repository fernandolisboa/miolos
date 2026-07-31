import { sessionResponseSchema } from "@miolos/core";
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

import { OPTIONS, POST } from "../app/session/route";
import { SESSION_COOKIE_NAME } from "../src/session/cookie";
import { hashSessionToken } from "../src/session/token";

// Seam 4: route handlers invoked as functions, responses parsed with the
// shared Zod contract, and the ONLY mock is src/db — everything below getDb
// runs for real on in-memory PGlite executing the committed migrations.
let ctx: Awaited<ReturnType<typeof createTestDb>>;

vi.mock("../src/db", () => ({
  getDb: () => ctx.db,
}));

function postRequest(init?: {
  headers?: Record<string, string>;
  body?: string;
}): NextRequest {
  return new NextRequest("http://localhost:3001/session", {
    method: "POST",
    headers: init?.headers,
    body: init?.body,
  });
}

function cookieTokenOf(response: Response): string {
  const setCookie = response.headers.get("set-cookie");
  const match = setCookie?.match(
    new RegExp(`^${SESSION_COOKIE_NAME}=([^;]+);`),
  );
  if (!match?.[1]) {
    // Redact the cookie value: even throwaway PGlite tokens never reach a
    // log — "no raw token in any log" holds to the letter.
    const redacted = String(setCookie).replace(/=[^;]+/, "=<redacted>");
    throw new Error(`no session token in: ${redacted}`);
  }
  return match[1];
}

async function mintedBody(response: Response) {
  expect(response.status).toBe(200);
  return sessionResponseSchema.parse(await response.json());
}

// One PGlite (WASM Postgres boot + migration replay ~1s) per FILE, not per
// test: per-test isolation comes from truncating both tables instead —
// sessions follows users via the FK cascade. Cuts the suite from ~12s to
// roughly the cost of one boot.
beforeAll(async () => {
  ctx = await createTestDb();
});

beforeEach(async () => {
  await ctx.db.execute(sql`truncate table users cascade`);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

afterAll(async () => {
  await ctx.close();
});

describe("POST /session", () => {
  it("mints a user and a hashed session on first request, with the exact cookie attrs", async () => {
    const response = await POST(postRequest());
    const body = await mintedBody(response);
    expect(body.created).toBe(true);

    const userRows = await ctx.db.select().from(users);
    expect(userRows).toHaveLength(1);
    expect(userRows[0]?.id).toBe(body.userId);

    const token = cookieTokenOf(response);
    const sessionRows = await ctx.db
      .select()
      .from(sessions)
      .where(eq(sessions.tokenHash, await hashSessionToken(token)));
    expect(sessionRows).toHaveLength(1);
    expect(sessionRows[0]?.userId).toBe(body.userId);

    const setCookie = response.headers.get("set-cookie");
    expect(setCookie).toContain(`${SESSION_COOKIE_NAME}=`);
    expect(setCookie).toContain("Path=/");
    expect(setCookie).toContain("Max-Age=34560000");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Lax");
  });

  it("emits Domain and Secure per the D10 matrix through the real route", async () => {
    vi.stubEnv("COOKIE_DOMAIN", "miolos.app");
    const withDomain = (await POST(postRequest())).headers.get("set-cookie");
    expect(withDomain).toContain("Domain=miolos.app");
    expect(withDomain).toContain("Secure");

    vi.stubEnv("COOKIE_DOMAIN", undefined);
    vi.stubEnv("NODE_ENV", "test"); // explicit: the no-Secure branch needs non-production
    const local = (await POST(postRequest())).headers.get("set-cookie");
    expect(local).not.toContain("Domain=");
    expect(local).not.toContain("Secure");

    vi.stubEnv("NODE_ENV", "production");
    // Keep the guard-degradation warning out of test output: production
    // with WEB_ORIGIN set is the configured shape.
    vi.stubEnv("WEB_ORIGIN", "https://miolos.app");
    const preview = (await POST(postRequest())).headers.get("set-cookie");
    expect(preview).toContain("Secure");
    expect(preview).not.toContain("Domain=");
  });

  it("resolves the same user for the same cookie and re-emits the sliding cookie", async () => {
    const first = await POST(postRequest());
    const firstBody = await mintedBody(first);
    const token = cookieTokenOf(first);

    const second = await POST(
      postRequest({ headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` } }),
    );
    const secondBody = await mintedBody(second);
    expect(secondBody.created).toBe(false);
    expect(secondBody.userId).toBe(firstBody.userId);
    expect(cookieTokenOf(second)).toBe(token);

    const userRows = await ctx.db.select().from(users);
    expect(userRows).toHaveLength(1);
  });

  it("throttles the last_seen_at bump: untouched when fresh, bumped when >1h stale (D6)", async () => {
    const first = await POST(postRequest());
    const token = cookieTokenOf(first);
    const tokenHash = await hashSessionToken(token);
    const cookieHeader = { cookie: `${SESSION_COOKIE_NAME}=${token}` };

    const afterMint = await ctx.db
      .select()
      .from(sessions)
      .where(eq(sessions.tokenHash, tokenHash));
    const mintSeenAt = afterMint[0]?.lastSeenAt;
    expect(mintSeenAt).toBeInstanceOf(Date);

    await POST(postRequest({ headers: cookieHeader }));
    const afterFreshResolve = await ctx.db
      .select()
      .from(sessions)
      .where(eq(sessions.tokenHash, tokenHash));
    expect(afterFreshResolve[0]?.lastSeenAt).toEqual(mintSeenAt);

    // Backdate directly in the test db (harness code, not identity path).
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    await ctx.db
      .update(sessions)
      .set({ lastSeenAt: twoHoursAgo })
      .where(eq(sessions.tokenHash, tokenHash));

    await POST(postRequest({ headers: cookieHeader }));
    const afterStaleResolve = await ctx.db
      .select()
      .from(sessions)
      .where(eq(sessions.tokenHash, tokenHash));
    const bumped = afterStaleResolve[0]?.lastSeenAt;
    expect(bumped).toBeInstanceOf(Date);
    expect(bumped!.getTime()).toBeGreaterThan(twoHoursAgo.getTime());
  });

  it("mints fresh on an unknown token instead of failing", async () => {
    const response = await POST(
      postRequest({ headers: { cookie: `${SESSION_COOKIE_NAME}=forged` } }),
    );
    const body = await mintedBody(response);
    expect(body.created).toBe(true);
    expect(cookieTokenOf(response)).not.toBe("forged");
  });

  it("documents D11: concurrent cookieless requests each mint, and each cookie stays bound to its own user", async () => {
    const [first, second] = await Promise.all([
      POST(postRequest()),
      POST(postRequest()),
    ]);
    const firstBody = await mintedBody(first);
    const secondBody = await mintedBody(second);
    expect(firstBody.created).toBe(true);
    expect(secondBody.created).toBe(true);
    expect(firstBody.userId).not.toBe(secondBody.userId);

    const firstReplay = await mintedBody(
      await POST(
        postRequest({
          headers: { cookie: `${SESSION_COOKIE_NAME}=${cookieTokenOf(first)}` },
        }),
      ),
    );
    const secondReplay = await mintedBody(
      await POST(
        postRequest({
          headers: {
            cookie: `${SESSION_COOKIE_NAME}=${cookieTokenOf(second)}`,
          },
        }),
      ),
    );
    expect(firstReplay).toEqual({ userId: firstBody.userId, created: false });
    expect(secondReplay).toEqual({ userId: secondBody.userId, created: false });
  });

  it("accepts no time input: junk date-shaped body and forged date headers change nothing (AC 5)", async () => {
    const baseline = await mintedBody(await POST(postRequest()));

    const forged = await POST(
      postRequest({
        headers: {
          "content-type": "application/json",
          date: "Mon, 01 Jan 1990 00:00:00 GMT",
          "x-timestamp": "1990-01-01T00:00:00.000Z",
        },
        body: JSON.stringify({
          createdAt: "2020-01-01T00:00:00.000Z",
          lastSeenAt: "1999-12-31T23:59:59.000Z",
          userId: baseline.userId,
        }),
      }),
    );
    const forgedBody = await mintedBody(forged);
    expect(forgedBody.created).toBe(true);
    expect(forgedBody.userId).not.toBe(baseline.userId);

    // Timestamps are DB-generated: created_at = last_seen_at on mint, and
    // untouched by anything the request carried.
    const rows = await ctx.db
      .select()
      .from(sessions)
      .where(
        eq(sessions.tokenHash, await hashSessionToken(cookieTokenOf(forged))),
      );
    const row = rows[0];
    expect(row).toBeDefined();
    expect(row!.createdAt.getTime()).toBe(row!.lastSeenAt.getTime());
    expect(row!.createdAt.getFullYear()).toBeGreaterThan(2020);
  });

  // Named for what it proves: timestamps are DB-populated Dates that never
  // decrease. Strict monotonicity is unprovable on PGlite, whose now()
  // follows the host JS clock (see the PR's AC-5 honesty note).
  it("stores DB-populated, non-decreasing created_at across sequential mints (AC 5)", async () => {
    const first = await mintedBody(await POST(postRequest()));
    const second = await mintedBody(await POST(postRequest()));

    const firstRow = await ctx.db
      .select()
      .from(users)
      .where(eq(users.id, first.userId));
    const secondRow = await ctx.db
      .select()
      .from(users)
      .where(eq(users.id, second.userId));
    expect(firstRow[0]?.createdAt).toBeInstanceOf(Date);
    expect(secondRow[0]!.createdAt.getTime()).toBeGreaterThanOrEqual(
      firstRow[0]!.createdAt.getTime(),
    );
  });

  it("emits credentialed CORS headers when WEB_ORIGIN is set, none when unset", async () => {
    vi.stubEnv("WEB_ORIGIN", "https://miolos.app");
    const withCors = await POST(postRequest());
    expect(withCors.headers.get("access-control-allow-origin")).toBe(
      "https://miolos.app",
    );
    expect(withCors.headers.get("access-control-allow-credentials")).toBe(
      "true",
    );
    expect(withCors.headers.get("vary")).toBe("Origin");

    vi.stubEnv("WEB_ORIGIN", undefined);
    const withoutCors = await POST(postRequest());
    expect(withoutCors.headers.has("access-control-allow-origin")).toBe(false);
    expect(withoutCors.headers.has("access-control-allow-credentials")).toBe(
      false,
    );
  });

  it("rejects cross-site mint evidence with 403, no cookie and no rows (D13)", async () => {
    const crossSite = await POST(
      postRequest({ headers: { "sec-fetch-site": "cross-site" } }),
    );
    expect(crossSite.status).toBe(403);
    expect(crossSite.headers.get("set-cookie")).toBeNull();

    vi.stubEnv("WEB_ORIGIN", "https://miolos.app");
    const evilOrigin = await POST(
      postRequest({ headers: { origin: "https://evil.example" } }),
    );
    expect(evilOrigin.status).toBe(403);
    expect(evilOrigin.headers.get("set-cookie")).toBeNull();

    expect(await ctx.db.select().from(users)).toHaveLength(0);
    expect(await ctx.db.select().from(sessions)).toHaveLength(0);
  });

  it("mints normally for a matching Origin (the real browser bootstrap shape)", async () => {
    vi.stubEnv("WEB_ORIGIN", "https://miolos.app");
    const response = await POST(
      postRequest({
        headers: {
          origin: "https://miolos.app",
          "sec-fetch-site": "same-site",
        },
      }),
    );
    const body = await mintedBody(response);
    expect(body.created).toBe(true);
  });
});

describe("OPTIONS /session", () => {
  it("answers preflight with 204 and the credentialed CORS grant", () => {
    vi.stubEnv("WEB_ORIGIN", "https://miolos.app");
    const response = OPTIONS();
    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe(
      "https://miolos.app",
    );
    expect(response.headers.get("access-control-allow-credentials")).toBe(
      "true",
    );
    expect(response.headers.get("access-control-allow-methods")).toBe(
      "POST, OPTIONS",
    );
    expect(response.headers.get("access-control-allow-headers")).toBe(
      "Content-Type",
    );
    expect(response.headers.get("access-control-max-age")).toBe("86400");
  });
});
