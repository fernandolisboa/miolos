import { dailyQueensResponseSchema } from "@miolos/core";
import { generateQueens } from "@miolos/games/queens";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { formatElapsed, messages } from "../src/i18n";
import {
  playRecordKey,
  queensPlayRecordSchema,
  type QueensPlayRecord,
} from "../src/play/play-record";
import styles from "../src/queens/queens-board.module.css";
import { QueensScreen } from "../src/queens/queens-screen";
import { contrast } from "./contrast";
import { bodyOf, colorTokens, decl, stylesheet } from "./css-source";
import { installPointerStubs, stubElementFromPoint } from "./pointer";

const sync = vi.hoisted(() => ({
  startCompletionSync: vi.fn(() => () => undefined),
  flushPendingCompletions: vi.fn(() => Promise.resolve(undefined)),
}));
vi.mock("../src/play/sync", () => sync);

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/rainhas",
}));

const DATE = "2026-08-01";
const copy = messages.games.queens.play;
const PUZZLE = generateQueens({ seed: 20_260_801, weekday: 1 });
const DAILY = dailyQueensResponseSchema.parse({
  game: "queens",
  date: DATE,
  size: PUZZLE.size,
  regions: PUZZLE.regions,
});
const N = DAILY.size;
const QUEEN_CELLS = PUZZLE.solution.flatMap((cell, index) =>
  cell === 1 ? [index] : [],
);
const EMPTY_CELLS = PUZZLE.solution.flatMap((cell, index) =>
  cell === 0 ? [index] : [],
);

function boardOf(): HTMLElement {
  return screen.getByRole("group", { name: copy.boardAria(N) });
}

function cellAt(index: number): HTMLElement {
  const cell = boardOf().querySelector<HTMLElement>(
    `[data-cell-index="${index}"]`,
  );
  if (cell === null) {
    throw new Error(`no cell at ${index}`);
  }
  return cell;
}

function labelOf(index: number): string {
  return cellAt(index).getAttribute("aria-label") ?? "";
}

function expectedLabel(
  index: number,
  value: 0 | 1 | null,
  conflict = false,
): string {
  const region = DAILY.regions[index] ?? -1;
  return copy.cellAria(
    Math.floor(index / N) + 1,
    (index % N) + 1,
    region + 1,
    value,
    conflict,
  );
}

function focusAt(index: number): void {
  act(() => {
    cellAt(index).focus();
  });
}

function press(key: string): void {
  fireEvent.keyDown(boardOf(), { key });
}

function caret(): number {
  const tabbable = boardOf().querySelector('[tabindex="0"]');
  return Number(tabbable?.getAttribute("data-cell-index"));
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  installPointerStubs();
});

afterEach(() => {
  vi.useRealTimers();
});

function storedRecord(): QueensPlayRecord {
  const raw = localStorage.getItem(playRecordKey("queens", DATE));
  return queensPlayRecordSchema.parse(JSON.parse(raw ?? "null"));
}

