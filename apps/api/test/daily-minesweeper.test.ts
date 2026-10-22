import {
  addDays,
  dailyMinesweeperResponseSchema,
  isoWeekdayOf,
} from "@miolos/core";
import { collectKeys, FORBIDDEN_DAILY_KEYS } from "@miolos/core/testing";
import { sql } from "@miolos/db";
import { insertDailyPuzzle, todaySaoPaulo } from "@miolos/db/publishing";
import { createTestDb } from "@miolos/db/testing";
import { isWeekday } from "@miolos/games";
import { generateMinesweeperDaily } from "@miolos/games/minesweeper";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { GET } from "../app/daily/minesweeper/route";

let ctx: Awaited<ReturnType<typeof createTestDb>>;

vi.mock("../src/db", () => ({
  getDb: () => ctx.db,
}));

beforeAll(async () => {
  ctx = await createTestDb();
}, 30_000);

beforeEach(async () => {
  await ctx.db.execute(sql`truncate table daily_puzzles`);
});

afterAll(async () => {
  await ctx.close();
});

async function seedDate(date: string) {
  const weekday = isoWeekdayOf(date);
  if (!isWeekday(weekday)) {
    throw new Error(`unreachable: bad weekday for ${date}`);
  }
  const puzzle = generateMinesweeperDaily({ seed: 11, weekday });
  await insertDailyPuzzle(ctx.db, {
    game: "minesweeper",
    date,
    seed: puzzle.seed,
    content: puzzle,
  });
  return puzzle;
}

describe("GET /daily/minesweeper", () => {
  it("T-API-S338: 200 with today's field as the projection, strict-parsed, and no seed or weekday at any depth", async () => {
    const today = await todaySaoPaulo(ctx.db);
    const puzzle = await seedDate(today);

    const response = await GET();
    expect(response.status).toBe(200);
    const raw: unknown = await response.json();
    expect(raw).toEqual({
      game: "minesweeper",
      date: today,
      rows: puzzle.rows,
      columns: puzzle.columns,
      mines: puzzle.mines,
      start: puzzle.start,
    });
    expect(dailyMinesweeperResponseSchema.parse(raw)).toEqual(raw);

    const keys = collectKeys(raw);
    for (const forbidden of [...FORBIDDEN_DAILY_KEYS, "weekday"]) {
      expect(keys.has(forbidden), forbidden).toBe(false);
    }
  }, 30_000);

  it("T-API-S338: 404 when only future rows exist, and when today's row is killed", async () => {
    const today = await todaySaoPaulo(ctx.db);
    await seedDate(addDays(today, 1));

    const future = await GET();
    expect(future.status).toBe(404);
    expect(await future.json()).toEqual({});

    await seedDate(today);
    await ctx.db.execute(
      sql`update daily_puzzles set killed_at = now() where date = ${today}`,
    );
    expect((await GET()).status).toBe(404);
  }, 30_000);

  it("is force-dynamic (a cached daily would serve yesterday's today)", async () => {
    const route = await import("../app/daily/minesweeper/route");
    expect(route.dynamic).toBe("force-dynamic");
  });
});
