import {
  dailySudokuResponseSchema,
  FREE_HINTS_PER_PUZZLE,
  type DailySudokuResponse,
} from "@miolos/core";
import {
  CLASSIC_LAYOUT,
  generateDailySudoku,
  nextSudokuStep,
} from "@miolos/games/sudoku";
import {
  act,
  createEvent,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DailyUnavailable } from "../src/components/daily-unavailable";
import { formatElapsed, messages } from "../src/i18n";
import { playRecordKey, type SudokuPlayRecord } from "../src/play/play-record";
import sharedStyles from "../src/play/screen.module.css";
import {
  mergedGrid,
  selectionHighlights,
  solutionDigits,
  track,
} from "../src/sudoku/engine";
import { sudokuHintExplanation } from "../src/sudoku/hint";
import type { SudokuDigit } from "../src/sudoku/state";
import styles from "../src/sudoku/sudoku-board.module.css";
import { SudokuScreen } from "../src/sudoku/sudoku-screen";
import {
  bodyOf,
  boardFloor,
  decl,
  pixels,
  stylesheet,
  token,
} from "./css-source";
import { freeHintSteps, spendFreeHints } from "./free-hints";
import { SPOKEN } from "./hint-reason";

const sync = vi.hoisted(() => ({
  startCompletionSync: vi.fn(() => () => undefined),

  flushPendingCompletions: vi.fn((record?: SudokuPlayRecord) =>
    Promise.resolve(record),
  ),
}));
vi.mock("../src/play/sync", () => sync);

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/sudoku",
}));

const DATE = "2026-08-01";
const SIDE = 9;
const TOTAL_CELLS = 81;

const BLANK: readonly number[] = Array.from({ length: TOTAL_CELLS }, () => 0);

const PUZZLE = generateDailySudoku({ seed: 20_260_801, weekday: 1 });

const DAILY: DailySudokuResponse = dailySudokuResponseSchema.parse({
  game: "sudoku",
  date: DATE,
  givens: PUZZLE.givens,
  tier: PUZZLE.tier,
});

const LEVEL = messages.games.sudoku.play.level(DAILY.tier);

const CLUE_COUNT = PUZZLE.givens.filter((cell) => cell !== 0).length;

const FIRST_EMPTY = PUZZLE.givens.indexOf(0);
const FIRST_GIVEN = PUZZLE.givens.findIndex((cell) => cell !== 0);

function solutionOf(): readonly SudokuDigit[] {
  const digits = solutionDigits(PUZZLE.givens);
  if (digits === null) {
    throw new Error("a published daily is uniquely solvable by construction");
  }
  return digits;
}

const SOLUTION = solutionOf();

const HINT_STEPS = freeHintSteps(
  PUZZLE.givens,
  nextSudokuStep,
  (step) => step.digit,
);

function cellAt(container: HTMLElement, index: number): HTMLElement {
  const cell = container.querySelector<HTMLElement>(
    `[data-cell-index="${index}"]`,
  );
  if (cell === null) {
    throw new Error(`no cell at index ${index}`);
  }
  return cell;
}

function boardOf(): HTMLElement {
  return screen.getByRole("group", {
    name: messages.games.sudoku.play.boardAria,
  });
}

function caretIndex(container: HTMLElement): number {
  const tabbable = container.querySelectorAll<HTMLElement>(
    '[data-cell-index][tabindex="0"]',
  );
  expect(tabbable).toHaveLength(1);
  return Number(tabbable[0]?.dataset.cellIndex);
}

function type(container: HTMLElement, index: number, key: string): void {
  fireEvent.click(cellAt(container, index));
  fireEvent.keyDown(boardOf(), { key });
}

function solveByTyping(container: HTMLElement): void {
  for (const [index, given] of PUZZLE.givens.entries()) {
    if (given !== 0) {
      continue;
    }
    type(container, index, String(SOLUTION[index]));
  }
}

function concludedRecord(
  overrides: Partial<SudokuPlayRecord> = {},
): SudokuPlayRecord {
  const entries = PUZZLE.givens.map((given, index) =>
    given === 0 ? (SOLUTION[index] ?? null) : null,
  );
  return {
    v: 1,
    game: "sudoku",
    date: DATE,
    entries,
    grid: [...SOLUTION],
    elapsedMs: 272_000,
    hintsUsed: 0,
    concluded: true,
    pendingSync: false,
    syncOutcome: "recorded",
    ...overrides,
  };
}

const GAME_CSS = stylesheet("src/sudoku/sudoku-board.module.css");
const SHARED_CSS = stylesheet("src/play/screen.module.css");

function declares(css: string, local: string): boolean {
  return new RegExp(`(?:^|[\\s,])\\.${local}(?![\\w-])`, "m").test(css);
}

function className(local: string): string {
  const generated = declares(GAME_CSS, local)
    ? styles[local]
    : declares(SHARED_CSS, local)
      ? sharedStyles[local]
      : undefined;
  if (generated === undefined) {
    throw new Error(
      `neither sudoku-board.module.css nor play/screen.module.css declares .${local}`,
    );
  }
  return generated;
}

