import { sessions, sql, users } from "@miolos/db";
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

import { POST } from "../app/push/subscriptions/route";
import { generateSessionToken, hashSessionToken } from "../src/session/token";
import {
  POSTHOG_INGESTION_URL,
  telemetrySettled,
} from "../src/telemetry/capture";
import { jsonHeaders, subscriptionsRequest } from "./push-helpers";

/**
 * The notification_opt_in seam (#33, ADR-0069 decision 2): the event fires
 * on a GENUINE FIRST INSERT only — `stored: true` is not enough, because
 * the write is `INSERT … ON CONFLICT DO UPDATE` and the DO UPDATE arm also
 * returns a row (key rotation, identical re-subscribe, cross-user repoint,
 * #36's future settings toggle). Insert-vs-update is detected inside
 * `upsertSubscription` by a pre-read `exists` scoped to
 * `(endpoint, user_id)`: the plan's `(xmax = 0)` RETURNING form does not
 * type through the `Db` union (ADR-0069 decision 6). That makes the
 * detection CHECK-THEN-ACT, not atomic — two racing FIRST posts of one
 * endpoint can both read an empty `held` and double-report `inserted`,
 * accepted at telemetry grade only. The subscription CEILING is unaffected:
 * it stays folded into the INSERT (ADR-0068 decision 1), which is where
 * check-then-act was measured broken.
 *
 * Same observation seam as telemetry-completions.test.ts: stubbed global
 * fetch + stubbed POSTHOG_KEY, `telemetrySettled()` awaited (the direct
 * handler calls take `runAfterResponse`'s fallback arm).
 */
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

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  await ctx.db.execute(sql`truncate table users cascade`);
  vi.stubEnv("WEB_ORIGIN", "https://miolos.app");
  vi.stubEnv("VAPID_PUBLIC_KEY", "BTestPublicKey");
  vi.stubEnv("VAPID_PRIVATE_KEY", "test-private-key");
  vi.stubEnv("VAPID_SUBJECT", "mailto:privacidade@miolos.app");
  vi.stubEnv("POSTHOG_KEY", "phc_test_key");
  fetchMock = vi.fn(() => Promise.resolve(new Response("{}")));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
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

function subscribeBody(p256dh = "p1", auth = "a1"): string {
  return JSON.stringify({ endpoint: ENDPOINT, keys: { p256dh, auth } });
}

function capturedEvents(): { event: string; distinct_id: string }[] {
  return fetchMock.mock.calls.map((call) => {
    const [url, init] = call as unknown as [string, RequestInit];
    expect(url).toBe(POSTHOG_INGESTION_URL);
    return JSON.parse(init.body as string) as {
      event: string;
      distinct_id: string;
    };
  });
}

describe("POST /push/subscriptions — notification_opt_in (#33, ADR-0069)", () => {
  it("T-API-S171: a genuine first insert fires notification_opt_in once, keyed by the server userId, with an empty payload", async () => {
    const { token, userId } = await createSession();

    const response = await POST(
      subscriptionsRequest("POST", {
        headers: jsonHeaders(token),
        body: subscribeBody(),
      }),
    );
    expect(response.status).toBe(200);
    await telemetrySettled();

    const events = capturedEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      api_key: "phc_test_key",
      event: "notification_opt_in",
      distinct_id: userId,
      // Never the endpoint or the keys — the payload is empty by decision.
      properties: { $process_person_profile: false, $geoip_disable: true },
    });
  });

  it("T-API-S172: a re-post of an existing endpoint — the DO UPDATE arm, stored: true — is silent", async () => {
    const { token } = await createSession();

    const first = await POST(
      subscriptionsRequest("POST", {
        headers: jsonHeaders(token),
        body: subscribeBody(),
      }),
    );
    expect(first.status).toBe(200);
    await telemetrySettled();
    expect(capturedEvents()).toHaveLength(1);

    // Key rotation: same endpoint, new keys — the upsert takes the
    // DO UPDATE arm, answers `subscribed: true`, and fires NOTHING. This
    // exercises `inserted === false` on a successful store, not merely
    // the ceiling's 429 refusal.
    const rotated = await POST(
      subscriptionsRequest("POST", {
        headers: jsonHeaders(token),
        body: subscribeBody("p2", "a2"),
      }),
    );
    expect(rotated.status).toBe(200);
    expect(await rotated.json()).toEqual({ subscribed: true });
    await telemetrySettled();
    expect(capturedEvents()).toHaveLength(1);
  });
});
