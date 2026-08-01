import {
  bufferDepthResponseSchema,
  sudokuDailyContentSchema,
} from "@miolos/core";
import { sql } from "@miolos/db";
import {
  insertDailyPuzzle,
  remoteConfig,
  todaySaoPaulo,
} from "@miolos/db/publishing";
import { createTestDb } from "@miolos/db/testing";
import { isWeekday } from "@miolos/games";
import { generateBinairo } from "@miolos/games/binairo";
import { generateNonogram } from "@miolos/games/nonogram";
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

/**
 * GET /buffer-depth counts ROWS and never reads content, so seeding sudoku
 * through the real generator would spend a tier-5 Sunday board per seeded
 * week to prove nothing. The placeholder is still run through
 * `sudokuDailyContentSchema` rather than merely asserted to fit it, so this
 * file can never seed a shape the wall would refuse to read.
 */
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
  game: "binairo" | "nonogram" | "sudoku",
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
    // Nonogram is generated for real rather than placeheld: unlike sudoku it
    // costs 0.0354-0.1902 ms per board, so the placeholder would buy nothing.
    const content =
      game === "binairo"
        ? generateBinairo({ seed, weekday })
        : game === "nonogram"
          ? generateNonogram(seed, weekday)
          : sudokuContentPlaceholder(seed);
    await insertDailyPuzzle(ctx.db, { game, date, seed, content });
  }
}

describe("GET /buffer-depth", () => {
  it("T-API-S5: reports per-game depth, the effective threshold and shallow=false at 7", async () => {
    await seedDays("binairo", 7);
    await seedDays("nonogram", 7);
    await seedDays("sudoku", 7);
    const response = await GET();
    expect(response.status).toBe(200);
    const body = bufferDepthResponseSchema.parse(await response.json());
    expect(body).toEqual({
      depths: { binairo: 7, nonogram: 7, sudoku: 7 },
      threshold: 4,
      shallow: false,
    });
  });

  it("T-API-S5: a drained SUDOKU buffer reports shallow=true even with binairo healthy", async () => {
    // The named failure mode plan 018 S16 exists to prevent: deriving
    // `shallow` from binairo alone would REPORT the drained buffer in
    // `depths` and never PAGE on it — buffer-alert.yml reads `jq -r .shallow`
    // and nothing else.
    await seedDays("binairo", 7);
    await seedDays("nonogram", 7);
    const response = await GET();
    expect(response.status).toBe(200);
    const body = bufferDepthResponseSchema.parse(await response.json());
    expect(body).toEqual({
      depths: { binairo: 7, nonogram: 7, sudoku: 0 },
      threshold: 4,
      shallow: true,
    });
  });

  it("T-API-S22: a drained NONOGRAM buffer alone flips shallow=true", async () => {
    // S16's failure mode instantiated for the key #25 just added: a third
    // game that is reported but never paged on is the quietest way to lose a
    // buffer, and `depths` is the half a reviewer checks by eye.
    await seedDays("binairo", 7);
    await seedDays("sudoku", 7);
    const response = await GET();
    expect(response.status).toBe(200);
    const body = bufferDepthResponseSchema.parse(await response.json());
    expect(body).toEqual({
      depths: { binairo: 7, nonogram: 0, sudoku: 7 },
      threshold: 4,
      shallow: true,
    });
  });

  it("shallow=true below the effective threshold — still HTTP 200 (the poller reads the flag)", async () => {
    await seedDays("binairo", 3);
    await seedDays("nonogram", 3);
    await seedDays("sudoku", 3);
    const response = await GET();
    expect(response.status).toBe(200);
    const body = bufferDepthResponseSchema.parse(await response.json());
    expect(body).toEqual({
      depths: { binairo: 3, nonogram: 3, sudoku: 3 },
      threshold: 4,
      shallow: true,
    });
  });

  it("tuned bufferDepth=2 with depth 2 reports shallow=false (A3)", async () => {
    await ctx.db.insert(remoteConfig).values({ key: "bufferDepth", value: 2 });
    await seedDays("binairo", 2);
    await seedDays("nonogram", 2);
    await seedDays("sudoku", 2);
    const response = await GET();
    const body = bufferDepthResponseSchema.parse(await response.json());
    expect(body).toEqual({
      depths: { binairo: 2, nonogram: 2, sudoku: 2 },
      threshold: 2,
      shallow: false,
    });
  });

  it("empty buffer reports depth 0 for every game and shallow=true", async () => {
    const response = await GET();
    const body = bufferDepthResponseSchema.parse(await response.json());
    expect(body).toEqual({
      depths: { binairo: 0, nonogram: 0, sudoku: 0 },
      threshold: 4,
      shallow: true,
    });
  });
});
