import { z } from "zod";

import { calendarDateString, isoDateString } from "./daily";

export const TERMO_MAX_GUESSES = 6;
export const TERMO_WORD_LENGTH = 5;

export const termoGuessWordSchema = z.string().regex(/^[a-z]{5}$/);

export const termoTileStateSchema = z.enum(["correct", "present", "absent"]);

export const termoTilesSchema = z.tuple([
  termoTileStateSchema,
  termoTileStateSchema,
  termoTileStateSchema,
  termoTileStateSchema,
  termoTileStateSchema,
]);

export type TermoTiles = z.infer<typeof termoTilesSchema>;

export const termoGuessRequestSchema = z.strictObject({
  game: z.literal("termo"),
  date: calendarDateString,
  guesses: z.array(termoGuessWordSchema).min(1).max(TERMO_MAX_GUESSES),
});

export type TermoGuessRequest = z.infer<typeof termoGuessRequestSchema>;

export const termoGuessResponseSchema = z
  .strictObject({
    game: z.literal("termo"),
    date: isoDateString,
    tiles: z.array(termoTilesSchema).min(1).max(TERMO_MAX_GUESSES),
    status: z.enum(["playing", "won", "lost"]),

    answer: z.string().optional(),
  })
  .refine((r) => (r.status === "playing") === (r.answer === undefined), {
    message: "answer is present exactly when the board is closed",
  });

export type TermoGuessResponse = z.infer<typeof termoGuessResponseSchema>;