const GRID_AREA_CLASSES = [
  ...new Set(
    [GAME_CSS, SHARED_CSS]
      .flatMap((sheet) => [...sheet.matchAll(/^\.(\w+)[^{]*\{([^}]*)\}/gm)])
      .filter(([, , body]) => /(?:^|;)\s*grid-area\s*:/.test(body ?? ""))
      .map(([, local]) => local ?? ""),
  ),
];

function parsed(markup: string): HTMLElement {
  const host = document.createElement("div");
  host.innerHTML = markup;
  return host;
}

function occupantsIn(root: HTMLElement): string[] {
  return GRID_AREA_CLASSES.filter(
    (local) => root.querySelector(`.${className(local)}`) !== null,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("the board and its readouts (T-WEB-S25)", () => {
  it("states every rule the engine enforces — rows, columns AND 3×3 blocks", () => {
    render(<SudokuScreen daily={DAILY} />);

    const rules = messages.games.sudoku.play.rules;
    expect(screen.getByText(rules)).toBeInTheDocument();

    expect(rules).toContain("linha");
    expect(rules).toContain("coluna");
    expect(rules).toContain("3×3");
  });

  it("renders 81 cells, with givens focusable, aria-disabled and named as fixed", () => {
    const { container } = render(<SudokuScreen daily={DAILY} />);

    expect(container.querySelectorAll("[data-cell-index]")).toHaveLength(
      TOTAL_CELLS,
    );

    const given = PUZZLE.givens[FIRST_GIVEN];
    if (given === undefined || given === 0) {
      throw new Error("the fixture puzzle has no givens");
    }
    const givenCell = cellAt(container, FIRST_GIVEN);

    expect(givenCell.tagName).toBe("BUTTON");
    expect(givenCell).toHaveAttribute("aria-disabled", "true");
    expect(givenCell).toHaveAttribute(
      "aria-label",
      messages.games.sudoku.play.cellGivenAria(
        Math.floor(FIRST_GIVEN / SIDE) + 1,
        (FIRST_GIVEN % SIDE) + 1,
        given,
      ),
    );
  });

  it("renders BOTH readout pairs, because the reflow crosses subtrees", () => {
    render(<SudokuScreen daily={DAILY} />);

    expect(
      screen.getAllByLabelText(messages.play.timerAria("00:00")),
    ).toHaveLength(2);
    expect(
      screen.getByText(
        messages.games.sudoku.play.progressShort(
          LEVEL,
          CLUE_COUNT,
          TOTAL_CELLS,
        ),
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        messages.games.sudoku.play.progressLong(CLUE_COUNT, TOTAL_CELLS),
      ),
    ).toBeInTheDocument();
  });

  it("reports the CLUE COUNT filled on a fresh board, never 81 of 81", () => {
    render(<SudokuScreen daily={DAILY} />);

    expect(CLUE_COUNT).toBeLessThan(TOTAL_CELLS);
    expect(
      screen.queryByText(
        messages.games.sudoku.play.progressLong(TOTAL_CELLS, TOTAL_CELLS),
      ),
    ).not.toBeInTheDocument();
  });

  it("renders the Nível readout on both viewports (§12.5)", () => {
    render(<SudokuScreen daily={DAILY} />);

    expect(
      screen.getByText(messages.games.sudoku.play.levelLabel),
    ).toBeInTheDocument();
    expect(screen.getByText(LEVEL)).toBeInTheDocument();
    expect(
      screen.getByText(
        messages.games.sudoku.play.progressShort(
          LEVEL,
          CLUE_COUNT,
          TOTAL_CELLS,
        ),
      ),
    ).toBeInTheDocument();
  });
});

describe("the impeccable structural guard (T-WEB-S26)", () => {
  function assertNoEyebrowAboveHeadings(root: ParentNode): void {
    const headings = [...root.querySelectorAll("h1")];
    expect(headings.length).toBeGreaterThan(0);
    for (const heading of headings) {
      expect(heading.previousElementSibling?.textContent ?? "").toBe("");
    }
  }

  function assertHeadingIsFirstChild(root: ParentNode): void {
    const heading = root.querySelector("h1");
    expect(heading).not.toBeNull();
    expect(heading?.previousElementSibling).toBeNull();
    expect(heading?.parentElement?.firstElementChild).toBe(heading);
  }

  it("holds in PlayView and in PlaySkeleton, by the .titleRow wrapper", () => {
    const skeleton = parsed(
      renderToStaticMarkup(<SudokuScreen daily={DAILY} />),
    );
    assertHeadingIsFirstChild(skeleton);
    assertNoEyebrowAboveHeadings(skeleton);

    const { container: play } = render(<SudokuScreen daily={DAILY} />);
    assertHeadingIsFirstChild(play);
    assertNoEyebrowAboveHeadings(play);
  });

  it("holds in DailyUnavailable and in the conclusion", async () => {
    const { container: unavailable } = render(
      <DailyUnavailable copy={messages.games.sudoku.play.unavailable} />,
    );

    assertNoEyebrowAboveHeadings(unavailable);

    window.localStorage.setItem(
      playRecordKey("sudoku", DATE),
      JSON.stringify(concludedRecord()),
    );
    const { container: conclusion } = render(<SudokuScreen daily={DAILY} />);

    await act(async () => {
      await import("../src/play/conclusion-view");
    });
    expect(conclusion.querySelector("[data-conclusion-state]")).not.toBeNull();
    assertHeadingIsFirstChild(conclusion);
    assertNoEyebrowAboveHeadings(conclusion);
  });
});

describe("writing with the keypad (T-WEB-S27)", () => {
  it("writes at the selected cell, and re-tapping the same digit clears it", () => {
    const { container } = render(<SudokuScreen daily={DAILY} />);
    const seven = screen.getByLabelText(
      messages.games.sudoku.play.keypad.digitAria(7),
    );

    fireEvent.click(seven);
    expect(cellAt(container, FIRST_EMPTY).textContent).toBe("");

    fireEvent.click(cellAt(container, FIRST_EMPTY));
    fireEvent.click(seven);
    expect(cellAt(container, FIRST_EMPTY).textContent).toBe("7");

    fireEvent.click(seven);
    expect(cellAt(container, FIRST_EMPTY).textContent).toBe("");
  });

  it("clears the selected cell with apagar", () => {
    const { container } = render(<SudokuScreen daily={DAILY} />);

    fireEvent.click(cellAt(container, FIRST_EMPTY));
    fireEvent.click(
      screen.getByLabelText(messages.games.sudoku.play.keypad.digitAria(4)),
    );
    expect(cellAt(container, FIRST_EMPTY).textContent).toBe("4");

    fireEvent.click(
      screen.getByLabelText(messages.games.sudoku.play.keypad.eraseAria),
    );

    expect(cellAt(container, FIRST_EMPTY).textContent).toBe("");
  });

  it("never changes a given", () => {
    const { container } = render(<SudokuScreen daily={DAILY} />);
    const before = cellAt(container, FIRST_GIVEN).textContent;

    fireEvent.click(cellAt(container, FIRST_GIVEN));
    fireEvent.click(
      screen.getByLabelText(messages.games.sudoku.play.keypad.digitAria(5)),
    );
    fireEvent.click(
      screen.getByLabelText(messages.games.sudoku.play.keypad.eraseAria),
    );

    expect(cellAt(container, FIRST_GIVEN).textContent).toBe(before);
    expect(
      screen.getByText(
        messages.games.sudoku.play.progressLong(CLUE_COUNT, TOTAL_CELLS),
      ),
    ).toBeInTheDocument();
  });

  it("names a repeating cell with the copy module's composed string", () => {
    const { container } = render(<SudokuScreen daily={DAILY} />);

    const row = Math.floor(FIRST_EMPTY / SIDE);
    const clash = PUZZLE.givens
      .slice(row * SIDE, row * SIDE + SIDE)
      .find((cell) => cell !== 0);
    if (clash === undefined) {
      throw new Error("the fixture puzzle has a row with no givens");
    }

    type(container, FIRST_EMPTY, String(clash));

    expect(cellAt(container, FIRST_EMPTY)).toHaveAttribute(
      "aria-label",
      messages.games.sudoku.play.cellInvalidAria(
        row + 1,
        (FIRST_EMPTY % SIDE) + 1,
        clash,
      ),
    );
    expect(cellAt(container, FIRST_EMPTY)).not.toHaveAttribute("aria-invalid");
  });
});

describe("the free hints (T-WEB-S28a)", () => {
  it("fills one cell per free hint, then renders the exhausted variant", () => {
    render(<SudokuScreen daily={DAILY} />);

    spendFreeHints();

    expect(
      screen.getByText(
        messages.games.sudoku.play.progressLong(
          CLUE_COUNT + FREE_HINTS_PER_PUZZLE,
          TOTAL_CELLS,
        ),
      ),
    ).toBeInTheDocument();
    const exhausted = screen.getByRole("button", {
      name: messages.play.hint.used,
    });
    expect(exhausted).toHaveAttribute("aria-disabled", "true");

    expect(
      screen.getByText(
        sudokuHintExplanation({ kind: "step", step: HINT_STEPS[2]! }) ?? "",
        SPOKEN,
      ),
    ).toBeInTheDocument();

    fireEvent.click(exhausted);

    expect(
      screen.getByText(
        messages.games.sudoku.play.progressLong(
          CLUE_COUNT + FREE_HINTS_PER_PUZZLE,
          TOTAL_CELLS,
        ),
      ),
    ).toBeInTheDocument();
  });

  it("leaves the caret where the player put it (§8.3)", () => {
    const { container } = render(<SudokuScreen daily={DAILY} />);
    fireEvent.click(cellAt(container, FIRST_EMPTY));
    expect(caretIndex(container)).toBe(FIRST_EMPTY);

    fireEvent.click(
      screen.getByText(messages.play.hint.available(FREE_HINTS_PER_PUZZLE)),
    );

    expect(caretIndex(container)).toBe(FIRST_EMPTY);
  });
});

describe("the hint names its step and lights the cells it reasons about (T-WEB-S553)", () => {
  const step = HINT_STEPS[0]!;

  function tinted(container: HTMLElement): number[] {
    return [...container.querySelectorAll<HTMLElement>("[data-cell-index]")]
      .filter((cell) => cell.classList.contains(className("cellUnit")))
      .map((cell) => Number(cell.dataset.cellIndex));
  }

  function liveRegion(container: HTMLElement): HTMLElement {
    const region = container.querySelector<HTMLElement>(
      `.${className("board")} [aria-live="polite"]`,
    );
    if (region === null) {
      throw new Error("the board renders no live region");
    }
    return region;
  }

  it("writes the step's cell, reads out why, and tints its cells until the next board action", () => {
    const { container } = render(<SudokuScreen daily={DAILY} />);
    expect(liveRegion(container).textContent).toBe("");

    fireEvent.click(
      screen.getByText(messages.play.hint.available(FREE_HINTS_PER_PUZZLE)),
    );

    const hinted = cellAt(container, step.index);
    expect(hinted.textContent).toBe(String(step.digit));
    expect(hinted.classList).toContain(className("cellHinted"));
    expect(liveRegion(container).textContent).toBe(
      sudokuHintExplanation({ kind: "step", step }),
    );
    expect(tinted(container)).toEqual(
      [...step.cells]
        .filter((index) => index !== step.index)
        .sort((a, b) => a - b),
    );

    fireEvent.click(cellAt(container, FIRST_GIVEN));

    const entries = PUZZLE.givens.map((_, index) =>
      index === step.index ? (SOLUTION[index] ?? null) : null,
    );
    const reach = selectionHighlights(
      mergedGrid(PUZZLE.givens, entries),
      FIRST_GIVEN,
      CLASSIC_LAYOUT,
    );
    expect(tinted(container)).toEqual(
      [...reach]
        .filter(([index, kind]) => kind === "unit" && index !== step.index)
        .map(([index]) => index),
    );
    expect(hinted.classList).toContain(className("cellHinted"));
    expect(liveRegion(container).textContent).toBe(
      sudokuHintExplanation({ kind: "step", step }),
    );
  });

  it("reads out a correction", () => {
    const { container } = render(<SudokuScreen daily={DAILY} />);
    const wrong = SOLUTION[FIRST_EMPTY] === 9 ? "1" : "9";
    type(container, FIRST_EMPTY, wrong);

    fireEvent.click(
      screen.getByText(messages.play.hint.available(FREE_HINTS_PER_PUZZLE)),
    );

    expect(cellAt(container, FIRST_EMPTY).textContent).toBe(
      String(SOLUTION[FIRST_EMPTY]),
    );
    expect(liveRegion(container).textContent).toBe(
      messages.games.sudoku.play.hint.correction,
    );
  });
});

describe("the selection's reach on the board (T-WEB-S496)", () => {
  function cellsWith(container: HTMLElement, local: string): number[] {
    return [...container.querySelectorAll<HTMLElement>("[data-cell-index]")]
      .filter((cell) => cell.classList.contains(className(local)))
      .map((cell) => Number(cell.dataset.cellIndex));
  }

  function labels(container: HTMLElement): (string | null)[] {
    return [...container.querySelectorAll("[data-cell-index]")].map((cell) =>
      cell.getAttribute("aria-label"),
    );
  }

  const ROW_GIVEN = PUZZLE.givens.findIndex(
    (cell, index) =>
      cell !== 0 && Math.floor(index / SIDE) === Math.floor(FIRST_EMPTY / SIDE),
  );

  it("tints the empty cell's row, column and box, and names nothing differently", () => {
    const { container } = render(<SudokuScreen daily={DAILY} />);
    const before = labels(container);

    fireEvent.click(cellAt(container, FIRST_EMPTY));

    const unit = Array.from(
      { length: TOTAL_CELLS },
      (_unused, index) => index,
    ).filter((index) =>
      selectionHighlights(BLANK, FIRST_EMPTY, CLASSIC_LAYOUT).has(index),
    );
    expect(cellsWith(container, "cellUnit")).toEqual(unit);
    expect(cellsWith(container, "cellSameDigit")).toEqual([]);
    expect(labels(container)).toEqual(before);
  });

  it("marks every copy of a selected given's digit, stronger than the tint", () => {
    const { container } = render(<SudokuScreen daily={DAILY} />);
    const digit = PUZZLE.givens[ROW_GIVEN];

    fireEvent.click(cellAt(container, ROW_GIVEN));

    const copies = PUZZLE.givens.flatMap((cell, index) =>
      cell === digit ? [index] : [],
    );
    expect(copies.length).toBeGreaterThan(1);
    expect(cellsWith(container, "cellSameDigit")).toEqual(copies);
    for (const index of cellsWith(container, "cellUnit")) {
      expect(PUZZLE.givens[index]).not.toBe(digit);
    }
  });

  it("never covers the conflict ring or the hint ring", () => {
    const { container } = render(<SudokuScreen daily={DAILY} />);
    const digit = String(PUZZLE.givens[ROW_GIVEN]);

    type(container, FIRST_EMPTY, digit);
    fireEvent.click(cellAt(container, ROW_GIVEN));

    const conflicting = cellAt(container, FIRST_EMPTY);
    expect(conflicting.classList).toContain(className("cellViolating"));
    expect(conflicting.classList).not.toContain(className("cellSameDigit"));
    expect(conflicting.classList).not.toContain(className("cellUnit"));

    type(container, FIRST_EMPTY, "Backspace");
    fireEvent.click(
      screen.getByText(messages.play.hint.available(FREE_HINTS_PER_PUZZLE)),
    );
    const hinted = container.querySelector<HTMLElement>(
      `.${className("cellHinted")}`,
    );
    if (hinted === null) {
      throw new Error("the hint revealed no cell");
    }
    for (const selected of [ROW_GIVEN, Number(hinted.dataset.cellIndex)]) {
      fireEvent.click(cellAt(container, selected));
      if (
        !selectionHighlights(
          BLANK,
          Number(hinted.dataset.cellIndex),
          CLASSIC_LAYOUT,
        ).has(selected)
      ) {
        throw new Error("the fixture's hint is not in the row given's units");
      }
      expect(hinted.classList).toContain(className("cellHinted"));
      expect(hinted.classList).not.toContain(className("cellUnit"));
      expect(hinted.classList).not.toContain(className("cellSameDigit"));
    }
  });
});

describe("the keyboard model (T-WEB-S28)", () => {
  it("is one composite widget, not 81 tab stops, and not a role=grid", () => {
    const { container } = render(<SudokuScreen daily={DAILY} />);

    const board = boardOf();
    expect(board).toHaveAttribute("role", "group");

    expect(container.querySelector('[role="grid"]')).toBeNull();
    expect(container.querySelector('[role="row"]')).toBeNull();
    expect(caretIndex(container)).toBe(0);
    expect(
      container.querySelectorAll('[data-cell-index][tabindex="-1"]'),
    ).toHaveLength(TOTAL_CELLS - 1);
  });

  it("selects the cell a Tab lands on, so the writing keys are not a silent no-op", () => {
    const { container } = render(<SudokuScreen daily={DAILY} />);

    const entry = caretIndex(container);
    act(() => {
      cellAt(container, entry).focus();
    });
    expect(cellAt(container, entry).className).toContain(
      className("cellSelected"),
    );

    const empty = cellAt(container, FIRST_EMPTY);
    act(() => {
      empty.focus();
    });
    fireEvent.keyDown(empty, { key: "7" });
    expect(empty.textContent).toBe("7");
    fireEvent.keyDown(empty, { key: "Backspace" });
    expect(empty.textContent).toBe("");
  });

  it("puts DOM focus on the cell the pointer selected", () => {
    const { container } = render(<SudokuScreen daily={DAILY} />);
    const cell = cellAt(container, FIRST_EMPTY);

    fireEvent.click(cell);

    expect(cell).toHaveFocus();
    expect(caretIndex(container)).toBe(FIRST_EMPTY);
    fireEvent.keyDown(cell, { key: "4" });
    expect(cell.textContent).toBe("4");
  });

  it("moves the caret with the arrows and clamps at all four edges", () => {
    const { container } = render(<SudokuScreen daily={DAILY} />);
    const board = boardOf();

    fireEvent.keyDown(board, { key: "ArrowRight" });
    expect(caretIndex(container)).toBe(0);

    fireEvent.keyDown(board, { key: "ArrowRight" });
    fireEvent.keyDown(board, { key: "ArrowDown" });
    expect(caretIndex(container)).toBe(SIDE + 1);

    for (const key of ["ArrowUp", "ArrowUp", "ArrowLeft", "ArrowLeft"]) {
      fireEvent.keyDown(board, { key });
    }
    expect(caretIndex(container)).toBe(0);

    fireEvent.click(cellAt(container, TOTAL_CELLS - 1));
    fireEvent.keyDown(board, { key: "ArrowDown" });
    fireEvent.keyDown(board, { key: "ArrowRight" });
    expect(caretIndex(container)).toBe(TOTAL_CELLS - 1);
  });

  it("jumps to the first and last column of the row with Home and End", () => {
    const { container } = render(<SudokuScreen daily={DAILY} />);
    const board = boardOf();

    fireEvent.click(cellAt(container, 4 * SIDE + 5));
    fireEvent.keyDown(board, { key: "Home" });
    expect(caretIndex(container)).toBe(4 * SIDE);

    fireEvent.keyDown(board, { key: "End" });
    expect(caretIndex(container)).toBe(4 * SIDE + SIDE - 1);
  });

  it("jumps to the first and last row of the column with PageUp and PageDown", () => {
    const { container } = render(<SudokuScreen daily={DAILY} />);
    const board = boardOf();

    fireEvent.click(cellAt(container, 4 * SIDE + 5));
    fireEvent.keyDown(board, { key: "PageUp" });
    expect(caretIndex(container)).toBe(5);

    fireEvent.keyDown(board, { key: "PageDown" });
    expect(caretIndex(container)).toBe((SIDE - 1) * SIDE + 5);
  });

  it("lets browser shortcuts through: Ctrl+PageUp and Cmd+5 are never prevented", () => {
    const { container } = render(<SudokuScreen daily={DAILY} />);
    const board = boardOf();

    fireEvent.click(cellAt(container, 4 * SIDE + 5));
    const passed = fireEvent.keyDown(board, { key: "PageUp", ctrlKey: true });
    expect(passed).toBe(true);
    expect(caretIndex(container)).toBe(4 * SIDE + 5);

    fireEvent.click(cellAt(container, FIRST_EMPTY));
    expect(fireEvent.keyDown(board, { key: "5", metaKey: true })).toBe(true);
    expect(cellAt(container, FIRST_EMPTY).textContent).toBe("");
  });

  it("writes with 1–9 and clears with 0, Backspace and Delete", () => {
    const { container } = render(<SudokuScreen daily={DAILY} />);
    const cell = cellAt(container, FIRST_EMPTY);

    for (const digit of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
      type(container, FIRST_EMPTY, String(digit));
      expect(cell.textContent).toBe(String(digit));

      fireEvent.keyDown(boardOf(), { key: String(digit) });
      expect(cell.textContent).toBe("");
    }

    for (const key of ["0", "Backspace", "Delete"]) {
      type(container, FIRST_EMPTY, "6");
      expect(cell.textContent).toBe("6");
      fireEvent.keyDown(boardOf(), { key });
      expect(cell.textContent).toBe("");
    }
  });

  it("prevents the page from scrolling under the caret", () => {
    render(<SudokuScreen daily={DAILY} />);
    const board = boardOf();

    for (const key of [
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "Home",
      "End",
    ]) {
      const event = createEvent.keyDown(board, { key });
      fireEvent(board, event);
      expect(event.defaultPrevented).toBe(true);
    }

    const tab = createEvent.keyDown(board, { key: "Tab" });
    fireEvent(board, tab);
    expect(tab.defaultPrevented).toBe(false);
  });
});

describe("closing the grid (T-WEB-S29)", () => {
  it("swaps the conclusion in place, with no navigation at all", async () => {
    const { container } = render(<SudokuScreen daily={DAILY} />);

    solveByTyping(container);

    await act(async () => {
      await import("../src/play/conclusion-view");
    });
    expect(container.querySelector("[data-conclusion-state]")).toHaveAttribute(
      "data-conclusion-state",
      "result",
    );
    expect(
      screen.getByText(messages.conclusion.stampLabel),
    ).toBeInTheDocument();
    expect(container.querySelector("[data-cell-index]")).toBeNull();

    expect(router.push).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();

    const [queued] = sync.flushPendingCompletions.mock.calls.at(-1) ?? [];
    expect(queued).toMatchObject({
      game: "sudoku",
      date: DATE,
      concluded: true,
      pendingSync: true,
      grid: [...SOLUTION],
    });
  }, 30_000);

  it("restores a finished day straight into the conclusion, clock stopped", async () => {
    vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
    const record = concludedRecord();
    window.localStorage.setItem(
      playRecordKey("sudoku", DATE),
      JSON.stringify(record),
    );

    const { container } = render(<SudokuScreen daily={DAILY} />);

    const frame = container.querySelector("[data-conclusion-state]");
    expect(frame).not.toBeNull();
    expect(frame?.childElementCount).toBeGreaterThan(0);
    expect(container.querySelector("[data-cell-index]")).toBeNull();

    await act(async () => {
      await import("../src/play/conclusion-view");
    });

    const stamped = messages.conclusion.stampAria(
      messages.games.sudoku.conclusion.title,

      formatElapsed(record.elapsedMs),
      record.hintsUsed,
    );
    expect(container.querySelector("[data-cell-index]")).toBeNull();
    expect(screen.getByLabelText(stamped)).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5_000);
    });

    expect(screen.getByLabelText(stamped)).toBeInTheDocument();

    expect(sync.flushPendingCompletions).not.toHaveBeenCalled();
  });
});

