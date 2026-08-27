import { MAX_GUESSES, WORD_LENGTH, type TileState } from "@miolos/games/termo";
import { describe, expect, it } from "vitest";

import {
  playRecordSchema,
  type TermoPlayRecord,
} from "../src/play/play-record";

const DATE = "2026-07-30";

type TermoRow = TermoPlayRecord["guesses"][number];
type Tiles = TermoRow["tiles"];

const WIN: Tiles = ["correct", "correct", "correct", "correct", "correct"];
const MISS: Tiles = ["absent", "present", "absent", "absent", "present"];

const row = (guess: string, tiles: Tiles): TermoRow => ({
  guess,
  tiles: [...tiles],
});

function playing(overrides: Record<string, unknown> = {}): unknown {
  return {
    v: 1,
    game: "termo",
    date: DATE,
    guesses: [row("cafes", MISS)],
    elapsedMs: 61_000,
    hintsUsed: 0,
    concluded: false,
    pendingSync: false,
    syncOutcome: "pending",
    ...overrides,
  };
}

function won(overrides: Record<string, unknown> = {}): unknown {
  return playing({
    guesses: [row("cafes", MISS), row("praga", WIN)],
    answer: "praga",
    outcome: "won",
    concluded: true,
    pendingSync: true,
    ...overrides,
  });
}

describe("the termo play record (T-WEB-S74)", () => {
  it("round-trips a full six-guess loss and routes the union on `game`", () => {
    const LETTERS = "abcdef";
    const guesses = Array.from({ length: MAX_GUESSES }, (_unused, index) =>
      row(LETTERS.charAt(index).repeat(WORD_LENGTH), MISS),
    );
    const parsed = playRecordSchema.parse(
      playing({
        guesses,
        answer: "praga",
        outcome: "lost",
        concluded: true,
        pendingSync: true,
      }),
    );

    expect(parsed.game).toBe("termo");
    if (parsed.game !== "termo") {
      throw new Error(
        "the discriminated union routed a termo record elsewhere",
      );
    }
    expect(parsed.guesses).toHaveLength(MAX_GUESSES);
    expect(parsed.guesses[0]?.tiles).toEqual([...MISS]);
    expect(parsed.outcome).toBe("lost");
    expect(parsed.answer).toBe("praga");
  });

  it("keeps `v` at 1, so every record written before #27 still parses", () => {
    const shipped: readonly unknown[] = [
      {
        v: 1,
        game: "binairo",
        date: DATE,
        entries: Array.from({ length: 64 }, () => null),
        elapsedMs: 272_000,
        hintsUsed: 1,
        concluded: false,
        pendingSync: false,
        syncOutcome: "pending",
      },
      {
        v: 1,
        game: "sudoku",
        date: DATE,
        entries: Array.from({ length: 81 }, () => null),
        grid: Array.from({ length: 9 }, () => [
          1, 2, 3, 4, 5, 6, 7, 8, 9,
        ]).flat(),
        elapsedMs: 411_000,
        hintsUsed: 0,
        concluded: true,
        pendingSync: true,
        syncOutcome: "pending",
      },
      {
        v: 1,
        game: "nonogram",
        date: DATE,
        size: 5,
        entries: Array.from({ length: 25 }, (_unused, index) =>
          index % 6 === 0 ? 1 : null,
        ),
        grid: Array.from({ length: 25 }, (_unused, index) =>
          index % 6 === 0 ? 1 : 0,
        ),
        elapsedMs: 133_000,
        hintsUsed: 0,
        concluded: true,
        pendingSync: true,
        syncOutcome: "pending",
      },
    ];

    for (const payload of shipped) {
      const parsed = playRecordSchema.safeParse(payload);
      expect(parsed.success, JSON.stringify(payload).slice(0, 60)).toBe(true);
      expect(parsed.data?.v).toBe(1);
    }
  });

  it("pins the restated tile union against the engine's, in both directions", () => {
    type RecordTile = TermoPlayRecord["guesses"][number]["tiles"][number];
    const engineToRecord: RecordTile = "present" satisfies TileState;
    const recordToEngine: TileState = "present" satisfies RecordTile;

    expect(engineToRecord).toBe(recordToEngine);

    for (const tile of ["correct", "present", "absent"] satisfies TileState[]) {
      expect(
        playRecordSchema.safeParse(
          playing({ guesses: [row("cafes", [tile, tile, tile, tile, tile])] }),
        ).success,
      ).toBe(true);
    }
  });
});

describe("the termo record's superRefine (T-WEB-S75)", () => {
  it("refuses a guess that follows a winning row", () => {
    expect(
      playRecordSchema.safeParse(
        won({ guesses: [row("praga", WIN), row("cafes", MISS)] }),
      ).success,
    ).toBe(false);

    expect(playRecordSchema.safeParse(won()).success).toBe(true);
  });

  it("writes `answer` exactly when the board closes, both directions", () => {
    expect(
      playRecordSchema.safeParse(playing({ answer: "praga" })).success,
    ).toBe(false);
    expect(playRecordSchema.safeParse(won({ answer: undefined })).success).toBe(
      false,
    );
  });

  it("writes `outcome` exactly when the board closes, both directions", () => {
    expect(
      playRecordSchema.safeParse(playing({ outcome: "won" })).success,
    ).toBe(false);
    expect(
      playRecordSchema.safeParse(won({ outcome: undefined })).success,
    ).toBe(false);
  });

  it("refuses a closed board with no judged guess at all", () => {
    expect(playRecordSchema.safeParse(won({ guesses: [] })).success).toBe(
      false,
    );
  });

  it("bounds the list at MAX_GUESSES and shapes each guess at WORD_LENGTH", () => {
    const over = Array.from({ length: MAX_GUESSES + 1 }, () =>
      row("cafes", MISS),
    );
    expect(playRecordSchema.safeParse(playing({ guesses: over })).success).toBe(
      false,
    );
    expect(
      playRecordSchema.safeParse(
        playing({ guesses: over.slice(0, MAX_GUESSES) }),
      ).success,
    ).toBe(true);

    const short = "a".repeat(WORD_LENGTH - 1);
    const long = "a".repeat(WORD_LENGTH + 1);
    const exact = "a".repeat(WORD_LENGTH);
    expect(
      playRecordSchema.safeParse(playing({ guesses: [row(short, MISS)] }))
        .success,
    ).toBe(false);
    expect(
      playRecordSchema.safeParse(playing({ guesses: [row(long, MISS)] }))
        .success,
    ).toBe(false);
    expect(
      playRecordSchema.safeParse(playing({ guesses: [row(exact, MISS)] }))
        .success,
    ).toBe(true);
  });

  it("refuses a NORMALIZED guess that is not five lower-case a-z letters", () => {
    for (const guess of ["CAFES", "café", "caf s", "cafés"]) {
      expect(
        playRecordSchema.safeParse(playing({ guesses: [row(guess, MISS)] }))
          .success,
        guess,
      ).toBe(false);
    }
  });

  it("refuses a tile row that is not exactly five tiles", () => {
    expect(
      playRecordSchema.safeParse(
        playing({ guesses: [{ guess: "cafes", tiles: MISS.slice(0, 4) }] }),
      ).success,
    ).toBe(false);
    expect(
      playRecordSchema.safeParse(
        playing({ guesses: [{ guess: "cafes", tiles: [...MISS, "absent"] }] }),
      ).success,
    ).toBe(false);
  });
});
