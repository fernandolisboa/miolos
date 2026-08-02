/**
 * The CLIENT-FACING daily contracts: the three public response schemas, their
 * union, and the primitives they share.
 *
 * The SERVER-ONLY half — `*DailyContentSchema`, `nonogramRevealSchema` and
 * `stripDailyContent` — lives in `./daily-content.ts`, and the split is a
 * bundle decision rather than a filing preference. `apps/web` imports values
 * from `@miolos/core` (`isoDateString`, `nonogramSizeSchema`,
 * `sudokuDigitSchema` in `play/play-record.ts`), and a module-scope
 * `z.strictObject(...)` is a call the bundler cannot prove pure — so while
 * the content schemas sat in THIS file, every one of them was retained in the
 * browser chunk of every route, `nonogramRevealSchema`'s `motifId` / `name` /
 * `mirrored` / `solution` key strings included. Measured: they were in a
 * chunk on all eight routes' first-load path. No motif VALUES ever shipped,
 * so it was never an ADR-0033 breach — it was dead weight on the ritual's
 * critical path plus a gratuitous publication of the withheld object's shape.
 *
 * Keeping them out is what `"sideEffects": false` in this package's
 * `package.json` buys, and `apps/web/scripts/route-client-js.mjs` greps the
 * built chunks for the marker so a re-merge is caught mechanically.
 *
 * SO: nothing in this file may import from `./daily-content.ts`. The
 * dependency runs one way.
 */
import { z } from "zod";

/** 'YYYY-MM-DD' — an America/Sao_Paulo calendar day (CONTEXT.md "Daily"). */
export const isoDateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** Exported for `./daily-content.ts`; not part of the package's surface. */
export const binairoCellSchema = z.union([
  z.literal(0),
  z.literal(1),
  z.null(),
]);

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
 * A written sudoku cell, 1-9. ONE definition, four consumers: the daily
 * response here, the daily CONTENT (`./daily-content.ts`), the completion
 * request (`contracts/completion.ts`) and the web play record all import it
 * rather than re-declaring a nine-member union, so only one place can drift
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

/**
 * The four size classes the weekday ramp can produce
 * (`NONOGRAM_WEEKDAY_CRITERIA`, packages/games/src/nonogram/difficulty.ts:31-41).
 * ONE definition, three consumers: the daily content and the daily response
 * here, and the web play record (plan 020 §14.1) — the `sudokuDigitSchema`
 * precedent above, so only one place can drift. A literal union,
 * never `z.number().int()`: a fifth size class is exactly the content-shape
 * drift ADR-0024 wants to fail closed on.
 */
export const nonogramSizeSchema = z.union([
  z.literal(5),
  z.literal(8),
  z.literal(10),
  z.literal(15),
]);

export type NonogramSize = z.infer<typeof nonogramSizeSchema>;

/**
 * One line's run lengths. `positive()` is load-bearing: an all-empty line is
 * `[]`, NEVER `[0]` (nonogram/types.ts:10, clues.ts:22 — "the UI renders
 * '0'"), so a stored `[0]` is drift, not data.
 */
const nonogramClueLineSchema = z.array(z.number().int().positive());

/**
 * Mirrors `NonogramClues` exactly, its nested `size` included — the wire
 * value is directly assignable to the engine's `NonogramClues`, so the client
 * hands `daily.clues` straight to `solveNonogram` with no reshaping at the
 * one boundary where reshaping goes wrong. The `.refine` is what a fixed
 * `.length(64)` is for binairo: the DIMENSION check. Rule validity (runs that
 * fit, clues that match a bitmap) belongs to `validateNonogram`, never here —
 * a second, divergent validator is how the two drift.
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
 * The public daily-nonogram projection. Four keys, and ADR-0033 is why there
 * is no fifth: no `reveal` in any form, no `seed` (engines are deterministic
 * — a seed IS the solution), no `weekday` (the client derives it from the
 * date). Withholding `reveal` is a PRODUCT decision and not a confidentiality
 * one — the client solves `clues` for the same bitmap in under a millisecond
 * — so the thing genuinely kept back is the curated `name`. `size` ships redundantly with `clues.size` because the wire value
 * must be assignable to the engine's `NonogramClues`; the refine is what
 * stops the two from disagreeing.
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
 * The extension point the last M2 game joins (#27).
 *
 * A refined `strictObject` is a legal option here and `.refine()` preserves
 * `.shape` — both measured against the installed zod 4.4.3, and both FALSE
 * in zod 3. A zod major bump re-runs that two-line probe before anything
 * else (plan 020 §7.2).
 */
export const dailyPuzzleResponseSchema = z.discriminatedUnion("game", [
  dailyBinairoResponseSchema,
  dailyNonogramResponseSchema,
  dailySudokuResponseSchema,
]);

export type DailyPuzzleResponse = z.infer<typeof dailyPuzzleResponseSchema>;

/**
 * The games `stripDailyContent` can actually project. NOT `Game`: termo
 * still throws `DailyProjectionUnsupportedError`, so a reader typed over
 * `Game` would type `getTodayDaily(db, "termo")` as `Promise<undefined>`
 * — `Extract<DailyPuzzleResponse, { game: "termo" }>` is `never` — while
 * it 500s at runtime the moment a termo row exists. #27 widens this in the
 * same PR that adds its projection, which is the same fail-closed
 * extension property the cron contracts have.
 */
export type ProjectedGame = DailyPuzzleResponse["game"];
