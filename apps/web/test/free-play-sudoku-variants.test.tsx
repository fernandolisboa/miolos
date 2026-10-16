import { generateSudokuVariant } from "@miolos/games/sudoku-variants";
import { fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FreePlaySolvedCard } from "../src/free-play/solved-card";
import { SudokuFreeScreen } from "../src/free-play/sudoku-free-screen";
import { useFreeSudoku } from "../src/free-play/use-free-sudoku";
import { messages } from "../src/i18n";
import { flushGeneration } from "./free-generation";

const SEED = 20_261_016;

const variant = messages.freePlay.sudokuVariant;

const keypad = messages.games.sudoku.play.keypad;

type Generate = typeof generateSudokuVariant;

function spiedDeps(generate: Generate = generateSudokuVariant) {
  const spy = vi.fn(generate);
  return { deps: { pickSeed: () => SEED, generate: spy }, spy };
}

async function choose(aria: string): Promise<void> {
  fireEvent.click(screen.getByRole("radio", { name: aria, hidden: true }));
  await flushGeneration();
}

const chooseVariant = (name: string) =>
  choose(messages.freePlay.variant.aria(name));

const chooseLevel = (name: string) =>
  choose(messages.freePlay.level.aria(name));

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

  it(
    "ends a Formas board on a card that names the variant, and Mais um keeps both choices",
    { timeout: 20_000 },
    async () => {
      const { deps, spy } = spiedDeps();
      const { container } = render(<SudokuFreeScreen deps={deps} />);
      await flushGeneration();
      await chooseLevel(messages.freePlay.level.leve);
      await chooseVariant(variant.irregular);
      const puzzle = spy.mock.results.at(-1)?.value as ReturnType<Generate>;

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

      expect(
        screen.getByText(
          messages.freePlay.solved.modeLine(
            messages.freePlay.modeTag,
            messages.games.sudoku.name,
            variant.irregular,
            messages.freePlay.level.leve,
          ),
        ),
      ).toBeInTheDocument();

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

describe("the free-play card line names the variant before the level (T-WEB-S868)", () => {
  it("reads Formas · Médio for Sudoku and leaves Clássico and Termo as they were", () => {
    const lines = [
      <FreePlaySolvedCard
        key="formas"
        game="sudoku"
        variant={variant.irregular}
        level={messages.freePlay.level.medio}
        onAgain={() => undefined}
      />,
      <FreePlaySolvedCard
        key="classic"
        game="sudoku"
        level={messages.freePlay.level.medio}
        onAgain={() => undefined}
      />,
      <FreePlaySolvedCard
        key="termo"
        game="termo"
        variant={messages.freePlay.variant.dueto}
        words={["ARDOR", "CASCO"]}
        onAgain={() => undefined}
      />,
    ].map((card) => {
      const { container, unmount } = render(card);
      const text = [...container.querySelectorAll("p")]
        .map((p) => p.textContent)
        .find((content) => content?.startsWith("Modo livre ·"));
      unmount();
      return text;
    });

    expect(lines).toEqual([
      "Modo livre · Sudoku · Formas · Médio",
      "Modo livre · Sudoku · Médio",
      "Modo livre · Termo · Dueto",
    ]);
  });
});
