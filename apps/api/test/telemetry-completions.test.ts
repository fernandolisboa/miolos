import { sessions, sql, users } from "@miolos/db";
import { insertDailyPuzzle, todaySaoPaulo } from "@miolos/db/publishing";
import { createTestDb } from "@miolos/db/testing";
import { completions } from "@miolos/db/user";
import { isWeekday } from "@miolos/games";
import { generateBinairo } from "@miolos/games/binairo";
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

import { POST } from "../app/completions/route";
import { addDays, isoWeekdayOf } from "../src/publishing/dates";
import { SESSION_COOKIE_NAME } from "../src/session/cookie";
import { generateSessionToken, hashSessionToken } from "../src/session/token";
import {
  POSTHOG_INGESTION_URL,
  telemetrySettled,
} from "../src/telemetry/capture";

let ctx: Awaited<ReturnType<typeof createTestDb>>;

const { streakReadOverride } = vi.hoisted(() => ({
  streakReadOverride: { throwing: false },
}));

vi.mock("../src/db", () => ({
  getDb: () => ctx.db,
}));

vi.mock("@miolos/db/user", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@miolos/db/user")>();
  return {
    ...actual,
    listCompletionsForStreak: (
      ...args: Parameters<typeof actual.listCompletionsForStreak>
    ) => {
      if (streakReadOverride.throwing) {
        throw new Error("derivation read boom (T-API-S164)");
      }
      return actual.listCompletionsForStreak(...args);
    },
  };
});

beforeAll(async () => {
  ctx = await createTestDb();
}, 30_000);

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  await ctx.db.execute(sql`truncate table users, daily_puzzles cascade`);
  vi.stubEnv("POSTHOG_KEY", "phc_test_key");
  fetchMock = vi.fn(() => Promise.resolve(new Response("{}")));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  streakReadOverride.throwing = false;
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
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

async function seedDaily(date: string, seed = 7): Promise<readonly number[]> {
  const weekday = isoWeekdayOf(date);
  if (!isWeekday(weekday)) {
    throw new Error(`unreachable: bad weekday for ${date}`);
  }
  const content = generateBinairo({ seed, weekday });
  await insertDailyPuzzle(ctx.db, { game: "binairo", date, seed, content });
  return content.solution;
}

async function insertCounted(init: {
  userId: string;
  game?: "binairo" | "sudoku" | "nonogram" | "termo";
  date: string;
}): Promise<void> {
  await ctx.db.insert(completions).values({
    userId: init.userId,
    game: init.game ?? "sudoku",
    date: init.date,
    outcome: "won",
    completedAt: new Date(`${init.date}T15:00:00Z`),
    elapsedMs: 61_000,
    hintsUsed: 0,
    onTime: true,
  });
}

async function seedSeenDay(userId: string, date: string): Promise<void> {
  await ctx.db.execute(
    sql`insert into user_seen_days (user_id, date)
        values (${userId}::uuid, ${date}::date)
        on conflict do nothing`,
  );
}

function completionRequest(token: string, body: string): NextRequest {
  return new NextRequest("http://localhost:3001/completions", {
    method: "POST",
    headers: new Headers({
      "content-type": "application/json",
      cookie: `${SESSION_COOKIE_NAME}=${token}`,
    }),
    body,
  });
}

function completionBody(date: string, grid: readonly number[]): string {
  return JSON.stringify({
    game: "binairo",
    date,
    grid: [...grid],
    elapsedMs: 61_000,
    hintsUsed: 0,
  });
}

function capturedEvents(): {
  event: string;
  distinct_id: string;
  properties: Record<string, unknown>;
}[] {
  return fetchMock.mock.calls.map((call) => {
    const [url, init] = call as unknown as [string, RequestInit];
    expect(url).toBe(POSTHOG_INGESTION_URL);
    return JSON.parse(init.body as string) as {
      event: string;
      distinct_id: string;
      properties: Record<string, unknown>;
    };
  });
}

describe("POST /completions — puzzle_completed (#33, ADR-0069 decision 2)", () => {
  it("T-API-S162: a recorded win fires puzzle_completed with the full payload, keyed by the server userId", async () => {
    const today = await todaySaoPaulo(ctx.db);
    const { token, userId } = await createSession();
    const solution = await seedDaily(today);

    const response = await POST(
      completionRequest(token, completionBody(today, solution)),
    );
    expect(response.status).toBe(200);
    await telemetrySettled();

    const events = capturedEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      api_key: "phc_test_key",
      event: "puzzle_completed",
      distinct_id: userId,
      properties: {
        game: "binairo",
        date: today,
        elapsed_ms: 61_000,
        outcome: "won",
        on_time: true,
        $process_person_profile: false,
        $geoip_disable: true,
      },
    });
  });

  it("T-API-S163: an idempotent replay (recorded: false) fires nothing — the write-once row is the dedup", async () => {
    const today = await todaySaoPaulo(ctx.db);
    const { token } = await createSession();
    const solution = await seedDaily(today);

    const first = await POST(
      completionRequest(token, completionBody(today, solution)),
    );
    expect(first.status).toBe(200);
    await telemetrySettled();
    expect(capturedEvents()).toHaveLength(1);

    const replay = await POST(
      completionRequest(token, completionBody(today, solution)),
    );
    expect(replay.status).toBe(200);
    expect(((await replay.json()) as { recorded: boolean }).recorded).toBe(
      false,
    );
    await telemetrySettled();

    expect(capturedEvents()).toHaveLength(1);
  });

  it("T-API-S164: a throwing post-response task never touches the response — the row lands, 200, recorded true, the error is logged", async () => {
    const today = await todaySaoPaulo(ctx.db);
    const { token, userId } = await createSession();
    await insertCounted({ userId, date: addDays(today, -5) });
    const solution = await seedDaily(today);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    streakReadOverride.throwing = true;

    const response = await POST(
      completionRequest(token, completionBody(today, solution)),
    );
    expect(response.status).toBe(200);
    expect(((await response.json()) as { recorded: boolean }).recorded).toBe(
      true,
    );
    await telemetrySettled();

    expect(capturedEvents().map((event) => event.event)).toEqual([
      "puzzle_completed",
    ]);
    expect(
      errorSpy.mock.calls.some((call) =>
        String(call[0]).includes("post-response task failed"),
      ),
    ).toBe(true);
  });
});

