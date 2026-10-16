import { fullDaysResponseSchema, medalsResponseSchema } from "@miolos/core";
import { sessions, sql, users } from "@miolos/db";
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

import { GET } from "../app/stats/full-days/route";
import { GET as medalsGet } from "../app/medals/route";
import { publishDaily } from "./lineup-helpers";
import { addDays } from "../src/publishing/dates";
import { SESSION_COOKIE_NAME } from "../src/session/cookie";
import { generateSessionToken, hashSessionToken } from "../src/session/token";

let ctx: Awaited<ReturnType<typeof createTestDb>>;

let dbOverride: Awaited<ReturnType<typeof createTestDb>>["db"] | undefined;

vi.mock("../src/db", () => ({
  getDb: () => dbOverride ?? ctx.db,
}));

beforeAll(async () => {
  ctx = await createTestDb();
}, 30_000);

beforeEach(async () => {
  await ctx.db.execute(sql`truncate table users, daily_puzzles cascade`);
});

afterEach(() => {
  dbOverride = undefined;
  vi.unstubAllEnvs();
});

afterAll(async () => {
  await ctx.close();
});

const WEB = "https://miolos.app";

const SIX = [
  "termo",
  "crossword",
  "sudoku",
  "nonogram",
  "binairo",
  "queens",
] as const;

type SixGame = (typeof SIX)[number];

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

function request(path: string, token?: string): NextRequest {
  const headers = new Headers();
  if (token !== undefined) {
    headers.set("cookie", `${SESSION_COOKIE_NAME}=${token}`);
  }
  return new NextRequest(`http://localhost:3001${path}`, {
    method: "GET",
    headers,
  });
}

async function win(
  userId: string,
  game: SixGame,
  date: string,
  onTime = true,
): Promise<void> {
  await ctx.db.insert(completions).values({
    userId,
    game,
    date,
    outcome: "won",
    completedAt: new Date(`${date}T15:00:00Z`),
    elapsedMs: 61_000,
    hintsUsed: 0,
    guesses: game === "termo" ? 3 : undefined,
    onTime,
  });
}

async function publishSix(date: string): Promise<void> {
  for (const game of SIX) {
    await publishDaily(ctx.db, game, date);
  }
}

describe("GET /stats/full-days (ADR-0129)", () => {
  it("T-API-S335: cookieless is 401, a thrown db is 500, and no-store plus the CORS grant ride every branch", async () => {
    vi.stubEnv("WEB_ORIGIN", WEB);

    const noCookie = await GET(request("/stats/full-days"));
    expect(noCookie.status).toBe(401);
    expect(await noCookie.json()).toEqual({ error: "no-session" });
    expect(noCookie.headers.get("cache-control")).toBe("no-store");
    expect(noCookie.headers.get("access-control-allow-origin")).toBe(WEB);

    dbOverride = new Proxy({} as NonNullable<typeof dbOverride>, {
      get() {
        throw new Error("connection lost");
      },
    });
    const thrown = await GET(
      request("/stats/full-days", generateSessionToken()),
    );
    expect(thrown.status).toBe(500);
    expect(await thrown.json()).toEqual({ error: "internal" });
    expect(thrown.headers.get("cache-control")).toBe("no-store");
    dbOverride = undefined;

    const { token } = await createSession();
    const ok = await GET(request("/stats/full-days", token));
    expect(ok.status).toBe(200);
    expect(ok.headers.get("cache-control")).toBe("no-store");
    expect(ok.headers.get("access-control-allow-origin")).toBe(WEB);
    expect(await ok.json()).toEqual({ dates: [] });
  });

  it("T-API-S336: three on-time wins make a full day, the whole lineup a perfect one that is listed too; two wins, late wins and other users' wins never count", async () => {
    const today = await todaySaoPaulo(ctx.db);
    const perfect = addDays(today, -3);
    const full = addDays(today, -2);
    const two = addDays(today, -1);
    const { token, userId } = await createSession();
    const other = await createSession();

    for (const date of [perfect, full, two, today]) {
      await publishSix(date);
    }
    for (const game of SIX) {
      await win(userId, game, perfect);
    }
    for (const game of ["sudoku", "binairo", "queens"] as const) {
      await win(userId, game, full);
    }
    await win(userId, "sudoku", two);
    await win(userId, "binairo", two);
    await win(userId, "queens", two, false);
    for (const game of ["sudoku", "binairo", "queens"] as const) {
      await win(other.userId, game, today);
    }

    const response = await GET(request("/stats/full-days", token));
    const raw: unknown = await response.json();
    expect(Object.keys(raw as Record<string, unknown>)).toEqual(["dates"]);
    expect(fullDaysResponseSchema.parse(raw).dates).toEqual([perfect, full]);

    const medals = medalsResponseSchema.parse(
      await (await medalsGet(request("/medals", token))).json(),
    ).medals;
    expect(medals).toContain("full-1");
    expect(medals).toContain("perfect-1");
  });

  it("T-API-S337: GET /medals returns full-1 for a single Dia Cheio and nothing of the kind for two wins", async () => {
    const today = await todaySaoPaulo(ctx.db);
    const { token, userId } = await createSession();
    await publishSix(today);
    await win(userId, "sudoku", today);
    await win(userId, "nonogram", today);

    const before = medalsResponseSchema.parse(
      await (await medalsGet(request("/medals", token))).json(),
    ).medals;
    expect(before).not.toContain("full-1");

    await win(userId, "crossword", today);
    const after = medalsResponseSchema.parse(
      await (await medalsGet(request("/medals", token))).json(),
    ).medals;
    expect(after).toContain("full-1");
    expect(after).not.toContain("perfect-1");
  });
});
