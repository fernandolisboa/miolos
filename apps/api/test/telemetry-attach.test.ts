import { eq, sessions, sql, users } from "@miolos/db";
import { createTestDb } from "@miolos/db/testing";
import { attachTokens } from "@miolos/db/user";
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

import { POST as confirmPost } from "../app/attach/confirm/route";
import { generateSessionToken, hashSessionToken } from "../src/session/token";
import {
  POSTHOG_INGESTION_URL,
  telemetrySettled,
} from "../src/telemetry/capture";

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

const EMAIL = "recovery@example.org";

async function createUser(init?: {
  email?: string;
  verified?: boolean;
  createdAt?: Date;
}): Promise<string> {
  const inserted = await ctx.db
    .insert(users)
    .values({
      ...(init?.email !== undefined
        ? {
            email: init.email,
            emailVerifiedAt: init.verified ? new Date() : null,
          }
        : {}),
      ...(init?.createdAt
        ? { createdAt: init.createdAt, updatedAt: init.createdAt }
        : {}),
    })
    .returning();
  const user = inserted[0];
  if (!user) {
    throw new Error("users insert returned no row");
  }
  const token = generateSessionToken();
  await ctx.db
    .insert(sessions)
    .values({ tokenHash: await hashSessionToken(token), userId: user.id });
  return user.id;
}

async function seedToken(userId: string, email = EMAIL): Promise<string> {
  const raw = generateSessionToken();
  await ctx.db.insert(attachTokens).values({
    tokenHash: await hashSessionToken(raw),
    userId,
    email,
    reminderConsent: false,
  });
  return raw;
}

async function postConfirm(rawToken: string): Promise<Response> {
  return confirmPost(
    new NextRequest("http://localhost:3001/attach/confirm", {
      method: "POST",
      headers: new Headers({ "content-type": "application/json" }),
      body: JSON.stringify({ token: rawToken }),
    }),
  );
}

function capturedBodies(): string[] {
  return fetchMock.mock.calls.map((call) => {
    const [url, init] = call as unknown as [string, RequestInit];
    expect(url).toBe(POSTHOG_INGESTION_URL);
    return init.body as string;
  });
}

describe("POST /attach/confirm — login_linked (#33, ADR-0069)", () => {
  it("T-API-S173: a plain attach fires login_linked {merged: false}, keyed by the resolver's winnerId", async () => {
    const requesterId = await createUser();
    const raw = await seedToken(requesterId);

    const response = await postConfirm(raw);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ merged: false });
    await telemetrySettled();

    const bodies = capturedBodies();
    expect(bodies).toHaveLength(1);
    expect(JSON.parse(bodies[0] ?? "")).toEqual({
      api_key: "phc_test_key",
      event: "login_linked",

      distinct_id: requesterId,
      properties: {
        merged: false,
        $process_person_profile: false,
        $geoip_disable: true,
      },
    });
  });

  it("T-API-S174: a recovery merge fires login_linked {merged: true} keyed by the WINNER — and the posted body carries no email", async () => {
    const holderId = await createUser({
      email: EMAIL,
      verified: true,
      createdAt: new Date("2026-01-01T12:00:00Z"),
    });
    const requesterId = await createUser();
    const raw = await seedToken(requesterId);

    const response = await postConfirm(raw);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ merged: true });
    await telemetrySettled();

    const winnerRows = await ctx.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, EMAIL));
    const winnerId = winnerRows[0]?.id;
    expect(winnerId).toBeDefined();
    expect([holderId, requesterId]).toContain(winnerId);

    const bodies = capturedBodies();
    expect(bodies).toHaveLength(1);
    expect(JSON.parse(bodies[0] ?? "")).toEqual({
      api_key: "phc_test_key",
      event: "login_linked",
      distinct_id: winnerId,
      properties: {
        merged: true,
        $process_person_profile: false,
        $geoip_disable: true,
      },
    });

    expect(bodies[0]).not.toContain(EMAIL);
    expect(bodies[0]).not.toContain("example.org");
  });
});
