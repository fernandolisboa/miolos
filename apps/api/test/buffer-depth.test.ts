import {
  addDays,
  type BufferDepthResponse,
  bufferDepthResponseSchema,
  type Game,
  GAMES,
  isoWeekdayOf,
  recordFor,
  sudokuDailyContentSchema,
  termoDailyContentSchema,
} from "@miolos/core";
import { sql } from "@miolos/db";
import {
  insertDailyPuzzle,
  remoteConfig,
  todaySaoPaulo,
} from "@miolos/db/publishing";
import { createTestDb } from "@miolos/db/testing";
import { isWeekday, type Weekday } from "@miolos/games";
import { generateBinairo } from "@miolos/games/binairo";
import { generateCrossword } from "@miolos/games/crossword";
import { generateMinesweeperDaily } from "@miolos/games/minesweeper";
import { generateNonogram } from "@miolos/games/nonogram";
import { generateQueens } from "@miolos/games/queens";
import { TERMO_ANSWERS } from "@miolos/games/termo-answers";
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
import { seedTermoAnswers, spendTermoAnswers } from "./termo-answer-helpers";

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

const CONTENT: Record<
  Game,
  (seed: number, weekday: Weekday, offset: number) => unknown
> = {
  binairo: (seed, weekday) => generateBinairo({ seed, weekday }),
  sudoku: (seed) => sudokuContentPlaceholder(seed),
  nonogram: (seed, weekday) => generateNonogram(seed, weekday),
  termo: (_seed, _weekday, offset) =>
    termoDailyContentSchema.parse(TERMO_ANSWERS[offset % TERMO_ANSWERS.length]),
  crossword: (seed) => generateCrossword(seed),
  queens: (seed, weekday) => generateQueens({ seed, weekday }),
  minesweeper: (seed, weekday) => generateMinesweeperDaily({ seed, weekday }),
};

async function seedDays(game: Game, count: number): Promise<void> {
  const today = await todaySaoPaulo(ctx.db);
  for (let offset = 0; offset < count; offset += 1) {
    const date = addDays(today, offset);
    const weekday = isoWeekdayOf(date);
    if (!isWeekday(weekday)) {
      throw new Error(`unreachable: bad weekday for ${date}`);
    }
    const seed = offset + 1;
    const content = CONTENT[game](seed, weekday, offset);
    await insertDailyPuzzle(ctx.db, { game, date, seed, content });
  }
}

async function seedAllBut(count: number, drained?: Game): Promise<void> {
  for (const game of GAMES) {
    if (game !== drained) {
      await seedDays(game, count);
    }
  }
}

function depthsOf(
  depth: number,
  drained?: Game,
): BufferDepthResponse["depths"] {
  return recordFor(GAMES, (game) => (game === drained ? 0 : depth));
}

async function readBody(): Promise<BufferDepthResponse> {
  const response = await GET();
  expect(response.status).toBe(200);
  return bufferDepthResponseSchema.parse(await response.json());
}

