import {
  dailyNonogramResponseSchema,
  type DailyNonogramResponse,
  type NonogramSize,
} from "@miolos/core";
import { generateNonogram } from "@miolos/games/nonogram";
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
import { Board } from "../src/nonogram/board";
import { filledTarget, solutionMarks } from "../src/nonogram/engine";
import styles from "../src/nonogram/nonogram-board.module.css";
import { NonogramConclusion } from "../src/nonogram/nonogram-conclusion";
import { NonogramScreen } from "../src/nonogram/nonogram-screen";
import type { NonogramCellValue, NonogramMark } from "../src/nonogram/state";
import {
  playRecordKey,
  type NonogramPlayRecord,
} from "../src/play/play-record";
import sharedStyles from "../src/play/screen.module.css";
import { bodyOf, decl, pixels, stylesheet, token } from "./css-source";
import { installPointerStubs, stubElementFromPoint } from "./pointer";

const sync = vi.hoisted(() => ({
  startCompletionSync: vi.fn(() => () => undefined),
  flushPendingCompletions: vi.fn((record?: NonogramPlayRecord) =>
    Promise.resolve(record),
  ),
}));
vi.mock("../src/play/sync", () => sync);

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/nonogram",
}));

const DATE = "2026-08-01";

const SMALL = daily(generateNonogram(20_260_801, 1));

const BIG = daily(generateNonogram(20_260_802, 7));

function daily(puzzle: {
  readonly size: number;
  readonly clues: unknown;
}): DailyNonogramResponse {
  return dailyNonogramResponseSchema.parse({
    game: "nonogram",
    date: DATE,
    size: puzzle.size,
    clues: puzzle.clues,
  });
}

function solutionOf(fixture: DailyNonogramResponse): readonly NonogramMark[] {
  const marks = solutionMarks(fixture.clues);
  if (marks === null) {
    throw new Error("a published daily solves by construction");
  }
  return marks;
}

const SOLUTION = solutionOf(SMALL);
const TARGET = filledTarget(SMALL.clues);

