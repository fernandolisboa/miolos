import {
  FREE_HINTS_PER_PUZZLE,
  HINTS_PER_PUZZLE_CEILING,
  type DailyBinairoResponse,
} from "@miolos/core";
import { generateBinairo } from "@miolos/games/binairo";
import { describe, expect, it } from "vitest";

import type { Press } from "../src/play/brush";
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
    (current, index) =>
      playReducer(current, { type: "tap", index, press: "tap" }),
    state,
  );
}

function press(state: PlayState, kind: Press, ...indices: number[]): PlayState {
  return indices.reduce(
    (current, index) =>
      playReducer(current, { type: "tap", index, press: kind }),
    state,
  );
}

function brushed(value: 0 | 1): PlayState {
  return playReducer(initPlayState(daily()), {
    type: "set-mode",
    value,
  });
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
    expect(state.hint).toEqual({
      used: 0,
      lastIndex: null,
    });
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
      value: 1,
    });

    state = tap(state, 9);
    expect(state.entries[9]).toBe(1);
    state = tap(state, 9);
    expect(state.entries[9]).toBeNull();
  });
});

describe("a mouse press writes a value (T-WEB-S506)", () => {
  it("left writes 1 and right writes 0 in cycle mode, and the same press again clears", () => {
    const start = initPlayState(daily());

    const one = press(start, "left", 5);
    expect(one.entries[5]).toBe(1);
    expect(press(one, "left", 5).entries[5]).toBeNull();

    const zero = press(start, "right", 5);
    expect(zero.entries[5]).toBe(0);
    expect(press(zero, "right", 5).entries[5]).toBeNull();

    expect(press(one, "right", 5).entries[5]).toBe(0);
  });

  it("a tap still cycles in cycle mode", () => {
    expect(tap(initPlayState(daily()), 5).entries[5]).toBe(0);
  });

  it("left and a tap use the brush, right the other value", () => {
    const zeros = brushed(0);

    expect(press(zeros, "tap", 3).entries[3]).toBe(0);
    expect(press(zeros, "left", 3).entries[3]).toBe(0);
    expect(press(zeros, "right", 3).entries[3]).toBe(1);
    expect(press(zeros, "tap", 3, 3).entries[3]).toBeNull();

    const ones = brushed(1);
    expect(press(ones, "right", 3).entries[3]).toBe(0);
    expect(press(ones, "left", 3, 3).entries[3]).toBeNull();
  });

  it("never changes a given, whatever the press", () => {
    const givens = [...EMPTY_GIVENS];
    givens[0] = 1;
    const state = initPlayState(daily(givens));

    for (const kind of ["tap", "left", "right"] as const) {
      expect(press(state, kind, 0).entries[0]).toBeNull();
    }
  });
});

describe("stroke-start and paint-over — the drag path (T-WEB-S506a)", () => {
  function stroke(
    state: PlayState,
    kind: Press,
    start: number,
    ...over: number[]
  ): PlayState {
    return over.reduce(
      (current, index) => playReducer(current, { type: "paint-over", index }),
      playReducer(state, { type: "stroke-start", index: start, press: kind }),
    );
  }

  it("is a no-op in cycle mode: cycling on drag is chaos (D8)", () => {
    const state = stroke(initPlayState(daily()), "left", 4, 5, 6);

    expect(state.entries).toEqual(EMPTY_GIVENS);
  });

  it("sets, never toggles, and is idempotent over the same cell in paint mode", () => {
    const state = stroke(brushed(0), "tap", 6, 7, 7, 7);

    expect(state.entries.slice(6, 8)).toEqual([0, 0]);
  });

  it("a right stroke writes the other value", () => {
    const state = stroke(brushed(1), "right", 6, 7);

    expect(state.entries.slice(6, 8)).toEqual([0, 0]);
  });

  it("from a cell already holding the brush's value clears only cells holding it", () => {
    let state = press(brushed(1), "tap", 8, 10);
    state = press(state, "right", 9);

    const cleared = stroke(state, "tap", 8, 9, 10, 11);

    expect(cleared.entries.slice(8, 12)).toEqual([null, 0, null, null]);
  });

  it("(a) a stroke starting on a given writes, and the next stroke replaces a clearing latch", () => {
    const givens = [...EMPTY_GIVENS];
    givens[2] = 0;
    let state = playReducer(initPlayState(daily(givens)), {
      type: "set-mode",
      value: 1,
    });
    state = press(state, "tap", 11, 12);
    state = stroke(state, "tap", 11);

    const fromGiven = stroke(state, "tap", 2, 3, 12);

    expect(fromGiven.entries[2]).toBeNull();
    expect(fromGiven.entries[3]).toBe(1);
    expect(fromGiven.entries[12]).toBe(1);
    expect(mergedGrid(fromGiven)[2]).toBe(0);
  });
});

