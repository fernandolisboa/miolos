import {
  dailyNonogramResponseSchema,
  FREE_HINTS_PER_PUZZLE,
  type DailyNonogramResponse,
  type NonogramSize,
} from "@miolos/core";
import { generateNonogram, nextNonogramStep } from "@miolos/games/nonogram";
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
import { nonogramHintExplanation } from "../src/nonogram/hint";
import styles from "../src/nonogram/nonogram-board.module.css";
import { NonogramConclusion } from "../src/nonogram/nonogram-conclusion";
import { NonogramScreen } from "../src/nonogram/nonogram-screen";
import type { NonogramCellValue, NonogramMark } from "../src/nonogram/state";
import {
  playRecordKey,
  type NonogramPlayRecord,
} from "../src/play/play-record";
import sharedStyles from "../src/play/screen.module.css";
import spotlightStyles from "../src/play/spotlight.module.css";
import {
  bodyOf,
  boardFloor,
  decl,
  pixels,
  stylesheet,
  token,
} from "./css-source";
import { spendFreeHints } from "./free-hints";
import { installPointerStubs, stubElementFromPoint } from "./pointer";
import { SPOKEN } from "./hint-reason";

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

const FIRST_STEP = (() => {
  const step = nextNonogramStep(
    SMALL.clues,
    SOLUTION.map(() => "unknown"),
  );
  if (step === null) {
    throw new Error("a published daily always has a first step");
  }
  return step;
})();

const FIRST_SENTENCE =
  nonogramHintExplanation(SMALL.size, { kind: "step", step: FIRST_STEP }) ?? "";

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

function withoutLineCross(): void {
  window.localStorage.setItem(
    "miolos-settings",
    JSON.stringify({ games: { nonogram: { lineCross: "off" } } }),
  );
}

describe("the composite widget (T-WEB-S42)", () => {
  // ADR-0055: CI gate 4142 ms (40 runs) × 4 → 20_000.
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
  }, 20_000);

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

  // ADR-0055: CI gate 2610 ms (40 runs) × 4 → 15_000.
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
  }, 15_000);

  // ADR-0055: CI gate 2372 ms (40 runs) × 4 → 10_000.
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
  }, 10_000);

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
        screen.getByLabelText(
          copy.rowCluesAria(
            row + 1,
            runs,
            runs.map(() => false),
          ),
        ),
      ).toBeInTheDocument();
    }
    for (const [column, runs] of BIG.clues.cols.entries()) {
      expect(
        screen.getByLabelText(
          copy.columnCluesAria(
            column + 1,
            runs,
            runs.map(() => false),
          ),
        ),
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
      expect(messages.games.nonogram.play.rowCluesAria(1, [], [])).toContain(
        "0",
      );
      return;
    }

    const rail = container.querySelector(`#nonogram-clue-row-${empty}`);
    expect(rail?.textContent).toBe("0");
    expect(rail).toHaveAttribute(
      "aria-label",
      messages.games.nonogram.play.rowCluesAria(empty + 1, [], []),
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

    const runs = BIG.clues.rows[0] ?? [];
    const rail = container.querySelector("#nonogram-clue-row-0");
    expect(rail).toHaveAttribute(
      "aria-label",
      messages.games.nonogram.play.rowCluesAria(
        1,
        runs,
        runs.map(() => false),
      ),
    );
  });
});

describe("the brush (T-WEB-S44)", () => {
  const copy = messages.games.nonogram.play.controls;

  beforeEach(withoutLineCross);

  function brushButton(mode: "fill" | "cross"): HTMLElement {
    return screen.getByLabelText(
      { fill: copy.fillAria, cross: copy.crossAria }[mode],
    );
  }

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
  });

  it("clears with a tap on a cell already holding the brush's mark, since there is no erase button", () => {
    const { container } = render(<NonogramScreen daily={SMALL} />);

    fireEvent.click(cellAt(container, 1));
    fireEvent.click(cellAt(container, 1));
    expect(markAt(container, 1)).toBeNull();

    fireEvent.click(brushButton("cross"));
    fireEvent.click(cellAt(container, 2));
    fireEvent.click(cellAt(container, 2));
    expect(markAt(container, 2)).toBeNull();
  });
});

