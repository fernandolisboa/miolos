import { notificationsStateResponseSchema } from "@miolos/core";
import { eq, sessions, sql, users } from "@miolos/db";
import { todaySaoPaulo } from "@miolos/db/publishing";
import { createTestDb } from "@miolos/db/testing";
import { completions } from "@miolos/db/user";
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

import { POST } from "../app/notifications/dismiss/route";
import { GET as stateGet } from "../app/notifications/state/route";
import { addDays } from "../src/publishing/dates";
import { SESSION_COOKIE_NAME } from "../src/session/cookie";
import { generateSessionToken, hashSessionToken } from "../src/session/token";
import { dismissRequest, jsonHeaders } from "./push-helpers";

// Seam 4 for POST /notifications/dismiss (#145, ADR-0064; plan 061 §3):
// the real handler over PGlite — the onboarding-seen suite's conventions.
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
  await ctx.db.execute(
    sql`truncate table users, daily_puzzles, remote_config cascade`,
  );
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

function stateRequest(token: string): NextRequest {
  const headers = new Headers();
  headers.set("cookie", `${SESSION_COOKIE_NAME}=${token}`);
  return new NextRequest("http://localhost:3001/notifications/state", {
    method: "GET",
    headers,
  });
}

describe("POST /notifications/dismiss — one permanent stamp (#145, ADR-0064)", () => {
  it("T-API-S130: stamps once with explicit updated_at; a re-post touches zero rows and never re-bumps; the state flips ineligible; 400/401/403/415 hold; and the stamp is NOT gated on the VAPID triple", async () => {
    // An eligible player (streak 3 on the compiled default), so the flip
    // below is the dismissal and nothing else.
    const { token, userId } = await createSession();
    const today = await todaySaoPaulo(ctx.db);
    for (const offset of [0, -1, -2]) {
      await ctx.db.insert(completions).values({
        userId,
        game: "binairo",
        date: addDays(today, offset),
        outcome: "won",
        completedAt: new Date(`${addDays(today, offset)}T15:00:00Z`),
        elapsedMs: 61_000,
        hintsUsed: 0,
      });
    }
    const before = await stateGet(stateRequest(token));
    expect(
      notificationsStateResponseSchema.parse(await before.json()).eligible,
    ).toBe(true);

    // The stamp — with explicit updated_at (schema.ts's writer list).
    const posted = await POST(
      dismissRequest({ headers: jsonHeaders(token), body: "{}" }),
    );
    expect(posted.status).toBe(200);
    expect(await posted.json()).toEqual({ dismissed: true });
    const stamped = await ctx.db
      .select({
        pushPromptDismissedAt: users.pushPromptDismissedAt,
        updatedAt: users.updatedAt,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, userId));
    const row = stamped[0];
    expect(row?.pushPromptDismissedAt).toBeInstanceOf(Date);
    expect(row?.updatedAt.getTime()).not.toBe(row?.createdAt.getTime());

    // The state flips ineligible, permanently — the attach-prompt
    // lifecycle, server-owned so it survives cleared site data and merge.
    const after = await stateGet(stateRequest(token));
    expect(
      notificationsStateResponseSchema.parse(await after.json()).eligible,
    ).toBe(false);

    // Idempotent: the re-post touches zero rows — neither stamp moves.
    const reposted = await POST(
      dismissRequest({ headers: jsonHeaders(token), body: "{}" }),
    );
    expect(reposted.status).toBe(200);
    const rowsAfterRepost = await ctx.db
      .select({
        pushPromptDismissedAt: users.pushPromptDismissedAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.id, userId));
    expect(rowsAfterRepost[0]?.pushPromptDismissedAt?.toISOString()).toBe(
      row?.pushPromptDismissedAt?.toISOString(),
    );
    expect(rowsAfterRepost[0]?.updatedAt.toISOString()).toBe(
      row?.updatedAt.toISOString(),
    );

    // The write-template refusals (the onboarding-seen shape).
    const smuggled = await POST(
      dismissRequest({
        headers: jsonHeaders(token),
        body: JSON.stringify({ anything: true }),
      }),
    );
    expect(smuggled.status).toBe(400);
    const noSession = await POST(
      dismissRequest({ headers: jsonHeaders(), body: "{}" }),
    );
    expect(noSession.status).toBe(401);
    const crossHeaders = jsonHeaders(token);
    crossHeaders.set("sec-fetch-site", "cross-site");
    const crossSite = await POST(
      dismissRequest({ headers: crossHeaders, body: "{}" }),
    );
    expect(crossSite.status).toBe(403);
    const textHeaders = new Headers({ "content-type": "text/plain" });
    textHeaders.set("cookie", jsonHeaders(token).get("cookie") ?? "");
    const wrongType = await POST(
      dismissRequest({ headers: textHeaders, body: "{}" }),
    );
    expect(wrongType.status).toBe(415);

    // Deliberately NOT gated on isPushConfigured(): a player declining a
    // prompt this environment rendered must be recorded even if a VAPID
    // var vanished between render and click — refusing would re-prompt
    // them forever, and the dismissal has no push side effect to fail
    // closed over (the route's own doc block).
    const fresh = await createSession();
    vi.stubEnv("VAPID_PUBLIC_KEY", undefined);
    const unconfigured = await POST(
      dismissRequest({ headers: jsonHeaders(fresh.token), body: "{}" }),
    );
    expect(unconfigured.status).toBe(200);
    const freshRow = await ctx.db
      .select({ pushPromptDismissedAt: users.pushPromptDismissedAt })
      .from(users)
      .where(eq(users.id, fresh.userId));
    expect(freshRow[0]?.pushPromptDismissedAt).toBeInstanceOf(Date);
  });
});
