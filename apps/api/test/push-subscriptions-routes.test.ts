import { pushSubscriptions, sessions, sql, users } from "@miolos/db";
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

import { DELETE, POST } from "../app/push/subscriptions/route";
import { generateSessionToken, hashSessionToken } from "../src/session/token";
import { jsonHeaders, subscriptionsRequest } from "./push-helpers";

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
  vi.stubEnv("VAPID_PUBLIC_KEY", "BTestPublicKey");
  vi.stubEnv("VAPID_PRIVATE_KEY", "test-private-key");
  vi.stubEnv("VAPID_SUBJECT", "mailto:privacidade@miolos.app");
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

const ENDPOINT = "https://push.example.org/send/device-1";

function subscribeBody(endpoint = ENDPOINT, p256dh = "p1", auth = "a1") {
  return JSON.stringify({ endpoint, keys: { p256dh, auth } });
}

describe("POST /push/subscriptions — the Zod boundary and the write (#145, ADR-0064)", () => {
  it("T-API-S127: 400 on an unknown key and on a bad endpoint, 415 on a non-JSON type, 403 cross-site, 401 without a session — and the happy path writes the row with a DB-side created_at, answering the CORS grant on every branch", async () => {
    const { token, userId } = await createSession();
    const grant = "https://miolos.app";
    const expectGrant = (response: Response) => {
      expect(response.headers.get("access-control-allow-origin")).toBe(grant);
      expect(response.headers.get("access-control-allow-credentials")).toBe(
        "true",
      );
    };

    const posted = await POST(
      subscriptionsRequest("POST", {
        headers: jsonHeaders(token),
        body: subscribeBody(),
      }),
    );
    expect(posted.status).toBe(200);
    expect(await posted.json()).toEqual({ subscribed: true });
    expectGrant(posted);
    const rows = await ctx.db.select().from(pushSubscriptions);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.endpoint).toBe(ENDPOINT);
    expect(rows[0]?.userId).toBe(userId);
    expect(rows[0]?.p256dh).toBe("p1");
    expect(rows[0]?.auth).toBe("a1");
    expect(rows[0]?.createdAt).toBeInstanceOf(Date);

    const smuggled = await POST(
      subscriptionsRequest("POST", {
        headers: jsonHeaders(token),
        body: JSON.stringify({
          endpoint: ENDPOINT,
          keys: { p256dh: "p1", auth: "a1" },
          expirationTime: null,
        }),
      }),
    );
    expect(smuggled.status).toBe(400);
    expect(await smuggled.json()).toEqual({ error: "invalid-body" });
    expectGrant(smuggled);
    const badEndpoint = await POST(
      subscriptionsRequest("POST", {
        headers: jsonHeaders(token),
        body: subscribeBody("not-a-url"),
      }),
    );
    expect(badEndpoint.status).toBe(400);
    expectGrant(badEndpoint);

    const textHeaders = new Headers({ "content-type": "text/plain" });
    textHeaders.set("cookie", jsonHeaders(token).get("cookie") ?? "");
    const wrongType = await POST(
      subscriptionsRequest("POST", {
        headers: textHeaders,
        body: subscribeBody(),
      }),
    );
    expect(wrongType.status).toBe(415);
    expectGrant(wrongType);

    const crossHeaders = jsonHeaders(token);
    crossHeaders.set("sec-fetch-site", "cross-site");
    const crossSite = await POST(
      subscriptionsRequest("POST", {
        headers: crossHeaders,
        body: subscribeBody(),
      }),
    );
    expect(crossSite.status).toBe(403);
    expectGrant(crossSite);

    const noSession = await POST(
      subscriptionsRequest("POST", {
        headers: jsonHeaders(),
        body: subscribeBody(),
      }),
    );
    expect(noSession.status).toBe(401);
    expectGrant(noSession);
    expect(await ctx.db.select().from(pushSubscriptions)).toHaveLength(1);

    const routeModule = await import("../app/push/subscriptions/route");
    expect(Object.keys(routeModule).sort()).toEqual([
      "DELETE",
      "OPTIONS",
      "POST",
      "dynamic",
    ]);
  });

  it("T-API-S128: the upsert — a re-POST of the same endpoint keeps ONE row and updates the keys, and an endpoint follows the CURRENT session's user", async () => {
    const first = await createSession();
    await POST(
      subscriptionsRequest("POST", {
        headers: jsonHeaders(first.token),
        body: subscribeBody(ENDPOINT, "p-old", "a-old"),
      }),
    );

    await POST(
      subscriptionsRequest("POST", {
        headers: jsonHeaders(first.token),
        body: subscribeBody(ENDPOINT, "p-new", "a-new"),
      }),
    );
    let rows = await ctx.db.select().from(pushSubscriptions);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.p256dh).toBe("p-new");
    expect(rows[0]?.auth).toBe("a-new");
    expect(rows[0]?.userId).toBe(first.userId);

    const second = await createSession();
    const reposted = await POST(
      subscriptionsRequest("POST", {
        headers: jsonHeaders(second.token),
        body: subscribeBody(ENDPOINT, "p-new", "a-new"),
      }),
    );
    expect(reposted.status).toBe(200);
    rows = await ctx.db.select().from(pushSubscriptions);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.userId).toBe(second.userId);
  });
});

