import type { DailyBinairoResponse } from "@miolos/core";
import { generateBinairo } from "@miolos/games/binairo";
import { describe, expect, it } from "vitest";

import type { BinairoPlayRecord } from "../src/play/play-record";
import { elapsedMs } from "../src/play/timer";
import {
  initPlayState,
  isSolvedGrid,
  mergedGrid,
  playReducer,
  type PlayState,
} from "../src/binairo/state";

const EMPTY_GIVENS: DailyBinairoResponse["givens"] = Array.from(
  { length: 64 },
  () => null,
);

function daily(
  givens: DailyBinairoResponse["givens"] = EMPTY_GIVENS,
  date = "2026-07-30",
): DailyBinairoResponse {
  return { game: "binairo", date, size: 8, givens };
}

function tap(state: PlayState, ...indices: number[]): PlayState {
  return indices.reduce(
    (current, index) => playReducer(current, { type: "tap", index }),
    state,
  );
}

const REAL_PUZZLE = generateBinairo({ seed: 20_260_730, weekday: 3 });

function record(overrides: Partial<BinairoPlayRecord> = {}): BinairoPlayRecord {
  return {
    v: 1,
    game: "binairo",
    date: "2026-07-30",
    entries: Array.from({ length: 64 }, () => null),
    elapsedMs: 0,
    hintsUsed: 0,
    concluded: false,
    pendingSync: false,
    syncOutcome: "pending",
    ...overrides,
  };
}

describe("initPlayState", () => {
  it("is the deterministic server snapshot: no record, no clock (D28)", () => {
    const state = initPlayState(daily());

    expect(state.hydrated).toBe(false);
    expect(state.date).toBe("2026-07-30");
    expect(state.entries).toEqual(EMPTY_GIVENS);
    expect(state.now).toBe(0);
    expect(elapsedMs(state.timer, state.now)).toBe(0);
    expect(state.timer.runningSince).toBeNull();
    expect(state.paint).toEqual({ kind: "cycle" });
    expect(state.hint).toEqual({ free: 1, used: 0, lastIndex: null });
    expect(state.violating.size).toBe(0);
    expect(state.status).toBe("playing");
    expect(state.pendingSync).toBe(false);
  });
});

describe("tap — the cell state machine (D7)", () => {
  it("cycles empty → 0 → 1 → empty in cycle mode", () => {
    let state = initPlayState(daily());

    state = tap(state, 5);
    expect(state.entries[5]).toBe(0);
    state = tap(state, 5);
    expect(state.entries[5]).toBe(1);
    state = tap(state, 5);
    expect(state.entries[5]).toBeNull();
  });

  it("never changes a given", () => {
    const givens = [...EMPTY_GIVENS];
    givens[0] = 1;
    const state = tap(initPlayState(daily(givens)), 0, 0, 0);

    expect(state.entries[0]).toBeNull();
    expect(mergedGrid(state)[0]).toBe(1);
  });

  it("sets the value directly in paint mode and clears it on a re-tap", () => {
    let state = playReducer(initPlayState(daily()), {
      type: "set-mode",
      mode: { kind: "paint", value: 1 },
    });

    state = tap(state, 9);
    expect(state.entries[9]).toBe(1);
    state = tap(state, 9);
    expect(state.entries[9]).toBeNull();
  });

  it("clears in erase mode whatever the cell held", () => {
    let state = tap(initPlayState(daily()), 3, 3);
    expect(state.entries[3]).toBe(1);

    state = playReducer(state, { type: "set-mode", mode: { kind: "erase" } });
    state = tap(state, 3);
    expect(state.entries[3]).toBeNull();
  });
});

describe("paint-over — the drag path (T-WEB-12b)", () => {
  it("is a no-op in cycle mode: cycling on drag is chaos (D8)", () => {
    const state = playReducer(initPlayState(daily()), {
      type: "paint-over",
      index: 4,
    });

    expect(state.entries[4]).toBeNull();
  });

  it("sets, never toggles, and is idempotent over the same cell in paint mode", () => {
    let state = playReducer(initPlayState(daily()), {
      type: "set-mode",
      mode: { kind: "paint", value: 0 },
    });

    state = playReducer(state, { type: "paint-over", index: 7 });
    state = playReducer(state, { type: "paint-over", index: 7 });

    expect(state.entries[7]).toBe(0);
  });

  it("clears in erase mode and leaves givens alone in every mode", () => {
    const givens = [...EMPTY_GIVENS];
    givens[2] = 0;
    let state = playReducer(initPlayState(daily(givens)), {
      type: "set-mode",
      mode: { kind: "paint", value: 1 },
    });

    state = playReducer(state, { type: "paint-over", index: 2 });
    expect(state.entries[2]).toBeNull();

    state = tap(state, 11);
    expect(state.entries[11]).toBe(1);
    state = playReducer(state, { type: "set-mode", mode: { kind: "erase" } });
    state = playReducer(state, { type: "paint-over", index: 11 });
    expect(state.entries[11]).toBeNull();
    state = playReducer(state, { type: "paint-over", index: 2 });
    expect(mergedGrid(state)[2]).toBe(0);
  });
});

