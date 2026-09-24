import { describe, expect, it } from "vitest";

import {
  bufferDepthResponseSchema,
  cronNotifyResponseSchema,
  cronPublishGameResultSchema,
  cronPublishResponseSchema,
  streakReminderSchema,
  type BufferDepthResponse,
  type CronPublishGameResult,
  type CronPublishResponse,
} from "../src/index";

const healthy: CronPublishGameResult = {
  generated: 3,
  depth: 7,
  failures: [],
  error: null,
};

const body: CronPublishResponse = {
  games: {
    termo: healthy,
    binairo: healthy,
    nonogram: healthy,
    sudoku: healthy,
  },
};

describe("cronPublishResponseSchema", () => {
  it("parses and round-trips a four-game body", () => {
    expect(cronPublishResponseSchema.parse(body)).toEqual(body);
  });

  it("rejects an unknown game key — the extension point survives the last v1 game", () => {
    const withCrossword = {
      games: { ...body.games, crossword: healthy },
    };
    expect(cronPublishResponseSchema.safeParse(withCrossword).success).toBe(
      false,
    );
  });

  it("rejects a body missing a wired game", () => {
    for (const missing of ["termo", "binairo", "nonogram", "sudoku"] as const) {
      const games = { ...body.games };
      delete games[missing];
      expect(
        cronPublishResponseSchema.safeParse({ games }).success,
        `dropping ${missing} must fail`,
      ).toBe(false);
    }
  });

  it("rejects an extra top-level key (strict on both levels)", () => {
    expect(
      cronPublishResponseSchema.safeParse({ ...body, game: "binairo" }).success,
    ).toBe(false);
  });

  it("carries a per-date failure and an escaped-throw message on the same shape", () => {
    const degraded: CronPublishResponse = {
      games: {
        termo: {
          generated: 5,
          depth: 5,
          failures: [
            {
              date: "2026-08-10",

              reason:
                "answer list exhausted: every curated Termo answer is already used",
            },
          ],
          error: null,
        },
        binairo: {
          generated: 0,
          depth: 0,
          failures: [],
          error: "Error: connection terminated",
        },
        nonogram: {
          generated: 7,
          depth: 7,
          failures: [],
          error: null,
        },
        sudoku: {
          generated: 6,
          depth: 6,
          failures: [{ date: "2026-08-09", reason: "seed-retries-exhausted" }],
          error: null,
        },
      },
    };
    expect(cronPublishResponseSchema.parse(degraded)).toEqual(degraded);
  });

  it("keeps failures[].date an isoDateString, so an aborted run cannot report through it", () => {
    expect(
      cronPublishGameResultSchema.safeParse({
        ...healthy,
        failures: [{ date: "*", reason: "the whole game threw" }],
      }).success,
    ).toBe(false);
  });

  it("rejects a missing error field — null is explicit, never absent", () => {
    expect(
      cronPublishGameResultSchema.safeParse({
        generated: 0,
        depth: 7,
        failures: [],
      }).success,
    ).toBe(false);
  });
});

