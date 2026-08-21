import { describe, expect, it } from "vitest";

import {
  bufferDepthResponseSchema,
  cronNotifyResponseSchema,
  cronPublishGameResultSchema,
  cronPublishResponseSchema,
  type BufferDepthResponse,
  type CronPublishGameResult,
  type CronPublishResponse,
} from "../src/index";

// T-CORE-S7 (plan 018 §15), extended to three games at #25 (T-CORE-S14, plan
// 020 §19) and to all four at #27 (T-CORE-S24, plan 022 §19.3). Both bodies
// were reshaped keyed BY GAME at #23 (S15) and both stayed `z.strictObject`
// on BOTH levels — the property this file exists to pin is that a game still
// has to widen the schema in the same PR that wires its top-up. A
// `z.array(...)` or a `gameSchema`-keyed record would parse a new game
// silently and lose exactly that.
//
// #27 RETARGETS the two negative cases for the second time. They rejected a
// third game key, then a fourth aimed at `termo`; `termo` is now wired, and
// `GAMES` is fully covered, so there is no fifth game to aim at. They aim at
// `crossword` — a real product word (the founding handoff's post-M2 game)
// that is deliberately NOT in `Game`. They must be retargeted again rather
// than deleted if a crossword ticket ever lands.
//
// The key ORDER below is the cron's, and it is COST-ASCENDING rather than
// alphabetical: termo first (a curated-word-list pick, 0.019 ms per cold
// week) before binairo (~7 ms), nonogram and sudoku.

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
    // One case per wired game: dropping any single key must fail, so a
    // future reshape cannot make one of the four optional by accident.
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
              // Termo's own drain mode, and the one that is a CONTENT fact
              // rather than an infrastructure one (ADR-0040 consequence (f)).
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
    // The key that was just added is the one whose alerting has never run.
    const drained: BufferDepthResponse = {
      depths: { termo: 7, binairo: 7, nonogram: 0, sudoku: 7 },
      threshold: 4,
      shallow: true,
    };
    expect(bufferDepthResponseSchema.parse(drained)).toEqual(drained);
  });

  it("carries the S16 failure mode for the key #27 just added: termo drained alone", () => {
    // Termo's drain is the one that can be a CONTENT fact — the word list
    // running out — rather than an infrastructure one, and the alert issue
    // it opens will read like a cron failure (ADR-0040 consequence (f)).
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

describe("cronNotifyResponseSchema (#146, ADR-0067 decision 4)", () => {
  it("T-CORE-S107: strict — an unknown key, a missing counter, a negative and a fractional count are all rejected; a legal tick body round-trips", () => {
    const tick = {
      candidates: 3,
      claimed: 2,
      sent: 2,
      pruned: 1,
      failed: 0,
    };
    expect(cronNotifyResponseSchema.parse(tick)).toEqual(tick);
    // Zero across the board is the expected first-tick reality, and legal.
    expect(
      cronNotifyResponseSchema.parse({
        candidates: 0,
        claimed: 0,
        sent: 0,
        pruned: 0,
        failed: 0,
      }).sent,
    ).toBe(0);
    // Strict: an appended key fails every deployed reader's parse.
    expect(
      cronNotifyResponseSchema.safeParse({ ...tick, skipped: 1 }).success,
    ).toBe(false);
    // A missing counter fails — the route can never under-report a field.
    const { failed: _failed, ...missing } = tick;
    expect(cronNotifyResponseSchema.safeParse(missing).success).toBe(false);
    // Counts are non-negative integers.
    expect(
      cronNotifyResponseSchema.safeParse({ ...tick, sent: -1 }).success,
    ).toBe(false);
    expect(
      cronNotifyResponseSchema.safeParse({ ...tick, pruned: 1.5 }).success,
    ).toBe(false);
  });
});