const PICTURE: readonly number[] = SOLUTION.flatMap((mark, index) =>
  mark === 1 ? [index] : [],
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

function boardOf(fixture: DailyNonogramResponse): HTMLElement {
  return screen.getByRole("group", {
    name: messages.games.nonogram.play.boardAria(fixture.size),
  });
}

function caretIndex(container: HTMLElement): number {
  const tabbable = container.querySelectorAll<HTMLElement>(
    '[data-cell-index][tabindex="0"]',
  );
  expect(tabbable).toHaveLength(1);
  return Number(tabbable[0]?.dataset.cellIndex);
}

function markAt(container: HTMLElement, index: number): NonogramCellValue {
  const cell = cellAt(container, index);
  if (cell.classList.contains(className("cellFilled"))) {
    return 1;
  }
  if (cell.classList.contains(className("cellCrossed"))) {
    return 0;
  }
  return null;
}

function paintThePicture(container: HTMLElement): void {
  for (const index of PICTURE) {
    fireEvent.click(cellAt(container, index));
  }
}

function concludedRecord(
  overrides: Partial<NonogramPlayRecord> = {},
): NonogramPlayRecord {
  const entries = SOLUTION.map((mark) => (mark === 1 ? 1 : null));
  return {
    v: 1,
    game: "nonogram",
    date: DATE,
    size: SMALL.size,
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

const GAME_CSS = stylesheet("src/nonogram/nonogram-board.module.css");
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
      `neither nonogram-board.module.css nor play/screen.module.css declares .${local}`,
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

installPointerStubs();

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("the composite widget (T-WEB-S42)", () => {
  it("is one tab stop, not size² of them, and not a role=grid", () => {
    const { container } = render(<NonogramScreen daily={BIG} />);

    const board = boardOf(BIG);
    expect(board).toHaveAttribute("role", "group");

    expect(container.querySelector('[role="grid"]')).toBeNull();
    expect(container.querySelector('[role="row"]')).toBeNull();
    expect(container.querySelectorAll("[data-cell-index]")).toHaveLength(
      BIG.size ** 2,
    );
    expect(caretIndex(container)).toBe(0);
    expect(
      container.querySelectorAll('[data-cell-index][tabindex="-1"]'),
    ).toHaveLength(BIG.size ** 2 - 1);

    expect(board.querySelectorAll("[aria-disabled]")).toHaveLength(0);
  });

  it("selects the cell a Tab lands on, so the writing keys are not a silent no-op", () => {
    const { container } = render(<NonogramScreen daily={SMALL} />);

    const entry = caretIndex(container);
    act(() => {
      cellAt(container, entry).focus();
    });
    expect(cellAt(container, entry).className).toContain(
      className("cellSelected"),
    );

    fireEvent.keyDown(cellAt(container, entry), { key: "1" });
    expect(markAt(container, entry)).toBe(1);
  });

  it("puts DOM focus on the cell the pointer selected", () => {
    const { container } = render(<NonogramScreen daily={SMALL} />);
    const cell = cellAt(container, 3);

    fireEvent.click(cell);

    expect(cell).toHaveFocus();
    expect(caretIndex(container)).toBe(3);
  });

  it("moves the caret with the arrows and clamps at all four edges", () => {
    const { container } = render(<NonogramScreen daily={BIG} />);
    const board = boardOf(BIG);
    const side = BIG.size;

    fireEvent.keyDown(board, { key: "ArrowRight" });
    expect(caretIndex(container)).toBe(0);

    fireEvent.keyDown(board, { key: "ArrowRight" });
    fireEvent.keyDown(board, { key: "ArrowDown" });
    expect(caretIndex(container)).toBe(side + 1);

    for (const key of ["ArrowUp", "ArrowUp", "ArrowLeft", "ArrowLeft"]) {
      fireEvent.keyDown(board, { key });
    }
    expect(caretIndex(container)).toBe(0);

    fireEvent.click(cellAt(container, side * side - 1));
    fireEvent.keyDown(board, { key: "ArrowDown" });
    fireEvent.keyDown(board, { key: "ArrowRight" });
    expect(caretIndex(container)).toBe(side * side - 1);
  });

  it("reaches the row's and the column's ends with Home/End and PageUp/PageDown", () => {
    const { container } = render(<NonogramScreen daily={BIG} />);
    const board = boardOf(BIG);
    const side = BIG.size;

    fireEvent.click(cellAt(container, 7 * side + 9));
    fireEvent.keyDown(board, { key: "Home" });
    expect(caretIndex(container)).toBe(7 * side);
    fireEvent.keyDown(board, { key: "End" });
    expect(caretIndex(container)).toBe(7 * side + side - 1);

    fireEvent.click(cellAt(container, 7 * side + 4));
    fireEvent.keyDown(board, { key: "PageUp" });
    expect(caretIndex(container)).toBe(4);
    fireEvent.keyDown(board, { key: "PageDown" });
    expect(caretIndex(container)).toBe((side - 1) * side + 4);
  });

  it("writes with 1 and 2 and clears with 0, Backspace and Delete", () => {
    const { container } = render(<NonogramScreen daily={SMALL} />);
    const board = boardOf(SMALL);

    for (const key of ["ArrowRight", "ArrowRight", "ArrowRight"]) {
      fireEvent.keyDown(board, { key });
    }
    expect(caretIndex(container)).toBe(2);

    for (const [key, value] of [
      ["1", 1],
      ["2", 0],
    ] as const) {
      fireEvent.keyDown(board, { key });
      expect(markAt(container, 2)).toBe(value);
      fireEvent.keyDown(board, { key });
      expect(markAt(container, 2)).toBeNull();
    }

    for (const key of ["0", "Backspace", "Delete"]) {
      fireEvent.keyDown(board, { key: "1" });
      expect(markAt(container, 2)).toBe(1);
      fireEvent.keyDown(board, { key });
      expect(markAt(container, 2)).toBeNull();
    }
  });

  it("prevents the page from scrolling under the caret", () => {
    render(<NonogramScreen daily={BIG} />);
    const board = boardOf(BIG);

    for (const key of [
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "Home",
      "End",
      "PageUp",
      "PageDown",
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

describe("the clue rails (T-WEB-S43)", () => {
  it("renders one labelled rail per row and per column", () => {
    const { container } = render(<NonogramScreen daily={BIG} />);
    const copy = messages.games.nonogram.play;

    for (const [row, runs] of BIG.clues.rows.entries()) {
      expect(
        screen.getByLabelText(copy.rowCluesAria(row + 1, runs)),
      ).toBeInTheDocument();
    }
    for (const [column, runs] of BIG.clues.cols.entries()) {
      expect(
        screen.getByLabelText(copy.columnCluesAria(column + 1, runs)),
      ).toBeInTheDocument();
    }
    expect(container.querySelectorAll('[id^="nonogram-clue-"]')).toHaveLength(
      2 * BIG.size,
    );
  });

  it("is never a role-less labelled div — the defect class N16 names", () => {
    const { container } = render(<NonogramScreen daily={BIG} />);

    const rails = container.querySelectorAll('[id^="nonogram-clue-"]');
    expect(rails.length).toBeGreaterThan(0);
    for (const rail of rails) {
      expect(rail).toHaveAttribute("role", "group");
      expect(rail.getAttribute("aria-label") ?? "").not.toBe("");
    }
  });

  it("renders `0` for an all-empty line, in the rail AND in its label", () => {
    const { container } = render(<NonogramScreen daily={BIG} />);
    const empty = BIG.clues.rows.findIndex((runs) => runs.length === 0);
    if (empty === -1) {
      expect(messages.games.nonogram.play.rowCluesAria(1, [])).toContain("0");
      return;
    }

    const rail = container.querySelector(`#nonogram-clue-row-${empty}`);
    expect(rail?.textContent).toBe("0");
    expect(rail).toHaveAttribute(
      "aria-label",
      messages.games.nonogram.play.rowCluesAria(empty + 1, []),
    );
  });

  it("describes every cell by its two rails, and names it by its state", () => {
    const { container } = render(<NonogramScreen daily={SMALL} />);
    const copy = messages.games.nonogram.play;
    const side = SMALL.size;

    for (let index = 0; index < side * side; index += 1) {
      const row = Math.floor(index / side);
      const column = index % side;
      const described = cellAt(container, index).getAttribute(
        "aria-describedby",
      );
      expect(described).toBe(
        `nonogram-clue-row-${row} nonogram-clue-col-${column}`,
      );

      for (const id of described?.split(" ") ?? []) {
        expect(container.querySelector(`#${id}`)).not.toBeNull();
      }
    }

    const board = boardOf(SMALL);
    fireEvent.click(cellAt(container, 0));
    expect(cellAt(container, 0)).toHaveAttribute(
      "aria-label",
      copy.cellAria(1, 1, 1),
    );
    fireEvent.keyDown(board, { key: "2" });
    expect(cellAt(container, 0)).toHaveAttribute(
      "aria-label",
      copy.cellAria(1, 1, 0),
    );
    fireEvent.keyDown(board, { key: "0" });
    expect(cellAt(container, 0)).toHaveAttribute(
      "aria-label",
      copy.cellAria(1, 1, null),
    );
  });

  it("announces each run ONCE, through the rail's label and never as bare digits (T-WEB-S68)", () => {
    const { container } = render(<NonogramScreen daily={BIG} />);

    const numerals = container.querySelectorAll(
      '[id^="nonogram-clue-"] > span',
    );

    expect(numerals.length).toBeGreaterThanOrEqual(BIG.size * 2);
    for (const numeral of numerals) {
      expect(numeral).toHaveAttribute("aria-hidden", "true");

      expect(numeral.textContent).toMatch(/^\d+$/);
    }

    const rail = container.querySelector("#nonogram-clue-row-0");
    expect(rail).toHaveAttribute(
      "aria-label",
      messages.games.nonogram.play.rowCluesAria(1, BIG.clues.rows[0] ?? []),
    );
  });
});

describe("the brush (T-WEB-S44)", () => {
  const copy = messages.games.nonogram.play.controls;

  function brushButton(mode: "fill" | "cross" | "erase"): HTMLElement {
    return screen.getByLabelText(
      { fill: copy.fillAria, cross: copy.crossAria, erase: copy.eraseAria }[
        mode
      ],
    );
  }

  it("is three sticky modes with exactly one pressed, `preencher` first", () => {
    render(<NonogramScreen daily={SMALL} />);

    const pressed = screen
      .getAllByRole("button", { pressed: true })
      .map((button) => button.getAttribute("aria-label"));
    expect(pressed).toEqual([copy.fillAria]);
    expect(screen.getAllByRole("button", { pressed: false })).toHaveLength(2);

    expect(brushButton("fill").className).toContain(className("controlActive"));
    for (const mode of ["cross", "erase"] as const) {
      expect(brushButton(mode).className).not.toContain(
        className("controlActive"),
      );
    }
  });

  it("changes what a tap writes, and pressing the active brush is a no-op", () => {
    const { container } = render(<NonogramScreen daily={SMALL} />);

    fireEvent.click(cellAt(container, 1));
    expect(markAt(container, 1)).toBe(1);

    fireEvent.click(brushButton("cross"));
    fireEvent.click(cellAt(container, 2));
    expect(markAt(container, 2)).toBe(0);

    fireEvent.click(brushButton("cross"));
    expect(brushButton("cross")).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(cellAt(container, 3));
    expect(markAt(container, 3)).toBe(0);

    fireEvent.click(brushButton("erase"));
    fireEvent.click(cellAt(container, 1));
    expect(markAt(container, 1)).toBeNull();
  });
});

describe("the stroke (T-WEB-S45)", () => {
  it("paints every cell it crosses, as a SET rather than a toggle", () => {
    const { container } = render(<NonogramScreen daily={SMALL} />);
    stubElementFromPoint(container);
    const board = boardOf(SMALL);

    fireEvent.pointerDown(board, { clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(board, { clientX: 1, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(board, { clientX: 2, clientY: 0, pointerId: 1 });

    fireEvent.pointerMove(board, { clientX: 1, clientY: 0, pointerId: 1 });
    fireEvent.pointerUp(board, { clientX: 1, clientY: 0, pointerId: 1 });

    for (const index of [0, 1, 2]) {
      expect(markAt(container, index)).toBe(1);
    }
  });

  it("writes a stationary tap from pointerup, without double-applying", () => {
    const { container } = render(<NonogramScreen daily={SMALL} />);
    stubElementFromPoint(container);
    const board = boardOf(SMALL);

    fireEvent.pointerDown(board, { clientX: 4, clientY: 0, pointerId: 1 });
    fireEvent.pointerUp(board, { clientX: 4, clientY: 0, pointerId: 1 });
    expect(markAt(container, 4)).toBe(1);

    fireEvent.click(cellAt(container, 4), { detail: 1 });
    expect(markAt(container, 4)).toBe(1);
  });

  it("writes nothing for a non-primary button", () => {
    const { container } = render(<NonogramScreen daily={SMALL} />);
    stubElementFromPoint(container);
    const board = boardOf(SMALL);

    fireEvent.pointerDown(board, {
      clientX: 4,
      clientY: 0,
      pointerId: 1,
      button: 2,
    });
    fireEvent.pointerUp(board, {
      clientX: 4,
      clientY: 0,
      pointerId: 1,
      button: 2,
    });

    expect(markAt(container, 4)).toBeNull();
  });

  it("survives a second finger touching and lifting mid-stroke", () => {
    const { container } = render(<NonogramScreen daily={SMALL} />);
    stubElementFromPoint(container);
    const board = boardOf(SMALL);

    fireEvent.pointerDown(board, { clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(board, { clientX: 1, clientY: 0, pointerId: 1 });

    fireEvent.pointerDown(board, { clientX: 9, clientY: 0, pointerId: 2 });
    fireEvent.pointerUp(board, { clientX: 9, clientY: 0, pointerId: 2 });
    fireEvent.pointerMove(board, { clientX: 2, clientY: 0, pointerId: 1 });
    fireEvent.pointerUp(board, { clientX: 2, clientY: 0, pointerId: 1 });

    for (const index of [0, 1, 2]) {
      expect(markAt(container, index)).toBe(1);
    }
    expect(markAt(container, 9)).toBeNull();
  });

  it("reopens after a stroke whose pointer never lifts", () => {
    const { container } = render(<NonogramScreen daily={SMALL} />);
    stubElementFromPoint(container);
    const board = boardOf(SMALL);

    fireEvent.pointerDown(board, { clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.lostPointerCapture(board, { pointerId: 1 });

    fireEvent.pointerDown(board, { clientX: 6, clientY: 0, pointerId: 2 });
    fireEvent.pointerUp(board, { clientX: 6, clientY: 0, pointerId: 2 });

    expect(markAt(container, 6)).toBe(1);
  });

  it("hands the caret back to the cell the stroke ended on", () => {
    const { container } = render(<NonogramScreen daily={SMALL} />);
    stubElementFromPoint(container);
    const board = boardOf(SMALL);

    fireEvent.pointerDown(board, { clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(board, { clientX: 1, clientY: 0, pointerId: 1 });
    fireEvent.pointerUp(board, { clientX: 1, clientY: 0, pointerId: 1 });

    expect(cellAt(container, 1)).toHaveFocus();
    expect(caretIndex(container)).toBe(1);
  });
});

describe("the board's re-render budget (T-WEB-S57)", () => {
  it("is memoized, so an unrelated tick cannot reconcile 225 cells", () => {
    //

    expect(Board).toHaveProperty("$$typeof", Symbol.for("react.memo"));
    expect(Board).toHaveProperty("type", expect.any(Function));
  });

  it("composes ONE label per painted cell during a drag — cells AND rails, not size² + 2·size (T-WEB-S66)", () => {
    //

    //

    const { container } = render(<NonogramScreen daily={BIG} />);
    stubElementFromPoint(container);
    const board = boardOf(BIG);
    const cells = BIG.size * BIG.size;
    const painted = 8;

    const cellAria = vi.spyOn(messages.games.nonogram.play, "cellAria");
    const rowCluesAria = vi.spyOn(messages.games.nonogram.play, "rowCluesAria");
    const columnCluesAria = vi.spyOn(
      messages.games.nonogram.play,
      "columnCluesAria",
    );

    fireEvent.pointerDown(board, { clientX: 0, clientY: 0, pointerId: 1 });
    for (let index = 1; index < painted; index += 1) {
      fireEvent.pointerMove(board, {
        clientX: index,
        clientY: 0,
        pointerId: 1,
      });
    }
    fireEvent.pointerUp(board, {
      clientX: painted - 1,
      clientY: 0,
      pointerId: 1,
    });

    for (let index = 0; index < painted; index += 1) {
      expect(markAt(container, index)).toBe(1);
    }

    expect(cellAria.mock.calls.length).toBeLessThan(cells);

    expect(rowCluesAria.mock.calls.length).toBe(0);
    expect(columnCluesAria.mock.calls.length).toBe(0);
    cellAria.mockRestore();
    rowCluesAria.mockRestore();
    columnCluesAria.mockRestore();
  });
});

describe("the four branches (T-WEB-S47)", () => {
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

  it("renders the unavailable card when the clues do not solve — BEFORE the hydration gate", () => {
    const impossible = dailyNonogramResponseSchema.parse({
      game: "nonogram",
      date: DATE,
      size: 5,
      clues: {
        size: 5,
        rows: [[5], [5], [5], [5], [5]],
        cols: [[1], [1], [1], [1], [1]],
      },
    });

    const { container } = render(<NonogramScreen daily={impossible} />);

    expect(
      screen.getByText(messages.games.nonogram.play.unavailable.title),
    ).toBeInTheDocument();

    expect(container.querySelector("[data-play-state]")).toBeNull();
    expect(container.querySelector("[data-conclusion-state]")).toBeNull();
  });

  it("paints a board-shaped skeleton first: no record, no clock, no live affordance", () => {
    window.localStorage.setItem(
      playRecordKey("nonogram", DATE),
      JSON.stringify(concludedRecord()),
    );
    const readStorage = vi.spyOn(Storage.prototype, "getItem");
    const clock = vi.spyOn(Date, "now");

    const markup = renderToStaticMarkup(<NonogramScreen daily={SMALL} />);

    expect(readStorage).not.toHaveBeenCalled();
    expect(clock).not.toHaveBeenCalled();
    expect(markup).toContain('data-play-state="skeleton"');
    expect(markup).not.toContain("00:00");
    expect(markup).not.toContain(
      messages.games.nonogram.play.progressLong(0, TARGET),
    );
    expect(markup).not.toContain(messages.games.nonogram.play.hint.available);

    expect(markup).not.toContain(messages.conclusion.stampLabel);
    expect(markup).not.toContain("data-cell-index");
    expect(markup).not.toContain('tabindex="0"');
  });

  it("still paints the screen's own identity, including the rules and the size", () => {
    const markup = renderToStaticMarkup(<NonogramScreen daily={SMALL} />);

    expect(markup).toContain(messages.games.nonogram.play.title);
    expect(markup).toContain(messages.games.nonogram.play.rules);
    expect(markup).toContain(messages.games.nonogram.play.sizeLabel);
  });

  it("reserves every box the play shell occupies, so nothing moves", () => {
    const skeleton = parsed(
      renderToStaticMarkup(<NonogramScreen daily={SMALL} />),
    );
    const { container: hydrated } = render(<NonogramScreen daily={SMALL} />);

    expect(occupantsIn(hydrated)).toEqual(
      expect.arrayContaining(["board", "hint", "statsCard"]),
    );
    expect(occupantsIn(skeleton)).toEqual(occupantsIn(hydrated));

    for (const [local, count] of [
      ["cell", SMALL.size ** 2],
      ["clueRow", SMALL.size],
      ["clueCol", SMALL.size],
      ["control", 3],
    ] as const) {
      expect(skeleton.querySelectorAll(`.${className(local)}`)).toHaveLength(
        count,
      );
      expect(hydrated.querySelectorAll(`.${className(local)}`)).toHaveLength(
        count,
      );
    }

    expect(
      skeleton.querySelectorAll("button, a[href], [tabindex]"),
    ).toHaveLength(1);

    for (const readout of [
      "timerBar",
      "timerCard",
      "progressBar",
      "progressCard",
    ]) {
      expect(
        skeleton.querySelector(`.${className(readout)}`)?.textContent,
      ).toBe("\u00a0");
    }
  });

  it("reports the PICTURE's cell count on a fresh board, never size²", () => {
    render(<NonogramScreen daily={SMALL} />);

    expect(TARGET).toBeLessThan(SMALL.size ** 2);
    expect(
      screen.getByText(messages.games.nonogram.play.progressLong(0, TARGET)),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        messages.games.nonogram.play.progressLong(0, SMALL.size ** 2),
      ),
    ).not.toBeInTheDocument();
  });

  it("renders both readout pairs and the screen's own third stat row", () => {
    render(<NonogramScreen daily={SMALL} />);
    const copy = messages.games.nonogram.play;

    expect(
      screen.getAllByLabelText(messages.play.timerAria("00:00")),
    ).toHaveLength(2);
    expect(screen.getByText(copy.rules)).toBeInTheDocument();
    expect(screen.getByText(copy.sizeLabel)).toBeInTheDocument();
    expect(screen.getByText(copy.size(SMALL.size))).toBeInTheDocument();
    expect(
      screen.getByText(copy.progressShort(SMALL.size, 0, TARGET)),
    ).toBeInTheDocument();
  });

  it("swaps the conclusion in place on a fill-only finish, with no navigation", async () => {
    const { container } = render(<NonogramScreen daily={SMALL} />);

    paintThePicture(container);

    await act(async () => {
      await import("../src/nonogram/nonogram-conclusion");
    });
    expect(container.querySelector("[data-conclusion-state]")).toHaveAttribute(
      "data-conclusion-state",
      "result",
    );
    expect(container.querySelector("[data-cell-index]")).toBeNull();

    expect(router.push).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
    const [queued] = sync.flushPendingCompletions.mock.calls.at(-1) ?? [];
    expect(queued).toMatchObject({
      game: "nonogram",
      date: DATE,
      size: SMALL.size,
      concluded: true,
      pendingSync: true,
      grid: [...SOLUTION],
    });
  });

  it("restores a finished day straight into the conclusion, clock stopped", () => {
    vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
    const record = concludedRecord();
    window.localStorage.setItem(
      playRecordKey("nonogram", DATE),
      JSON.stringify(record),
    );

    const { container } = render(<NonogramScreen daily={SMALL} />);

    const stamped = messages.conclusion.stampAria(
      messages.games.nonogram.conclusion.title,
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

  it("keeps the h1 the first element child in every view", () => {
    const skeleton = parsed(
      renderToStaticMarkup(<NonogramScreen daily={SMALL} />),
    );
    assertHeadingIsFirstChild(skeleton);
    assertNoEyebrowAboveHeadings(skeleton);

    const { container: play } = render(<NonogramScreen daily={SMALL} />);
    assertHeadingIsFirstChild(play);
    assertNoEyebrowAboveHeadings(play);

    const { container: unavailable } = render(
      <DailyUnavailable copy={messages.games.nonogram.play.unavailable} />,
    );

    assertNoEyebrowAboveHeadings(unavailable);

    window.localStorage.setItem(
      playRecordKey("nonogram", DATE),
      JSON.stringify(concludedRecord()),
    );
    const { container: conclusion } = render(<NonogramScreen daily={SMALL} />);
    expect(conclusion.querySelector("[data-conclusion-state]")).not.toBeNull();
    assertHeadingIsFirstChild(conclusion);
    assertNoEyebrowAboveHeadings(conclusion);
  });

  it("spends the one free hint on a picture cell and explains which case fired", () => {
    const { container } = render(<NonogramScreen daily={SMALL} />);
    const copy = messages.games.nonogram.play;

    fireEvent.keyDown(boardOf(SMALL), { key: "ArrowRight" });
    const caret = caretIndex(container);

    fireEvent.click(screen.getByText(copy.hint.available));

    const exhausted = screen.getByText(copy.hint.used);
    expect(exhausted).toHaveAttribute("aria-disabled", "true");

    expect(screen.getByText(copy.hint.explain.fill)).toBeInTheDocument();
    expect(screen.getByText(copy.progressLong(1, TARGET))).toBeInTheDocument();

    const filled = container.querySelectorAll(
      `.${className("cellFilled")}[data-cell-index]`,
    );
    expect(filled).toHaveLength(1);
    expect(PICTURE).toContain(
      Number(filled[0]?.getAttribute("data-cell-index")),
    );

    expect(caretIndex(container)).toBe(caret);
  });
});

describe("the picture reveal (T-WEB-S51)", () => {
  function pathFor(size: number, cells: readonly NonogramMark[]): string {
    return cells
      .map((cell, index) =>
        cell === 1
          ? `M${String(index % size)} ${String(Math.floor(index / size))}h1v1h-1z`
          : "",
      )
      .join("");
  }

  const REVEAL = messages.games.nonogram.reveal.aria;

  function figure(): HTMLElement {
    return screen.getByRole("img", { name: REVEAL });
  }

  it("hands the reveal down from the play state the moment the picture closes", () => {
    const { container } = render(<NonogramScreen daily={SMALL} />);

    paintThePicture(container);

    expect(figure()).toHaveAttribute(
      "viewBox",
      `0 0 ${String(SMALL.size)} ${String(SMALL.size)}`,
    );
    expect(figure().querySelector("path")).toHaveAttribute(
      "d",
      pathFor(SMALL.size, SOLUTION),
    );

    expect(
      screen.getByText(messages.conclusion.stampLabel),
    ).toBeInTheDocument();
  });

  it("derives the same picture from a concluded record, with no prop at all", () => {
    window.localStorage.setItem(
      playRecordKey("nonogram", DATE),
      JSON.stringify(concludedRecord()),
    );

    render(<NonogramConclusion date={DATE} />);

    expect(figure().querySelector("path")).toHaveAttribute(
      "d",
      pathFor(SMALL.size, SOLUTION),
    );
  });

  it("stamps a concluded record that carries no grid, and reveals nothing", () => {
    //

    const day = "2026-07-31";
    window.localStorage.setItem(
      playRecordKey("nonogram", day),
      JSON.stringify(concludedRecord({ date: day, grid: undefined })),
    );

    const { container } = render(<NonogramConclusion date={day} />);

    expect(
      screen.getByLabelText(
        messages.conclusion.stampAria(
          messages.games.nonogram.conclusion.title,
          formatElapsed(272_000),
          0,
        ),
      ),
    ).toBeInTheDocument();
    expect(container.querySelector("svg")).toBeNull();
  });

  it("reveals the picture in place even where localStorage throws", () => {
    const original = Object.getOwnPropertyDescriptor(window, "localStorage");
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("access denied", "SecurityError");
      },
    });

    try {
      const { container } = render(<NonogramScreen daily={SMALL} />);

      paintThePicture(container);

      expect(figure().querySelector("path")).toHaveAttribute(
        "d",
        pathFor(SMALL.size, SOLUTION),
      );
    } finally {
      if (original !== undefined) {
        Object.defineProperty(window, "localStorage", original);
      }
    }
  });
});

describe("the board geometry (T-WEB-S48)", () => {
  const PAGE_PADDING = 2 * token("--space-5");

  const FOLD_COLUMN = 1141 - (80 + 330 + 72 + 80);

  const CARD_BORDER = 1;
  const SIZES: readonly NonogramSize[] = [5, 8, 10, 15];

  const DIGIT = 6.609375;
  const TWO_DIGIT = 2 * DIGIT;

  const WORST_ROW: Readonly<Record<NonogramSize, readonly [number, number]>> = {
    5: [3, 3],
    8: [4, 4],
    10: [5, 5],
    15: [5, 5],
  };

  const MOBILE_GEOMETRY = bodyOf(GAME_CSS, "@media (max-width: 768px)");
  const AFTER_GEOMETRY = GAME_CSS.slice(
    GAME_CSS.indexOf(MOBILE_GEOMETRY) + MOBILE_GEOMETRY.length,
  );
  const MOBILE_CHROME = bodyOf(AFTER_GEOMETRY, "@media (max-width: 768px)");
  const SHARED_MOBILE = bodyOf(SHARED_CSS, "@media (max-width: 768px)");

  function mobileCap(size: NonogramSize): number {
    return pixels(
      decl(
        bodyOf(GAME_CSS, size === 5 ? ".mobileCap5" : ".pageNonogram"),
        "--board-mobile-max",
      ),
    );
  }

  function gutterWidth(size: NonogramSize): number {
    const rail = bodyOf(GAME_CSS, ".clueRow");
    const gap = pixels(decl(rail, "column-gap"));
    const pad = pixels(decl(rail, "padding-inline-end"));
    const [chars, runs] = WORST_ROW[size];
    return chars * DIGIT + (runs - 1) * gap + pad;
  }

  function innerWidth(size: NonogramSize, viewport: number): number {
    const padding = pixels(decl(bodyOf(SHARED_MOBILE, ".gridCard"), "padding"));
    const card = Math.min(mobileCap(size), viewport - PAGE_PADDING);
    return card - 2 * padding - 2 * CARD_BORDER;
  }

  function mobileCell(size: NonogramSize, viewport: number): number {
    return (innerWidth(size, viewport) - gutterWidth(size)) / size;
  }

  function desktopCell(size: NonogramSize): number {
    const template = decl(
      bodyOf(GAME_CSS, `.size${size}`),
      "grid-template-columns",
    );
    return Number(
      /repeat\(\d+,\s*(\d+(?:\.\d+)?)px\)/.exec(template ?? "")?.[1],
    );
  }

  it("declares its two mobile blocks in the fixed order the assertions read", () => {
    expect(MOBILE_GEOMETRY).toContain(".size15");
    expect(MOBILE_CHROME).toContain(".controls");
  });

  it("A1 — sizes the board fluidly on a phone, with no px cell track left", () => {
    for (const size of SIZES) {
      const template = decl(
        bodyOf(MOBILE_GEOMETRY, `.size${size}`),
        "grid-template-columns",
      );
      expect(template).toBe(
        `max-content repeat(${String(size)}, minmax(0, 1fr))`,
      );

      expect(template).not.toMatch(/\d+px/);
    }
  });

  it("A2 — declares the mobile cap the shared sheet reads with NO fallback", () => {
    expect(mobileCap(15)).toBe(350);
    expect(mobileCap(15)).toBeLessThanOrEqual(390 - PAGE_PADDING);

    expect(decl(bodyOf(SHARED_MOBILE, ".gridCard"), "max-width")).toBe(
      "var(--board-mobile-max)",
    );
  });

  it("A3 — clears the two-digit column-clue floor at 320px and at 390px", () => {
    for (const size of SIZES) {
      expect(mobileCell(size, 320)).toBeGreaterThanOrEqual(TWO_DIGIT);
      expect(mobileCell(size, 390)).toBeGreaterThanOrEqual(TWO_DIGIT);
      expect(mobileCell(size, 390)).toBeGreaterThan(mobileCell(size, 320));
    }

    expect(mobileCell(15, 320) - TWO_DIGIT).toBeLessThan(1.5);
  });

  it("A4 — draws the ruled field as per-cell borders, at gap 0", () => {
    const cell = bodyOf(GAME_CSS, ".cell");
    const hairline =
      "1px solid color-mix(in srgb, var(--ink) 50%, transparent)";

    expect(decl(bodyOf(GAME_CSS, ".grid"), "gap")).toBe("0");
    expect(decl(cell, "border-top")).toBe(hairline);
    expect(decl(cell, "border-left")).toBe(hairline);
    expect(decl(bodyOf(GAME_CSS, ".cellRuleTop"), "border-top-width")).toBe(
      "2px",
    );
    expect(decl(bodyOf(GAME_CSS, ".cellRuleTop"), "border-top-color")).toBe(
      "var(--ink)",
    );
    expect(decl(bodyOf(GAME_CSS, ".cellRuleLeft"), "border-left-width")).toBe(
      "2px",
    );
    expect(decl(bodyOf(GAME_CSS, ".cellRuleLeft"), "border-left-color")).toBe(
      "var(--ink)",
    );
    expect(decl(bodyOf(GAME_CSS, ".cellEdgeRight"), "border-right")).toBe(
      "2px solid var(--ink)",
    );
    expect(decl(bodyOf(GAME_CSS, ".cellEdgeBottom"), "border-bottom")).toBe(
      "2px solid var(--ink)",
    );
  });

  it("A5 — the single top-level .cell carries no radius and is border-box", () => {
    const cell = bodyOf(GAME_CSS, ".cell");

    expect(decl(cell, "background")).toBe("var(--paper-desk)");
    expect(decl(cell, "box-sizing")).toBe("border-box");

    expect(decl(cell, "border-radius")).toBeUndefined();
  });

  it("A6 — every desktop board still fits the shared 1140px fold", () => {
    for (const size of SIZES) {
      const board = gutterWidth(size) + size * desktopCell(size);
      const card = board + 2 * token("--space-4") + 2;

      expect(card).toBeLessThanOrEqual(FOLD_COLUMN);
    }
  });

  it("A7 — every desktop template is square", () => {
    for (const size of SIZES) {
      const body = bodyOf(GAME_CSS, `.size${size}`);
      expect(decl(body, "grid-template-rows")).toBe(
        decl(body, "grid-template-columns"),
      );
    }
  });

  it("A8 — gives the grid and both rails no boundary at all", () => {
    for (const local of [".grid", ".clueRow", ".clueCol"]) {
      const body = bodyOf(GAME_CSS, local);
      for (const property of [
        "background",
        "background-color",
        "border",
        "outline",
        "box-shadow",
      ]) {
        expect(decl(body, property)).toBeUndefined();
      }
    }
  });

  it("A9 — sets the clue numerals at the exact triple DIGIT was measured at", () => {
    const number = bodyOf(GAME_CSS, ".clueNumber");

    expect(decl(number, "font-family")).toBe("var(--font-ui)");
    expect(decl(number, "font-weight")).toBe("600");
    expect(pixels(decl(number, "font-size"))).toBe(11);
    expect(decl(number, "font-variant-numeric")).toBe("tabular-nums");
  });

  it("A10 — keeps every brush control clear of the 44px touch target", () => {
    const controls = bodyOf(MOBILE_CHROME, ".controls");
    const minimum = token("--touch-target-min");

    expect(decl(controls, "width")).toBe("100%");
    expect(decl(controls, "max-width")).toBe("var(--board-mobile-max)");
    const gap = pixels(decl(controls, "gap"));

    for (const cap of [mobileCap(15), mobileCap(5)]) {
      const row = Math.min(cap, 320 - PAGE_PADDING);
      expect((row - 2 * gap) / 3).toBeGreaterThanOrEqual(minimum);
    }
    const control = bodyOf(MOBILE_CHROME, ".control");
    expect(pixels(decl(control, "height"))).toBeGreaterThanOrEqual(minimum);

    expect(decl(control, "min-width")).toBe("0");

    expect(decl(control, "padding")).toBe("var(--space-2) var(--space-1)");

    expect(decl(bodyOf(MOBILE_CHROME, ".affordance"), "display")).toBe("none");
  });

  it("A10b — places the keyboard affordance the way a flex ROW allows", () => {
    const affordance = bodyOf(GAME_CSS, ".affordance");
    const controls = bodyOf(GAME_CSS, ".controls");

    expect(decl(controls, "display")).toBe("flex");
    expect(decl(controls, "align-items")).toBe("center");
    expect(decl(affordance, "margin-top")).toBeUndefined();
    expect(decl(affordance, "margin-left")).toBe("var(--space-3)");

    expect(pixels(decl(affordance, "font-size"))).toBe(13);
  });

  it("A11 — carries a rotation signature no other game's board declares", () => {
    const page = bodyOf(GAME_CSS, ".pageNonogram");
    const rotations = ["--grid-card-rot", "--stats-card-rot", "--tape-rot"];
    const mine = rotations.map((name) => decl(page, name));

    for (const value of mine) {
      expect(value).toBeDefined();
    }
    for (const card of mine.slice(0, 2)) {
      const degrees = Math.abs(Number(/^(-?[\d.]+)deg$/.exec(card ?? "")?.[1]));
      expect(degrees).toBeGreaterThanOrEqual(0.3);
      expect(degrees).toBeLessThanOrEqual(2.4);
    }
    const tape = Math.abs(Number(/^(-?[\d.]+)deg$/.exec(mine[2] ?? "")?.[1]));
    expect(tape).toBeGreaterThanOrEqual(3);
    expect(tape).toBeLessThanOrEqual(5);

    for (const [sheet, local] of [
      ["src/binairo/binairo-screen.module.css", ".pageBinairo"],
      ["src/sudoku/sudoku-board.module.css", ".pageSudoku"],
    ] as const) {
      const other = bodyOf(stylesheet(sheet), local);
      expect(mine).not.toEqual(rotations.map((name) => decl(other, name)));
    }
  });

  it("A12 — caps a Monday's CARD so the board still fills its paper", () => {
    expect(mobileCap(5)).toBe(310);

    expect(Math.abs(mobileCell(5, 390) - 52)).toBeLessThan(1);
    expect(
      decl(bodyOf(MOBILE_GEOMETRY, ".size5"), "max-width"),
    ).toBeUndefined();
  });

  it("A13 — spends the last free channel on the hint, additively", () => {
    expect(decl(bodyOf(GAME_CSS, ".cellFilled"), "background")).toBe(
      "var(--accent)",
    );
    for (const local of [".cellFilled.cellHinted", ".cellCrossed.cellHinted"]) {
      const body = bodyOf(GAME_CSS, local);

      expect(decl(body, "box-shadow")).toBeDefined();
      for (const property of [
        "background",
        "background-color",
        "border-color",
      ]) {
        expect(decl(body, property)).toBeUndefined();
      }
    }

    const control = bodyOf(GAME_CSS, ".control");
    const active = bodyOf(GAME_CSS, ".controlActive");
    expect(decl(control, "background")).toBe("var(--paper-card)");
    expect(decl(control, "color")).toBe("var(--accent)");
    expect(decl(active, "background")).toBe("var(--accent)");
    expect(decl(active, "color")).toBe("var(--paper-card)");
    expect(decl(active, "border")).toBeUndefined();
    expect(decl(active, "border-color")).toBeUndefined();
  });

  it("A14 — transitions paint only, and declares its own reduced-motion branch", () => {
    const reduced = bodyOf(GAME_CSS, "@media (prefers-reduced-motion: reduce)");
    expect(reduced).toContain(".cell");
    expect(reduced).toContain(".control");

    const transition = decl(bodyOf(GAME_CSS, ".cell"), "transition");

    expect(transition).toBeDefined();
    for (const property of [
      "transform",
      "width",
      "height",
      "padding",
      "margin",
    ]) {
      expect(transition).not.toContain(property);
    }
  });

  it("A(caret) — declares selection and focus as ONE block, inset (T-WEB-S49)", () => {
    expect(GAME_CSS).toMatch(/^\.cellSelected,\n\.cell:focus-visible \{/m);

    const caret = bodyOf(GAME_CSS, ".cell:focus-visible");

    expect(decl(caret, "outline")).toBe("2px solid var(--ink)");

    expect(pixels(decl(caret, "outline-offset"))).toBeLessThan(0);
  });

  it("C1 — draws the frame and the every-five rule as classes, not comments", () => {
    for (const fixture of [SMALL, BIG]) {
      const { container, unmount } = render(<NonogramScreen daily={fixture} />);
      const side = fixture.size;
      for (let index = 0; index < side * side; index += 1) {
        const row = Math.floor(index / side);
        const column = index % side;
        const classes = cellAt(container, index).classList;
        expect(classes.contains(className("cellRuleTop"))).toBe(row % 5 === 0);
        expect(classes.contains(className("cellRuleLeft"))).toBe(
          column % 5 === 0,
        );
        expect(classes.contains(className("cellEdgeRight"))).toBe(
          column === side - 1,
        );
        expect(classes.contains(className("cellEdgeBottom"))).toBe(
          row === side - 1,
        );
      }
      unmount();
    }
  });
});

describe("the picture reveal's CSS (T-WEB-S52)", () => {
  const CONCLUSION_CSS = stylesheet("src/play/conclusion-view.module.css");

  it("settles once on mount, on the tokens the design system already carries", () => {
    const animation = decl(bodyOf(CONCLUSION_CSS, ".picture"), "animation");

    expect(animation).toContain("picture-settle");

    expect(animation).not.toMatch(/bounce|elastic|wobble|jiggle|spring/i);

    expect(animation).not.toMatch(/infinite|alternate/);

    expect(animation).toContain("var(--duration-slow)");
    expect(animation).toContain("var(--ease-settle)");
  });

  it("moves paint only, so `layout-transition` cannot fire on it", () => {
    const keyframe = bodyOf(CONCLUSION_CSS, "@keyframes picture-settle");
    const animated = new Set(
      [...keyframe.matchAll(/(?:^|;|\{)\s*([a-z-]+)\s*:/g)].map(
        ([, property]) => property,
      ),
    );

    expect(animated).toEqual(new Set(["transform", "opacity"]));
  });

  it("is not a card inside a card", () => {
    for (const local of [".picture", ".pictureRow"]) {
      const body = bodyOf(CONCLUSION_CSS, local);
      for (const property of [
        "background",
        "background-color",
        "border",
        "border-radius",
        "box-shadow",
      ]) {
        expect(decl(body, property)).toBeUndefined();
      }
    }
  });

  it("stands the mount keyframe down for reduced motion, in the SAME module", () => {
    const reduced = bodyOf(
      CONCLUSION_CSS,
      "@media (prefers-reduced-motion: reduce)",
    );

    expect(reduced).toContain(".picture");
    expect(decl(bodyOf(reduced, ".picture"), "animation")).toBe("none");

    expect(decl(bodyOf(reduced, ".picture"), "opacity")).toBe("1");
  });
});