describe("the Rainhas board is one composite widget (T-WEB-S456)", () => {
  it("is one labelled group, one tab stop, no role=grid, and names row, column and region per cell", () => {
    const { container } = render(<QueensScreen daily={DAILY} />);

    expect(container.querySelector('[role="grid"]')).toBeNull();
    expect(boardOf().querySelectorAll("button")).toHaveLength(N * N);
    expect(boardOf().querySelectorAll('[tabindex="0"]')).toHaveLength(1);
    expect(labelOf(0)).toBe(expectedLabel(0, null));
    expect(labelOf(0)).toMatch(/^linha 1, coluna 1, região \d: vazia$/);
    expect(boardOf().textContent).toBe("");
  });

  it("cycles a keyboard-activated cell empty → marked → queen → empty, once per activation", () => {
    render(<QueensScreen daily={DAILY} />);
    const target = 4;

    fireEvent.click(cellAt(target), { detail: 0 });
    expect(labelOf(target)).toBe(expectedLabel(target, 0));
    fireEvent.click(cellAt(target), { detail: 0 });
    expect(labelOf(target)).toBe(expectedLabel(target, 1));
    expect(cellAt(target).querySelector("svg")).not.toBeNull();
    fireEvent.click(cellAt(target), { detail: 0 });
    expect(labelOf(target)).toBe(expectedLabel(target, null));
  });

  it("writes with 1, 2 and 0/Backspace/Delete, and the same key again clears", () => {
    render(<QueensScreen daily={DAILY} />);
    focusAt(10);

    press("1");
    expect(labelOf(10)).toBe(expectedLabel(10, 1));
    press("1");
    expect(labelOf(10)).toBe(expectedLabel(10, null));
    press("2");
    expect(labelOf(10)).toBe(expectedLabel(10, 0));
    for (const key of ["0", "Backspace", "Delete"]) {
      press("1");
      press(key);
      expect(labelOf(10), key).toBe(expectedLabel(10, null));
    }
  });

  it("moves with the arrows, clamps at the edges, and jumps with Home and End", () => {
    render(<QueensScreen daily={DAILY} />);
    focusAt(0);

    press("ArrowUp");
    press("ArrowLeft");
    expect(caret()).toBe(0);
    press("ArrowDown");
    press("ArrowRight");
    expect(caret()).toBe(N + 1);
    press("End");
    expect(caret()).toBe(2 * N - 1);
    press("ArrowRight");
    expect(caret()).toBe(2 * N - 1);
    press("Home");
    expect(caret()).toBe(N);
    expect(cellAt(N)).toHaveFocus();
  });

  it("jumps a column with PageUp and PageDown and lets browser shortcuts through", () => {
    render(<QueensScreen daily={DAILY} />);
    focusAt(3 * N + 2);

    press("PageUp");
    expect(caret()).toBe(2);
    press("PageDown");
    expect(caret()).toBe((N - 1) * N + 2);

    focusAt(N + 1);
    press("1");
    for (const shortcut of [
      { key: "PageUp", ctrlKey: true },
      { key: "0", ctrlKey: true },
      { key: "2", metaKey: true },
      { key: "ArrowLeft", altKey: true },
    ]) {
      expect(fireEvent.keyDown(boardOf(), shortcut), shortcut.key).toBe(true);
    }
    expect(caret()).toBe(N + 1);
    expect(labelOf(N + 1)).toBe(expectedLabel(N + 1, 1));
  });

  it("crosses empty cells on a drag and never touches a queen", () => {
    const { container } = render(<QueensScreen daily={DAILY} />);
    stubElementFromPoint(container);
    focusAt(1);
    press("1");

    const board = boardOf();
    fireEvent.pointerDown(board, { clientX: 0, clientY: 0, pointerId: 1 });
    for (const x of [1, 2, 3]) {
      fireEvent.pointerMove(board, { clientX: x, clientY: 0, pointerId: 1 });
    }
    fireEvent.pointerUp(board, { clientX: 3, clientY: 0, pointerId: 1 });

    expect(labelOf(0)).toBe(expectedLabel(0, 0));
    expect(labelOf(1)).toContain(": rainha");
    expect(labelOf(2)).toBe(expectedLabel(2, 0));
    expect(labelOf(3)).toBe(expectedLabel(3, 0));
  });

  it("applies a pointer tap once, not again on the click that follows it", () => {
    const { container } = render(<QueensScreen daily={DAILY} />);
    stubElementFromPoint(container);

    fireEvent.pointerDown(boardOf(), { clientX: 5, clientY: 0, pointerId: 1 });
    fireEvent.pointerUp(boardOf(), { clientX: 5, clientY: 0, pointerId: 1 });
    fireEvent.click(cellAt(5), { detail: 1 });

    expect(labelOf(5)).toBe(expectedLabel(5, 0));
  });

  it("names and rings a conflict, counts queens placed, and never flags a mark", () => {
    render(<QueensScreen daily={DAILY} />);
    focusAt(0);
    press("1");
    press("ArrowRight");
    press("1");
    press("ArrowDown");
    press("2");

    expect(labelOf(0)).toBe(expectedLabel(0, 1, true));
    expect(labelOf(1)).toBe(expectedLabel(1, 1, true));
    expect(labelOf(0)).toMatch(/, em conflito$/);
    expect(cellAt(0).className).toContain(styles.cellConflict);
    expect(labelOf(N + 1)).toBe(expectedLabel(N + 1, 0));
    expect(cellAt(N + 1).className).not.toContain(styles.cellConflict);
    expect(
      screen.getByText(copy.progressLong(2, N), { exact: false }),
    ).toBeInTheDocument();
  });

  it("solves with marks on the board and stores a grid of queens only", () => {
    render(<QueensScreen daily={DAILY} />);
    const marked = EMPTY_CELLS.slice(0, 5);
    for (const index of marked) {
      focusAt(index);
      press("2");
    }
    for (const index of QUEEN_CELLS) {
      focusAt(index);
      press("1");
    }

    const record = storedRecord();
    expect(record.concluded).toBe(true);
    expect(record.grid).toEqual([...PUZZLE.solution]);
    for (const index of marked) {
      expect(record.entries[index]).toBe(0);
    }
  });
});

