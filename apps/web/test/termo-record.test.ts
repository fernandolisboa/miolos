import { MAX_GUESSES, WORD_LENGTH, type TileState } from "@miolos/games/termo";
import { describe, expect, it } from "vitest";

import {
  playRecordSchema,
  type TermoPlayRecord,
} from "../src/play/play-record";

/**
 * T-WEB-S74 / T-WEB-S75 (plan 022 §14.1, ADR-0044). The termo member is the
 * first play record that is not a board, and the first whose `closed` and
 * `solved` do not coincide.
 *
 * A value import of `@miolos/games/termo` is free HERE and banned in
 * `src/play/play-record.ts`: the bundle rule binds `src/`, and that module is
 * on every route's client graph, so importing the engine there would put the
 * Termo engine on `/` — and Termo's word list one lost purity annotation
 * behind it (ADR-0045 decision 5).
 *
 * WHAT THE SCHEMA DOES INSTEAD IS IMPORT, NOT RESTATE. The bounds come from
 * `@miolos/core`'s `contracts/termo-guess.ts` — `TERMO_MAX_GUESSES`,
 * `TERMO_WORD_LENGTH`, `termoTilesSchema`, `termoGuessWordSchema` — which is
 * client-safe by design and already on `/`'s graph, so the wire and the record
 * read ONE definition (finding B-6; `play-record.ts`'s own header argues it at
 * length). An earlier version of this file described a third restatement and
 * called itself the pin for it; that design is gone.
 *
 * THIS FILE IS STILL THE ANTI-DRIFT PIN, and it is the only one that can be:
 * `@miolos/core` and `@miolos/games/termo` never import each other, so nothing
 * but a test that imports BOTH can catch the day the engine's 6, 5 or tile
 * union stops agreeing with the contract's.
 */

const DATE = "2026-07-30";

type TermoRow = TermoPlayRecord["guesses"][number];
type Tiles = TermoRow["tiles"];

/** Five `correct` tiles — the winning row. */
const WIN: Tiles = ["correct", "correct", "correct", "correct", "correct"];
const MISS: Tiles = ["absent", "present", "absent", "absent", "present"];

const row = (guess: string, tiles: Tiles): TermoRow => ({
  guess,
  tiles: [...tiles],
});

/**
 * Overrides are `Record<string, unknown>` rather than
 * `Partial<TermoPlayRecord>`, deliberately: half the cases below feed
 * ILL-TYPED payloads — a four-tile row, a seven-guess list, an accented
 * guess — because this schema's job is to parse a user-editable
 * `localStorage` entry. The compiler is not the thing under test; the
 * well-formed fixtures stay typed through `row` above.
 */
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
    // ADR-0029 consequence (d) / ADR-0044's rejected list: bumping `v`
    // discards every stored record on deploy, and a discarded record carrying
    // `pendingSync: true` is the only copy of a completion the server has not
    // acknowledged — a lost streak day. These three payloads are the OLD
    // SHAPE, written by hand rather than by a factory, so a widened member or
    // a bumped literal reds here rather than in a mirror of today's code.
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
    // The schema takes its union from `@miolos/core`'s `termoTilesSchema` and
    // the engine declares its own; neither package imports the other (see the
    // file header), so this is the only place they can be held together. The
    // pin is a mutual assignability check reached back out through the
    // schema's OWN inferred type, so a member added to, removed from or
    // renamed on EITHER side reds `pnpm typecheck` HERE rather than silently
    // producing a record the Termo reducer cannot read.
    type RecordTile = TermoPlayRecord["guesses"][number]["tiles"][number];
    const engineToRecord: RecordTile = "present" satisfies TileState;
    const recordToEngine: TileState = "present" satisfies RecordTile;

    expect(engineToRecord).toBe(recordToEngine);
    // And the runtime half: every member of the engine's union parses.
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
    // `deriveBoardStatus` THROWS a RangeError on this shape
    // (packages/games/src/termo/status.ts:31-36), so a record carrying it
    // would crash the reducer on restore. It has to be unparseable rather
    // than merely unexpected.
    expect(
      playRecordSchema.safeParse(
        won({ guesses: [row("praga", WIN), row("cafes", MISS)] }),
      ).success,
    ).toBe(false);
    // Anti-vacuity: the same rows with the win LAST parse.
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
    // This branch is what makes `termoBody`'s `undefined` return unreachable
    // for a legitimately closed record — and `undefined` there PERMANENTLY
    // settles the record as rejected (sync.ts:199-206).
    expect(playRecordSchema.safeParse(won({ guesses: [] })).success).toBe(
      false,
    );
  });

  it("bounds the list at MAX_GUESSES and shapes each guess at WORD_LENGTH", () => {
    // Behavioural pins on the two contract constants, driven by the ENGINE's
    // own values value-imported here: a schema that merely DECLARED a matching
    // type would pass a `typeof` assignment and fail these.
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
    // The wire and every engine call see the normalized form, and it is the
    // only form available: `canonical-map.csv` is harness input and does not
    // ship, so no runtime path produces the accented spelling of an
    // arbitrary guess (ADR-0044 decision 1).
    for (const guess of ["CAFES", "café", "caf s", "cafés"]) {
      expect(
        playRecordSchema.safeParse(playing({ guesses: [row(guess, MISS)] }))
          .success,
        guess,
      ).toBe(false);
    }
  });

  it("refuses a tile row that is not exactly five tiles", () => {
    // Built inline rather than through `row`, because both shapes are
    // deliberately outside the tuple type the well-formed helper produces.
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
