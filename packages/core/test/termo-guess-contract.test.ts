import {
  deriveKeyboardState,
  MAX_GUESSES,
  WORD_LENGTH,
  type TileStates,
} from "@miolos/games/termo";
import { describe, expect, it } from "vitest";

import {
  TERMO_MAX_GUESSES,
  TERMO_WORD_LENGTH,
  termoGuessRequestSchema,
  termoGuessResponseSchema,
  termoGuessWordSchema,
  termoTilesSchema,
  termoTileStateSchema,
  type TermoGuessResponse,
  type TermoTiles,
} from "../src/index";

/**
 * The Termo guess wire (ADR-0038, plan 022 §11.1). `@miolos/games` is a DEV
 * dependency of this package and stays one — `packages/core/src` may not
 * import it at all — so this file is the door where the restated bounds meet
 * the engine's own, exactly as `daily-contract.test.ts` does for the stored
 * content.
 */

/**
 * MUTABLE, not `as const`: `z.tuple` infers a mutable 5-tuple, so a `readonly`
 * literal is `TS4104` against it. The direction that matters holds — the
 * inferred tuple IS assignable to the engine's `readonly TileStates`, which is
 * what lets a parsed response feed `deriveKeyboardState` with no `as`
 * (plan 022 §26 probe P-a).
 */
const TILES: TermoTiles = ["correct", "present", "absent", "absent", "absent"];

/** A five-letter normalized word; the schema checks shape, never the dictionary. */
const WORD = "praga";

describe("termoTilesSchema", () => {
  // T-CORE-S18 (plan 022 §19.3) — the half `daily-contract.test.ts:660` names
  // as this commit's. One id, two files, on the T-API-S34 precedent: the
  // stored-content literals are pinned there and the wire literals here,
  // because this is the file that owns these symbols.
  it("T-CORE-S18: the restated bounds ARE the engine's WORD_LENGTH and MAX_GUESSES", () => {
    expect(TERMO_WORD_LENGTH).toBe(WORD_LENGTH);
    expect(TERMO_MAX_GUESSES).toBe(MAX_GUESSES);
  });

  it("T-CORE-S18: the tuple's arity is the engine's WORD_LENGTH, by shape AND by behaviour", () => {
    // `.def.items`, never `.items`: verified against the installed zod 4.4.3
    // that a tuple exposes `type`/`items`/`rest` on `.def` and NOTHING at
    // `.items`, so `.items.length` would read `undefined.length` and throw a
    // TypeError — a red test for the wrong reason. The behavioural half below
    // is what survives a zod internal rename.
    expect(termoTilesSchema.def.items).toHaveLength(WORD_LENGTH);
    for (const length of [WORD_LENGTH - 1, WORD_LENGTH + 1]) {
      expect(
        termoTilesSchema.safeParse(
          Array.from({ length }, () => "absent" as const),
        ).success,
        `a ${String(length)}-tuple must fail`,
      ).toBe(false);
    }
    expect(termoTilesSchema.safeParse(TILES).success).toBe(true);
  });

  it("T-CORE-S18: a parsed row IS the engine's `TileStates`, with no `as`", () => {
    // The assignment is the assertion (it is a `pnpm typecheck` failure if it
    // ever stops holding), and the `expect` is what keeps the binding USED so
    // `@typescript-eslint/no-unused-vars` cannot fire on it.
    const forEngine: TileStates = termoTilesSchema.parse(TILES);
    expect(deriveKeyboardState([{ guess: WORD, tiles: forEngine }])).toEqual(
      expect.any(Object),
    );
  });

  it("T-CORE-S21: the three tile states are the engine's, and nothing else parses", () => {
    expect(termoTileStateSchema.options).toEqual([
      "correct",
      "present",
      "absent",
    ]);
    expect(termoTileStateSchema.safeParse("held").success).toBe(false);
  });
});

describe("termoGuessWordSchema", () => {
  it("T-CORE-S21: accepts a NORMALIZED five-letter word and rejects everything else", () => {
    expect(termoGuessWordSchema.parse(WORD)).toBe(WORD);
    // The client normalizes before posting (ADR-0032's canonical wire), so an
    // accented or upper-case body is a client bug, not a lenient case.
    for (const rejected of [
      "CAFÉ",
      "cafe",
      "cafés",
      "café",
      "PRAGA",
      "pr aga",
    ]) {
      expect(
        termoGuessWordSchema.safeParse(rejected).success,
        `${rejected} must fail`,
      ).toBe(false);
    }
  });
});

