/**
 * The free-play Binairo screen (#28): the zero-fetch session (AC 1), the
 * network-cut session (AC 4) and the localStorage keyspace instrument
 * (AC 2). Every absence assertion sits beside a positive control proving
 * the instrument fires (plan 025 D11) — an untested instrument passes
 * against broken code.
 *
 * The screens mount WITHOUT the root layout, so no session mint is in
 * frame (D3): the assertion here is literally zero fetch calls.
 */
import { generateBinairo } from "@miolos/games/binairo";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BinairoFreeScreen } from "../src/free-play/binairo-free-screen";
import { LEVEL_WEEKDAYS } from "../src/free-play/catalog";
import { messages } from "../src/i18n";
import {
  writePlayRecord,
  type BinairoPlayRecord,
} from "../src/play/play-record";
import { installPointerStubs } from "./pointer";

installPointerStubs();

// Pinned seeds: the first render draws SEED, "Mais um" draws NEXT_SEED.
// Determinism is the proved engine invariant (ADR-0023), so the expected
// boards come from calling the generator with the same {seed, weekday}.
const SEED = 20_260_812;
const NEXT_SEED = 20_260_813;
const WEEKDAY = LEVEL_WEEKDAYS.medio; // the screens' default level
const PUZZLE = generateBinairo({ seed: SEED, weekday: WEEKDAY });
const NEXT_PUZZLE = generateBinairo({ seed: NEXT_SEED, weekday: WEEKDAY });

/** A stable deps object per test run — the hooks key their effect on it. */
function pinnedDeps(seeds: readonly number[]) {
  const queue = [...seeds];
  return {
    pickSeed: () => {
      const seed = queue.shift();
      if (seed === undefined) {
        throw new Error("the test drew more seeds than it pinned");
      }
      return seed;
    },
  };
}

function cellAt(container: HTMLElement, index: number): HTMLElement {
  const cell = container.querySelector<HTMLElement>(
    `[data-cell-index="${index}"]`,
  );
  if (cell === null) {
    throw new Error(`no cell at index ${index}`);
  }
  return cell;
}

/**
 * Cycle every cell to its solution value against the DOM's own rendered
 * value (the tap and the hint already wrote two cells, so a blind full
 * cycle would overshoot). Returns as soon as the grid is gone — the click
 * that completes the board swaps the whole screen to the solved card, so
 * the cell the loop would check next no longer exists.
 */
function solveRemaining(container: HTMLElement): void {
  for (const [index, given] of PUZZLE.givens.entries()) {
    if (given !== null) {
      continue;
    }
    const target = PUZZLE.solution[index];
    // At most 3 transitions in the null → 0 → 1 → null cycle.
    for (let clicks = 0; clicks < 3; clicks += 1) {
      const cell = container.querySelector<HTMLElement>(
        `[data-cell-index="${index}"]`,
      );
      if (cell === null) {
        return; // solved — the in-place swap took the grid with it
      }
      if (cell.textContent === String(target)) {
        break;
      }
      fireEvent.click(cell);
    }
  }
}

/**
 * The full session of plan 025 §9.1: generate → play → hint → solve →
 * "Mais um" regenerates. Extracted because S115 and S116 must drive the
 * IDENTICAL session — one against a recording fetch, one against a
 * rejecting one.
 */
