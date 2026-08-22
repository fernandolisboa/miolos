/**
 * The client-facing daily contracts: the three public response schemas,
 * their union, and the primitives they share.
 *
 * The server-only half — `*DailyContentSchema`, `nonogramRevealSchema` and
 * `stripDailyContent` — lives in `./daily-content.ts`. The split is a bundle
 * boundary, not a filing preference: a module-scope `z.strictObject(...)` is
 * a call the bundler cannot prove pure, so while the content schemas sat in
 * this file every one of them — including `nonogramRevealSchema`'s withheld
 * key strings — was retained in the browser chunk of every route, even
 * though no motif value ever shipped.
 *
 * Nothing in this file may import from `./daily-content.ts`. The dependency
 * runs one way, checked by `apps/web/test/eslint-db-wall.test.ts`.
 */
import { z } from "zod";

/** 'YYYY-MM-DD' — an America/Sao_Paulo calendar day (CONTEXT.md "Daily"). */
export const isoDateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/**
 * A calendar-VALID 'YYYY-MM-DD'. `isoDateString` checks shape only, which is
 * right for server-derived values but wrong for a client-supplied one:
 * "2026-02-30" passes the regex, reaches a Postgres `date` column, and
 * raises 22008 — a 500 from a two-character body edit. Round-tripping
 * through UTC catches it: JS rolls an impossible day over
 * ("2026-02-30" → 2026-03-02), so a value that survives the round trip is a
 * real calendar day.
 *
 * The round trip alone is not enough: JS has a year 0, but the proleptic
 * Gregorian calendar Postgres implements does not (1 BC is followed
 * directly by 1 AD), so `"0000-01-01"` survives the round trip and still
 * raises 22008 in Postgres — hence the explicit `>= 1` floor below.
 *
 * It lives here, not in `./completion.ts` where it originally sat:
 * `completion.ts` needs `./termo-guess.ts`'s `termoGuessWordSchema`, and
 * `./termo-guess.ts` needs this schema — a two-module cycle. This file
 * imports nothing but `zod`, so `completion.ts → termo-guess.ts → daily.ts`
 * stays a DAG. Moving `calendarDateString` back reopens the cycle: a
 * module-scope `z.strictObject(...)` referencing an as-yet-uninitialised
 * binding throws `ReferenceError` under real ESM — and `pnpm test` does NOT
 * catch it, because vitest's SSR transform lets the circular binding
 * silently arrive `undefined` instead of throwing.
 */
export const calendarDateString = isoDateString.refine((value) => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.getUTCFullYear() >= 1 &&
    parsed.toISOString().slice(0, 10) === value
  );
}, "not a calendar date");

/** Exported for `./daily-content.ts`; not part of the package's surface. */
export const binairoCellSchema = z.union([
  z.literal(0),
  z.literal(1),
  z.null(),
]);

/**
 * The public daily-binairo projection — see the strip table on
 * `stripDailyContent` in `./daily-content.ts`. Strict: a smuggled extra key
 * fails the parse.
 */
export const dailyBinairoResponseSchema = z.strictObject({
  game: z.literal("binairo"),
  date: isoDateString,
  size: z.literal(8),
  givens: z.array(binairoCellSchema).length(64),
});

export type DailyBinairoResponse = z.infer<typeof dailyBinairoResponseSchema>;

/**
 * A written sudoku cell, 1-9. Every consumer — the daily response here, the
 * daily content, the completion request and the web play record — imports
 * this rather than re-declaring the nine-member union, so only one place
 * can drift.
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
export const sudokuGivenCellSchema = z.union([z.literal(0), sudokuDigitSchema]);

/** Mirrors `SudokuTier`: the highest house-ladder rung the puzzle requires. */
export const sudokuTierSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);

/**
 * The public daily-sudoku projection — see the strip table on
 * `stripDailyContent` in `./daily-content.ts`. `tier` ships because it is
 * the screen's `Nível` readout; it leaks nothing the client could not
 * already recompute from `givens`. Strict: a smuggled extra key fails the
 * parse.
 */
