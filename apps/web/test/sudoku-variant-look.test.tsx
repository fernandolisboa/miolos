import {
  CLASSIC_LAYOUT,
  type SudokuLayout,
  type SudokuStep,
} from "@miolos/games/sudoku";
import {
  DIAGONAL_LAYOUT,
  generateSudokuVariant,
} from "@miolos/games/sudoku-variants";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import lookStyles from "../src/free-play/sudoku-look.module.css";
import { sudokuLook, namedHint } from "../src/free-play/sudoku-layout";
import { messages } from "../src/i18n";
import { NO_MISTAKES } from "../src/play/mistakes";
import { Board, type BoardLook } from "../src/sudoku/board";
import {
  sudokuHintExplanation,
  type SudokuHintReason,
} from "../src/sudoku/hint";
import boardStyles from "../src/sudoku/sudoku-board.module.css";

const FORMAS = generateSudokuVariant({
  seed: 7,
  weekday: 1,
  variant: "irregular",
}).layout;

function explain(reason: SudokuHintReason, layout: SudokuLayout) {
  const named = namedHint(reason, layout);
  return sudokuHintExplanation(named.reason, named.units);
}

const PARSED_CLASSIC: SudokuLayout = Object.freeze({
  regions: Object.freeze([...CLASSIC_LAYOUT.regions]),
  extraUnits: Object.freeze([]),
});

const BLANK: readonly number[] = Array.from({ length: 81 }, () => 0);

const NOOP = () => undefined;

function step(overrides: Partial<SudokuStep>): SudokuHintReason {
  return {
    kind: "step",
    step: {
      index: 0,
      digit: 4,
      technique: "nakedSingle",
      unit: null,
      cells: [],
      after: null,
      ...overrides,
    },
  };
}

const boxStep = (index: number, after: SudokuStep["after"] = null) =>
  step({
    index,
    technique: "hiddenSingle",
    unit: { kind: "box", index: 0 },
    after,
  });

function renderBoard(layout: SudokuLayout, look: BoardLook | undefined) {
  const givens = BLANK.map((_, index) => (index === 8 ? 5 : 0));
  return render(
    <Board
      layout={layout}
      look={look}
      givens={givens}
      solution={null}
      mistakes={NO_MISTAKES}
      entries={BLANK.map(() => null)}
      notes={BLANK}
      selected={null}
      violating={new Set()}
      hintIndex={null}
      spotlight={[]}
      onSelect={NOOP}
      onMove={NOOP}
      onDigit={NOOP}
      onNote={NOOP}
      onToggleNoting={NOOP}
      onClear={NOOP}
      onTapCell={NOOP}
    />,
  ).container;
}

function cellsWith(container: HTMLElement, className: string | undefined) {
  return [...container.querySelectorAll("[data-cell-index]")].flatMap((cell) =>
    className !== undefined && cell.classList.contains(className)
      ? [Number(cell.getAttribute("data-cell-index"))]
      : [],
  );
}

const ruleCount = (container: HTMLElement) =>
  container.querySelectorAll(`.${boardStyles.rule ?? "rule"}`).length;

const nameOf = (container: HTMLElement, index: number) =>
  container
    .querySelector(`[data-cell-index="${index}"]`)
    ?.getAttribute("aria-label");

describe("the hint names the variant's units (T-WEB-S866)", () => {
  it("names one or both diagonals in a naked single, and nothing more off them", () => {
    expect(
      [0, 40, 1].map((index) => explain(step({ index }), DIAGONAL_LAYOUT)),
    ).toEqual([
      "Na linha 1, coluna 1, só o 4 cabe: a linha, a coluna, o bloco e a diagonal já têm os outros números.",
      "Na linha 5, coluna 5, só o 4 cabe: a linha, a coluna, o bloco e as duas diagonais já têm os outros números.",
      "Na linha 1, coluna 2, só o 4 cabe: a linha, a coluna e o bloco já têm os outros números.",
    ]);
  });

  it("calls a Formas region a região, in a naked single and a hidden one", () => {
    expect(
      [step({ index: 0 }), boxStep(19), boxStep(19, "nakedTriple")].map(
        (reason) => explain(reason, FORMAS),
      ),
    ).toEqual([
      "Na linha 1, coluna 1, só o 4 cabe: a linha, a coluna e a região já têm os outros números.",
      "Nesta região, o 4 só cabe na linha 3, coluna 2.",
      "Com uma técnica avançada (trio fechado), o 4 só cabe na linha 3, coluna 2 desta região.",
    ]);
  });

  it("keeps bloco, and every classic sentence, on a parsed classic layout", () => {
    const reasons: SudokuHintReason[] = [
      { kind: "correction" },
      step({ index: 23 }),
      boxStep(79),
      boxStep(19, "nakedTriple"),
      step({ index: 23, after: "hiddenPair" }),
    ];

    expect(reasons.map((reason) => explain(reason, PARSED_CLASSIC))).toEqual(
      reasons.map((reason) => sudokuHintExplanation(reason)),
    );
    expect(explain(boxStep(79), PARSED_CLASSIC)).toBe(
      "Neste bloco, o 4 só cabe na linha 9, coluna 8.",
    );
    expect(sudokuLook(PARSED_CLASSIC)).toBeUndefined();
    expect(ruleCount(renderBoard(PARSED_CLASSIC, undefined))).toBe(4);
  });
});

