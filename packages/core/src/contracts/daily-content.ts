/**
 * The SERVER-ONLY daily contracts: the shape of `daily_puzzles.content` per
 * game, and the strip that projects it for the wire.
 *
 * Separate from `./daily.ts` for a bundle reason, not a filing one — see
 * that file's header. Nothing here may ever be imported by a client
 * component. `packages/db/src/published.ts` (the wall), `apps/api`'s cron
 * and completion routes are the only consumers.
 */
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

/**
 * Server-side shape of `daily_puzzles.content` for binairo — mirrors
 * `BinairoPuzzle` exactly. Parsed by the cron before insert and by the wall
 * after read: jsonb is untyped at the boundary, so it is Zod-parsed, never
 * cast.
 *
 * Strict, deliberately (ADR-0024): an engine-added field fails the cron's
 * pre-insert parse before it reaches the buffer. Corollary: because rows
 * are immutable and the buffer is `bufferDepth` days deep, the read side
 * must keep parsing rows generated up to `bufferDepth` days earlier — an
 * engine's content-shape change updates this schema in the same PR.
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
 * `SudokuPuzzle` exactly. Strict for the same fail-closed reason as
 * `binairoDailyContentSchema` above, same operational corollaries.
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
 * Mirrors `NonogramReveal` exactly. The whole object is withheld from every
 * default read (ADR-0033) — `stripDailyContent` never picks a field of it.
 * The one exception: `getPublishedNonogramMotifName`
 * (`packages/db/src/published.ts`) parses a published row with this schema
 * behind the wall and returns `reveal.name` alone, for a day already judged
 * completed (ADR-0070).
 *
 * No `.min(1)` on `name`, deliberately: `validateNonogram` rejects an empty
 * name at generation time, so nothing on this read path re-checks it and a
 * stored `name: ""` parses here. Tightening it is a write-side change that
 * can drain the buffer — the read instead normalises a blank name to
 * `undefined`.
 */
const nonogramRevealSchema = z.strictObject({
  motifId: z.string(),
  name: z.string(),
  mirrored: z.boolean(),
  solution: z.array(z.array(z.boolean())),
});

/**
 * Server-side shape of `daily_puzzles.content` for nonogram — mirrors
 * `NonogramPuzzle` exactly, `game` included: unlike binairo and sudoku, the
 * nonogram engine writes a `game: "nonogram"` field, and omitting it here
 * fails every pre-insert parse. Strict for the same fail-closed reason as
 * `binairoDailyContentSchema` above.
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
 * Server-side shape of `daily_puzzles.content` for termo — mirrors
 * `TermoAnswer` exactly and carries nothing else. Strict for the same
 * fail-closed reason as `binairoDailyContentSchema` above.
 *
 * Three deliberate absences (ADR-0040), each the obvious thing to add and
 * each wrong:
 *
 * - no `index`: the word is stored, never its position in the curated list.
 *   The list can be regenerated and reordered, and rows are immutable, so
 *   an index would let a content commit silently rewrite what an
 *   already-published row meant.
 * - no `seed`: the other three engines are deterministic from a seed;
 *   Termo draws by rejection sampling over a run-scoped pool, so replaying
 *   the same seed against a different pool reproduces nothing.
 * - no `game` literal: every read is already keyed by `game` in SQL.
 *
 * `normalized` is stored though it is derivable, so the no-repeat check
 * compares pure ASCII and cannot be defeated by a jsonb round-trip that
 * composes a diacritic differently. `canonical` is the reveal — nothing
 * else in the runtime can recover an accented spelling.
 *
 * `.length(5)`, not a charset regex: a dimension check matching the
 * engine's `WORD_LENGTH`. A charset regex would fail every insert the day a
 * regeneration introduces an accented letter outside today's word list.
 */
export const termoDailyContentSchema = z.strictObject({
  canonical: z.string().length(5),
  normalized: z.string().regex(/^[a-z]{5}$/),
});

export type TermoDailyContent = z.infer<typeof termoDailyContentSchema>;

/**
 * Thrown by `stripDailyContent` for a game whose projection is not
 * implemented (ADR-0024 fail-closed dispatch) — a throw is stronger than a
 * strip: no leak path exists at all.
 *
 * Unreachable today (all four games project) and kept anyway:
 * `eslint.config.mjs` bans this name from `apps/web` by a list derived from
 * this module's exports, and it is the landing place for a fifth game — a
 * new `Game` member makes the switch below non-exhaustive, a compile error
 * rather than a silent gap.
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
 * by allowlist pick, never by deleting `solution` (ADR-0024). Called inside
 * the wall (`packages/db/src/published.ts`) so no consumer ever receives
 * what it must not send.
 *
 * Strip table (ADR-0024):
 *
 * | Game     | Public projection           | Withheld (never in a default read)                           |
 * | -------- | ---------------------------- | -------------------------------------------------------------- |
 * | binairo  | `game, date, size, givens`   | `solution`, `seed`, `weekday`, `givensCount`, `requiredTier`    |
 * | sudoku   | `game, date, givens, tier`   | `solution`, `seed`, `clueCount`                                 |
 * | nonogram | `game, date, size, clues`    | entire `reveal`, `seed`, `weekday`                              |
 * | termo    | `game, date` only            | the answer word, in any field; guesses are judged server-side   |
 *
 * `seed` is withheld for every game: engines are deterministic, so a seed
 * is the solution.
 *
 * The nonogram row is a PRODUCT withhold, not a confidentiality one
 * (ADR-0033): `solveNonogram(clues)` recovers the bitmap client-side in
 * under a millisecond, so what is actually kept back is the curated
 * `name`. That name is published on a different payload entirely — the
 * user's own completed `/day` claim (ADR-0070), through
 * `getPublishedNonogramMotifName`, never through this function.
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
      // Product withhold, not confidentiality (ADR-0033) — see doc above.
      const parsed = nonogramDailyContentSchema.parse(content);
      return dailyNonogramResponseSchema.parse({
        game: "nonogram",
        date,
        size: parsed.size,
        clues: parsed.clues,
      });
    }
    case "termo": {
      // Parsed though the projection carries nothing from the row: with an
      // empty projection the 200 IS the whole message, so it must mean
      // "playable", not merely "a row exists". A drifted row 500s here
      // rather than serving a date the game cannot be played on.
      termoDailyContentSchema.parse(content);
      return dailyTermoResponseSchema.parse({ game: "termo", date });
    }
  }
}