describe("DELETE /push/subscriptions — own rows only (#145, ADR-0064)", () => {
  it("T-API-S129: deletes the caller's own row, never another user's (cross-user isolation by endpoint knowledge alone), and re-deleting is an idempotent {removed:true}", async () => {
    const owner = await createSession();
    const stranger = await createSession();
    await POST(
      subscriptionsRequest("POST", {
        headers: jsonHeaders(owner.token),
        body: subscribeBody(),
      }),
    );

    const foreign = await DELETE(
      subscriptionsRequest("DELETE", {
        headers: jsonHeaders(stranger.token),
        body: JSON.stringify({ endpoint: ENDPOINT }),
      }),
    );
    expect(foreign.status).toBe(200);
    expect(await foreign.json()).toEqual({ removed: true });
    expect(await ctx.db.select().from(pushSubscriptions)).toHaveLength(1);

    const own = await DELETE(
      subscriptionsRequest("DELETE", {
        headers: jsonHeaders(owner.token),
        body: JSON.stringify({ endpoint: ENDPOINT }),
      }),
    );
    expect(own.status).toBe(200);
    expect(await own.json()).toEqual({ removed: true });
    expect(await ctx.db.select().from(pushSubscriptions)).toEqual([]);

    const again = await DELETE(
      subscriptionsRequest("DELETE", {
        headers: jsonHeaders(owner.token),
        body: JSON.stringify({ endpoint: ENDPOINT }),
      }),
    );
    expect(again.status).toBe(200);
    expect(await again.json()).toEqual({ removed: true });

    const smuggled = await DELETE(
      subscriptionsRequest("DELETE", {
        headers: jsonHeaders(owner.token),
        body: JSON.stringify({ endpoint: ENDPOINT, all: true }),
      }),
    );
    expect(smuggled.status).toBe(400);
  });
});

describe("the subscribe boundary refuses what the dispatcher must never receive (#145 step-6 security 1/2)", () => {
  it("T-API-S131: non-https schemes (metadata, loopback, file, javascript, data) and oversized endpoint/keys are 400s — never 500s, never rows: these rows are #146's SSRF target list", async () => {
    const { token } = await createSession();

    const legal = await POST(
      subscriptionsRequest("POST", {
        headers: jsonHeaders(token),
        body: subscribeBody(),
      }),
    );
    expect(legal.status).toBe(200);
    await ctx.db.execute(sql`truncate table push_subscriptions`);

    const hostile = [
      "http://169.254.169.254/latest/meta-data/",
      "http://localhost:5432/x",
      "file:///etc/passwd",
      "javascript:alert(1)",
      "data:text/plain,hi",
      "ftp://x.example/a",
    ];
    for (const endpoint of hostile) {
      const refused = await POST(
        subscriptionsRequest("POST", {
          headers: jsonHeaders(token),
          body: subscribeBody(endpoint),
        }),
      );
      expect(refused.status, endpoint).toBe(400);
      expect(await refused.json()).toEqual({ error: "invalid-body" });
    }

    const oversizedEndpoint = `https://push.example.org/${"a".repeat(2100)}`;
    const tooLong = await POST(
      subscriptionsRequest("POST", {
        headers: jsonHeaders(token),
        body: subscribeBody(oversizedEndpoint),
      }),
    );
    expect(tooLong.status).toBe(400);
    const giantKey = await POST(
      subscriptionsRequest("POST", {
        headers: jsonHeaders(token),
        body: subscribeBody(ENDPOINT, "p".repeat(129), "a1"),
      }),
    );
    expect(giantKey.status).toBe(400);
    const giantAuth = await POST(
      subscriptionsRequest("POST", {
        headers: jsonHeaders(token),
        body: subscribeBody(ENDPOINT, "p1", "a".repeat(129)),
      }),
    );
    expect(giantAuth.status).toBe(400);

    expect(await ctx.db.select().from(pushSubscriptions)).toEqual([]);
    const deleteRefused = await DELETE(
      subscriptionsRequest("DELETE", {
        headers: jsonHeaders(token),
        body: JSON.stringify({ endpoint: "http://169.254.169.254/x" }),
      }),
    );
    expect(deleteRefused.status).toBe(400);
  });
});

