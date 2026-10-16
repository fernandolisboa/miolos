import {
  DAILY_MINESWEEPER_SIZE,
  minesweeperCompletionRequestSchema,
} from "@miolos/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { archiveCardStatus } from "../src/archive/card-status";
import { readDayState } from "../src/play/day-state";
import {
  ELAPSED_CAP_MS,
  isPlayedRecord,
  minesweeperPlayRecordSchema,
  WRITE_PROBE_BYTES,
  writePlayRecord,
  type MinesweeperPlayRecord,
  type TermoPlayRecord,
} from "../src/play/play-record";
import { buildShareText } from "../src/play/share-text";
import { messages } from "../src/i18n";

const DATE = "2026-10-16";
const CELLS = DAILY_MINESWEEPER_SIZE.rows * DAILY_MINESWEEPER_SIZE.columns;

function minesweeperRecord(
  overrides: Partial<MinesweeperPlayRecord> = {},
): MinesweeperPlayRecord {
  return {
    v: 1,
    game: "minesweeper",
    date: DATE,
    entries: Array.from({ length: CELLS }, (_unused, index) =>
      index < 40 ? 1 : 0,
    ),
    hit: null,
    elapsedMs: 95_000,
    hintsUsed: 0,
    concluded: true,
    pendingSync: true,
    syncOutcome: "pending",
    ...overrides,
  };
}

function termoRecord(outcome: "won" | "lost"): TermoPlayRecord {
  return {
    v: 1,
    game: "termo",
    date: DATE,
    guesses: [
      {
        guess: "TERMO",
        tiles: ["absent", "absent", "absent", "absent", "absent"],
      },
    ],
    answer: "PROVA",
    outcome,
    elapsedMs: 0,
    hintsUsed: 0,
    concluded: true,
    pendingSync: false,
    syncOutcome: "recorded",
  };
}

const requestInitSchema = z.object({ body: z.string() });

beforeEach(() => {
  window.localStorage.clear();
  vi.unstubAllGlobals();
  vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.example.test");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("the Campo Minado record holds the board, the hit and nothing of the field (T-WEB-S921)", () => {
  it("takes the board's cells from core's daily size", () => {
    expect(
      minesweeperPlayRecordSchema.safeParse(minesweeperRecord()).success,
    ).toBe(true);
    expect(
      minesweeperPlayRecordSchema.safeParse(
        minesweeperRecord({ entries: Array(CELLS - 1).fill(0) }),
      ).success,
    ).toBe(false);
    expect(
      minesweeperPlayRecordSchema.safeParse({
        ...minesweeperRecord(),
        entries: [...Array.from({ length: CELLS - 1 }, () => 0), 4],
      }).success,
    ).toBe(false);
  });

  it("writes the hit exactly when the board closes, inside the board", () => {
    const open = minesweeperRecord({ concluded: false, pendingSync: false });
    expect(
      minesweeperPlayRecordSchema.safeParse({ ...open, hit: undefined })
        .success,
    ).toBe(true);
    expect(minesweeperPlayRecordSchema.safeParse(open).success).toBe(false);
    expect(
      minesweeperPlayRecordSchema.safeParse(
        minesweeperRecord({ hit: undefined }),
      ).success,
    ).toBe(false);
    expect(
      minesweeperPlayRecordSchema.safeParse(minesweeperRecord({ hit: CELLS }))
        .success,
    ).toBe(false);
    expect(
      minesweeperPlayRecordSchema.safeParse({
        ...minesweeperRecord(),
        grid: [],
      }).success,
    ).toBe(false);
  });

  it("fits the write probe at its largest: every cell flagged, a hit and the elapsed cap", () => {
    const largest = minesweeperRecord({
      entries: Array(CELLS).fill(3),
      hit: CELLS - 1,
      elapsedMs: ELAPSED_CAP_MS,
      syncOutcome: "rejected",
    });
    expect(minesweeperPlayRecordSchema.parse(largest)).toEqual(largest);
    expect(JSON.stringify(largest).length).toBeLessThanOrEqual(
      WRITE_PROBE_BYTES,
    );
  });

  it.each([
    ["a win", null],
    ["a loss", 57],
  ] as const)(
    "posts %s as game, date, hit, time and no hints, never the board",
    async (_label, hit) => {
      writePlayRecord(minesweeperRecord({ hit }));
      const fetchMock = vi.fn((url: unknown) =>
        Promise.resolve(
          String(url).endsWith("/session")
            ? Response.json({ userId: crypto.randomUUID(), created: true })
            : Response.json({
                game: "minesweeper",
                date: DATE,
                outcome: hit === null ? "won" : "lost",
                onTime: true,
                recorded: true,
                elapsedMs: 95_000,
                hintsUsed: 0,
              }),
        ),
      );
      vi.stubGlobal("fetch", fetchMock);
      vi.resetModules();
      const { flushPendingCompletions } = await import("../src/play/sync");
      await flushPendingCompletions();

      const call = fetchMock.mock.calls.find((args) =>
        String(args[0]).endsWith("/completions"),
      ) as unknown[] | undefined;
      const raw: unknown = JSON.parse(requestInitSchema.parse(call?.[1]).body);
      expect(minesweeperCompletionRequestSchema.parse(raw)).toEqual({
        game: "minesweeper",
        date: DATE,
        hit,
        elapsedMs: 95_000,
        hintsUsed: 0,
      });
    },
  );
});

describe("a lost Campo Minado is played wherever a lost Termo is (T-WEB-S922)", () => {
  it("names played records: a lost Termo, a Campo Minado with a hit, and nothing open", () => {
    expect(isPlayedRecord(termoRecord("lost"))).toBe(true);
    expect(isPlayedRecord(termoRecord("won"))).toBe(false);
    expect(isPlayedRecord(minesweeperRecord({ hit: 12 }))).toBe(true);
    expect(isPlayedRecord(minesweeperRecord())).toBe(false);
    expect(
      isPlayedRecord(minesweeperRecord({ concluded: false, hit: undefined })),
    ).toBe(false);
  });

  it("marks the archive card and the day played, with no time", () => {
    expect(archiveCardStatus(minesweeperRecord({ hit: 12 }))).toBe("played");
    expect(archiveCardStatus(minesweeperRecord())).toBe("completed");

    writePlayRecord(minesweeperRecord({ hit: 12 }));
    expect(readDayState(DATE).minesweeper).toEqual({
      status: "played",
      elapsedMs: undefined,
    });
    writePlayRecord(minesweeperRecord());
    expect(readDayState(DATE).minesweeper).toEqual({
      status: "completed",
      elapsedMs: 95_000,
    });
  });

  it("shares a loss as played and a win by its time", () => {
    const url = "https://miolos.example/arquivo/2026-10-16/campo-minado";
    const lost = buildShareText(
      { game: "minesweeper", date: DATE, elapsedMs: 95_000, played: true },
      { url },
    );
    const won = buildShareText(
      { game: "minesweeper", date: DATE, elapsedMs: 95_000, played: false },
      { url },
    );
    expect(lost.split("\n")[1]).toBe(messages.share.played);
    expect(won.split("\n")[1]).toBe("01:35");
  });
});