describe("the brush is two icons (T-WEB-S498)", () => {
  const copy = messages.games.nonogram.play.controls;

  it("is two aria-pressed buttons named by their aria copy, with exactly one pressed", () => {
    render(<NonogramScreen daily={SMALL} />);

    const buttons = screen
      .getAllByRole("button")
      .filter((button) => button.hasAttribute("aria-pressed"));
    expect(buttons.map((b) => b.getAttribute("aria-label"))).toStrictEqual([
      copy.crossAria,
      copy.fillAria,
    ]);

    const pressed = screen.getAllByRole("button", { pressed: true });
    expect(pressed.map((b) => b.getAttribute("aria-label"))).toEqual([
      copy.fillAria,
    ]);
    expect(pressed[0]?.className).toContain(className("controlActive"));
    expect(screen.getByLabelText(copy.crossAria).className).not.toContain(
      className("controlActive"),
    );
  });

  it("shows an icon and no visible words, and has no erase control", () => {
    render(<NonogramScreen daily={SMALL} />);

    for (const label of [copy.fillAria, copy.crossAria]) {
      const button = screen.getByLabelText(label);
      expect(button.textContent).toBe("");
      expect(button.querySelector("svg[aria-hidden]")).not.toBeNull();
    }
    expect(screen.queryByLabelText("apagar células")).toBeNull();
    expect(screen.queryByText("apagar")).toBeNull();
  });

  it("keeps only the keys in the affordance line", () => {
    render(<NonogramScreen daily={SMALL} />);

    expect(screen.getByText(copy.affordance)).toBeInTheDocument();
    expect(copy.affordance).toMatch(/^No teclado:/);
  });

  it("switches by click and the skeleton reserves both segments", () => {
    const html = renderToStaticMarkup(<NonogramScreen daily={SMALL} />);
    const host = parsed(html);

    expect(host.querySelectorAll(`.${className("control")}`)).toHaveLength(2);
  });
});

