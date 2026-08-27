import { z } from "zod";

import { completionOutcomeSchema } from "../completion";
import { gameSchema } from "../game";
import {
  calendarDateString,
  isoDateString,
  nonogramSizeSchema,
  sudokuDigitSchema,
} from "./daily";

import { TERMO_MAX_GUESSES, termoGuessWordSchema } from "./termo-guess";

const submittedCellSchema = z.union([z.literal(0), z.literal(1)]);

export const binairoCompletionRequestSchema = z.strictObject({
  game: z.literal("binairo"),
  date: calendarDateString,
  grid: z.array(submittedCellSchema).length(64),
  elapsedMs: z.number().int().min(0).max(86_400_000),
  hintsUsed: z.number().int().min(0).max(1),
});

export type BinairoCompletionRequest = z.infer<
  typeof binairoCompletionRequestSchema
>;

export const sudokuCompletionRequestSchema = z.strictObject({
  game: z.literal("sudoku"),
  date: calendarDateString,
  grid: z.array(sudokuDigitSchema).length(81),
  elapsedMs: z.number().int().min(0).max(86_400_000),
  hintsUsed: z.number().int().min(0).max(1),
});

export type SudokuCompletionRequest = z.infer<
  typeof sudokuCompletionRequestSchema
>;

const NONOGRAM_CELL_COUNTS: readonly number[] = nonogramSizeSchema.options.map(
  (option) => option.value ** 2,
);

export const nonogramCompletionRequestSchema = z.strictObject({
  game: z.literal("nonogram"),
  date: calendarDateString,
  grid: z
    .array(submittedCellSchema)
    .refine((g) => NONOGRAM_CELL_COUNTS.includes(g.length), {
      message: "grid length must be 25, 64, 100 or 225",
    }),
  elapsedMs: z.number().int().min(0).max(86_400_000),
  hintsUsed: z.number().int().min(0).max(1),
});

export type NonogramCompletionRequest = z.infer<
  typeof nonogramCompletionRequestSchema
>;

export const termoCompletionRequestSchema = z.strictObject({
  game: z.literal("termo"),
  date: calendarDateString,
  guesses: z.array(termoGuessWordSchema).min(1).max(TERMO_MAX_GUESSES),
  elapsedMs: z.number().int().min(0).max(86_400_000),
  hintsUsed: z.number().int().min(0).max(1),
});

export type TermoCompletionRequest = z.infer<
  typeof termoCompletionRequestSchema
>;

export const completionRequestSchema = z.discriminatedUnion("game", [
  binairoCompletionRequestSchema,
  nonogramCompletionRequestSchema,
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
