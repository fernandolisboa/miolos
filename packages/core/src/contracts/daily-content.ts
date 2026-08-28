import { z } from "zod";

import type { Game } from "../game";
import {
  binairoCellSchema,
  dailyBinairoResponseSchema,
  dailyNonogramResponseSchema,
  dailySudokuResponseSchema,
  dailyTermoResponseSchema,
  nonogramCluesSchema,
  nonogramSizeSchema,
  sudokuDigitSchema,
  sudokuGivenCellSchema,
  sudokuTierSchema,
  type DailyPuzzleResponse,
} from "./daily";

const binairoSolvedCellSchema = z.union([z.literal(0), z.literal(1)]);

export const binairoDailyContentSchema = z.strictObject({
  size: z.literal(8),
  seed: z.number().int().nonnegative(),
  weekday: z.number().int().min(1).max(7),
  givens: z.array(binairoCellSchema).length(64),
  solution: z.array(binairoSolvedCellSchema).length(64),
  givensCount: z.number().int(),
  requiredTier: z.union([z.literal(1), z.literal(2)]),
});

export type BinairoDailyContent = z.infer<typeof binairoDailyContentSchema>;

const sudokuSolvedCellSchema = sudokuDigitSchema;

export const sudokuDailyContentSchema = z.strictObject({
  givens: z.array(sudokuGivenCellSchema).length(81),
  solution: z.array(sudokuSolvedCellSchema).length(81),
  tier: sudokuTierSchema,
  clueCount: z.number().int(),
  seed: z.number().int().nonnegative(),
});

export type SudokuDailyContent = z.infer<typeof sudokuDailyContentSchema>;

const nonogramRevealSchema = z.strictObject({
  motifId: z.string(),
  name: z.string(),
  mirrored: z.boolean(),
  solution: z.array(z.array(z.boolean())),
});

export const nonogramDailyContentSchema = z
  .strictObject({
    game: z.literal("nonogram"),
    seed: z.number().int().nonnegative(),
    weekday: z.number().int().min(1).max(7),
    size: nonogramSizeSchema,
    clues: nonogramCluesSchema,
    reveal: nonogramRevealSchema,
  })
  .refine((c) => c.size === c.clues.size, {
    message: "size disagrees with clues.size",
  })
  .refine(
    (c) =>
      c.reveal.solution.length === c.size &&
      c.reveal.solution.every((row) => row.length === c.size),
    { message: "reveal.solution must be size x size" },
  );

export type NonogramDailyContent = z.infer<typeof nonogramDailyContentSchema>;

export const termoDailyContentSchema = z.strictObject({
  canonical: z.string().length(5),
  normalized: z.string().regex(/^[a-z]{5}$/),
});

export type TermoDailyContent = z.infer<typeof termoDailyContentSchema>;

export class DailyProjectionUnsupportedError extends Error {
  readonly game: Game;

  constructor(game: Game) {
    super(
      `no daily projection is implemented for game "${game}" yet — ` +
        "see the strip table in packages/core/src/contracts/daily-content.ts",
    );
    this.name = "DailyProjectionUnsupportedError";
    this.game = game;
  }
}

export function stripDailyContent(
  game: Game,
  date: string,
  content: unknown,
): DailyPuzzleResponse {
  switch (game) {
    case "binairo": {
      const parsed = binairoDailyContentSchema.parse(content);
      return dailyBinairoResponseSchema.parse({
        game: "binairo",
        date,
        size: parsed.size,
        givens: parsed.givens,
      });
    }
    case "sudoku": {
      const parsed = sudokuDailyContentSchema.parse(content);
      return dailySudokuResponseSchema.parse({
        game: "sudoku",
        date,
        givens: parsed.givens,
        tier: parsed.tier,
      });
    }
    case "nonogram": {
      const parsed = nonogramDailyContentSchema.parse(content);
      return dailyNonogramResponseSchema.parse({
        game: "nonogram",
        date,
        size: parsed.size,
        clues: parsed.clues,
      });
    }
    case "termo": {
      termoDailyContentSchema.parse(content);
      return dailyTermoResponseSchema.parse({ game: "termo", date });
    }
  }
}