describe("termoGuessRequestSchema", () => {
  const valid = { game: "termo", date: "2026-08-02", guesses: [WORD] };

  it("T-CORE-S21: parses a one-guess body and round-trips it unchanged", () => {
    expect(termoGuessRequestSchema.parse(valid)).toEqual(valid);
  });

  it("T-CORE-S21: bounds the list at 1..TERMO_MAX_GUESSES", () => {
    for (const length of [1, TERMO_MAX_GUESSES]) {
      expect(
        termoGuessRequestSchema.safeParse({
          ...valid,
          guesses: Array.from({ length }, () => WORD),
        }).success,
        `${String(length)} guesses must parse`,
      ).toBe(true);
    }
    for (const length of [0, TERMO_MAX_GUESSES + 1]) {
      expect(
        termoGuessRequestSchema.safeParse({
          ...valid,
          guesses: Array.from({ length }, () => WORD),
        }).success,
        `${String(length)} guesses must fail`,
      ).toBe(false);
    }
  });

  it("T-CORE-S21: `date` is calendarDateString — an impossible day and year 0 both fail", () => {
    // Client-supplied, so the shape check is not enough: "2026-02-30" reaches
    // a Postgres `date` column and raises 22008 (contracts/daily.ts).
    for (const date of ["2026-02-30", "0000-01-01", "2026-8-02", "nope"]) {
      expect(
        termoGuessRequestSchema.safeParse({ ...valid, date }).success,
        `${date} must fail`,
      ).toBe(false);
    }
  });

  it("T-CORE-S21: carries no tiles, no status and no smuggled key", () => {
    expect(Object.keys(termoGuessRequestSchema.shape).sort()).toEqual([
      "date",
      "game",
      "guesses",
    ]);
    for (const extra of [
      { tiles: [TILES] },
      { status: "won" },
      { answer: "praga" },
    ]) {
      expect(
        termoGuessRequestSchema.safeParse({ ...valid, ...extra }).success,
      ).toBe(false);
    }
  });
});

describe("termoGuessResponseSchema", () => {
  const playing: TermoGuessResponse = {
    game: "termo",
    date: "2026-08-02",
    tiles: [TILES],
    status: "playing",
  };

  it("T-CORE-S21: a playing board WITHOUT an answer parses; WITH one it fails", () => {
    expect(termoGuessResponseSchema.parse(playing)).toEqual(playing);
    expect(
      termoGuessResponseSchema.safeParse({ ...playing, answer: "praga" })
        .success,
    ).toBe(false);
  });

  it("T-CORE-S21: a closed board WITHOUT an answer fails; WITH one it parses", () => {
    for (const status of ["won", "lost"] as const) {
      expect(
        termoGuessResponseSchema.safeParse({ ...playing, status }).success,
        `${status} without an answer must fail`,
      ).toBe(false);
      const closed = { ...playing, status, answer: "praga" };
      expect(termoGuessResponseSchema.parse(closed)).toEqual(closed);
    }
  });

  it("T-CORE-S21: the answer is the CANONICAL accented spelling, not a normalized one", () => {
    // `z.string()`, deliberately unshaped beyond that: the reveal is
    // `content.canonical` (ADR-0015), which carries `ã`, `ç`, `é`, `ó` today
    // and may carry more after a regeneration.
    const accented = { ...playing, status: "won" as const, answer: "então" };
    expect(termoGuessResponseSchema.parse(accented).answer).toBe("então");
  });

  it("T-CORE-S21: `tiles` is bounded 1..TERMO_MAX_GUESSES and strict about its rows", () => {
    for (const length of [1, TERMO_MAX_GUESSES]) {
      expect(
        termoGuessResponseSchema.safeParse({
          ...playing,
          tiles: Array.from({ length }, () => TILES),
        }).success,
        `${String(length)} rows must parse`,
      ).toBe(true);
    }
    for (const tiles of [
      [],
      Array.from({ length: TERMO_MAX_GUESSES + 1 }, () => TILES),
      [["correct", "present", "absent", "absent"]],
    ]) {
      expect(
        termoGuessResponseSchema.safeParse({ ...playing, tiles }).success,
      ).toBe(false);
    }
  });

  it("T-CORE-S21: `date` is server-derived — a strict shape, and no extra key", () => {
    expect(
      termoGuessResponseSchema.safeParse({ ...playing, date: "2026-8-2" })
        .success,
    ).toBe(false);
    expect(
      termoGuessResponseSchema.safeParse({ ...playing, guesses: [WORD] })
        .success,
    ).toBe(false);
  });
});
