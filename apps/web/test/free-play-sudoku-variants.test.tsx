import { FREE_HINTS_PER_PUZZLE } from "@miolos/core";
import { generateSudokuVariant } from "@miolos/games/sudoku-variants";
import { fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SudokuFreeScreen } from "../src/free-play/sudoku-free-screen";
import lookStyles from "../src/free-play/sudoku-look.module.css";
import { useFreeSudoku } from "../src/free-play/use-free-sudoku";
import { messages } from "../src/i18n";
import boardStyles from "../src/sudoku/sudoku-board.module.css";
import { flushGeneration } from "./free-generation";

const SEED = 20_261_016;

// see ADR-0055: slowest solve alone, 3866 ms (3 runs) x 4 = 15464, rounded up to 5000
const SOLVE_TIMEOUT = 20_000;

const variant = messages.freePlay.sudokuVariant;

const keypad = messages.games.sudoku.play.keypad;

type Generate = typeof generateSudokuVariant;

function spiedDeps(generate: Generate = generateSudokuVariant) {
  const spy = vi.fn(generate);
  return { deps: { pickSeed: () => SEED, generate: spy }, spy };
}

function pickVariant(name: string): void {
  fireEvent.click(
    screen.getByRole("radio", {
      name: messages.freePlay.variant.aria(name),
      hidden: true,
    }),
  );
}

async function choose(aria: string): Promise<void> {
  fireEvent.click(screen.getByRole("radio", { name: aria, hidden: true }));
  await flushGeneration();
}

async function chooseVariant(name: string): Promise<void> {
  pickVariant(name);
  await flushGeneration();
}

const chooseLevel = (name: string) =>
  choose(messages.freePlay.level.aria(name));

function solve(container: HTMLElement, puzzle: ReturnType<Generate>): void {
  for (const [index, given] of puzzle.givens.entries()) {
    const cell = container.querySelector<HTMLElement>(
      `[data-cell-index="${index}"]`,
    );
    if (given !== 0 || cell === null) {
      continue;
    }
    fireEvent.click(cell);
    fireEvent.click(
      screen.getByRole("button", {
        name: keypad.digitAria(puzzle.solution[index] ?? 0),
      }),
    );
  }
}

const cardLine = (container: HTMLElement) =>
  [...container.querySelectorAll("p")]
    .map((p) => p.textContent)
    .find((text) => text?.startsWith("Modo livre ·"));

const ruleCount = (container: HTMLElement) =>
  container.querySelectorAll(`.${boardStyles.rule ?? "rule"}`).length;