describe("POST /completions — streak_broken, derived on return (#33, ADR-0069 decision 3)", () => {
  it("T-API-S165: a counted insert after a gap fires once, with previous_streak, broken_after_date and gap_days", async () => {
    const today = await todaySaoPaulo(ctx.db);
    const { token, userId } = await createSession();

    await insertCounted({ userId, date: addDays(today, -6) });
    await insertCounted({ userId, date: addDays(today, -5) });
    const solution = await seedDaily(today);

    const response = await POST(
      completionRequest(token, completionBody(today, solution)),
    );
    expect(response.status).toBe(200);
    await telemetrySettled();

    const events = capturedEvents();
    expect(events.map((event) => event.event)).toEqual([
      "puzzle_completed",
      "streak_broken",
    ]);
    expect(events[1]?.distinct_id).toBe(userId);
    expect(events[1]?.properties).toEqual({
      previous_streak: 2,
      broken_after_date: addDays(today, -5),
      gap_days: 4,
      $process_person_profile: false,
      $geoip_disable: true,
    });
  });

  it("T-API-S166: an adjacent-day continuation is silent — yesterday counted means no break", async () => {
    const today = await todaySaoPaulo(ctx.db);
    const { token, userId } = await createSession();
    await insertCounted({ userId, date: addDays(today, -1) });
    const solution = await seedDaily(today);

    await POST(completionRequest(token, completionBody(today, solution)));
    await telemetrySettled();

    expect(capturedEvents().map((event) => event.event)).toEqual([
      "puzzle_completed",
    ]);
  });

  it("T-API-S167: the first-ever counted completion is silent — there was never a streak to break", async () => {
    const today = await todaySaoPaulo(ctx.db);
    const { token } = await createSession();
    const solution = await seedDaily(today);

    await POST(completionRequest(token, completionBody(today, solution)));
    await telemetrySettled();

    expect(capturedEvents().map((event) => event.event)).toEqual([
      "puzzle_completed",
    ]);
  });

  it("T-API-S168: a second counted game on an already-counted day is silent — the day broke the gap once", async () => {
    const today = await todaySaoPaulo(ctx.db);
    const { token, userId } = await createSession();
    await insertCounted({ userId, date: addDays(today, -5) });

    await insertCounted({ userId, game: "sudoku", date: today });
    const solution = await seedDaily(today);

    await POST(completionRequest(token, completionBody(today, solution)));
    await telemetrySettled();

    expect(capturedEvents().map((event) => event.event)).toEqual([
      "puzzle_completed",
    ]);
  });

  it("T-API-S169: a counted late flush landing AFTER today's counted insert is silent — the max-counted-date guard (the B1 repro)", async () => {
    const today = await todaySaoPaulo(ctx.db);
    const yesterday = addDays(today, -1);
    const { token, userId } = await createSession();
    await insertCounted({ userId, date: addDays(today, -5) });
    await seedSeenDay(userId, yesterday);
    const todaySolution = await seedDaily(today);
    const yesterdaySolution = await seedDaily(yesterday);

    const first = await POST(
      completionRequest(token, completionBody(today, todaySolution)),
    );
    expect(first.status).toBe(200);
    await telemetrySettled();
    expect(
      capturedEvents().filter((event) => event.event === "streak_broken"),
    ).toHaveLength(1);

    const flushed = await POST(
      completionRequest(token, completionBody(yesterday, yesterdaySolution)),
    );
    expect(flushed.status).toBe(200);
    await telemetrySettled();

    const events = capturedEvents();

    expect(events.map((event) => event.event)).toEqual([
      "puzzle_completed",
      "streak_broken",
      "puzzle_completed",
    ]);
    expect(events[2]?.properties["on_time"]).toBe(true);
    expect(events[2]?.properties["date"]).toBe(yesterday);
  });

  it("T-API-S170: a 1-day gap whose missed day was SEEN still fires — the accepted retro-close residual (ADR-0069)", async () => {
    const today = await todaySaoPaulo(ctx.db);
    const { token, userId } = await createSession();
    await insertCounted({ userId, date: addDays(today, -2) });
    await seedSeenDay(userId, addDays(today, -1));
    const solution = await seedDaily(today);

    await POST(completionRequest(token, completionBody(today, solution)));
    await telemetrySettled();

    const events = capturedEvents();
    expect(events.map((event) => event.event)).toEqual([
      "puzzle_completed",
      "streak_broken",
    ]);
    expect(events[1]?.properties).toEqual({
      previous_streak: 1,
      broken_after_date: addDays(today, -2),
      gap_days: 1,
      $process_person_profile: false,
      $geoip_disable: true,
    });
  });
});
