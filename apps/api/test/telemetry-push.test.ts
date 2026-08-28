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

let ctx: Awaited<ReturnType<typeof createTestDb>>;

vi.mock("../src/db", () => ({
  getDb: () => ctx.db,
}));

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
