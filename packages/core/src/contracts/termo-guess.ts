/**
 * The Termo GUESS wire — `POST /termo/guess`, request and response
 * (ADR-0038, plan 022 §11.1). CLIENT-SAFE, deliberately: unlike
 * `./daily-content.ts` nothing here names or shapes the answer word, so it is
 * re-exported from the package root and is NOT on `apps/web`'s ESLint ban
 * list. The one field that carries an answer — the response's `answer` — only
 * ever arrives on a board the player has already closed.
 *
 * Named `termo-guess.ts` rather than `guess.ts` on the `grid-hint.ts`
 * precedent (ADR-0029 decision 6): the shared layer's naming stays honest
 * about which game a module belongs to.
 *
 * IMPORT DIRECTION, and it is load-bearing (plan 022 §8.0): this module takes
 * `calendarDateString`/`isoDateString` from `./daily`, which imports nothing
 * but `zod`, and `./completion.ts` takes `termoGuessWordSchema` and
 * `TERMO_MAX_GUESSES` from HERE. Nothing in this file may import from
 * `./completion.ts` — that edge closes a cycle that throws a `ReferenceError`
 * at import in every `@miolos/core` consumer, and vitest does not reproduce
 * it.
 */
import { z } from "zod";

import { calendarDateString, isoDateString } from "./daily";

/**
 * Termo's board bounds, restated here because `@miolos/games` is a
 * devDependency of this package and must stay one: a runtime dependency would
 * put `words.generated.ts` (~40 KB) on the import path of every
 * `@miolos/core` consumer, `apps/web` included.
 *
 * `TERMO_` prefixed because `apps/api`'s judge imports BOTH these and the
 * engine's own `MAX_GUESSES`/`WORD_LENGTH` in one file, where a bare name
 * would collide. Pinned equal to the engine's constants by T-CORE-S18 in
 * `packages/core/test/termo-guess-contract.test.ts`, which is where core is
 * allowed to meet games.
 */
export const TERMO_MAX_GUESSES = 6;
export const TERMO_WORD_LENGTH = 5;

/**
 * A guess as it crosses the wire: NORMALIZED — lower-case, accent-free,
 * exactly five a-z letters. The client normalizes with `normalizeWord` before
 * posting, so two honest players who typed "AÇÃO" and "acao" post
 * BYTE-IDENTICAL bodies. That is ADR-0032's canonical-wire property, kept
 * where Termo can keep it.
 *
 * The shape matches `evaluate.ts`'s own `SHAPE` regexp, so a body that parses
 * can never make `evaluateGuess` throw its `RangeError`.
 */
export const termoGuessWordSchema = z.string().regex(/^[a-z]{5}$/);

/** One judged tile. The engine's `TileState`, restated (T-CORE-S18). */
export const termoTileStateSchema = z.enum(["correct", "present", "absent"]);

/**
 * One judged row. A TUPLE, not `.length(5)`: `z.tuple` infers a 5-tuple
 * assignable to the engine's `readonly TileStates`, so a parsed response feeds
 * straight into `deriveKeyboardState` with no `as`. The five members are
 * spelled out because `z.tuple` needs a literal-length array; T-CORE-S18 pins
 * the arity against `WORD_LENGTH` both structurally and behaviourally.
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
 * POST /termo/guess. STATELESS: the client posts the WHOLE list every time
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
 * `answer` is present IF AND ONLY IF the board is closed. That is the whole of
 * ADR-0038 decision 2, and it is CHECKED on the OUTGOING object rather than
 * documented: a route change that leaked the answer mid-game throws a 500
 * instead of leaking, and one that dropped it from a closed board throws too.
 * It fails closed in both directions, which is why the refine lives here and
 * not in a route comment.
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