describe("set-mode", () => {
  it("swaps the sticky paint mode without touching the grid", () => {
    const filled = tap(initPlayState(daily()), 1);
    const state = playReducer(filled, {
      type: "set-mode",
      mode: { kind: "paint", value: 1 },
    });

    expect(state.paint).toEqual({ kind: "paint", value: 1 });
    expect(state.entries).toEqual(filled.entries);
  });
});

describe("local validation (D11, T-WEB-12)", () => {
  it("flags a third identical digit the moment it lands and clears it on removal", () => {
    let state = tap(initPlayState(daily()), 0, 1, 2);

    expect([...state.violating].toSorted()).toEqual([0, 1, 2]);

    state = tap(state, 2);
    expect(state.violating.size).toBe(0);
  });

  it("never blocks further entry while a violation stands", () => {
    let state = tap(initPlayState(daily()), 0, 1, 2);
    expect(state.violating.size).toBeGreaterThan(0);

    state = tap(state, 3);
    expect(state.entries[3]).toBe(0);
  });
});

describe("completion detection (D12, T-WEB-13)", () => {
  function fillFromSolution(indices: readonly number[]): PlayState {
    const givens = [...REAL_PUZZLE.givens];
    let state = initPlayState(daily(givens));
    for (const index of indices) {
      const target = REAL_PUZZLE.solution[index];
      if (REAL_PUZZLE.givens[index] !== null || target === undefined) {
        continue;
      }

      state = tap(state, index);
      if (target === 1) {
        state = tap(state, index);
      }
    }
    return state;
  }

  const allIndices = Array.from({ length: 64 }, (_unused, index) => index);

  it("flips to solved only when the merged grid is complete AND rule-valid", () => {
    const state = fillFromSolution(allIndices);

    expect(isSolvedGrid(mergedGrid(state))).toBe(true);
    expect(state.status).toBe("solved");
    expect(state.pendingSync).toBe(true);
  });

  it("stays playing on a full but wrong grid", () => {
    const solved = fillFromSolution(allIndices);

    const flipped = allIndices.find(
      (index) =>
        REAL_PUZZLE.givens[index] === null && REAL_PUZZLE.solution[index] === 0,
    );
    expect(flipped).toBeDefined();
    const wrong = tap(solved, flipped ?? 0);

    expect(isSolvedGrid(mergedGrid(wrong))).toBe(true);
    expect(wrong.violating.size).toBeGreaterThan(0);
    expect(wrong.status).toBe("playing");
  });

  it("leaves an incomplete grid playing even with no violations", () => {
    const state = fillFromSolution(allIndices.slice(0, 8));

    expect(state.violating.size).toBe(0);
    expect(state.status).toBe("playing");
    expect(state.pendingSync).toBe(false);
  });
});

describe("use-hint (§10.3)", () => {
  it("writes the solution's value, spends the one free hint and marks the cell", () => {
    const givens = [...REAL_PUZZLE.givens];
    const first = playReducer(initPlayState(daily(givens)), {
      type: "use-hint",
      solution: REAL_PUZZLE.solution,
    });

    expect(first.hint.used).toBe(1);
    expect(first.hint.lastIndex).not.toBeNull();
    const index = first.hint.lastIndex ?? -1;
    expect(first.entries[index]).toBe(REAL_PUZZLE.solution[index]);

    const second = playReducer(first, {
      type: "use-hint",
      solution: REAL_PUZZLE.solution,
    });
    expect(second).toBe(first);
  });
});