describe("GET /buffer-depth", () => {
  // ADR-0055: CI gate 2232 ms (40 runs) × 4 → 10_000.
  it("T-API-S5: reports per-game depth, the effective threshold and shallow=false at 7", async () => {
    await seedAllBut(7);
    const response = await GET();
    expect(response.status).toBe(200);
    const body = bufferDepthResponseSchema.parse(await response.json());
    expect(body).toEqual({
      depths: depthsOf(7),
      threshold: 4,
      shallow: false,
      termoAnswersRemaining: TERMO_ANSWERS.length - 7,
      termoAnswersLow: false,
    });
  }, 10_000);

  it("T-API-S5: a drained SUDOKU buffer reports shallow=true even with binairo healthy", async () => {
    await seedAllBut(7, "sudoku");
    const response = await GET();
    expect(response.status).toBe(200);
    const body = bufferDepthResponseSchema.parse(await response.json());
    expect(body).toEqual({
      depths: depthsOf(7, "sudoku"),
      threshold: 4,
      shallow: true,
      termoAnswersRemaining: TERMO_ANSWERS.length - 7,
      termoAnswersLow: false,
    });
  });

  it("T-API-S22: a drained NONOGRAM buffer alone flips shallow=true", async () => {
    await seedAllBut(7, "nonogram");
    const response = await GET();
    expect(response.status).toBe(200);
    const body = bufferDepthResponseSchema.parse(await response.json());
    expect(body).toEqual({
      depths: depthsOf(7, "nonogram"),
      threshold: 4,
      shallow: true,
      termoAnswersRemaining: TERMO_ANSWERS.length - 7,
      termoAnswersLow: false,
    });
  });

  it("T-API-S34b: a drained TERMO buffer alone flips shallow=true", async () => {
    await seedAllBut(7, "termo");
    const response = await GET();
    expect(response.status).toBe(200);
    const body = bufferDepthResponseSchema.parse(await response.json());
    expect(body).toEqual({
      depths: depthsOf(7, "termo"),
      threshold: 4,
      shallow: true,
      termoAnswersRemaining: TERMO_ANSWERS.length,
      termoAnswersLow: false,
    });
  });

  it("T-API-S224: a drained CROSSWORD buffer alone flips shallow=true", async () => {
    await seedAllBut(7, "crossword");
    const response = await GET();
    expect(response.status).toBe(200);
    const body = bufferDepthResponseSchema.parse(await response.json());
    expect(body).toEqual({
      depths: depthsOf(7, "crossword"),
      threshold: 4,
      shallow: true,
      termoAnswersRemaining: TERMO_ANSWERS.length - 7,
      termoAnswersLow: false,
    });
  });

  it("T-API-S240: a drained QUEENS buffer alone flips shallow=true", async () => {
    await seedAllBut(7, "queens");
    expect(await readBody()).toEqual({
      depths: depthsOf(7, "queens"),
      threshold: 4,
      shallow: true,
      termoAnswersRemaining: TERMO_ANSWERS.length - 7,
      termoAnswersLow: false,
    });
  });

  it("T-API-S341: a drained CAMPO MINADO buffer alone flips shallow=true", async () => {
    await seedAllBut(7, "minesweeper");
    expect(await readBody()).toEqual({
      depths: depthsOf(7, "minesweeper"),
      threshold: 4,
      shallow: true,
      termoAnswersRemaining: TERMO_ANSWERS.length - 7,
      termoAnswersLow: false,
    });
  });

  it("shallow=true below the effective threshold — still HTTP 200 (the poller reads the flag)", async () => {
    await seedAllBut(3);
    const response = await GET();
    expect(response.status).toBe(200);
    const body = bufferDepthResponseSchema.parse(await response.json());
    expect(body).toEqual({
      depths: depthsOf(3),
      threshold: 4,
      shallow: true,
      termoAnswersRemaining: TERMO_ANSWERS.length - 3,
      termoAnswersLow: false,
    });
  });

  it("tuned bufferDepth=2 with depth 2 reports shallow=false (A3)", async () => {
    await ctx.db.insert(remoteConfig).values({ key: "bufferDepth", value: 2 });
    await seedAllBut(2);
    const response = await GET();
    const body = bufferDepthResponseSchema.parse(await response.json());
    expect(body).toEqual({
      depths: depthsOf(2),
      threshold: 2,
      shallow: false,
      termoAnswersRemaining: TERMO_ANSWERS.length - 2,
      termoAnswersLow: false,
    });
  });

  it("empty buffer reports depth 0 for every game and shallow=true", async () => {
    const response = await GET();
    const body = bufferDepthResponseSchema.parse(await response.json());
    expect(body).toEqual({
      depths: depthsOf(0),
      threshold: 4,
      shallow: true,
      termoAnswersRemaining: TERMO_ANSWERS.length,
      termoAnswersLow: false,
    });
  });

  it("T-API-S217: reports the eligible answer count, and flags it low AT 30 and not at 31", async () => {
    await spendTermoAnswers(
      ctx.db,
      TERMO_ANSWERS.slice(0, TERMO_ANSWERS.length - 31),
    );
    expect(await readBody()).toMatchObject({
      termoAnswersRemaining: 31,
      termoAnswersLow: false,
    });

    await ctx.db.execute(sql`truncate table daily_puzzles`);
    await spendTermoAnswers(
      ctx.db,
      TERMO_ANSWERS.slice(0, TERMO_ANSWERS.length - 30),
    );
    expect(await readBody()).toMatchObject({
      termoAnswersRemaining: 30,
      termoAnswersLow: true,
    });
  });

  it("T-API-S218: a killed buffered termo row leaves the buffer but its answer stays used inside the window", async () => {
    await seedDays("termo", 7);
    const today = await todaySaoPaulo(ctx.db);
    await ctx.db.execute(
      sql`update daily_puzzles set killed_at = now() where game = 'termo' and date = ${addDays(today, 3)}`,
    );
    expect(await readBody()).toMatchObject({
      depths: { termo: 6 },
      termoAnswersRemaining: TERMO_ANSWERS.length - 7,
    });
  });

  it("T-API-S219: a shallow buffer and a low answer list are reported independently", async () => {
    await seedAllBut(7, "termo");
    expect(await readBody()).toMatchObject({
      shallow: true,
      termoAnswersLow: false,
    });

    await seedDays("termo", 7);
    await spendTermoAnswers(
      ctx.db,
      TERMO_ANSWERS.slice(7, TERMO_ANSWERS.length - 23),
    );
    expect(await readBody()).toMatchObject({
      shallow: false,
      termoAnswersRemaining: 23,
      termoAnswersLow: true,
    });
  });

  it("T-API-S345: counts an answer drawn 364 days ago as used and one drawn 365 days ago as eligible", async () => {
    const today = await todaySaoPaulo(ctx.db);
    await seedTermoAnswers(
      ctx.db,
      TERMO_ANSWERS.slice(0, 2).map((answer, index) => ({
        date: addDays(today, -364 - index),
        answer,
      })),
    );
    expect(await readBody()).toMatchObject({
      termoAnswersRemaining: TERMO_ANSWERS.length - 1,
    });
  });
});
