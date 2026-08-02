/**
 * The SERVER-ONLY daily contracts: the shape of `daily_puzzles.content` per
 * game, and the strip that projects it for the wire.
 *
 * SEPARATE FROM `./daily.ts` FOR A BUNDLE REASON, not a filing one — see that
 * file's header. Nothing here may ever be imported by a client component.
 * `packages/db/src/published.ts` (the wall), `apps/api`'s cron and completion
 * routes are the only consumers.
 */
import { z } from "zod";

import type { Game } from "../game";
import {
  binairoCellSchema,
  dailyBinairoResponseSchema,
  dailyNonogramResponseSchema,
  dailySudokuResponseSchema,
  nonogramCluesSchema,
  nonogramSizeSchema,
  sudokuDigitSchema,
  sudokuGivenCellSchema,
  sudokuTierSchema,
  type DailyPuzzleResponse,
} from "./daily";

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

/** A solved cell is never 0. */
const sudokuSolvedCellSchema = sudokuDigitSchema;

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

/** Mirrors `NonogramReveal` exactly. The whole object is withheld from every default read (ADR-0033). */
const nonogramRevealSchema = z.strictObject({
  motifId: z.string(),
  name: z.string(),
  mirrored: z.boolean(),
  solution: z.array(z.array(z.boolean())),
});

/**
 * Server-side shape of `daily_puzzles.content` for nonogram — mirrors
 * `NonogramPuzzle` (nonogram/types.ts:32-41) exactly, `game` INCLUDED:
 * unlike `BinairoPuzzle` and `SudokuPuzzle`, the nonogram engine writes a
 * `game: "nonogram"` field (generate.ts:48). Omitting it from this
 * strictObject fails every pre-insert parse and drains the buffer (plan 020
 * N2). Strict for the same fail-closed reason `binairoDailyContentSchema`
 * is, with the same operational corollaries — see that schema's TSDoc above.
 * (A line-number self-citation used to sit here and pointed at the import
 * block; a reference that cannot drift when the imports grow replaces it.)
 */
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
        "see the strip table in packages/core/src/contracts/daily-content.ts",
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
 * | nonogram | `game, date, size, clues`     | entire `reveal` (`motifId`, `name`, `mirrored`, `solution`), `seed`, `weekday` | #25 (this file)      |
 * | termo    | `game, date` only             | the answer word, in any field; guesses are judged server-side                    | #27 (throws until)   |
 *
 * The nonogram row is a PRODUCT withhold, not a confidentiality one
 * (ADR-0033). `solveNonogram(clues)` recovers the bitmap in under a
 * millisecond by construction (ADR-0021 decision 3), so the picture's shape
 * is client-derivable and the strip protects nothing about it. What it
 * withholds is the curated `name`, which is NOT derivable from the clues,
 * and casual inspection of the rest — ADR-0027's own words, never a
 * security claim.
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
    case "nonogram": {
      // A PRODUCT withhold, never a confidentiality one: `solveNonogram(clues)`
      // recovers the bitmap in under a millisecond, so what is actually held
      // back is the curated `name` and casual inspection of the rest
      // (ADR-0033, ADR-0027). Do not re-describe this as protecting the
      // solution — it does not, and cannot.
      const parsed = nonogramDailyContentSchema.parse(content);
      return dailyNonogramResponseSchema.parse({
        game: "nonogram",
        date,
        size: parsed.size,
        clues: parsed.clues,
      });
    }
    case "termo":
      throw new DailyProjectionUnsupportedError(game);
  }
}
