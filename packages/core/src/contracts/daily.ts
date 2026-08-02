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
 * `package.json` buys. `apps/web/scripts/route-client-js.mjs` greps the built
 * chunks for the marker, so a re-merge is CATCHABLE — but the script is run by
 * hand (`pnpm build && pnpm bundle-check`, from `apps/web`) and pasted in the
 * PR at step 8. No CI job runs it, so a green pipeline is not evidence that
 * this split is intact.
 *
 * SO: nothing in this file may import from `./daily-content.ts`. The
 * dependency runs one way, and since step-6 round 3 that is CHECKED rather
 * than promised: `T-LINT-S4` in `apps/web/test/eslint-db-wall.test.ts` reads
 * this file's source and reds on any `from "./daily-content"`; `T-LINT-S5`
 * beside it bans the five server-only names from every `apps/web` import,
 * `T-LINT-S6` bans the relative and dynamic paths that walked around that
 * ban, and `T-LINT-S7` derives the name list from THIS module's exports so
 * #27's schema cannot land unlisted (findings
 * `core-client-server-split-is-prose-only`,
 * `core-server-only-ban-is-bare-specifier-only`, ISS-R4-4). All four live
 * there because this package compiles with `"types": []` and cannot name
 * `node:fs`.
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
 * ONE definition, four consumers: the daily content and the daily response
 * here, the completion request's `NONOGRAM_CELL_COUNTS`
 * (`contracts/completion.ts`, which derives the legal grid lengths from
 * `.options` rather than re-listing them) and the web play record (plan 020
 * §14.1) — the `sudokuDigitSchema` precedent above, so only one place can
 * drift. A literal union,
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
 * The public daily-termo projection: TWO keys, and that is the whole
 * contract. The three grid games ship the inputs a player needs; a Termo
 * player needs nothing but the date, because the board starts empty and
 * every guess is judged server-side (ADR-0038). So this schema's job is
 * entirely negative — `z.strictObject` with exactly `game` and `date` makes
 * "the answer word, in any field" (the strip table, ./daily-content.ts) a
 * PARSE FAILURE at the wall and again at the HTTP boundary, rather than a
 * rule kept by review.
 *
 * It carries no content and is still a full union member: that is the only
 * thing that widens `ProjectedGame` below, and without it
 * `getTodayDaily(db, "termo")` cannot compile and `/daily/termo` cannot
 * exist without reaching around the wall.
 */
export const dailyTermoResponseSchema = z.strictObject({
  game: z.literal("termo"),
  date: isoDateString,
});

export type DailyTermoResponse = z.infer<typeof dailyTermoResponseSchema>;

/**
 * All four M2 games. The extension point closed at #27 — every member of
 * `Game` now has a projection, so this union is total and the next game to
 * join it is one that does not exist yet.
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
  dailyTermoResponseSchema,
]);

export type DailyPuzzleResponse = z.infer<typeof dailyPuzzleResponseSchema>;

/**
 * The games `stripDailyContent` can actually project. Since #27 that is
 * every member of `Game`, so this alias and `Game` are momentarily the same
 * set — and it is RETAINED, deliberately, as the wall's bound.
 *
 * It is the bound on `getTodayDaily` and `getPublishedDaily`
 * (packages/db/src/published.ts), and what it buys is that adding a fifth
 * game to `Game` does NOT silently make those two readers callable for it:
 * `Extract<DailyPuzzleResponse, { game: G }>` would be `never`, so the call
 * would not compile until the projection lands. Collapsing it to `Game`
 * would trade a compile error for a runtime one, which is the opposite of
 * the property it was introduced for.
 */
export type ProjectedGame = DailyPuzzleResponse["game"];
