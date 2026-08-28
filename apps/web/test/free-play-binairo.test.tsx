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

const SEED = 20_260_812;
const NEXT_SEED = 20_260_813;
const WEEKDAY = LEVEL_WEEKDAYS.medio;
const PUZZLE = generateBinairo({ seed: SEED, weekday: WEEKDAY });
const NEXT_PUZZLE = generateBinairo({ seed: NEXT_SEED, weekday: WEEKDAY });

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

function solveRemaining(container: HTMLElement): void {
  for (const [index, given] of PUZZLE.givens.entries()) {
    if (given !== null) {
      continue;
    }
    const target = PUZZLE.solution[index];

    for (let clicks = 0; clicks < 3; clicks += 1) {
      const cell = container.querySelector<HTMLElement>(
        `[data-cell-index="${index}"]`,
      );
      if (cell === null) {
        return;
      }
      if (cell.textContent === String(target)) {
        break;
      }
      fireEvent.click(cell);
    }
  }
}

function driveFullSession(container: HTMLElement): void {
  const firstEmpty = PUZZLE.givens.findIndex((cell) => cell === null);
  fireEvent.click(cellAt(container, firstEmpty));

  fireEvent.click(screen.getByText(messages.games.binairo.play.hint.available));
  expect(
    screen.getByText(messages.games.binairo.play.hint.used),
  ).toBeInTheDocument();

  solveRemaining(container);

  expect(screen.getByText(messages.freePlay.solved.stamp)).toBeInTheDocument();

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
    writePlayRecord(dailyRecord);
    const before = keyspace();

    writePlayRecord({ ...dailyRecord, elapsedMs: 62_000 });

    expect(keyspace()).not.toEqual(before);
  });
});