describe("the region palette, the glyphs and the rings are measured (T-WEB-S457)", () => {
  const css = stylesheet("src/queens/queens-board.module.css");
  const REGIONS = Array.from(
    { length: 9 },
    (_unused, index) => `--queens-region-${String(index + 1)}`,
  );

  it.each(["light", "dark"] as const)(
    "keeps --ink >= 7:1 and both rings >= 3:1 on every region tint (%s)",
    (theme) => {
      const tokens = colorTokens(theme);
      const hex = (name: string): string => {
        const value = tokens.get(name);
        if (value === undefined) {
          throw new Error(`${name} missing from the ${theme} block`);
        }
        return value;
      };
      for (const region of REGIONS) {
        const fill = hex(region);
        expect(contrast(hex("--ink"), fill), region).toBeGreaterThanOrEqual(7);
        expect(
          contrast(hex("--accent-app"), fill),
          `${region} conflict ring`,
        ).toBeGreaterThanOrEqual(3);
        expect(
          contrast(hex("--accent-queens"), fill),
          `${region} hint ring`,
        ).toBeGreaterThanOrEqual(3);
      }
    },
  );

  it("draws the queen and the mark in --ink and the rings as shapes, never accent text", () => {
    expect(decl(bodyOf(css, ".queen"), "fill")).toBe("var(--ink)");
    expect(decl(bodyOf(css, ".cellMarked::after"), "background")).toBe(
      "var(--ink)",
    );
    expect(decl(bodyOf(css, ".cell"), "color")).toBe("var(--ink)");
    expect(decl(bodyOf(css, ".cellHinted"), "box-shadow")).toBe(
      "inset 0 0 0 2px var(--accent)",
    );
    expect(decl(bodyOf(css, ".cellConflict"), "box-shadow")).toBe(
      "inset 0 0 0 3px var(--accent-app)",
    );
    expect(css).not.toMatch(/(^|[^-])color:\s*var\(--accent/m);
  });

  it("draws region boundaries 2px --ink and inner borders 1px --line", () => {
    for (const edge of [".edgeTop", ".edgeLeft", ".edgeRight", ".edgeBottom"]) {
      const body = bodyOf(css, edge);
      expect(body, edge).toContain("2px solid var(--ink)");
    }
    expect(decl(bodyOf(css, ".cell"), "border")).toBe("0");
    expect(decl(bodyOf(css, ".cell"), "border-top")).toBe(
      "1px solid var(--line)",
    );
    expect(decl(bodyOf(css, ".cell"), "border-left")).toBe(
      "1px solid var(--line)",
    );
  });

  it("fills every cell from its region token and thickens exactly the region boundaries", () => {
    render(<QueensScreen daily={DAILY} />);
    for (let index = 0; index < N * N; index += 1) {
      const cell = cellAt(index);
      const region = DAILY.regions[index] ?? -1;
      expect(cell.style.background).toBe(
        `var(--queens-region-${String(region + 1)})`,
      );
      const column = index % N;
      const above = index >= N ? DAILY.regions[index - N] : undefined;
      const left = column > 0 ? DAILY.regions[index - 1] : undefined;
      expect(
        cell.className.includes(styles.edgeTop ?? "?"),
        `top ${index}`,
      ).toBe(above !== region);
      expect(
        cell.className.includes(styles.edgeLeft ?? "?"),
        `left ${index}`,
      ).toBe(left !== region);
      expect(
        cell.className.includes(styles.edgeRight ?? "?"),
        `right ${index}`,
      ).toBe(column === N - 1);
      expect(
        cell.className.includes(styles.edgeBottom ?? "?"),
        `bottom ${index}`,
      ).toBe(index >= N * (N - 1));
    }
  });
});

describe("the Rainhas screen wires the hint, the conclusion and the saves (T-WEB-S476)", () => {
  it("spends the one free hint on a queen's cell and explains it", () => {
    render(<QueensScreen daily={DAILY} />);

    fireEvent.click(screen.getByText(copy.hint.available));

    expect(screen.getByText(copy.hint.used)).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByText(copy.hint.explain.fill)).toBeInTheDocument();
    const queens = QUEEN_CELLS.filter((index) =>
      labelOf(index).endsWith(": rainha"),
    );
    expect(queens).toHaveLength(1);
  });

  it("first turns a wrong queen into an X, and says it corrected", () => {
    render(<QueensScreen daily={DAILY} />);
    const wrong = EMPTY_CELLS[0] ?? -1;
    focusAt(wrong);
    press("1");

    fireEvent.click(screen.getByText(copy.hint.available));

    expect(labelOf(wrong)).toBe(expectedLabel(wrong, 0));
    expect(screen.getByText(copy.hint.explain.correction)).toBeInTheDocument();
  });

  it("swaps the conclusion in place on the last queen, with no navigation", async () => {
    const { container } = render(<QueensScreen daily={DAILY} />);
    for (const index of QUEEN_CELLS) {
      focusAt(index);
      press("1");
    }

    await act(async () => {
      await import("../src/play/conclusion-view");
    });
    expect(container.querySelector("[data-conclusion-state]")).toHaveAttribute(
      "data-conclusion-state",
      "result",
    );
    expect(container.querySelector("[data-cell-index]")).toBeNull();
    expect(router.push).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
    expect(sync.flushPendingCompletions).toHaveBeenCalled();
  });

  it("restores a finished day straight into the conclusion, clock stopped", async () => {
    vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
    const record: QueensPlayRecord = {
      v: 1,
      game: "queens",
      date: DATE,
      size: DAILY.size,
      entries: [...PUZZLE.solution],
      grid: [...PUZZLE.solution],
      elapsedMs: 151_000,
      hintsUsed: 1,
      concluded: true,
      pendingSync: false,
      syncOutcome: "recorded",
    };
    localStorage.setItem(playRecordKey("queens", DATE), JSON.stringify(record));

    const { container } = render(<QueensScreen daily={DAILY} />);
    await act(async () => {
      await import("../src/play/conclusion-view");
    });

    const stamped = messages.conclusion.stampAria(
      messages.games.queens.conclusion.title,
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

  it("saves a mid-game edit before any pagehide", () => {
    render(<QueensScreen daily={DAILY} />);
    focusAt(3);
    press("2");

    const record = storedRecord();
    expect(record.concluded).toBe(false);
    expect(record.entries[3]).toBe(0);
  });
});