describe("the first paint (T-WEB-S30, T-WEB-S31)", () => {
  it("is a board-shaped skeleton: no record, no clock, no live affordance", () => {
    window.localStorage.setItem(
      playRecordKey("sudoku", DATE),
      JSON.stringify(concludedRecord()),
    );
    const readStorage = vi.spyOn(Storage.prototype, "getItem");
    const clock = vi.spyOn(Date, "now");

    const markup = renderToStaticMarkup(<SudokuScreen daily={DAILY} />);

    expect(readStorage).not.toHaveBeenCalled();
    expect(clock).not.toHaveBeenCalled();
    expect(markup).toContain('data-play-state="skeleton"');

    expect(markup).not.toContain("00:00");
    expect(markup).not.toContain(
      messages.games.sudoku.play.progressLong(CLUE_COUNT, TOTAL_CELLS),
    );
    expect(markup).not.toContain(
      messages.play.hint.available(FREE_HINTS_PER_PUZZLE),
    );
    expect(markup).not.toContain("<button");

    expect(markup).not.toContain(messages.conclusion.stampLabel);

    expect(markup).not.toContain("data-cell-index");
    expect(markup).not.toContain('tabindex="0"');
  });

  it("still paints the screen's own identity, including the level", () => {
    const markup = renderToStaticMarkup(<SudokuScreen daily={DAILY} />);

    expect(markup).toContain(messages.games.sudoku.play.title);
    expect(markup).toContain(messages.games.sudoku.play.rules);
    expect(markup).toContain(LEVEL);
  });

  it("reserves every box the play shell occupies, so nothing moves", () => {
    const skeleton = parsed(
      renderToStaticMarkup(<SudokuScreen daily={DAILY} />),
    );
    const { container: hydrated } = render(<SudokuScreen daily={DAILY} />);

    expect(occupantsIn(hydrated)).toEqual(
      expect.arrayContaining(["board", "hint", "statsCard"]),
    );
    expect(occupantsIn(skeleton)).toEqual(occupantsIn(hydrated));

    for (const [local, count] of [
      ["cell", TOTAL_CELLS],
      ["keypadDigit", 9],
      ["keypadPencil", 1],
      ["keypadErase", 1],
      ["rule", 4],
    ] as const) {
      expect(skeleton.querySelectorAll(`.${className(local)}`)).toHaveLength(
        count,
      );
      expect(hydrated.querySelectorAll(`.${className(local)}`)).toHaveLength(
        count,
      );
    }
  });

  it("reserves them without a value, a control or a tab stop", () => {
    const skeleton = parsed(
      renderToStaticMarkup(<SudokuScreen daily={DAILY} />),
    );

    for (const readout of [
      "timerBar",
      "timerCard",
      "progressBar",
      "progressCard",
    ]) {
      expect(
        skeleton.querySelector(`.${className(readout)}`)?.textContent,
      ).toBe(" ");
    }

    expect(
      skeleton.querySelectorAll("button, a[href], [tabindex]"),
    ).toHaveLength(1);
  });
});

