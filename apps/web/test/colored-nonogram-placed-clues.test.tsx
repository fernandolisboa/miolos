import { lineCells } from "@miolos/games/nonogram";
import {
  coloredRuns,
  type ColoredNonogramClues,
} from "@miolos/games/colored-nonogram";
import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ColoredBoard } from "../src/colored-nonogram/board";
import styles from "../src/colored-nonogram/colored-board.module.css";
import { messages } from "../src/i18n";
import boardStyles from "../src/nonogram/nonogram-board.module.css";
import { NO_MISTAKES } from "../src/play/mistakes";
import { bodyOf, decl, stylesheet } from "./css-source";

const TONES = [
  [1, 1, 1, 2, 2],
  [0, 0, 0, 0, 0],
  [1, 0, 2, 0, 1],
  [2, 2, 0, 1, 0],
  [1, 1, 0, 0, 2],
].flat();
const RUNS = lineCells(5).map(({ cells }) =>
  coloredRuns(cells.map((cell) => TONES[cell] ?? 0)),
);
const CLUES: ColoredNonogramClues = {
  size: 5,
  palette: ["r", "b"],
  rows: RUNS.slice(0, 5),
  cols: RUNS.slice(5),
};

const ENTRIES: readonly (number | null)[] = [
  [1, 1, 1, 2, null],
  [0, 0, 0, 0, 0],
  new Array<null>(5).fill(null),
  new Array<null>(5).fill(null),
  new Array<null>(5).fill(null),
].flat();

function board(entries: readonly (number | null)[]) {
  return (
    <ColoredBoard
      size={5}
      clues={CLUES}
      solution={null}
      entries={entries}
      mistakes={NO_MISTAKES}
      selected={null}
      hintIndex={null}
      spotlight={[]}
      onSelect={vi.fn()}
      onMove={vi.fn()}
      onMarkCell={vi.fn()}
      onStrokeStart={vi.fn()}
      onEnterValue={vi.fn()}
      onClear={vi.fn()}
      onPaintOver={vi.fn()}
    />
  );
}

function renderBoard() {
  return render(board(ENTRIES));
}

function rowRail(container: HTMLElement, row: number) {
  const rail = container.querySelector<HTMLElement>(
    `#nonogram-clue-row-${String(row)}`,
  );
  if (rail === null) {
    throw new Error(`no rail for row ${String(row + 1)}`);
  }
  return { rail, numbers: [...rail.querySelectorAll("span")] };
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  window.localStorage.clear();
});

describe("a Cores chip its marks already place is struck, and named done (T-WEB-S980)", () => {
  const placedClass = styles.chipPlaced ?? "";
  const copy = messages.games.nonogram.play;

  it("strikes a run a different tone closes, and not the run still open", () => {
    expect(CLUES.rows[0]).toEqual([
      { tone: 1, length: 3 },
      { tone: 2, length: 2 },
    ]);
    const { rail, numbers } = rowRail(renderBoard().container, 0);

    expect(numbers.map((number) => number.textContent)).toEqual(["3", "2"]);
    expect(numbers[0]).toHaveClass(placedClass);
    expect(numbers[1]).not.toHaveClass(placedClass);
    expect(rail).toHaveAttribute(
      "aria-label",
      copy.rowCluesAria(1, ["3 vermelho", "2 azul"], [true, false]),
    );
    expect(rail.getAttribute("aria-label")).toContain("3 vermelho feito, 2");
  });

  it("follows the marks as they change, striking and unstriking", () => {
    const view = renderBoard();
    const struck = () =>
      rowRail(view.container, 0).numbers.map((number) =>
        number.classList.contains(placedClass),
      );

    expect(struck()).toEqual([true, false]);
    view.rerender(board([null, null, 1, 2, 2, ...ENTRIES.slice(5)]));
    expect(struck()).toEqual([false, true]);
    view.rerender(board(ENTRIES));
    expect(struck()).toEqual([true, false]);
  });

  it("strikes a column's runs from its decided end", () => {
    const rail = renderBoard().container.querySelector<HTMLElement>(
      "#nonogram-clue-col-0",
    );
    const chips = [...(rail?.querySelectorAll("span") ?? [])];

    expect(chips.map((chip) => chip.classList.contains(placedClass))).toEqual([
      true,
      false,
      false,
      false,
    ]);
  });

  it("never strikes the empty line's 0, nor gives a chip the Clássico class", () => {
    const { container } = renderBoard();
    const { rail, numbers } = rowRail(container, 1);

    expect(numbers.map((number) => number.textContent)).toEqual(["0"]);
    expect(numbers[0]).not.toHaveClass(placedClass);
    expect(rail).toHaveAttribute("aria-label", "números da linha 2: 0");
    expect(
      container.querySelector(`.${boardStyles.clueNumberPlaced ?? ""}`),
    ).toBeNull();
  });

  it("strikes nothing when the setting is off", () => {
    window.localStorage.setItem(
      "miolos-settings",
      JSON.stringify({ games: { nonogram: { strikePlacedRuns: false } } }),
    );
    const { container } = renderBoard();
    const { rail } = rowRail(container, 0);

    expect(container.querySelector(`.${placedClass}`)).toBeNull();
    expect(rail).toHaveAttribute(
      "aria-label",
      copy.rowCluesAria(1, ["3 vermelho", "2 azul"], [false, false]),
    );
  });
});

describe("the struck chip keeps its tone, its ink and its box (T-WEB-S981)", () => {
  const PLACED = bodyOf(
    stylesheet("src/colored-nonogram/colored-board.module.css"),
    ".chipPlaced",
  );

  it("is struck through and sets nothing that recolours or resizes the chip", () => {
    expect(decl(PLACED, "text-decoration-line")).toBe("line-through");
    expect(decl(PLACED, "text-decoration-thickness")).toBe("2px");
    expect(PLACED).not.toMatch(
      /(?:^|[;\s])(?:color|background[\w-]*|box-shadow|border[\w-]*|opacity|font[\w-]*|padding[\w-]*|margin[\w-]*|width|height|line-height|letter-spacing)\s*:/,
    );
  });
});