describe("set-mode takes the digit (T-WEB-S501)", () => {
  it("returns to cycle when the active brush is pressed again", () => {
    const zeros = brushed(0);
    const again = playReducer(zeros, {
      type: "set-mode",
      value: 0,
    });
    const other = playReducer(zeros, {
      type: "set-mode",
      value: 1,
    });

    expect(again.paint).toEqual({ kind: "cycle" });
    expect(other.paint).toEqual({ kind: "paint", value: 1 });
  });

  it("swaps the sticky paint mode without touching the grid", () => {
    const filled = tap(initPlayState(daily()), 1);
    const state = playReducer(filled, {
      type: "set-mode",
      value: 1,
    });

    expect(state.paint).toEqual({ kind: "paint", value: 1 });
    expect(state.entries).toEqual(filled.entries);
  });
});

describe("a stroke that starts nowhere (T-WEB-S502)", () => {
  it("drops the old latch instead of leaving it to paint the next cells", () => {
    const latched = playReducer(brushed(1), {
      type: "stroke-start",
      index: 3,
      press: "tap",
    });
    expect(latched.stroke).not.toBeNull();

    const lost = playReducer(latched, {
      type: "stroke-start",
      index: 999,
      press: "tap",
    });
    const after = playReducer(lost, { type: "paint-over", index: 4 });

    expect(lost.stroke).toBeNull();
    expect(after.entries[4]).toBeNull();
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
  it("writes the solution's value, spends a free hint and marks the cell", () => {
    const givens = [...REAL_PUZZLE.givens];
    const first = playReducer(initPlayState(daily(givens)), {
      type: "use-hint",
      solution: REAL_PUZZLE.solution,
    });

    expect(first.hint.used).toBe(1);
    expect(first.hint.lastIndex).not.toBeNull();
    const index = first.hint.lastIndex ?? -1;
    expect(first.entries[index]).toBe(REAL_PUZZLE.solution[index]);
  });
});

describe("the reducer's hints stop at the ceiling (T-WEB-S511b)", () => {
  const initial = initPlayState(daily([...REAL_PUZZLE.givens]));

  function hint(state: PlayState): PlayState {
    return playReducer(state, {
      type: "use-hint",
      solution: REAL_PUZZLE.solution,
    });
  }

  it("writes a solution value on each free press", () => {
    let current = initial;
    for (let press = 1; press <= FREE_HINTS_PER_PUZZLE; press += 1) {
      current = hint(current);
      const index = current.hint.lastIndex ?? -1;

      expect(current.hint.lastIndex).not.toBeNull();
      expect(current.hint.used).toBe(press);
      expect(current.entries[index]).toBe(REAL_PUZZLE.solution[index]);
    }
  });

  it("leaves exactly one hint after a restore one short of the ceiling, and the press after it is inert", () => {
    const restored = playReducer(initial, {
      type: "restore",
      record: record({ hintsUsed: HINTS_PER_PUZZLE_CEILING - 1 }),
      now: 1,
    });
    const last = hint(restored);

    expect(last.hint.used).toBe(HINTS_PER_PUZZLE_CEILING);
    expect(hint(last)).toBe(last);
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
    expect(state.hint).toEqual({
      used: 1,
      lastIndex: null,
    });
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