describe("bufferDepthResponseSchema", () => {
  const depths: BufferDepthResponse = {
    depths: { termo: 7, binairo: 7, nonogram: 7, sudoku: 7 },
    threshold: 4,
    shallow: false,
  };

  it("parses and round-trips a four-game body", () => {
    expect(bufferDepthResponseSchema.parse(depths)).toEqual(depths);
  });

  it("rejects an unknown game key — the extension point survives the last v1 game", () => {
    const withCrossword = {
      ...depths,
      depths: { ...depths.depths, crossword: 7 },
    };
    expect(bufferDepthResponseSchema.safeParse(withCrossword).success).toBe(
      false,
    );
  });

  it("rejects a body missing a wired game", () => {
    for (const missing of ["termo", "binairo", "nonogram", "sudoku"] as const) {
      const remaining = { ...depths.depths };
      delete remaining[missing];
      expect(
        bufferDepthResponseSchema.safeParse({ ...depths, depths: remaining })
          .success,
        `dropping ${missing} must fail`,
      ).toBe(false);
    }
  });

  it("carries the S16 failure mode: one game drained, shallow true", () => {
    const drained: BufferDepthResponse = {
      depths: { termo: 7, binairo: 7, nonogram: 7, sudoku: 0 },
      threshold: 4,
      shallow: true,
    };
    expect(bufferDepthResponseSchema.parse(drained)).toEqual(drained);
  });

  it("carries the S16 failure mode for the key #25 just added: nonogram drained alone", () => {
    const drained: BufferDepthResponse = {
      depths: { termo: 7, binairo: 7, nonogram: 0, sudoku: 7 },
      threshold: 4,
      shallow: true,
    };
    expect(bufferDepthResponseSchema.parse(drained)).toEqual(drained);
  });

  it("carries the S16 failure mode for the key #27 just added: termo drained alone", () => {
    const drained: BufferDepthResponse = {
      depths: { termo: 0, binairo: 7, nonogram: 7, sudoku: 7 },
      threshold: 4,
      shallow: true,
    };
    expect(bufferDepthResponseSchema.parse(drained)).toEqual(drained);
  });

  it("rejects a non-positive threshold and a negative depth", () => {
    expect(
      bufferDepthResponseSchema.safeParse({ ...depths, threshold: 0 }).success,
    ).toBe(false);
    expect(
      bufferDepthResponseSchema.safeParse({
        ...depths,
        depths: { termo: 7, binairo: -1, nonogram: 7, sudoku: 7 },
      }).success,
    ).toBe(false);
    expect(
      bufferDepthResponseSchema.safeParse({
        ...depths,
        depths: { termo: -1, binairo: 7, nonogram: 7, sudoku: 7 },
      }).success,
    ).toBe(false);
  });
});

describe("cronNotifyResponseSchema (#146, ADR-0068 decision 4; per channel at #199, ADR-0079)", () => {
  const tick = {
    push: { candidates: 3, claimed: 2, sent: 2, pruned: 1, failed: 0 },
    email: { candidates: 1, claimed: 1, sent: 1, failed: 0 },
  };

  it("T-CORE-S107: strict — an unknown key, a missing counter, a negative and a fractional count are all rejected; a legal tick body round-trips", () => {
    expect(cronNotifyResponseSchema.parse(tick)).toEqual(tick);

    expect(
      cronNotifyResponseSchema.safeParse({
        ...tick,
        push: { ...tick.push, skipped: 1 },
      }).success,
    ).toBe(false);

    expect(
      cronNotifyResponseSchema.safeParse({
        ...tick,
        push: { candidates: 3, claimed: 2, sent: 2, pruned: 1 },
      }).success,
    ).toBe(false);

    expect(
      cronNotifyResponseSchema.safeParse({
        ...tick,
        push: { ...tick.push, sent: -1 },
      }).success,
    ).toBe(false);
    expect(
      cronNotifyResponseSchema.safeParse({
        ...tick,
        push: { ...tick.push, pruned: 1.5 },
      }).success,
    ).toBe(false);
  });

  it("T-CORE-S116: both channels are required, email has no pruned counter, and the pre-#199 flat body no longer parses", () => {
    expect(
      cronNotifyResponseSchema.safeParse({ push: tick.push }).success,
    ).toBe(false);
    expect(
      cronNotifyResponseSchema.safeParse({
        ...tick,
        email: { ...tick.email, pruned: 0 },
      }).success,
    ).toBe(false);
    expect(cronNotifyResponseSchema.safeParse(tick.push).success).toBe(false);
  });
});

describe("streakReminderSchema (#199, ADR-0079)", () => {
  it("T-CORE-S117: an address and a streak of at least one day, nothing else", () => {
    const reminder = { to: "ana@example.org", streak: 3 };
    expect(streakReminderSchema.parse(reminder)).toEqual(reminder);
    expect(
      streakReminderSchema.safeParse({ ...reminder, streak: 0 }).success,
    ).toBe(false);
    expect(
      streakReminderSchema.safeParse({ ...reminder, to: "not-an-address" })
        .success,
    ).toBe(false);
    expect(
      streakReminderSchema.safeParse({ ...reminder, body: "promo" }).success,
    ).toBe(false);
  });
});