export const dailySudokuResponseSchema = z.strictObject({
  game: z.literal("sudoku"),
  date: isoDateString,
  givens: z.array(sudokuGivenCellSchema).length(81),
  tier: sudokuTierSchema,
});

export type DailySudokuResponse = z.infer<typeof dailySudokuResponseSchema>;

/**
 * The four size classes the weekday ramp can produce. Every consumer — the
 * daily content, the daily response here, the completion request (which
 * derives legal grid lengths from `.options` rather than re-listing them)
 * and the web play record — imports this rather than re-declaring it, so
 * only one place can drift. A literal union, never `z.number().int()`: a
 * fifth size class is exactly the content-shape drift ADR-0024 wants to
 * fail closed on.
 */
export const nonogramSizeSchema = z.union([
  z.literal(5),
  z.literal(8),
  z.literal(10),
  z.literal(15),
]);

export type NonogramSize = z.infer<typeof nonogramSizeSchema>;

/** One line's run lengths. `positive()` is load-bearing: an all-empty line
 *  is `[]`, never `[0]` — a stored `[0]` is drift, not data. */
const nonogramClueLineSchema = z.array(z.number().int().positive());

/**
 * Mirrors `NonogramClues` exactly, so the wire value is directly assignable
 * to the engine's `NonogramClues` with no reshaping. The `.refine` is a
 * dimension check only; rule validity (runs that fit, clues that match a
 * bitmap) belongs to `validateNonogram` — a second, divergent validator
 * here is how the two would drift.
 */
export const nonogramCluesSchema = z
  .strictObject({
    size: nonogramSizeSchema,
    rows: z.array(nonogramClueLineSchema),
    cols: z.array(nonogramClueLineSchema),
  })
  .refine((c) => c.rows.length === c.size && c.cols.length === c.size, {
    message: "clue line counts must equal size",
  });

/**
 * The public daily-nonogram projection. No `reveal` in any form — ADR-0033:
 * this is a product withhold, not confidentiality, since
 * `solveNonogram(clues)` recovers the bitmap client-side in under a
 * millisecond. What's actually kept back is the curated `name`. `size`
 * ships redundantly with `clues.size`; the refine below stops the two from
 * disagreeing.
 */
export const dailyNonogramResponseSchema = z
  .strictObject({
    game: z.literal("nonogram"),
    date: isoDateString,
    size: nonogramSizeSchema,
    clues: nonogramCluesSchema,
  })
  .refine((d) => d.size === d.clues.size, {
    message: "size disagrees with clues.size",
  });

export type DailyNonogramResponse = z.infer<typeof dailyNonogramResponseSchema>;

/**
 * The public daily-termo projection: just `game` and `date`. A Termo player
 * needs nothing else — the board starts empty and every guess is judged
 * server-side (ADR-0038) — so this schema's job is to make "the answer
 * word, in any field" a parse failure rather than a rule kept by review.
 */
export const dailyTermoResponseSchema = z.strictObject({
  game: z.literal("termo"),
  date: isoDateString,
});

export type DailyTermoResponse = z.infer<typeof dailyTermoResponseSchema>;

/**
 * All four M2 games — the union is total, so the next game to join it is
 * one that does not exist yet.
 *
 * `.refine()` preserves `.shape` — true for the installed zod 4.4.3, false
 * in zod 3. Re-verify on any zod major bump.
 */
export const dailyPuzzleResponseSchema = z.discriminatedUnion("game", [
  dailyBinairoResponseSchema,
  dailyNonogramResponseSchema,
  dailySudokuResponseSchema,
  dailyTermoResponseSchema,
]);

export type DailyPuzzleResponse = z.infer<typeof dailyPuzzleResponseSchema>;

/**
 * The games `stripDailyContent` can project — currently every member of
 * `Game`, and kept as its own alias rather than collapsed to `Game` anyway:
 * it is the bound on `getTodayDaily` and `getPublishedDaily`
 * (`packages/db/src/published.ts`), so adding a fifth game to `Game` does
 * NOT silently make those callable for it —
 * `Extract<DailyPuzzleResponse, { game: G }>` becomes `never` and the call
 * fails to compile until the projection lands.
 */
export type ProjectedGame = DailyPuzzleResponse["game"];
