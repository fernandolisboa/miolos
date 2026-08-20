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

// Seam 4 for POST + DELETE /push/subscriptions (#145, ADR-0064; plan 061
// §3): the real handlers over PGlite — the onboarding-seen suite's write
// conventions (origin guard, 415, strict body, 401), plus the upsert and
// own-rows-only semantics the endpoint PK carries.
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

    // The happy path FIRST (the non-vacuity control): the row lands, owned
    // by the session's user, created_at from the DB clock.
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

    // Zod boundary: an unknown key (the browser's toJSON grows one) and a
    // non-URL endpoint are both 400s — parsed, never cast.
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

    // 415: the JSON content type is what forces the CORS preflight, so a
    // missing one is refused before the body is read.
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

    // 403 cross-site: the origin guard precedes everything else.
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

    // 401 without a session — and no row was written by any refusal.
    const noSession = await POST(
      subscriptionsRequest("POST", {
        headers: jsonHeaders(),
        body: subscribeBody(),
      }),
    );
    expect(noSession.status).toBe(401);
    expectGrant(noSession);
    expect(await ctx.db.select().from(pushSubscriptions)).toHaveLength(1);

    // The file exports exactly the write template's surface: both verbs,
    // the preflight, and force-dynamic.
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

    // Key rotation: same endpoint, new keys — one row, updated in place.
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

    // The endpoint follows whoever the cookie now says (the browser
    // install is the authority for its own capability URL): a second
    // account re-subscribing the SAME endpoint repoints the one row.
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

    // The stranger knows the capability URL — the delete removes NOTHING
    // and still answers the idempotent shape (no row-count oracle).
    const foreign = await DELETE(
      subscriptionsRequest("DELETE", {
        headers: jsonHeaders(stranger.token),
        body: JSON.stringify({ endpoint: ENDPOINT }),
      }),
    );
    expect(foreign.status).toBe(200);
    expect(await foreign.json()).toEqual({ removed: true });
    expect(await ctx.db.select().from(pushSubscriptions)).toHaveLength(1);

    // The owner's delete removes the row.
    const own = await DELETE(
      subscriptionsRequest("DELETE", {
        headers: jsonHeaders(owner.token),
        body: JSON.stringify({ endpoint: ENDPOINT }),
      }),
    );
    expect(own.status).toBe(200);
    expect(await own.json()).toEqual({ removed: true });
    expect(await ctx.db.select().from(pushSubscriptions)).toEqual([]);

    // Idempotent: the re-delete answers the same shape over zero rows.
    const again = await DELETE(
      subscriptionsRequest("DELETE", {
        headers: jsonHeaders(owner.token),
        body: JSON.stringify({ endpoint: ENDPOINT }),
      }),
    );
    expect(again.status).toBe(200);
    expect(await again.json()).toEqual({ removed: true });

    // The Zod boundary holds on this verb too: an extra key is a 400.
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

    // Positive control first (the T-API-S125 convention): a real push
    // endpoint passes, so every refusal below is non-vacuous.
    const legal = await POST(
      subscriptionsRequest("POST", {
        headers: jsonHeaders(token),
        body: subscribeBody(),
      }),
    );
    expect(legal.status).toBe(200);
    await ctx.db.execute(sql`truncate table push_subscriptions`);

    // The scheme floor: a browser push service is always https, and every
    // one of these is a destination #146's server-side send pass must never
    // be handed — the boundary is the only place that can refuse them
    // before they become stored rows.
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

    // The length caps — and the status fix that rides them: an over-long
    // endpoint used to raise inside the insert (the btree PK's ~2704-byte
    // tuple limit), surfacing as a caller-reachable 500 for what is
    // malformed input. The .max(2048) makes it the 400 it always was.
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

    // Nothing was stored by any refusal, and the DELETE contract mirrors
    // the scheme floor for symmetry.
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
    // Age the stamp deterministically, so "preserved" and "refreshed" are
    // a day apart rather than a race on the DB clock's millisecond.
    await ctx.db.execute(
      sql`update push_subscriptions set created_at = now() - interval '1 day'`,
    );
    const agedRows = await ctx.db.select().from(pushSubscriptions);
    const aged = agedRows[0]?.createdAt;
    expect(aged).toBeInstanceOf(Date);

    // Same user, rotated keys: the consent act is unchanged — the stamp
    // must not move (ADR-0064 decision 2's idiom).
    await POST(
      subscriptionsRequest("POST", {
        headers: jsonHeaders(first.token),
        body: subscribeBody(ENDPOINT, "p-new", "a-new"),
      }),
    );
    let rows = await ctx.db.select().from(pushSubscriptions);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.createdAt?.getTime()).toBe(aged?.getTime());

    // A different account repoints the row: the single record ADR-0064
    // nominates as the proof of consent must now attest to the NEW owner's
    // consent moment, not carry the old owner's.
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