describe("timer (D10, §8.3, T-WEB-14)", () => {
  const running = (state: PlayState, now: number) =>
    playReducer(state, { type: "resume", now });
  const paused = (state: PlayState, now: number) =>
    playReducer(state, { type: "pause", now });

  it("accumulates only the running segments", () => {
    let state = initPlayState(daily());
    state = running(state, 1_000);
    state = paused(state, 6_000);
    expect(elapsedMs(state.timer, 999_999)).toBe(5_000);

    state = running(state, 10_000);
    expect(elapsedMs(state.timer, 12_000)).toBe(7_000);
  });

  it("resume is idempotent: a second resume never discards the running segment", () => {
    let state = initPlayState(daily());
    state = running(state, 1_000);
    state = running(state, 4_000);
    state = paused(state, 6_000);

    expect(elapsedMs(state.timer, 999_999)).toBe(5_000);
  });

  it("pause is idempotent: visibilitychange then pagehide must not double-count", () => {
    let state = initPlayState(daily());
    state = running(state, 1_000);
    state = paused(state, 6_000);
    state = paused(state, 9_000);

    expect(elapsedMs(state.timer, 999_999)).toBe(5_000);
  });

  it("pagehide then pageshow with no visibilitychange leaves the clock running (bfcache)", () => {
    let state = initPlayState(daily());
    state = running(state, 1_000);
    state = paused(state, 3_000);
    state = running(state, 60_000);

    expect(state.timer.runningSince).toBe(60_000);
    expect(elapsedMs(state.timer, 61_000)).toBe(3_000);
  });

  it("tick moves the clock reference and never accumulates by itself", () => {
    let state = initPlayState(daily());
    state = running(state, 1_000);
    const before = elapsedMs(state.timer, 5_000);

    state = playReducer(state, { type: "tick", now: 5_000 });

    expect(state.now).toBe(5_000);
    expect(elapsedMs(state.timer, 5_000)).toBe(before);
    expect(state.timer.accumulatedMs).toBe(0);
  });
});

describe("restore (T-WEB-14b)", () => {
  it("maps every field of a record and recomputes the derived ones", () => {
    const entries: BinairoPlayRecord["entries"] = Array.from(
      { length: 64 },
      () => null,
    );
    entries[0] = 0;
    entries[1] = 0;
    entries[2] = 0;
    const state = playReducer(initPlayState(daily()), {
      type: "restore",
      record: record({
        entries,
        elapsedMs: 42_000,
        hintsUsed: 1,
        pendingSync: true,
      }),
      now: 100_000,
    });

    expect(state.hydrated).toBe(true);
    expect(state.entries).toEqual(entries);
    expect(state.timer.accumulatedMs).toBe(42_000);
    expect(state.timer.runningSince).toBeNull();
    expect(elapsedMs(state.timer, 100_000)).toBe(42_000);
    expect(state.hint).toEqual({ free: 1, used: 1, lastIndex: null });
    expect(state.pendingSync).toBe(true);
    expect([...state.violating].toSorted()).toEqual([0, 1, 2]);
    expect(state.status).toBe("playing");
  });

  it("restores a concluded record straight into the solved status", () => {
    const solvedEntries = REAL_PUZZLE.solution.map((value, index) =>
      REAL_PUZZLE.givens[index] === null ? value : null,
    );
    const state = playReducer(initPlayState(daily([...REAL_PUZZLE.givens])), {
      type: "restore",
      record: record({
        entries: solvedEntries,
        concluded: true,
        pendingSync: true,
        elapsedMs: 272_000,
      }),
      now: 1,
    });

    expect(state.status).toBe("solved");
    expect(state.timer.runningSince).toBeNull();
    expect(state.pendingSync).toBe(true);
  });

  it("with no record flips hydration and nothing the player can see", () => {
    const initial = initPlayState(daily());
    const state = playReducer(initial, {
      type: "restore",
      record: undefined,
      now: 7,
    });

    expect(state.hydrated).toBe(true);
    expect(state.entries).toEqual(initial.entries);
    expect(state.timer).toEqual(initial.timer);
    expect(state.hint).toEqual(initial.hint);
    expect(state.pendingSync).toBe(false);
    expect(state.status).toBe("playing");
  });
});

describe("mark-synced", () => {
  it("clears the pending flag without touching the grid", () => {
    const solved = playReducer(initPlayState(daily()), {
      type: "restore",
      record: record({ pendingSync: true }),
      now: 1,
    });
    const state = playReducer(solved, { type: "mark-synced" });

    expect(state.pendingSync).toBe(false);
    expect(state.entries).toEqual(solved.entries);
  });
});

describe("isSolvedGrid", () => {
  it("narrows only a grid with no empty cell", () => {
    expect(isSolvedGrid([...REAL_PUZZLE.solution])).toBe(true);
    expect(isSolvedGrid([...REAL_PUZZLE.givens])).toBe(false);
  });
});