describe("the board draws the variant (T-WEB-S867)", () => {
  it("draws Formas with no box rules and an edge between exactly the neighbours in different regions", () => {
    const board = renderBoard(FORMAS, sudokuLook(FORMAS));
    const { regions } = FORMAS;
    const differs = (index: number, next: number) =>
      regions[index] !== regions[next];

    expect(ruleCount(board)).toBe(0);
    expect(cellsWith(board, lookStyles.edgeRight)).toEqual(
      BLANK.flatMap((_, index) =>
        index % 9 < 8 && differs(index, index + 1) ? [index] : [],
      ),
    );
    expect(cellsWith(board, lookStyles.edgeBottom)).toEqual(
      BLANK.flatMap((_, index) =>
        index < 72 && differs(index, index + 9) ? [index] : [],
      ),
    );
    expect(cellsWith(board, lookStyles.diagonalMain)).toEqual([]);
  });

  it("strokes the 17 diagonal cells of Diagonal, the centre both ways, over the box rules", () => {
    const board = renderBoard(DIAGONAL_LAYOUT, sudokuLook(DIAGONAL_LAYOUT));
    const main = cellsWith(board, lookStyles.diagonalMain);
    const anti = cellsWith(board, lookStyles.diagonalAnti);

    expect(ruleCount(board)).toBe(4);
    expect(main).toEqual([0, 10, 20, 30, 40, 50, 60, 70, 80]);
    expect(anti).toEqual([8, 16, 24, 32, 40, 48, 56, 64, 72]);
    expect(new Set([...main, ...anti]).size).toBe(17);
    expect(cellsWith(board, lookStyles.edgeRight)).toEqual([]);
  });

  it("names where a cell sits before its value", () => {
    const formas = renderBoard(FORMAS, sudokuLook(FORMAS));
    const diagonal = renderBoard(DIAGONAL_LAYOUT, sudokuLook(DIAGONAL_LAYOUT));
    const region = (index: number) => (FORMAS.regions[index] ?? 0) + 1;

    expect([
      nameOf(formas, 0),
      nameOf(formas, 8),
      nameOf(diagonal, 40),
      nameOf(diagonal, 8),
      nameOf(diagonal, 1),
    ]).toEqual([
      "linha 1, coluna 1, região 1: vazia",
      `linha 1, coluna 9, região ${String(region(8))}: 5, célula fixa`,
      "linha 5, coluna 5, nas duas diagonais: vazia",
      "linha 1, coluna 9, na diagonal: 5, célula fixa",
      "linha 1, coluna 2: vazia",
    ]);
  });

  it("leaves a board with no look exactly as the daily draws it", () => {
    const board = renderBoard(CLASSIC_LAYOUT, undefined);
    const lookClasses = Object.values(lookStyles);

    expect(ruleCount(board)).toBe(4);
    expect(board.firstElementChild?.className).toBe(boardStyles.grid);
    expect(
      [...board.querySelectorAll("[data-cell-index]")].some((cell) =>
        lookClasses.some((name) => cell.classList.contains(name)),
      ),
    ).toBe(false);
    expect(nameOf(board, 8)).toBe(
      messages.games.sudoku.play.cellGivenAria(1, 9, 5),
    );
    expect(nameOf(board, 0)).toBe("linha 1, coluna 1: vazia");
  });
});