function playState(container: HTMLElement): string | null | undefined {
  return container.querySelector("main")?.getAttribute("data-play-state");
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
  HTMLElement.prototype.hidePopover = vi.fn();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("free Sudoku offers a Variante (T-WEB-S861)", () => {
  it("offers Clássico, Diagonal and Formas behind a trigger that names the choice", async () => {
    const { deps } = spiedDeps();
    render(<SudokuFreeScreen deps={deps} />);
    await flushGeneration();

    expect(
      screen.getByRole("button", {
        name: messages.freePlay.variant.triggerAria(variant.classic),
      }),
    ).toHaveTextContent(variant.classic);
    expect(
      screen
        .getAllByRole("radio", { hidden: true })
        .map((radio) => radio.getAttribute("aria-label"))
        .filter((label) => label?.startsWith("Variante")),
    ).toEqual(
      [variant.classic, variant.diagonal, variant.irregular].map(
        messages.freePlay.variant.aria,
      ),
    );
  });

  it("generates Leve + Formas from weekday 1 and the irregular variant, and a plain re-render builds nothing", async () => {
    const { deps, spy } = spiedDeps();
    const { container, rerender } = render(<SudokuFreeScreen deps={deps} />);
    await flushGeneration();
    await chooseLevel(messages.freePlay.level.leve);
    await chooseVariant(variant.irregular);

    expect(spy).toHaveBeenLastCalledWith({
      seed: SEED,
      weekday: 1,
      variant: "irregular",
    });
    expect(playState(container)).toBe("playing");
    const calls = spy.mock.calls.length;

    rerender(<SudokuFreeScreen deps={deps} />);
    await flushGeneration();

    expect(spy).toHaveBeenCalledTimes(calls);
  });

  it("shows the variant's rules in the title and the menu", async () => {
    const { deps } = spiedDeps();
    render(<SudokuFreeScreen deps={deps} />);
    await flushGeneration();
    await chooseVariant(variant.diagonal);

    expect(screen.getAllByText(variant.rules.diagonal)).toHaveLength(2);
    expect(screen.queryByText(variant.rules.classic)).not.toBeInTheDocument();
  });

  it("draws a Formas board with region edges, names its cells and hints by região, and keeps the daily's box rules off", async () => {
    const { deps } = spiedDeps();
    const { container } = render(<SudokuFreeScreen deps={deps} />);
    await flushGeneration();
    await chooseLevel(messages.freePlay.level.leve);
    await chooseVariant(variant.irregular);

    expect(
      container
        .querySelector("[data-cell-index='0']")
        ?.getAttribute("aria-label"),
    ).toContain("região");
    expect(
      container.querySelector(`.${lookStyles.edgeRight ?? "edgeRight"}`),
    ).not.toBeNull();
    expect(ruleCount(container)).toBe(0);

    fireEvent.click(
      screen.getByRole("button", {
        name: messages.play.hint.available(FREE_HINTS_PER_PUZZLE),
      }),
    );
    const readout = container.querySelector("[aria-live='polite'] p");

    expect(readout?.textContent).toContain("região");
    expect(readout?.textContent).not.toContain("bloco");
  });

  it("holds the place of a Formas board with a gridded skeleton that has no box rules, and Diagonal's with them", async () => {
    const { deps } = spiedDeps();
    const { container } = render(<SudokuFreeScreen deps={deps} />);
    const grid = () =>
      container.querySelector(`.${boardStyles.grid ?? "grid"}`);

    expect([ruleCount(container), grid()?.children.length]).toEqual([4, 85]);
    await flushGeneration();

    pickVariant(variant.irregular);
    expect(playState(container)).toBe("generating");
    expect([ruleCount(container), grid()?.children.length]).toEqual([0, 81]);
    expect(grid()?.classList).toContain(lookStyles.formas);
    await flushGeneration();

    pickVariant(variant.diagonal);
    expect(playState(container)).toBe("generating");
    expect([ruleCount(container), grid()?.children.length]).toEqual([4, 85]);
    expect(grid()?.classList).not.toContain(lookStyles.formas);
  });

  it(
    "Mais um after a solved Formas board keeps both choices",
    { timeout: SOLVE_TIMEOUT },
    async () => {
      const { deps, spy } = spiedDeps();
      const { container } = render(<SudokuFreeScreen deps={deps} />);
      await flushGeneration();
      await chooseLevel(messages.freePlay.level.leve);
      await chooseVariant(variant.irregular);
      const puzzle = spy.mock.results.at(-1)?.value as ReturnType<Generate>;

      solve(container, puzzle);

      fireEvent.click(
        screen.getByRole("button", {
          name: messages.freePlay.solved.again.sudoku,
        }),
      );
      await flushGeneration();

      expect(spy).toHaveBeenLastCalledWith({
        seed: SEED,
        weekday: 1,
        variant: "irregular",
      });
      expect(playState(container)).toBe("playing");
    },
  );
});

describe("the free Sudoku layout is parsed at the boundary (T-WEB-S862)", () => {
  const withRegions = (regions: (all: readonly number[]) => number[]) =>
    ((options) => {
      const puzzle = generateSudokuVariant(options);
      return {
        ...puzzle,
        layout: { ...puzzle.layout, regions: regions(puzzle.layout.regions) },
      };
    }) satisfies Generate;

  it.each([
    ["80 cells", withRegions((all) => all.slice(1))],
    ["a region of 8 cells", withRegions((all) => [1, ...all.slice(1)])],
  ])("shows the error card for %s", async (_name, generate) => {
    const { deps } = spiedDeps(generate);
    const { container } = render(<SudokuFreeScreen deps={deps} />);
    await flushGeneration();

    expect(playState(container)).toBe("error");
  });

  it("freezes the parsed layout at every level", async () => {
    const input = { level: "leve", variant: "diagonal" } as const;
    const { deps } = spiedDeps();
    const { result } = renderHook(() => useFreeSudoku(input, deps));
    await flushGeneration();
    const { phase } = result.current;
    if (phase.kind !== "ready") {
      throw new Error("the pinned seed did not generate");
    }
    const { layout } = phase.puzzle;

    expect([
      Object.isFrozen(layout),
      Object.isFrozen(layout.regions),
      Object.isFrozen(layout.extraUnits),
      layout.extraUnits.every(Object.isFrozen),
      layout.extraUnits.length,
    ]).toEqual([true, true, true, true, 2]);
  });
});

describe("the free-play card line reads level, then variant (T-WEB-S868)", () => {
  it.each([
    ["Clássico", variant.classic, "Modo livre · Sudoku · Leve · Clássico"],
    ["Formas", variant.irregular, "Modo livre · Sudoku · Leve · Formas"],
  ])(
    "ends a %s board on that line",
    { timeout: SOLVE_TIMEOUT },
    async (_name, pick, line) => {
      const { deps, spy } = spiedDeps();
      const { container } = render(<SudokuFreeScreen deps={deps} />);
      await flushGeneration();
      await chooseLevel(messages.freePlay.level.leve);
      await chooseVariant(pick);

      solve(container, spy.mock.results.at(-1)?.value as ReturnType<Generate>);

      expect(cardLine(container)).toBe(line);
    },
  );
});
