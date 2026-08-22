/**
 * The Termo guess wire — `POST /termo/guess` (ADR-0038). Client-safe,
 * deliberately: unlike `./daily-content.ts` nothing here names or shapes
 * the answer word except the response's `answer`, which only ever arrives
 * on a board the player has already closed — so this module is re-exported
 * from the package root and is NOT on `apps/web`'s ESLint ban list.
 *
 * Import direction is load-bearing: this module imports only from `./daily`
 * (which imports nothing but `zod`), and `./completion.ts` imports from
 * here. Nothing in this file may import from `./completion.ts` — that edge
 * closes a cycle that throws a `ReferenceError` at import in every
 * `@miolos/core` consumer, and vitest does not reproduce it.
 */
import { z } from "zod";

import { calendarDateString, isoDateString } from "./daily";

/**
 * Termo's board bounds, restated here because `@miolos/games` is a
 * devDependency of this package and must stay one: a runtime dependency
 * would put `words.generated.ts` (~40 KB) on the import path of every
 * `@miolos/core` consumer, `apps/web` included.
 */
export const TERMO_MAX_GUESSES = 6;
export const TERMO_WORD_LENGTH = 5;

/**
 * A guess as it crosses the wire: normalized — lower-case, accent-free,
 * exactly five a-z letters. The client normalizes with `normalizeWord`
 * before posting, so two honest players who typed "AÇÃO" and "acao" post
 * byte-identical bodies (ADR-0032).
 *
 * The shape matches `evaluate.ts`'s own shape regexp, so a body that parses
 * can never make `evaluateGuess` throw its `RangeError`.
 */
export const termoGuessWordSchema = z.string().regex(/^[a-z]{5}$/);

/** One judged tile — the engine's `TileState`, restated. */
export const termoTileStateSchema = z.enum(["correct", "present", "absent"]);

/**
 * One judged row. A tuple, not `.length(5)`: `z.tuple` infers a 5-tuple
 * assignable to the engine's `readonly TileStates`, so a parsed response
 * feeds straight into `deriveKeyboardState` with no `as`.
 */
export const termoTilesSchema = z.tuple([
  termoTileStateSchema,
  termoTileStateSchema,
  termoTileStateSchema,
  termoTileStateSchema,
  termoTileStateSchema,
]);

export type TermoTiles = z.infer<typeof termoTilesSchema>;

/**
 * POST /termo/guess. Stateless: the client posts the whole list every time
 * (ADR-0038 decision 1), so the route holds nothing between requests and a
 * replay is idempotent for free.
 *
 * Carries no tiles and no status — both are the server's to compute, and a
 * second place to state them is a second place to lie. `date` is
 * `calendarDateString`, never `isoDateString`: it is client-supplied.
 */
export const termoGuessRequestSchema = z.strictObject({
  game: z.literal("termo"),
  date: calendarDateString,
  guesses: z.array(termoGuessWordSchema).min(1).max(TERMO_MAX_GUESSES),
});

export type TermoGuessRequest = z.infer<typeof termoGuessRequestSchema>;

/**
 * The judged board. `tiles` is parallel to the submitted `guesses`, in the
 * submitted order — the request is not echoed back, because an echo is a
 * second place for the two to disagree.
 *
 * `answer` is present if and only if the board is closed (ADR-0038 decision
 * 2). That is checked on the outgoing object below rather than only
 * documented: a route change that leaked the answer mid-game throws a 500
 * instead of leaking, and one that dropped it from a closed board throws
 * too — it fails closed in both directions.
 */
export const termoGuessResponseSchema = z
  .strictObject({
    game: z.literal("termo"),
    date: isoDateString,
    tiles: z.array(termoTilesSchema).min(1).max(TERMO_MAX_GUESSES),
    status: z.enum(["playing", "won", "lost"]),
    /** The canonical ACCENTED spelling (ADR-0015), e.g. "praga", "então". */
    answer: z.string().optional(),
  })
  .refine((r) => (r.status === "playing") === (r.answer === undefined), {
    message: "answer is present exactly when the board is closed",
  });

export type TermoGuessResponse = z.infer<typeof termoGuessResponseSchema>;
