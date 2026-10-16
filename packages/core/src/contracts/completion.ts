import { z } from "zod";

import { completionOutcomeSchema, hintsUsedSchema } from "../completion";
import { gameSchema } from "../game";
import {
  calendarDateString,
  CROSSWORD_SIZES,
  crosswordLetterSchema,
  isoDateString,
  minesweeperCellIndexSchema,
  nonogramSizeSchema,
  queensSizeSchema,
  sudokuDigitSchema,
} from "./daily";

import { TERMO_MAX_GUESSES, termoGuessWordSchema } from "./termo-guess";

const submittedCellSchema = z.union([z.literal(0), z.literal(1)]);

const elapsedMsSchema = z.number().int().min(0).max(86_400_000);

export const binairoCompletionRequestSchema = z.strictObject({
  game: z.literal("binairo"),
  date: calendarDateString,
  grid: z.array(submittedCellSchema).length(64),
  elapsedMs: elapsedMsSchema,
  hintsUsed: hintsUsedSchema,
});

export type BinairoCompletionRequest = z.infer<
  typeof binairoCompletionRequestSchema
>;

export const sudokuCompletionRequestSchema = z.strictObject({
  game: z.literal("sudoku"),
  date: calendarDateString,
  grid: z.array(sudokuDigitSchema).length(81),
  elapsedMs: elapsedMsSchema,
  hintsUsed: hintsUsedSchema,
});

export type SudokuCompletionRequest = z.infer<
  typeof sudokuCompletionRequestSchema
>;

function squareGridSchema<Cell extends z.ZodType>(
  cell: Cell,
  sides: readonly number[],
) {
  const cellCounts = sides.map((side) => side ** 2);
  return z
    .array(cell)
    .max(Math.max(...cellCounts))
    .refine((g) => cellCounts.includes(g.length), {
      message: `grid length must be one of ${cellCounts.join(", ")}`,
    });
}

function sidesOf(sizes: {
  readonly options: readonly { readonly value: number }[];
}): readonly number[] {
  return sizes.options.map((option) => option.value);
}

export const crosswordCellsSchema = squareGridSchema(
  crosswordLetterSchema.nullable(),
  CROSSWORD_SIZES,
);

export const nonogramCompletionRequestSchema = z.strictObject({
  game: z.literal("nonogram"),
  date: calendarDateString,
  grid: squareGridSchema(submittedCellSchema, sidesOf(nonogramSizeSchema)),
  elapsedMs: elapsedMsSchema,
  hintsUsed: hintsUsedSchema,
});

export type NonogramCompletionRequest = z.infer<
  typeof nonogramCompletionRequestSchema
>;

export const termoCompletionRequestSchema = z.strictObject({
  game: z.literal("termo"),
  date: calendarDateString,
  guesses: z.array(termoGuessWordSchema).min(1).max(TERMO_MAX_GUESSES),
  elapsedMs: elapsedMsSchema,
  hintsUsed: hintsUsedSchema,
});

export type TermoCompletionRequest = z.infer<
  typeof termoCompletionRequestSchema
>;

export const crosswordCompletionRequestSchema = z.strictObject({
  game: z.literal("crossword"),
  date: calendarDateString,
  grid: crosswordCellsSchema,
  elapsedMs: elapsedMsSchema,
  hintsUsed: hintsUsedSchema,
});

export type CrosswordCompletionRequest = z.infer<
  typeof crosswordCompletionRequestSchema
>;

export const queensCompletionRequestSchema = z.strictObject({
  game: z.literal("queens"),
  date: calendarDateString,
  grid: squareGridSchema(submittedCellSchema, sidesOf(queensSizeSchema)),
  elapsedMs: elapsedMsSchema,
  hintsUsed: hintsUsedSchema,
});

export type QueensCompletionRequest = z.infer<
  typeof queensCompletionRequestSchema
>;

export const minesweeperCompletionRequestSchema = z.strictObject({
  game: z.literal("minesweeper"),
  date: calendarDateString,
  hit: minesweeperCellIndexSchema.nullable(),
  elapsedMs: elapsedMsSchema,
  hintsUsed: hintsUsedSchema,
});

export type MinesweeperCompletionRequest = z.infer<
  typeof minesweeperCompletionRequestSchema
>;

export const completionRequestSchema = z.discriminatedUnion("game", [
  binairoCompletionRequestSchema,
  crosswordCompletionRequestSchema,
  minesweeperCompletionRequestSchema,
  nonogramCompletionRequestSchema,
  queensCompletionRequestSchema,
  sudokuCompletionRequestSchema,
  termoCompletionRequestSchema,
]);

export type CompletionRequest = z.infer<typeof completionRequestSchema>;

export const completionResponseSchema = z.strictObject({
  game: gameSchema,
  date: isoDateString,
  outcome: completionOutcomeSchema,

  onTime: z.boolean(),

  recorded: z.boolean(),
  elapsedMs: z.number().int().min(0),
  hintsUsed: z.number().int().min(0),
});

export type CompletionResponse = z.infer<typeof completionResponseSchema>;

export const apiErrorResponseSchema = z.strictObject({ error: z.string() });

export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>;
