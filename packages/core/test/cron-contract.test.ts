import { describe, expect, it } from "vitest";

import {
  bufferDepthResponseSchema,
  cronPublishGameResultSchema,
  cronPublishResponseSchema,
  type BufferDepthResponse,
  type CronPublishGameResult,
  type CronPublishResponse,
} from "../src/index";

// T-CORE-S7 (plan 018 §15), extended to three games at #25 (T-CORE-S14, plan
// 020 §19). Both bodies were reshaped keyed BY GAME at #23 (S15) and both
// stayed `z.strictObject` on BOTH levels — the property this file exists to
// pin is that the NEXT game still has to widen the schema in the same PR that
// wires its top-up. A `z.array(...)` or a `gameSchema`-keyed record would
// parse a new game silently and lose exactly that. The two "rejects a third
// game key" cases are therefore rewritten rather than deleted: they now
// reject a FOURTH, aimed at termo, which is the game the contracts genuinely
// do not carry.

const healthy: CronPublishGameResult = {
  generated: 3,
  depth: 7,
  failures: [],
  error: null,
};

const body: CronPublishResponse = {
  games: { binairo: healthy, nonogram: healthy, sudoku: healthy },
};

describe("cronPublishResponseSchema", () => {
  it("parses and round-trips a three-game body", () => {
    expect(cronPublishResponseSchema.parse(body)).toEqual(body);
  });

  it("rejects a fourth game key — the extension point survives the reshape", () => {
    const withTermo = {
      games: { ...body.games, termo: healthy },
    };
    expect(cronPublishResponseSchema.safeParse(withTermo).success).toBe(false);
  });

  it("rejects a body missing a wired game", () => {
    expect(
      cronPublishResponseSchema.safeParse({
        games: { binairo: healthy, sudoku: healthy },
      }).success,
    ).toBe(false);
    expect(
      cronPublishResponseSchema.safeParse({
        games: { nonogram: healthy, sudoku: healthy },
      }).success,
    ).toBe(false);
    expect(
      cronPublishResponseSchema.safeParse({
        games: { binairo: healthy, nonogram: healthy },
      }).success,
    ).toBe(false);
  });

  it("rejects an extra top-level key (strict on both levels)", () => {
    expect(
      cronPublishResponseSchema.safeParse({ ...body, game: "binairo" }).success,
    ).toBe(false);
  });

  it("carries a per-date failure and an escaped-throw message on the same shape", () => {
    const degraded: CronPublishResponse = {
      games: {
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
    // The reason `error` exists at all (§7.2/C2): a run-level message has
    // nowhere else to go that still strict-parses.
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
    depths: { binairo: 7, nonogram: 7, sudoku: 7 },
    threshold: 4,
    shallow: false,
  };

  it("parses and round-trips a three-game body", () => {
    expect(bufferDepthResponseSchema.parse(depths)).toEqual(depths);
  });

  it("rejects a fourth game key — the extension point survives the reshape", () => {
    const withTermo = {
      ...depths,
      depths: { ...depths.depths, termo: 7 },
    };
    expect(bufferDepthResponseSchema.safeParse(withTermo).success).toBe(false);
  });

  it("rejects a body missing a wired game", () => {
    expect(
      bufferDepthResponseSchema.safeParse({ ...depths, depths: { binairo: 7 } })
        .success,
    ).toBe(false);
    expect(
      bufferDepthResponseSchema.safeParse({
        ...depths,
        depths: { binairo: 7, sudoku: 7 },
      }).success,
    ).toBe(false);
  });

  it("carries the S16 failure mode: one game drained, shallow true", () => {
    const drained: BufferDepthResponse = {
      depths: { binairo: 7, nonogram: 7, sudoku: 0 },
      threshold: 4,
      shallow: true,
    };
    expect(bufferDepthResponseSchema.parse(drained)).toEqual(drained);
  });

  it("carries the S16 failure mode for the key #25 just added: nonogram drained alone", () => {
    // The key that was just added is the one whose alerting has never run.
    const drained: BufferDepthResponse = {
      depths: { binairo: 7, nonogram: 0, sudoku: 7 },
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
        depths: { binairo: -1, nonogram: 7, sudoku: 7 },
      }).success,
    ).toBe(false);
  });
});
