import {
  type BufferDepthResponse,
  bufferDepthResponseSchema,
  sudokuDailyContentSchema,
  termoDailyContentSchema,
} from "@miolos/core";
import { sql } from "@miolos/db";
import {
  dailyPuzzles,
  insertDailyPuzzle,
  remoteConfig,
  todaySaoPaulo,
} from "@miolos/db/publishing";
import { createTestDb } from "@miolos/db/testing";
import { isWeekday } from "@miolos/games";
import { generateBinairo } from "@miolos/games/binairo";
import { generateNonogram } from "@miolos/games/nonogram";
import { TERMO_ANSWERS } from "@miolos/games/termo";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { GET } from "../app/buffer-depth/route";
import { addDays, isoWeekdayOf } from "../src/publishing/dates";

let ctx: Awaited<ReturnType<typeof createTestDb>>;

vi.mock("../src/db", () => ({
  getDb: () => ctx.db,
}));

beforeAll(async () => {
  ctx = await createTestDb();
}, 30_000);

beforeEach(async () => {
  await ctx.db.execute(sql`truncate table daily_puzzles`);
  await ctx.db.execute(sql`truncate table remote_config`);
});

afterAll(async () => {
  await ctx.close();
});

function sudokuContentPlaceholder(seed: number): unknown {
  return sudokuDailyContentSchema.parse({
    givens: Array.from({ length: 81 }, () => 0),
    solution: Array.from({ length: 81 }, (_, index) => (index % 9) + 1),
    tier: 1,
    clueCount: 0,
    seed,
  });
}

async function seedDays(
  game: "binairo" | "nonogram" | "sudoku" | "termo",
  count: number,
): Promise<void> {
  const today = await todaySaoPaulo(ctx.db);
  for (let offset = 0; offset < count; offset += 1) {
    const date = addDays(today, offset);
    const weekday = isoWeekdayOf(date);
    if (!isWeekday(weekday)) {
      throw new Error(`unreachable: bad weekday for ${date}`);
    }
    const seed = offset + 1;

    const content =
      game === "binairo"
        ? generateBinairo({ seed, weekday })
        : game === "nonogram"
          ? generateNonogram(seed, weekday)
          : game === "termo"
            ? termoDailyContentSchema.parse(TERMO_ANSWERS[offset % 400])
            : sudokuContentPlaceholder(seed);
    await insertDailyPuzzle(ctx.db, { game, date, seed, content });
  }
}

async function spendPastAnswers(from: number, count: number): Promise<void> {
  await ctx.db.insert(dailyPuzzles).values(
    TERMO_ANSWERS.slice(from, from + count).map((answer, index) => ({
      game: "termo" as const,
      date: addDays("2020-01-01", index),
      seed: index,
      content: termoDailyContentSchema.parse(answer),
      publishedAt: sql`now() - interval '1 year'`,
    })),
  );
}

async function readBody(): Promise<BufferDepthResponse> {
  const response = await GET();
  expect(response.status).toBe(200);
  return bufferDepthResponseSchema.parse(await response.json());
}

