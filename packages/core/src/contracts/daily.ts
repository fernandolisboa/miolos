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

/** The extension point M2 games join (#23/#25/#27). */
export const dailyPuzzleResponseSchema = z.discriminatedUnion("game", [
  dailyBinairoResponseSchema,
]);

export type DailyPuzzleResponse = z.infer<typeof dailyPuzzleResponseSchema>;

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
 * | sudoku   | `game, date, givens, tier`    | `solution`, `seed`, `clueCount`                                                  | #23 (throws until)   |
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
    case "sudoku":
    case "nonogram":
    case "termo":
      throw new DailyProjectionUnsupportedError(game);
  }
}
