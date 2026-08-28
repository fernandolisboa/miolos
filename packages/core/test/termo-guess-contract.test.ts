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

const TILES: TermoTiles = ["correct", "present", "absent", "absent", "absent"];

const WORD = "praga";

describe("termoTilesSchema", () => {
  it("T-CORE-S18b: the restated bounds ARE the engine's WORD_LENGTH and MAX_GUESSES", () => {
    expect(TERMO_WORD_LENGTH).toBe(WORD_LENGTH);
    expect(TERMO_MAX_GUESSES).toBe(MAX_GUESSES);
  });

  it("T-CORE-S18b: the tuple's arity is the engine's WORD_LENGTH, by shape AND by behaviour", () => {
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

  it("T-CORE-S18b: a parsed row IS the engine's `TileStates`, with no `as`", () => {
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
