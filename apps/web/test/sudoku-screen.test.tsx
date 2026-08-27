import {
  dailySudokuResponseSchema,
  type DailySudokuResponse,
} from "@miolos/core";
import { generateDailySudoku } from "@miolos/games/sudoku";
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
import { solutionDigits, track } from "../src/sudoku/engine";
import type { SudokuDigit } from "../src/sudoku/state";
import styles from "../src/sudoku/sudoku-board.module.css";
import { SudokuScreen } from "../src/sudoku/sudoku-screen";
import { bodyOf, decl, pixels, stylesheet, token } from "./css-source";

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

describe("the one free hint (T-WEB-S28a)", () => {
  it("fills exactly one cell, then renders the exhausted variant", () => {
    render(<SudokuScreen daily={DAILY} />);

    fireEvent.click(
      screen.getByText(messages.games.sudoku.play.hint.available),
    );

    expect(
      screen.getByText(
        messages.games.sudoku.play.progressLong(CLUE_COUNT + 1, TOTAL_CELLS),
      ),
    ).toBeInTheDocument();
    const exhausted = screen.getByText(messages.games.sudoku.play.hint.used);
    expect(exhausted).toHaveAttribute("aria-disabled", "true");

    expect(
      screen.getByText(messages.games.sudoku.play.hint.explain.fill),
    ).toBeInTheDocument();

    fireEvent.click(exhausted);

    expect(
      screen.getByText(
        messages.games.sudoku.play.progressLong(CLUE_COUNT + 1, TOTAL_CELLS),
      ),
    ).toBeInTheDocument();
  });

  it("leaves the caret where the player put it (§8.3)", () => {
    const { container } = render(<SudokuScreen daily={DAILY} />);
    fireEvent.click(cellAt(container, FIRST_EMPTY));
    expect(caretIndex(container)).toBe(FIRST_EMPTY);

    fireEvent.click(
      screen.getByText(messages.games.sudoku.play.hint.available),
    );

    expect(caretIndex(container)).toBe(FIRST_EMPTY);
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
    expect(markup).not.toContain(messages.games.sudoku.play.hint.available);
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

  const PAGE_PADDING = 2 * token("--space-5");
  const NARROWEST_VIEWPORT = 320;
  const REFERENCE_VIEWPORT = 390;

  const CARD_BORDER = 1;

  const GAPS = 10;
  const GUTTERS = 2;

  function boardInnerWidth(viewport: number): number {
    const cap = pixels(
      decl(bodyOf(GAME_CSS, ".pageSudoku"), "--board-mobile-max"),
    );
    const padding = pixels(decl(bodyOf(SHARED_MOBILE, ".gridCard"), "padding"));
    const card = Math.min(cap, viewport - PAGE_PADDING);
    return card - 2 * padding - 2 * CARD_BORDER;
  }

  function mobileCell(viewport: number): number {
    const gap = pixels(decl(bodyOf(MOBILE, ".grid"), "gap"));
    const gutter = 2;
    return (boardInnerWidth(viewport) - GAPS * gap - GUTTERS * gutter) / SIDE;
  }

  function mobileKeypadButton(viewport: number): number {
    const keypad = bodyOf(MOBILE, ".keypad");
    const gap = pixels(decl(keypad, "gap"));
    const cap = pixels(
      decl(bodyOf(GAME_CSS, ".pageSudoku"), "--board-mobile-max"),
    );
    const row = Math.min(cap, viewport - PAGE_PADDING);
    return (row - 3 * gap) / 4;
  }

  it("sizes the board fluidly, with the gutter tracks fixed", () => {
    const grid = bodyOf(MOBILE, ".grid");
    const card = bodyOf(SHARED_MOBILE, ".gridCard");

    expect(decl(grid, "grid-template-columns")).toContain("minmax(0, 1fr)");
    expect(decl(grid, "grid-template-columns")).toBe(
      decl(grid, "grid-template-rows"),
    );

    expect(decl(grid, "grid-template-columns")).toContain("2px");
    expect(decl(grid, "aspect-ratio")).toBe("1");

    expect(decl(card, "box-sizing")).toBe("border-box");
    expect(decl(card, "width")).toBe("100%");
    expect(decl(card, "max-width")).toBe("var(--board-mobile-max)");
  });

  it("keeps every cell clear of WCAG 2.5.8's 24px floor down to 320px", () => {
    expect(mobileCell(REFERENCE_VIEWPORT)).toBeGreaterThanOrEqual(24);
    expect(mobileCell(NARROWEST_VIEWPORT)).toBeGreaterThanOrEqual(24);
    expect(mobileCell(REFERENCE_VIEWPORT)).toBeGreaterThan(
      mobileCell(NARROWEST_VIEWPORT),
    );
  });

  it("keeps every keypad key clear of the 44px touch target down to 320px", () => {
    const keypad = bodyOf(MOBILE, ".keypad");
    const minimum = token("--touch-target-min");
    const rows = decl(keypad, "grid-template-rows")?.split(/\s+/) ?? [];

    expect(decl(keypad, "width")).toBe("100%");
    expect(decl(keypad, "max-width")).toBe("var(--board-mobile-max)");
    expect(decl(keypad, "grid-template-columns")).toBe(
      "repeat(4, minmax(0, 1fr))",
    );
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expect(pixels(row)).toBeGreaterThanOrEqual(minimum);
    }
    expect(mobileKeypadButton(REFERENCE_VIEWPORT)).toBeGreaterThanOrEqual(
      minimum,
    );
    expect(mobileKeypadButton(NARROWEST_VIEWPORT)).toBeGreaterThanOrEqual(
      minimum,
    );

    expect(decl(bodyOf(MOBILE, ".keypadErase"), "grid-column")).toBe("2 / -1");
  });

  it("gives the desktop keypad the board's exact inner width and tracks", () => {
    const grid = bodyOf(GAME_CSS, ".grid");
    const keypad = bodyOf(GAME_CSS, ".keypad");
    const template = decl(grid, "grid-template-columns") ?? "";
    const cell = Number(/repeat\(3,\s*(\d+(?:\.\d+)?)px\)/.exec(template)?.[1]);
    const gutter = Number(/\)\s+(\d+(?:\.\d+)?)px/.exec(template)?.[1]);
    const gap = pixels(decl(grid, "gap"));

    expect(decl(keypad, "grid-template-columns")).toBe(template);
    expect(pixels(decl(keypad, "width"))).toBe(
      SIDE * cell + GAPS * gap + GUTTERS * gutter,
    );
  });

  it("places each digit on the column `track()` computes for that cell", () => {
    for (let index = 0; index < SIDE; index += 1) {
      const rule = bodyOf(GAME_CSS, `.keypadDigit:nth-child(${index + 1})`);
      expect(Number(decl(rule, "grid-column"))).toBe(track(index));
    }
  });
});