describe("created_at is the consent evidence and attests to the CURRENT owner (#145 step-6 security 3)", () => {
  it("T-API-S132: a same-user key rotation preserves the stamp; an owner-changing repoint refreshes it — the recorded moment always belongs to the account that consented", async () => {
    const first = await createSession();
    await POST(
      subscriptionsRequest("POST", {
        headers: jsonHeaders(first.token),
        body: subscribeBody(ENDPOINT, "p-old", "a-old"),
      }),
    );

    await ctx.db.execute(
      sql`update push_subscriptions set created_at = now() - interval '1 day'`,
    );
    const agedRows = await ctx.db.select().from(pushSubscriptions);
    const aged = agedRows[0]?.createdAt;
    expect(aged).toBeInstanceOf(Date);

    await POST(
      subscriptionsRequest("POST", {
        headers: jsonHeaders(first.token),
        body: subscribeBody(ENDPOINT, "p-new", "a-new"),
      }),
    );
    let rows = await ctx.db.select().from(pushSubscriptions);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.createdAt?.getTime()).toBe(aged?.getTime());

    const second = await createSession();
    await POST(
      subscriptionsRequest("POST", {
        headers: jsonHeaders(second.token),
        body: subscribeBody(ENDPOINT, "p-new", "a-new"),
      }),
    );
    rows = await ctx.db.select().from(pushSubscriptions);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.userId).toBe(second.userId);
    const refreshed = rows[0]?.createdAt;
    expect(refreshed).toBeInstanceOf(Date);
    expect((refreshed?.getTime() ?? 0) > (aged?.getTime() ?? 0)).toBe(true);
  });
});

describe("the per-user subscription ceiling (#146, ADR-0068 decision 1 — the #145 residual closed)", () => {
  it("T-API-S151: the 10th endpoint lands, the 11th answers 429 and stores nothing, a same-user re-subscribe at the cap upserts with its stamp preserved, and a cross-user repoint at the cap answers 429 with ownership unchanged", async () => {
    const { token } = await createSession();
    const endpoint = (n: number) => `https://push.example.org/send/cap-${n}`;
    const post = (body: string, sessionToken = token) =>
      POST(
        subscriptionsRequest("POST", {
          headers: jsonHeaders(sessionToken),
          body,
        }),
      );

    for (let n = 1; n <= 9; n += 1) {
      expect((await post(subscribeBody(endpoint(n)))).status).toBe(200);
    }
    expect((await post(subscribeBody(endpoint(10)))).status).toBe(200);

    const eleventh = await post(subscribeBody(endpoint(11)));
    expect(eleventh.status).toBe(429);
    const stored = await ctx.db
      .select({ endpoint: pushSubscriptions.endpoint })
      .from(pushSubscriptions);
    expect(stored).toHaveLength(10);
    expect(stored.map((row) => row.endpoint)).not.toContain(endpoint(11));

    const beforeRotation = await ctx.db
      .select()
      .from(pushSubscriptions)
      .where(sql`${pushSubscriptions.endpoint} = ${endpoint(3)}`);
    const rotation = await post(
      subscribeBody(endpoint(3), "rotated-p256dh", "rotated-auth"),
    );
    expect(rotation.status).toBe(200);
    const afterRotation = await ctx.db
      .select()
      .from(pushSubscriptions)
      .where(sql`${pushSubscriptions.endpoint} = ${endpoint(3)}`);
    expect(afterRotation[0]?.p256dh).toBe("rotated-p256dh");
    expect(afterRotation[0]?.createdAt.getTime()).toBe(
      beforeRotation[0]?.createdAt.getTime(),
    );
    expect(await ctx.db.select().from(pushSubscriptions)).toHaveLength(10);

    const other = await createSession();
    const otherEndpoint = "https://push.example.org/send/other-device";
    expect((await post(subscribeBody(otherEndpoint), other.token)).status).toBe(
      200,
    );
    const takeover = await post(subscribeBody(otherEndpoint));
    expect(takeover.status).toBe(429);
    const contested = await ctx.db
      .select({ userId: pushSubscriptions.userId })
      .from(pushSubscriptions)
      .where(sql`${pushSubscriptions.endpoint} = ${otherEndpoint}`);
    expect(contested[0]?.userId).toBe(other.userId);

    const repoint = await post(subscribeBody(endpoint(10)), other.token);
    expect(repoint.status).toBe(200);
    const repointed = await ctx.db
      .select({ userId: pushSubscriptions.userId })
      .from(pushSubscriptions)
      .where(sql`${pushSubscriptions.endpoint} = ${endpoint(10)}`);
    expect(repointed[0]?.userId).toBe(other.userId);

    expect((await post(subscribeBody(endpoint(12)))).status).toBe(200);
  });
});

describe("the promoted write preamble keeps the push route's order (#36)", () => {
  it("T-API-S203: a cross-site write is a 403 even with push unconfigured, and the 503 still comes before the JSON gate, the session and the body", async () => {
    vi.stubEnv("VAPID_PRIVATE_KEY", undefined);
    const crossHeaders = jsonHeaders();
    crossHeaders.set("sec-fetch-site", "cross-site");
    const crossSite = await POST(
      subscriptionsRequest("POST", { headers: crossHeaders, body: "{" }),
    );
    expect(crossSite.status).toBe(403);

    const unconfigured = await DELETE(
      subscriptionsRequest("DELETE", {
        headers: new Headers({ "content-type": "text/plain" }),
        body: "{",
      }),
    );
    expect(unconfigured.status).toBe(503);
    expect(await unconfigured.json()).toEqual({
      error: "push-not-configured",
    });
  });
});