describe("GET /buffer-depth", () => {
  it("T-API-S5: reports per-game depth, the effective threshold and shallow=false at 7", async () => {
    await seedDays("termo", 7);
    await seedDays("binairo", 7);
    await seedDays("nonogram", 7);
    await seedDays("sudoku", 7);
    const response = await GET();
    expect(response.status).toBe(200);
    const body = bufferDepthResponseSchema.parse(await response.json());
    expect(body).toEqual({
      depths: { termo: 7, binairo: 7, nonogram: 7, sudoku: 7 },
      threshold: 4,
      shallow: false,
      termoAnswersRemaining: 393,
      termoAnswersLow: false,
    });
  });

  it("T-API-S5: a drained SUDOKU buffer reports shallow=true even with binairo healthy", async () => {
    await seedDays("termo", 7);
    await seedDays("binairo", 7);
    await seedDays("nonogram", 7);
    const response = await GET();
    expect(response.status).toBe(200);
    const body = bufferDepthResponseSchema.parse(await response.json());
    expect(body).toEqual({
      depths: { termo: 7, binairo: 7, nonogram: 7, sudoku: 0 },
      threshold: 4,
      shallow: true,
      termoAnswersRemaining: 393,
      termoAnswersLow: false,
    });
  });

  it("T-API-S22: a drained NONOGRAM buffer alone flips shallow=true", async () => {
    await seedDays("termo", 7);
    await seedDays("binairo", 7);
    await seedDays("sudoku", 7);
    const response = await GET();
    expect(response.status).toBe(200);
    const body = bufferDepthResponseSchema.parse(await response.json());
    expect(body).toEqual({
      depths: { termo: 7, binairo: 7, nonogram: 0, sudoku: 7 },
      threshold: 4,
      shallow: true,
      termoAnswersRemaining: 393,
      termoAnswersLow: false,
    });
  });

  it("T-API-S34b: a drained TERMO buffer alone flips shallow=true", async () => {
    await seedDays("binairo", 7);
    await seedDays("nonogram", 7);
    await seedDays("sudoku", 7);
    const response = await GET();
    expect(response.status).toBe(200);
    const body = bufferDepthResponseSchema.parse(await response.json());
    expect(body).toEqual({
      depths: { termo: 0, binairo: 7, nonogram: 7, sudoku: 7 },
      threshold: 4,
      shallow: true,
      termoAnswersRemaining: 400,
      termoAnswersLow: false,
    });
  });

  it("shallow=true below the effective threshold — still HTTP 200 (the poller reads the flag)", async () => {
    await seedDays("termo", 3);
    await seedDays("binairo", 3);
    await seedDays("nonogram", 3);
    await seedDays("sudoku", 3);
    const response = await GET();
    expect(response.status).toBe(200);
    const body = bufferDepthResponseSchema.parse(await response.json());
    expect(body).toEqual({
      depths: { termo: 3, binairo: 3, nonogram: 3, sudoku: 3 },
      threshold: 4,
      shallow: true,
      termoAnswersRemaining: 397,
      termoAnswersLow: false,
    });
  });

  it("tuned bufferDepth=2 with depth 2 reports shallow=false (A3)", async () => {
    await ctx.db.insert(remoteConfig).values({ key: "bufferDepth", value: 2 });
    await seedDays("termo", 2);
    await seedDays("binairo", 2);
    await seedDays("nonogram", 2);
    await seedDays("sudoku", 2);
    const response = await GET();
    const body = bufferDepthResponseSchema.parse(await response.json());
    expect(body).toEqual({
      depths: { termo: 2, binairo: 2, nonogram: 2, sudoku: 2 },
      threshold: 2,
      shallow: false,
      termoAnswersRemaining: 398,
      termoAnswersLow: false,
    });
  });

  it("empty buffer reports depth 0 for every game and shallow=true", async () => {
    const response = await GET();
    const body = bufferDepthResponseSchema.parse(await response.json());
    expect(body).toEqual({
      depths: { termo: 0, binairo: 0, nonogram: 0, sudoku: 0 },
      threshold: 4,
      shallow: true,
      termoAnswersRemaining: 400,
      termoAnswersLow: false,
    });
  });

  it("T-API-S217: reports the unused answer count, and flags it low AT 30 and not at 31", async () => {
    await spendPastAnswers(7, 369);
    expect(await readBody()).toMatchObject({
      termoAnswersRemaining: 31,
      termoAnswersLow: false,
    });

    await ctx.db.execute(sql`truncate table daily_puzzles`);
    await spendPastAnswers(7, 370);
    expect(await readBody()).toMatchObject({
      termoAnswersRemaining: 30,
      termoAnswersLow: true,
    });
  });

  it("T-API-S218: a killed buffered termo row leaves the buffer but its answer stays spent", async () => {
    await seedDays("termo", 7);
    const today = await todaySaoPaulo(ctx.db);
    await ctx.db.execute(
      sql`update daily_puzzles set killed_at = now() where game = 'termo' and date = ${addDays(today, 3)}`,
    );
    expect(await readBody()).toMatchObject({
      depths: { termo: 6 },
      termoAnswersRemaining: 393,
    });
  });

  it("T-API-S219: a shallow buffer and a low answer list are reported independently", async () => {
    await seedDays("binairo", 7);
    await seedDays("nonogram", 7);
    await seedDays("sudoku", 7);
    expect(await readBody()).toMatchObject({
      shallow: true,
      termoAnswersLow: false,
    });

    await seedDays("termo", 7);
    await spendPastAnswers(7, 370);
    expect(await readBody()).toMatchObject({
      shallow: false,
      termoAnswersRemaining: 23,
      termoAnswersLow: true,
    });
  });
});