describe("the board and keypad arithmetic (T-WEB-S34)", () => {
  const MOBILE = bodyOf(GAME_CSS, "@media (max-width: 768px)");
  const SHARED_MOBILE = bodyOf(SHARED_CSS, "@media (max-width: 768px)");

  const CARD_BORDER = 1;

  const GAPS = 10;
  const GUTTERS = 2;

  function cellAtFloor(): number {
    const padding = pixels(decl(bodyOf(SHARED_MOBILE, ".gridCard"), "padding"));
    const gap = pixels(decl(bodyOf(MOBILE, ".grid"), "gap"));
    const gutter = 2;
    return (
      (boardFloor() -
        2 * padding -
        2 * CARD_BORDER -
        GAPS * gap -
        GUTTERS * gutter) /
      SIDE
    );
  }

  it("sizes the board fluidly at every width, with the gutter tracks fixed", () => {
    const grid = bodyOf(GAME_CSS, ".grid");

    expect(decl(grid, "grid-template-columns")).toContain("minmax(0, 1fr)");
    expect(decl(grid, "grid-template-columns")).not.toMatch(/\d+px\)/);
    expect(decl(grid, "grid-template-columns")).toBe(
      decl(grid, "grid-template-rows"),
    );

    expect(decl(grid, "grid-template-columns")).toContain("2px");
    expect(decl(grid, "aspect-ratio")).toBe("1");
    expect(decl(bodyOf(GAME_CSS, ".pageSudoku"), "--board-max")).toMatch(
      /^\d+px$/,
    );
  });

  it("keeps every cell clear of WCAG 2.5.8's 24px floor at the board floor", () => {
    expect(cellAtFloor()).toBeGreaterThanOrEqual(24);
  });

  it("keeps every keypad key clear of the 44px touch target at the board floor", () => {
    const keypad = bodyOf(MOBILE, ".keypad");
    const minimum = token("--touch-target-min");
    const rows = /repeat\((\d+),\s*(\d+px)\)/.exec(
      decl(keypad, "grid-template-rows") ?? "",
    );
    const slots = Number(
      /repeat\((\d+),/.exec(decl(keypad, "grid-template-columns") ?? "")?.[1],
    );
    const gap = pixels(decl(keypad, "column-gap"));

    expect(slots).toBe(6);
    expect(decl(keypad, "width")).toBe("var(--board-side)");
    expect(Number(rows?.[1])).toBe(2);
    expect(pixels(rows?.[2])).toBeGreaterThanOrEqual(minimum);
    expect((boardFloor() - (slots - 1) * gap) / slots).toBeGreaterThanOrEqual(
      minimum,
    );

    const pencil = bodyOf(MOBILE, ".keypadPencil");
    expect(decl(pencil, "grid-row")).toBe("1");
    expect(decl(pencil, "grid-column")).toBe(String(slots));
    const erase = bodyOf(MOBILE, ".keypadErase");
    expect(decl(erase, "grid-column")).toBe(`${String(slots - 1)} / -1`);
  });

  it("gives the desktop keypad the board's tracks, and never a digit under the 44px target", () => {
    const grid = bodyOf(GAME_CSS, ".grid");
    const keypad = bodyOf(GAME_CSS, ".keypad");
    const minimum = token("--touch-target-min");

    expect(decl(keypad, "grid-template-columns")).toBe(
      decl(grid, "grid-template-columns"),
    );
    expect(decl(keypad, "gap")).toBe(decl(grid, "gap"));

    const width = (decl(keypad, "width") ?? "").replace(/\s+/g, " ");
    expect(width).toMatch(/^max\( ?calc\(var\(--board-side\) - /);

    const floorWidth = [
      ...width.matchAll(/(\d+) \* (var\(--touch-target-min\)|\d+px)/g),
    ].reduce(
      (total, [, count, unit]) =>
        total +
        Number(count) *
          (unit === "var(--touch-target-min)" ? minimum : pixels(unit)),
      0,
    );
    const gutters = 2 * 2;
    const gaps = 10 * pixels(decl(grid, "gap"));
    expect((floorWidth - gutters - gaps) / SIDE).toBeGreaterThanOrEqual(
      minimum,
    );
  });

  it("reserves the keypad under the card, desktop and phone", () => {
    const rows = (body: string) =>
      (decl(body, "grid-template-rows") ?? "")
        .match(/\d+px/g)
        ?.map((row) => pixels(row)) ?? [];
    const desktop = bodyOf(GAME_CSS, ".keypad");
    const phone = bodyOf(MOBILE, ".keypad");

    expect(decl(bodyOf(GAME_CSS, ".pageSudoku"), "--board-below")).toBe(
      `calc(var(--space-6) + ${String(rows(desktop)[0])}px + var(--space-2) + ${String(rows(desktop)[1])}px)`,
    );
    expect(decl(bodyOf(MOBILE, ".pageSudoku"), "--board-below")).toBe(
      `calc(var(--space-4) + 2 * ${String(rows(phone)[0])}px + var(--space-2))`,
    );
    expect(decl(desktop, "margin-top")).toBe("var(--space-6)");
    expect(decl(phone, "margin-top")).toBe("var(--space-4)");
    expect(decl(desktop, "row-gap")).toBe("8px");
    expect(decl(phone, "row-gap")).toBe("var(--space-2)");
  });

  it("places each digit on the column `track()` computes for that cell", () => {
    for (let index = 0; index < SIDE; index += 1) {
      const rule = bodyOf(GAME_CSS, `.keypadDigit:nth-child(${index + 1})`);
      expect(Number(decl(rule, "grid-column"))).toBe(track(index));
    }
  });
});

describe("the keypad's apagar is the ⌫ key (T-WEB-S623)", () => {
  it("draws the glyph, keeps its name, and the skeleton draws the same", () => {
    const skeleton = parsed(
      renderToStaticMarkup(<SudokuScreen daily={DAILY} />),
    ).querySelector(`.${className("keypadErase")}`);
    render(<SudokuScreen daily={DAILY} />);
    const erase = screen.getByRole("button", {
      name: messages.games.sudoku.play.keypad.eraseAria,
    });

    expect(erase.textContent).toBe("");
    expect(erase.querySelector("svg")?.getAttribute("aria-hidden")).toBe(
      "true",
    );
    expect(skeleton?.innerHTML).toBe(erase.innerHTML);
  });
});

describe("the keypad tells a placed-out digit (T-WEB-S651)", () => {
  const keypad = messages.games.sudoku.play.keypad;

  const DIGIT = ([1, 2, 3, 4, 5, 6, 7, 8, 9] as const).reduce((best, digit) =>
    PUZZLE.givens.filter((cell) => cell === digit).length >
    PUZZLE.givens.filter((cell) => cell === best).length
      ? digit
      : best,
  );

  const MISSING = PUZZLE.givens.flatMap((given, index) =>
    given === 0 && SOLUTION[index] === DIGIT ? [index] : [],
  );

  const ELSEWHERE = PUZZLE.givens.findIndex(
    (given, index) => given === 0 && SOLUTION[index] !== DIGIT,
  );

  it("fades at nine, turns red above nine, and returns as copies leave", () => {
    const { container } = render(<SudokuScreen daily={DAILY} />);
    const key = () => {
      const keys = container.querySelectorAll<HTMLElement>(
        `.${className("keypadDigit")}`,
      );
      const found = keys[DIGIT - 1];
      if (found === undefined) {
        throw new Error(`no keypad key for ${DIGIT}`);
      }
      return found;
    };

    expect(key()).toHaveAttribute("aria-label", keypad.digitAria(DIGIT));
    expect(key().className).toBe(className("keypadDigit"));

    for (const index of MISSING) {
      type(container, index, String(DIGIT));
    }
    expect(key()).toHaveAttribute(
      "aria-label",
      keypad.digitCompleteAria(DIGIT),
    );
    expect(key()).toHaveClass(className("keypadComplete"));
    expect(key().textContent).toBe(`${DIGIT}✓`);
    expect(key()).toBeEnabled();

    type(container, ELSEWHERE, String(DIGIT));
    expect(key()).toHaveAttribute(
      "aria-label",
      keypad.digitOverAria(DIGIT, 10),
    );
    expect(key()).toHaveClass(className("keypadOver"));
    expect(key()).not.toHaveClass(className("keypadComplete"));
    expect(key().textContent).toBe(`${DIGIT}10`);

    type(container, ELSEWHERE, "Backspace");
    expect(key()).toHaveClass(className("keypadComplete"));

    type(container, MISSING[0] ?? FIRST_EMPTY, "Backspace");
    expect(key()).toHaveAttribute("aria-label", keypad.digitAria(DIGIT));
    expect(key().className).toBe(className("keypadDigit"));
    expect(key().textContent).toBe(String(DIGIT));
  });
});