function driveFullSession(container: HTMLElement): void {
  // Play: a first tap enters a value on some non-given cell...
  const firstEmpty = PUZZLE.givens.findIndex((cell) => cell === null);
  fireEvent.click(cellAt(container, firstEmpty)); // null → 0

  // ...and the hint reveals a cell (one free hint, D7). If the tapped 0
  // contradicts the solution, the hint corrects exactly that cell.
  fireEvent.click(screen.getByText(messages.games.binairo.play.hint.available));
  expect(
    screen.getByText(messages.games.binairo.play.hint.used),
  ).toBeInTheDocument();

  solveRemaining(container);

  // Solved: the in-place swap to the solved card, no navigation.
  expect(screen.getByText(messages.freePlay.solved.stamp)).toBeInTheDocument();

  // "Mais um": a fresh seed at the same level — the board remounts on the
  // NEXT_SEED puzzle, provably a different generation.
  fireEvent.click(screen.getByText(messages.freePlay.solved.again));
  const nextFirstGiven = NEXT_PUZZLE.givens.findIndex((cell) => cell !== null);
  expect(cellAt(container, nextFirstGiven).textContent).toBe(
    String(NEXT_PUZZLE.givens[nextFirstGiven]),
  );
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("free-play Binairo is a zero-fetch session (T-WEB-S115)", () => {
  it("generates, plays, hints, solves and regenerates without one fetch call", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { container } = render(
      <BinairoFreeScreen deps={pinnedDeps([SEED, NEXT_SEED])} />,
    );

    // The pinned puzzle is on the board: determinism ties the screen to the
    // fixture (control that the injectable seed reached the generator).
    const firstGiven = PUZZLE.givens.findIndex((cell) => cell !== null);
    expect(cellAt(container, firstGiven).textContent).toBe(
      String(PUZZLE.givens[firstGiven]),
    );

    driveFullSession(container);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("control: the stubbed fetch records calls when something does fetch", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}"));
    vi.stubGlobal("fetch", fetchMock);

    await fetch("/anything");

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("free-play Binairo keeps working with the network cut (T-WEB-S116)", () => {
  it("completes the identical session against a rejecting fetch", () => {
    // The network-cut shape: any call would reject (and surface as an
    // unhandled rejection failing the run) — so completing the session
    // proves no free-play code path awaits the network, cut or not (AC 4).
    const fetchMock = vi
      .fn()
      .mockRejectedValue(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", fetchMock);

    const { container } = render(
      <BinairoFreeScreen deps={pinnedDeps([SEED, NEXT_SEED])} />,
    );

    driveFullSession(container);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("control: the rejecting stub is not inert", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValue(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetch("/anything")).rejects.toThrow("Failed to fetch");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("free play writes nothing to localStorage (T-WEB-S117)", () => {
  const dailyRecord: BinairoPlayRecord = {
    v: 1,
    game: "binairo",
    date: "2026-08-11",
    entries: Array.from({ length: 64 }, () => null),
    elapsedMs: 61_000,
    hintsUsed: 0,
    concluded: false,
    pendingSync: false,
    syncOutcome: "pending",
  };

  function keyspace(): Record<string, string> {
    const all: Record<string, string> = {};
    for (let at = 0; at < localStorage.length; at += 1) {
      const key = localStorage.key(at);
      if (key !== null) {
        all[key] = localStorage.getItem(key) ?? "";
      }
    }
    return all;
  }

  it("leaves the keyspace byte-identical across a full session (D6)", () => {
    vi.stubGlobal("fetch", vi.fn());
    // A realistic daily record plus an unrelated key: the assertion is over
    // the WHOLE keyspace, not merely "no new miolos:play:* keys" — D6's
    // claim is zero writes, and the stronger instrument costs nothing.
    writePlayRecord(dailyRecord);
    localStorage.setItem("unrelated:key", "untouched");
    const before = keyspace();
    expect(Object.keys(before).length).toBeGreaterThanOrEqual(2);

    const { container } = render(
      <BinairoFreeScreen deps={pinnedDeps([SEED, NEXT_SEED])} />,
    );
    driveFullSession(container);

    expect(keyspace()).toEqual(before);
  });

  it("control: a writePlayRecord call visibly changes the snapshot", () => {
    // An accidentally-frozen mock storage would fake the pass above; this
    // proves the snapshot instrument sees real writes.
    writePlayRecord(dailyRecord);
    const before = keyspace();

    writePlayRecord({ ...dailyRecord, elapsedMs: 62_000 });

    expect(keyspace()).not.toEqual(before);
  });
});
