import { pushSubscriptions, sessions, sql, users } from "@miolos/db";
import { createTestDb } from "@miolos/db/testing";
import {
  attachTokens,
  completions,
  hintGrants,
  medalGrants,
  mergeAccounts,
} from "@miolos/db/user";
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

import { POST as deletePost } from "../app/account/delete/route";
import { POST as sessionPost } from "../app/session/route";
import { SESSION_COOKIE_NAME } from "../src/session/cookie";
import { requireUserId } from "../src/session/service";
import { generateSessionToken, hashSessionToken } from "../src/session/token";

let ctx: Awaited<ReturnType<typeof createTestDb>>;

vi.mock("../src/db", () => ({
  getDb: () => ctx.db,
}));

beforeAll(async () => {
  ctx = await createTestDb();
}, 30_000);

beforeEach(async () => {
  await ctx.db.execute(sql`truncate table users, daily_puzzles cascade`);
  vi.stubEnv("WEB_ORIGIN", "https://miolos.app");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

afterAll(async () => {
  await ctx.close();
});

const OLDER = new Date("2026-01-01T12:00:00.000Z");
const NEWER = new Date("2026-06-01T12:00:00.000Z");

async function createSession(
  createdAt?: Date,
): Promise<{ token: string; userId: string }> {
  const inserted = await ctx.db
    .insert(users)
    .values(createdAt ? { createdAt, updatedAt: createdAt } : {})
    .returning();
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

function deleteRequest(token: string | undefined, body: unknown): NextRequest {
  const headers = new Headers({ "content-type": "application/json" });
  if (token !== undefined) {
    headers.set("cookie", `${SESSION_COOKIE_NAME}=${token}`);
  }
  return new NextRequest("http://localhost:3001/account/delete", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

async function mintViaSessionRoute(cookieToken?: string): Promise<string> {
  const headers = new Headers();
  if (cookieToken !== undefined) {
    headers.set("cookie", `${SESSION_COOKIE_NAME}=${cookieToken}`);
  }
  const response = await sessionPost(
    new NextRequest("http://localhost:3001/session", {
      method: "POST",
      headers,
    }),
  );
  expect(response.status).toBe(200);
  const body: unknown = await response.json();
  return (body as { userId: string }).userId;
}

describe("POST /account/delete — real self-service deletion (D13)", () => {
  const seenDayCount = async (): Promise<number> => {
    type CountRow = { readonly n: number };
    const result = (await ctx.db.execute(
      sql`select count(*)::int as n from user_seen_days`,
    )) as unknown as CountRow[] | { readonly rows?: CountRow[] };
    const rows: CountRow[] = Array.isArray(result)
      ? result
      : (result.rows ?? []);
    return rows[0]?.n ?? 0;
  };

  it("T-API-S77: the cascade removes the whole footprint, the cookie is cleared, and only the literal confirm passes", async () => {
    const { token, userId } = await createSession(OLDER);
    await ctx.db.insert(completions).values({
      userId,
      game: "binairo",
      date: "2026-08-01",
      outcome: "won",
      completedAt: new Date("2026-08-01T15:00:00Z"),
      elapsedMs: 61_000,
      hintsUsed: 0,
      onTime: true,
    });
    await ctx.db
      .insert(hintGrants)
      .values({ userId, date: "2026-08-01", source: "rewarded-ad", hints: 1 });
    await ctx.db.insert(attachTokens).values({
      tokenHash: "hash-pending",
      userId,
      email: "jogadora@example.com",
    });

    await ctx.db.insert(pushSubscriptions).values({
      endpoint: "https://push.example.test/endpoint-1",
      userId,
      p256dh: "p256dh-key",
      auth: "auth-secret",
    });
    await ctx.db.execute(
      sql`insert into user_seen_days (user_id, date) values (${userId}, '2026-08-01')`,
    );

    expect(await ctx.db.select().from(pushSubscriptions)).toHaveLength(1);
    expect(await seenDayCount()).toBe(1);

    for (const body of [{ confirm: false }, {}, { confirm: true, extra: 1 }]) {
      const refused = await deletePost(deleteRequest(token, body));
      expect(refused.status, JSON.stringify(body)).toBe(400);
    }
    expect(await ctx.db.select().from(users)).toHaveLength(1);

    const noSession = await deletePost(
      deleteRequest(undefined, { confirm: true }),
    );
    expect(noSession.status).toBe(401);

    const response = await deletePost(deleteRequest(token, { confirm: true }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ deleted: true });

    expect(await ctx.db.select().from(users)).toHaveLength(0);
    expect(await ctx.db.select().from(sessions)).toHaveLength(0);
    expect(await ctx.db.select().from(completions)).toHaveLength(0);
    expect(await ctx.db.select().from(hintGrants)).toHaveLength(0);
    expect(await ctx.db.select().from(attachTokens)).toHaveLength(0);

    expect(await ctx.db.select().from(pushSubscriptions)).toHaveLength(0);
    expect(await seenDayCount()).toBe(0);

    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(`${SESSION_COOKIE_NAME}=;`);
    expect(setCookie).toContain("Max-Age=0");
  });

  it("T-API-S77a: a seeded medal_grants row is gone after the cascade delete — #30's table joins S77's footprint claim", async () => {
    const { token, userId } = await createSession(OLDER);
    await ctx.db.insert(medalGrants).values({ userId, medalId: "founder" });
    expect(await ctx.db.select().from(medalGrants)).toHaveLength(1);

    const response = await deletePost(deleteRequest(token, { confirm: true }));
    expect(response.status).toBe(200);
    expect(await ctx.db.select().from(medalGrants)).toHaveLength(0);
    expect(await ctx.db.select().from(users)).toHaveLength(0);
  });

  it("T-API-S78: after deletion the bootstrap mints a FRESH identity, and a merge tombstone is structurally unreachable by this route", async () => {
    const a = await createSession(OLDER);
    await deletePost(deleteRequest(a.token, { confirm: true }));
    const freshId = await mintViaSessionRoute(a.token);
    expect(freshId).not.toBe(a.userId);
    expect(await ctx.db.select().from(users)).toHaveLength(1);

    await ctx.db.execute(sql`truncate table users cascade`);
    const winner = await createSession(OLDER);
    const loser = await createSession(NEWER);
    await mergeAccounts(ctx.db, winner.userId, loser.userId);
    expect(await requireUserId(ctx.db, loser.token)).toBe(winner.userId);

    const viaLoserCookie = await deletePost(
      deleteRequest(loser.token, { confirm: true }),
    );
    expect(viaLoserCookie.status).toBe(200);
    const remaining = await ctx.db.select().from(users);
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.id).toBe(loser.userId);
    expect(await ctx.db.select().from(sessions)).toHaveLength(0);
  });
});
