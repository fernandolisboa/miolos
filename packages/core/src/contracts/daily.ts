import { z } from "zod";

import type { Game } from "../game";

/** 'YYYY-MM-DD' — an America/Sao_Paulo calendar day (CONTEXT.md "Daily"). */
export const isoDateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const binairoCellSchema = z.union([z.literal(0), z.literal(1), z.null()]);
const binairoSolvedCellSchema = z.union([z.literal(0), z.literal(1)]);

/**
 * Server-side shape of `daily_puzzles.content` for binairo — mirrors
 * `BinairoPuzzle` exactly. Parsed by the cron BEFORE insert and by the
 * wall AFTER read: jsonb is untyped at the boundary, so it is Zod-parsed,
 * never cast.
 *
 * Strict, deliberately (ADR-0024): an engine-added field fails the cron's
 * pre-insert parse → the buffer drains → the depth alert fires.
 * Fail-closed against unreviewed content-shape drift, at the cost of a
 * loud, wanted alarm on benign additive fields. Corollaries: changing an
 * engine's content shape means updating this schema in the same PR, and
 * because rows are immutable and the buffer is ~`bufferDepth` days deep,
 * the read side must keep parsing rows generated up to `bufferDepth`
 * days earlier (ADR-0024 operational semantics).
 */
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

/**
 * The public daily-binairo projection. No `seed` (engines are
 * deterministic — a seed IS the solution), no `solution`, no `weekday`
 * (the client derives it from the date), no `requiredTier` (YAGNI; #18
 * may extend). Strict: a smuggled extra key fails the parse.
 */
export const dailyBinairoResponseSchema = z.strictObject({
  game: z.literal("binairo"),
  date: isoDateString,
  size: z.literal(8),
  givens: z.array(binairoCellSchema).length(64),
});

export type DailyBinairoResponse = z.infer<typeof dailyBinairoResponseSchema>;

/**
 * A written sudoku cell, 1-9. ONE definition, three consumers: the daily
 * content and response here, the completion request
 * (`contracts/completion.ts`) and the web play record all import it rather
 * than re-declaring a nine-member union, so only one place can drift
 * (plan 018 §6.1).
 */
export const sudokuDigitSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
  z.literal(7),
  z.literal(8),
  z.literal(9),
]);

/** 0 = an empty cell to solve; 1–9 = a digit (`SudokuGrid`'s own sentinel). */
const sudokuGivenCellSchema = z.union([z.literal(0), sudokuDigitSchema]);

/** A solved cell is never 0. */
const sudokuSolvedCellSchema = sudokuDigitSchema;

/** Mirrors `SudokuTier`: the highest house-ladder rung the puzzle requires. */
const sudokuTierSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);

/**
 * Server-side shape of `daily_puzzles.content` for sudoku — mirrors
 * `SudokuPuzzle` exactly: `givens`, `solution`, `tier`, `clueCount`,
 * `seed`, and no `size` or `weekday` (unlike binairo, the sudoku engine
 * carries neither). Strict for the same fail-closed reason
 * `binairoDailyContentSchema` is, with the same operational corollaries.
 */
export const sudokuDailyContentSchema = z.strictObject({
  givens: z.array(sudokuGivenCellSchema).length(81),
  solution: z.array(sudokuSolvedCellSchema).length(81),
  tier: sudokuTierSchema,
  clueCount: z.number().int(),
  seed: z.number().int().nonnegative(),
});

export type SudokuDailyContent = z.infer<typeof sudokuDailyContentSchema>;

/**
 * The public daily-sudoku projection. No `seed`, no `solution`, no
 * `clueCount` (it is solution-adjacent clue metadata and is in
 * `FORBIDDEN_DAILY_KEYS`), no `weekday` (the client derives it from the
 * date). `tier` ships because the strip table mandates it and it is the
 * screen's `Nível` readout; it leaks nothing the client could not already
 * recompute from `givens`. Strict: a smuggled extra key fails the parse.
 */
export const dailySudokuResponseSchema = z.strictObject({
  game: z.literal("sudoku"),
  date: isoDateString,
  givens: z.array(sudokuGivenCellSchema).length(81),
  tier: sudokuTierSchema,
});

export type DailySudokuResponse = z.infer<typeof dailySudokuResponseSchema>;

/** The extension point M2 games join (#25/#27). */
export const dailyPuzzleResponseSchema = z.discriminatedUnion("game", [
  dailyBinairoResponseSchema,
  dailySudokuResponseSchema,
]);

export type DailyPuzzleResponse = z.infer<typeof dailyPuzzleResponseSchema>;

/**
 * The games `stripDailyContent` can actually project. NOT `Game`: nonogram
 * and termo still throw `DailyProjectionUnsupportedError`, so a reader
 * typed over `Game` would type `getTodayDaily(db, "nonogram")` as
 * `Promise<undefined>` — `Extract<DailyPuzzleResponse, { game: "nonogram" }>`
 * is `never` — while it 500s at runtime the moment a nonogram row exists.
 * #25/#27 widen this in the same PR that adds their projection, which is
 * the same fail-closed extension property the cron contracts have.
 */
export type ProjectedGame = DailyPuzzleResponse["game"];

/**
 * Thrown by `stripDailyContent` for games whose projection is not
 * implemented yet — a throw is stronger than a strip: no leak path exists
 * at all (ADR-0024 fail-closed dispatch).
 */
export class DailyProjectionUnsupportedError extends Error {
  readonly game: Game;

  constructor(game: Game) {
    super(
      `no daily projection is implemented for game "${game}" yet — ` +
        "see the strip table in packages/core/src/contracts/daily.ts",
    );
    this.name = "DailyProjectionUnsupportedError";
    this.game = game;
  }
}

/**
 * Build the solution-free public projection of a stored `content` value —
 * by allowlist pick, never by deleting `solution` (ADR-0024). Called
 * inside the wall (`packages/db/src/published.ts`) so no consumer ever
 * receives what it must not send.
 *
 * Strip table (ADR-0024, the per-game M2 contract):
 *
 * | Game     | Public projection (allowlist) | Withheld (never in a default read)                                              | Implemented          |
 * | -------- | ----------------------------- | ------------------------------------------------------------------------------- | -------------------- |
 * | binairo  | `game, date, size, givens`    | `solution`, `seed`, `weekday`, `givensCount`, `requiredTier`                     | #17 (this file)      |
 * | sudoku   | `game, date, givens, tier`    | `solution`, `seed`, `clueCount`                                                  | #23 (this file)      |
 * | nonogram | `game, date, size, clues`     | entire `reveal` (`motifId`, `name`, `mirrored`, `solution` — identity spoils), `seed`, `weekday` | #25 (throws until)   |
 * | termo    | `game, date` only             | the answer word, in any field; guesses are judged server-side                    | #27 (throws until)   |
 *
 * `seed` is withheld for EVERY game: engines are deterministic, so a seed
 * is the solution.
 */
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
    case "nonogram":
    case "termo":
      throw new DailyProjectionUnsupportedError(game);
  }
}
