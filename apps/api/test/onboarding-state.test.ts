import { randomUUID } from "node:crypto";

import { onboardingStateResponseSchema } from "@miolos/core";
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

import { POST as seenPost } from "../app/onboarding/seen/route";
import { GET } from "../app/onboarding/state/route";
import { getOnboardingState } from "../src/onboarding/service";
import { SESSION_COOKIE_NAME } from "../src/session/cookie";
import { generateSessionToken, hashSessionToken } from "../src/session/token";

// Seam 4 for GET /onboarding/state (#35, ADR-0061, plan 057 D5): the real
// handler over PGlite. The attach-state suite's conventions throughout.
let ctx: Awaited<ReturnType<typeof createTestDb>>;

vi.mock("../src/db", () => ({
  getDb: () => ctx.db,
}));

// Hook budget 30_000 ms, over vitest's bare 10_000 ms hook default. The
// measured figures behind it — isolated, capped, uncapped and CI — why it is
// not re-derived, and the re-derivation tripwire live once, beside
// `createTestDb` in `@miolos/db/testing` (ADR-0055 decision 1 as amended by
// #114; ADR-0057). Do not restate them here — 26 copies rot 26 ways.
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

function stateRequest(token?: string): NextRequest {
  const headers = new Headers();
  if (token !== undefined) {
    headers.set("cookie", `${SESSION_COOKIE_NAME}=${token}`);
  }
  return new NextRequest("http://localhost:3001/onboarding/state", {
    method: "GET",
    headers,
  });
}

async function readShow(token: string): Promise<boolean> {
  const response = await GET(stateRequest(token));
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  return onboardingStateResponseSchema.parse(await response.json()).show;
}

describe("GET /onboarding/state — server-owned once-only (#35, ADR-0061)", () => {
  it("T-API-S117: no session is 401 no-session AND no users row is created — the route never mints", async () => {
    const response = await GET(stateRequest());
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "no-session" });
    expect(response.headers.get("cache-control")).toBe("no-store");

    // The route never mints (requireUserId's contract): a first visit's
    // identity comes from the layout's own POST /session, which the web
    // hook awaits BEFORE calling here (plan 057 D10).
    expect(await ctx.db.select({ id: users.id }).from(users)).toEqual([]);

    // No OPTIONS export: the authenticated-READ template (the attach-state
    // route's own pin) — a credentialed GET with no custom header never
    // preflights.
    const routeModule = await import("../app/onboarding/state/route");
    expect(Object.keys(routeModule).sort()).toEqual(["GET", "dynamic"]);
  });

  it("T-API-S118: NULL onboarding_seen_at answers show true; a stamped row answers show false, forever", async () => {
    const { token, userId } = await createSession();
    expect(await readShow(token)).toBe(true);

    await ctx.db
      .update(users)
      .set({ onboardingSeenAt: sql`now()` })
      .where(eq(users.id, userId));
    expect(await readShow(token)).toBe(false);
  });

  it("T-API-S119: an unknown user id resolves show false at the service seam, and a deleted account's request fails closed as a 401 — never a 500", async () => {
    // The service seam: an id with no row resolves undefined, and the
    // route's derivation (`account !== undefined && … === null`) turns
    // that into show:false — an identity we cannot read is never nagged.
    expect(await getOnboardingState(ctx.db, randomUUID())).toBeUndefined();

    // Through the route, "deleted user" is unreachable as a 200: the
    // sessions FK cascades, so deleting the account retires the cookie and
    // requireUserId answers 401. Asserted so the fail-closed path is a
    // pinned status, not a guessed one — and never a 500.
    const { token, userId } = await createSession();
    await ctx.db.delete(users).where(eq(users.id, userId));
    const response = await GET(stateRequest(token));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "no-session" });
  });

  it("T-API-S122: every branch of BOTH routes carries the CORS grant, and every GET branch carries no-store", async () => {
    const grant = "https://miolos.app";
    const expectGrant = (response: Response) => {
      expect(response.headers.get("access-control-allow-origin")).toBe(grant);
      expect(response.headers.get("access-control-allow-credentials")).toBe(
        "true",
      );
    };

    // GET: the 200 and the 401.
    const { token, userId } = await createSession();
    const ok = await GET(stateRequest(token));
    expect(ok.status).toBe(200);
    expect(ok.headers.get("cache-control")).toBe("no-store");
    expectGrant(ok);
    const unauthenticated = await GET(stateRequest());
    expect(unauthenticated.status).toBe(401);
    expect(unauthenticated.headers.get("cache-control")).toBe("no-store");
    expectGrant(unauthenticated);

    // POST: 200, 401, 403, 415 and 400 — every branch grants, so a browser
    // can always READ the status instead of reporting an opaque CORS error.
    const jsonHeaders = (sessionToken?: string): Headers => {
      const headers = new Headers({ "content-type": "application/json" });
      if (sessionToken !== undefined) {
        headers.set("cookie", `${SESSION_COOKIE_NAME}=${sessionToken}`);
      }
      return headers;
    };
    const post = (init: { headers: Headers; body: string }) =>
      seenPost(
        new NextRequest("http://localhost:3001/onboarding/seen", {
          method: "POST",
          ...init,
        }),
      );

    const posted = await post({ headers: jsonHeaders(token), body: "{}" });
    expect(posted.status).toBe(200);
    expectGrant(posted);

    const noSession = await post({ headers: jsonHeaders(), body: "{}" });
    expect(noSession.status).toBe(401);
    expectGrant(noSession);

    const crossHeaders = jsonHeaders(token);
    crossHeaders.set("sec-fetch-site", "cross-site");
    const crossSite = await post({ headers: crossHeaders, body: "{}" });
    expect(crossSite.status).toBe(403);
    expectGrant(crossSite);

    const textHeaders = new Headers({ "content-type": "text/plain" });
    textHeaders.set("cookie", `${SESSION_COOKIE_NAME}=${token}`);
    const wrongType = await post({ headers: textHeaders, body: "{}" });
    expect(wrongType.status).toBe(415);
    expectGrant(wrongType);

    const smuggled = await post({
      headers: jsonHeaders(token),
      body: JSON.stringify({ anything: true }),
    });
    expect(smuggled.status).toBe(400);
    expectGrant(smuggled);

    // The stamped user still answers the GET with the grant (the show:false
    // branch — the last branch the sweep has not crossed).
    const stamped = await ctx.db
      .select({ onboardingSeenAt: users.onboardingSeenAt })
      .from(users)
      .where(eq(users.id, userId));
    expect(stamped[0]?.onboardingSeenAt).toBeInstanceOf(Date);
    const shown = await GET(stateRequest(token));
    expect(shown.status).toBe(200);
    expect(onboardingStateResponseSchema.parse(await shown.json()).show).toBe(
      false,
    );
    expectGrant(shown);
  });
});