describe("the mouse buttons on the board (T-WEB-S498a)", () => {
  const MOUSE = { pointerId: 1, pointerType: "mouse" } as const;

  beforeEach(withoutLineCross);

  function click(board: HTMLElement, index: number, button: number): void {
    const at = { ...MOUSE, clientX: index, clientY: 0, button };
    fireEvent.pointerDown(board, at);
    fireEvent.pointerUp(board, at);
  }

  it("a left click uses the brush and a right click writes the opposite", () => {
    const { container } = render(<NonogramScreen daily={SMALL} />);
    stubElementFromPoint(container);
    const board = boardOf(SMALL);

    click(board, 1, 0);
    click(board, 2, 2);
    expect([1, 2].map((i) => markAt(container, i))).toStrictEqual([1, 0]);

    click(board, 1, 2);
    click(board, 2, 0);
    expect([1, 2].map((i) => markAt(container, i))).toStrictEqual([0, 1]);

    click(board, 1, 2);
    expect(markAt(container, 1)).toBeNull();
  });

  it("under the cross brush the buttons swap", () => {
    const { container } = render(<NonogramScreen daily={SMALL} />);
    stubElementFromPoint(container);
    const board = boardOf(SMALL);
    fireEvent.click(
      screen.getByLabelText(messages.games.nonogram.play.controls.crossAria),
    );

    click(board, 1, 0);
    click(board, 2, 2);

    expect([1, 2].map((i) => markAt(container, i))).toStrictEqual([0, 1]);
  });

  it("a right drag crosses every cell, and the board's context menu is blocked", () => {
    const { container } = render(<NonogramScreen daily={SMALL} />);
    stubElementFromPoint(container);
    const board = boardOf(SMALL);
    const base = { ...MOUSE, clientY: 0, button: 2 };

    fireEvent.pointerDown(board, { ...base, clientX: 0 });
    fireEvent.pointerMove(board, { ...base, clientX: 1 });
    fireEvent.pointerMove(board, { ...base, clientX: 2 });
    fireEvent.pointerUp(board, { ...base, clientX: 2 });

    expect([0, 1, 2].map((i) => markAt(container, i))).toStrictEqual([0, 0, 0]);
    expect(fireEvent.contextMenu(board)).toBe(false);
    expect(
      fireEvent.contextMenu(
        screen.getByLabelText(messages.games.nonogram.play.controls.fillAria),
      ),
    ).toBe(true);
  });

  it("a stroke from a filled cell clears the filled cells and leaves the crosses", () => {
    const { container } = render(<NonogramScreen daily={SMALL} />);
    stubElementFromPoint(container);
    const board = boardOf(SMALL);
    click(board, 0, 0);
    click(board, 1, 2);
    click(board, 2, 0);
    const base = { ...MOUSE, clientY: 0, button: 0 };

    fireEvent.pointerDown(board, { ...base, clientX: 0 });
    fireEvent.pointerMove(board, { ...base, clientX: 1 });
    fireEvent.pointerMove(board, { ...base, clientX: 2 });
    fireEvent.pointerMove(board, { ...base, clientX: 3 });
    fireEvent.pointerUp(board, { ...base, clientX: 3 });

    expect([0, 1, 2, 3].map((i) => markAt(container, i))).toStrictEqual([
      null,
      0,
      null,
      null,
    ]);
  });

  it("leaves a touch stroke on the brush", () => {
    const { container } = render(<NonogramScreen daily={SMALL} />);
    stubElementFromPoint(container);
    const board = boardOf(SMALL);
    const base = { pointerId: 1, pointerType: "touch", clientY: 0, button: 0 };

    fireEvent.pointerDown(board, { ...base, clientX: 0 });
    fireEvent.pointerMove(board, { ...base, clientX: 1 });
    fireEvent.pointerUp(board, { ...base, clientX: 1 });

    expect([0, 1].map((i) => markAt(container, i))).toStrictEqual([1, 1]);
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

  it("writes nothing for a middle button", () => {
    const { container } = render(<NonogramScreen daily={SMALL} />);
    stubElementFromPoint(container);
    const board = boardOf(SMALL);

    fireEvent.pointerDown(board, {
      clientX: 4,
      clientY: 0,
      pointerId: 1,
      button: 1,
    });
    fireEvent.pointerUp(board, {
      clientX: 4,
      clientY: 0,
      pointerId: 1,
      button: 1,
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
    expect(Board).toHaveProperty("$$typeof", Symbol.for("react.memo"));
    expect(Board).toHaveProperty("type", expect.any(Function));
  });

  it("composes ONE label per painted cell during a drag, and a rail's only when its struck numbers change — not size² + 2·size (T-WEB-S66)", () => {
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

    expect(BIG.clues.cols[1]).toEqual([1]);
    expect(rowCluesAria.mock.calls.length).toBe(0);
    expect(columnCluesAria.mock.calls).toEqual([[2, [1], [true]]]);
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
    expect(markup).not.toContain(
      messages.play.hint.available(FREE_HINTS_PER_PUZZLE),
    );

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
      ["control", 2],
      ["brushToggle", 1],
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

  it("spends a free hint on a picture cell and explains which case fired", () => {
    const { container } = render(<NonogramScreen daily={SMALL} />);
    const copy = messages.games.nonogram.play;

    fireEvent.keyDown(boardOf(SMALL), { key: "ArrowRight" });
    const caret = caretIndex(container);

    fireEvent.click(
      screen.getByText(messages.play.hint.available(FREE_HINTS_PER_PUZZLE)),
    );

    expect(
      screen.getByRole("button", {
        name: messages.play.hint.available(FREE_HINTS_PER_PUZZLE - 1),
      }),
    ).toHaveAttribute("aria-disabled", "false");
    expect(screen.getByText(FIRST_SENTENCE, SPOKEN)).toBeInTheDocument();
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

  it("goes inert once every free hint is spent", () => {
    const { container } = render(<NonogramScreen daily={SMALL} />);
    const marked = () =>
      container.querySelectorAll(
        `.${className("cellFilled")}[data-cell-index], .${className("cellCrossed")}[data-cell-index]`,
      ).length;

    spendFreeHints();

    const exhausted = screen.getByRole("button", {
      name: messages.play.hint.used,
    });
    expect(exhausted).toHaveAttribute("aria-disabled", "true");
    expect(marked()).toBe(FREE_HINTS_PER_PUZZLE);

    fireEvent.click(exhausted);
    expect(marked()).toBe(FREE_HINTS_PER_PUZZLE);
  });
});

describe("the hint names its line and lights the cells it reasons about (T-WEB-S571)", () => {
  function spotlit(container: HTMLElement): number[] {
    return [...container.querySelectorAll<HTMLElement>("[data-cell-index]")]
      .filter((cell) => cell.classList.contains(spotlightStyles.spotlit ?? ""))
      .map((cell) => Number(cell.dataset.cellIndex));
  }

  it("writes the step's cell, reads out why and tints the line until the next board action", () => {
    const { container } = render(<NonogramScreen daily={SMALL} />);
    expect(spotlit(container)).toEqual([]);

    fireEvent.click(
      screen.getByText(messages.play.hint.available(FREE_HINTS_PER_PUZZLE)),
    );

    expect(markAt(container, FIRST_STEP.index)).toBe(FIRST_STEP.value);
    expect(cellAt(container, FIRST_STEP.index).classList).toContain(
      styles.cellHinted,
    );
    expect(screen.getByText(FIRST_SENTENCE, SPOKEN)).toBeInTheDocument();
    expect(spotlit(container)).toEqual(FIRST_STEP.cells);

    fireEvent.click(cellAt(container, FIRST_STEP.cells.at(-1) ?? 0));

    expect(spotlit(container)).toEqual([]);
    expect(screen.getByText(FIRST_SENTENCE, SPOKEN)).toBeInTheDocument();
  });

  it("reads out a correction and lights nothing", () => {
    const { container } = render(<NonogramScreen daily={SMALL} />);
    const wrong = SOLUTION.indexOf(0);

    fireEvent.click(cellAt(container, wrong));
    fireEvent.click(
      screen.getByText(messages.play.hint.available(FREE_HINTS_PER_PUZZLE)),
    );

    expect(
      screen.getByText(
        messages.games.nonogram.play.hint.explain.correction,
        SPOKEN,
      ),
    ).toBeInTheDocument();
    expect(spotlit(container)).toEqual([]);
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
    expect(
      [...container.querySelectorAll("svg")].filter(
        (svg) => !svg.closest("header"),
      ),
    ).toEqual([]);
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
  const CARD_BORDER = 1;
  const SIZES: readonly NonogramSize[] = [5, 8, 10, 15];

  const DIGIT = 6.609375;
  const TWO_DIGIT = 2 * DIGIT;
  const CLUE_LINE = 11;

  const WORST_ROW: Readonly<Record<NonogramSize, readonly [number, number]>> = {
    5: [3, 3],
    8: [4, 4],
    10: [5, 5],
    15: [5, 5],
  };

  const WORST_COLUMN_RUNS: Readonly<Record<NonogramSize, number>> = {
    5: 3,
    8: 4,
    10: 3,
    15: 3,
  };

  const MOBILE = bodyOf(GAME_CSS, "@media (max-width: 768px)");
  const SHARED_MOBILE = bodyOf(SHARED_CSS, "@media (max-width: 768px)");

  function sizeClass(size: NonogramSize): string {
    return bodyOf(GAME_CSS, `.pageSize${String(size)}`);
  }

  function gutterWidth(size: NonogramSize): number {
    const rail = bodyOf(GAME_CSS, ".clueRow");
    const gap = pixels(decl(rail, "column-gap"));
    const pad = pixels(decl(rail, "padding-inline-end"));
    const [chars, runs] = WORST_ROW[size];
    return chars * DIGIT + (runs - 1) * gap + pad;
  }

  function cellAtFloor(size: NonogramSize): number {
    const padding = pixels(decl(bodyOf(SHARED_MOBILE, ".gridCard"), "padding"));
    return (
      (boardFloor() - 2 * padding - 2 * CARD_BORDER - gutterWidth(size)) / size
    );
  }

  it("A1 — sizes the board fluidly at every width, with no px cell track left", () => {
    for (const size of SIZES) {
      const template = decl(
        bodyOf(GAME_CSS, `.size${String(size)}`),
        "grid-template-columns",
      );
      expect(template).toBe(
        `max-content repeat(${String(size)}, minmax(0, 1fr))`,
      );
      expect(template).not.toMatch(/\d+px/);
    }
    expect(decl(bodyOf(GAME_CSS, ".cell"), "aspect-ratio")).toBe("1");
  });

  it("A2 — declares a ceiling per size class, the larger boards higher", () => {
    const ceiling = (size: NonogramSize) =>
      pixels(decl(sizeClass(size), "--board-max"));

    expect(ceiling(5)).toBeLessThanOrEqual(ceiling(8));
    expect(ceiling(8)).toBeLessThanOrEqual(ceiling(10));
    expect(ceiling(10)).toBe(ceiling(15));
  });

  it("A3 — clears the two-digit column-clue floor at the board floor", () => {
    for (const size of SIZES) {
      expect(cellAtFloor(size)).toBeGreaterThanOrEqual(TWO_DIGIT);
    }

    expect(cellAtFloor(15) - TWO_DIGIT).toBeLessThan(1.5);
  });

  it("A4 — draws the ruled field as per-cell borders, at gap 0", () => {
    const cell = bodyOf(GAME_CSS, ".cell");
    const hairline =
      "1px solid color-mix(in srgb, var(--ink) 50%, transparent)";

    expect(decl(bodyOf(GAME_CSS, ".grid"), "gap")).toBe("0");
    expect(decl(cell, "border-top")).toBe(hairline);
    expect(decl(cell, "border-left")).toBe(hairline);
    expect(decl(bodyOf(GAME_CSS, ".cellRuleTop"), "border-top-width")).toBe(
      "3px",
    );
    expect(decl(bodyOf(GAME_CSS, ".cellRuleTop"), "border-top-color")).toBe(
      "var(--ink)",
    );
    expect(decl(bodyOf(GAME_CSS, ".cellRuleLeft"), "border-left-width")).toBe(
      "3px",
    );
    expect(decl(bodyOf(GAME_CSS, ".cellRuleLeft"), "border-left-color")).toBe(
      "var(--ink)",
    );
    expect(decl(bodyOf(GAME_CSS, ".cellEdgeRight"), "border-right")).toBe(
      "3px solid var(--ink)",
    );
    expect(decl(bodyOf(GAME_CSS, ".cellEdgeBottom"), "border-bottom")).toBe(
      "3px solid var(--ink)",
    );
  });

  it("A5 — the single top-level .cell carries no radius and is border-box", () => {
    const cell = bodyOf(GAME_CSS, ".cell");

    expect(decl(cell, "background")).toBe("var(--paper-desk)");
    expect(decl(cell, "box-sizing")).toBe("border-box");

    expect(decl(cell, "border-radius")).toBeUndefined();
  });

  it("A6 — reserves the clue rail's overhang, so the card never outgrows its well", () => {
    const rail = bodyOf(GAME_CSS, ".clueCol");
    const row = bodyOf(GAME_CSS, ".clueRow");
    const leftMinimum = DIGIT + pixels(decl(row, "padding-inline-end"));

    for (const size of SIZES) {
      const runs = WORST_COLUMN_RUNS[size];
      const top =
        runs * CLUE_LINE +
        (runs - 1) * pixels(decl(rail, "row-gap")) +
        pixels(decl(rail, "padding-block-end"));

      expect(
        pixels(decl(sizeClass(size), "--board-overhang")),
      ).toBeGreaterThanOrEqual(top - leftMinimum);
    }

    expect(decl(bodyOf(GAME_CSS, ".pageNonogram"), "--board-below")).toContain(
      "var(--board-overhang)",
    );
    expect(decl(bodyOf(MOBILE, ".pageNonogram"), "--board-below")).toContain(
      "var(--board-overhang)",
    );
  });

  it("A7 — every size template is N cell columns and N cell rows behind one rail each", () => {
    for (const size of SIZES) {
      const body = bodyOf(GAME_CSS, `.size${String(size)}`);
      expect(decl(body, "grid-template-rows")).toMatch(
        new RegExp(`^max-content repeat\\(${String(size)}, auto\\)$`),
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

  it("A10 — keeps both brush segments clear of the 44px touch target", () => {
    const controls = bodyOf(GAME_CSS, ".controls");
    const minimum = token("--touch-target-min");

    expect(decl(controls, "width")).toBe("var(--board-side)");

    const segment = bodyOf(MOBILE, ".control");
    expect(pixels(decl(segment, "height"))).toBeGreaterThanOrEqual(minimum);
    expect(pixels(decl(segment, "width"))).toBeGreaterThanOrEqual(minimum);
    expect(2 * pixels(decl(segment, "width"))).toBeLessThanOrEqual(
      boardFloor(),
    );

    expect(decl(bodyOf(MOBILE, ".affordance"), "display")).toBe("none");
  });

  it("A10c — draws the toggle as one paper frame with the token radius, the active segment raised", () => {
    const frame = bodyOf(GAME_CSS, ".brushToggle");
    const active = bodyOf(GAME_CSS, ".controlActive");

    expect(decl(frame, "border-radius")).toBe("var(--radius)");
    expect(decl(active, "box-shadow")).toContain("var(--shadow-sm)");
    expect(decl(active, "background")).toBe("var(--accent)");
  });

  it("A10b — centres the toggle on the board's axis, the (i) tip beside it", () => {
    const affordance = bodyOf(GAME_CSS, ".affordance");
    const controls = bodyOf(GAME_CSS, ".controls");

    expect(decl(controls, "display")).toBe("grid");
    expect(decl(controls, "grid-template-columns")).toBe("1fr auto 1fr");
    expect(decl(bodyOf(GAME_CSS, ".brushToggle"), "grid-column")).toBe("2");
    expect(decl(affordance, "justify-self")).toBe("start");
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
    expect(decl(control, "background")).toBe("transparent");
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

    expect(decl(caret, "outline")).toBe(
      "2px solid var(--cell-ink, var(--ink))",
    );

    expect(pixels(decl(caret, "outline-offset"))).toBeLessThan(0);
  });

  // ADR-0055: CI gate 4163 ms (40 runs) × 4 → 20_000.
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
  }, 20_000);
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
    for (const local of [".picture", ".figureRow"]) {
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
