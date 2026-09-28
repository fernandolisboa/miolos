import {
  dailyCrosswordResponseSchema,
  type DailyCrosswordResponse,
} from "@miolos/core";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { messages } from "../src/i18n";
import type { CrosswordPlayRecord } from "../src/play/play-record";
import { CrosswordScreen } from "../src/crossword/crossword-screen";

const sync = vi.hoisted(() => ({
  startCompletionSync: vi.fn(() => () => undefined),
  flushPendingCompletions: vi.fn(() => Promise.resolve(undefined)),
}));
vi.mock("../src/play/sync", () => sync);

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/cruzadinha",
}));

const DATE = "2026-08-01";
const copy = messages.games.crossword.play;

// row0: c a t # #
// row1: a # o # #
// rows 2-4: all blocks
const DAILY: DailyCrosswordResponse = dailyCrosswordResponseSchema.parse({
  game: "crossword",
  date: DATE,
  grid: [
    ["c", "a", "t", null, null],
    ["a", null, "o", null, null],
    [null, null, null, null, null],
    [null, null, null, null, null],
    [null, null, null, null, null],
  ],
  clues: [
    {
      number: 1,
      direction: "across",
      row: 0,
      col: 0,
      length: 3,
      clue: "felino",
    },
    {
      number: 1,
      direction: "down",
      row: 0,
      col: 0,
      length: 2,
      clue: "pronome",
    },
    { number: 2, direction: "down", row: 0, col: 2, length: 2, clue: "verbo" },
  ],
});

function boardOf(): HTMLElement {
  return screen.getByRole("group", { name: copy.boardAria });
}

function cellAt(index: number): HTMLElement {
  const cell = boardOf().querySelector<HTMLElement>(
    `[data-cell-index="${index}"]`,
  );
  if (cell === null) {
    throw new Error(`no cell at index ${index}`);
  }
  return cell;
}

function tap(cell: HTMLElement): void {
  fireEvent.pointerDown(cell);
  fireEvent.click(cell);
}

beforeEach(() => {
  localStorage.clear();
});

describe("board a11y (T-WEB-S434)", () => {
  it("is one labelled group, one tab stop, with a cell aria label and a block aria-disabled", () => {
    render(<CrosswordScreen daily={DAILY} />);

    const board = boardOf();
    const cells = within(board).getAllByRole("button");
    expect(cells).toHaveLength(25);

    const tabbable = board.querySelectorAll('[data-cell-index][tabindex="0"]');
    expect(tabbable).toHaveLength(1);

    const block = cellAt(3);
    expect(block.getAttribute("aria-disabled")).toBe("true");
    expect(block.getAttribute("aria-label")).toBe(copy.blockAria);

    const empty = cellAt(0);
    expect(empty.getAttribute("aria-label")).toBe(copy.cellAria(1, 1, null));
  });

  it("composes the letter into the cell's aria label once typed", () => {
    render(<CrosswordScreen daily={DAILY} />);
    tap(cellAt(0));
    fireEvent.keyDown(boardOf(), { key: "c" });
    expect(cellAt(0).getAttribute("aria-label")).toBe(copy.cellAria(1, 1, "c"));
  });
});

describe("the tap-toggle trap (T-WEB-S435)", () => {
  it("a first tap on an unselected cell selects it and never toggles direction", () => {
    render(<CrosswordScreen daily={DAILY} />);
    tap(cellAt(0));
    expect(screen.getByRole("status").textContent).toContain(
      copy.clueLabel(1, "across"),
    );
  });

  it("a second tap on the already-selected cell toggles direction", () => {
    render(<CrosswordScreen daily={DAILY} />);
    tap(cellAt(0));
    tap(cellAt(0));
    expect(screen.getByRole("status").textContent).toContain(
      copy.clueLabel(1, "down"),
    );
  });

  it("focusing a cell alone (no tap) never toggles direction either", () => {
    render(<CrosswordScreen daily={DAILY} />);
    tap(cellAt(0));
    tap(cellAt(0));
    expect(screen.getByRole("status").textContent).toContain(
      copy.clueLabel(1, "down"),
    );
    fireEvent.focus(cellAt(0));
    expect(screen.getByRole("status").textContent).toContain(
      copy.clueLabel(1, "down"),
    );
  });
});

describe("physical keys (T-WEB-S436)", () => {
  it("types a-z, auto-advancing inside the entry", () => {
    render(<CrosswordScreen daily={DAILY} />);
    tap(cellAt(0));
    fireEvent.keyDown(boardOf(), { key: "c" });
    fireEvent.keyDown(boardOf(), { key: "a" });
    fireEvent.keyDown(boardOf(), { key: "t" });
    expect(cellAt(0).textContent).toContain("c");
    expect(cellAt(1).textContent).toContain("a");
    expect(cellAt(2).textContent).toContain("t");
  });

  it("normalizes an accented physical key before writing it", () => {
    render(<CrosswordScreen daily={DAILY} />);
    tap(cellAt(0));
    fireEvent.keyDown(boardOf(), { key: "Ç" });
    expect(cellAt(0).textContent).toContain("c");
  });

  it("Backspace clears, and arrows move the caret, clamped", () => {
    render(<CrosswordScreen daily={DAILY} />);
    tap(cellAt(0));
    fireEvent.keyDown(boardOf(), { key: "c" });
    fireEvent.keyDown(boardOf(), { key: "ArrowLeft" });
    expect(document.activeElement).toBe(cellAt(0));
    fireEvent.keyDown(boardOf(), { key: "Backspace" });
    expect(cellAt(0).textContent).not.toContain("c");
  });
});

const LEADING_BLOCK: DailyCrosswordResponse =
  dailyCrosswordResponseSchema.parse({
    game: "crossword",
    date: DATE,
    grid: [
      [null, "a", "t", null, null],
      [null, null, "o", null, null],
      [null, null, null, null, null],
      [null, null, null, null, null],
      [null, null, null, null, null],
    ],
    clues: [
      { number: 1, direction: "across", row: 0, col: 1, length: 2, clue: "a" },
      { number: 2, direction: "down", row: 0, col: 2, length: 2, clue: "b" },
    ],
  });

describe("hint, skipping a block (T-WEB-S437)", () => {
  it("steps over a leading block and fills the first white cell", () => {
    render(<CrosswordScreen daily={LEADING_BLOCK} />);
    fireEvent.click(screen.getByRole("button", { name: copy.hint.available }));
    expect(cellAt(1).getAttribute("aria-label")).toBe(copy.cellAria(1, 2, "a"));
    expect(cellAt(0).textContent).toBe("");
    expect(cellAt(0).getAttribute("aria-label")).toBe(copy.blockAria);
  });
});

describe("browser shortcuts pass through the board (T-WEB-S440)", () => {
  it("Ctrl+F and Cmd+R are never prevented and write nothing", () => {
    render(<CrosswordScreen daily={DAILY} />);
    tap(cellAt(0));

    const find = fireEvent.keyDown(boardOf(), { key: "f", ctrlKey: true });
    const reload = fireEvent.keyDown(boardOf(), { key: "r", metaKey: true });
    const altLetter = fireEvent.keyDown(boardOf(), { key: "a", altKey: true });

    expect([find, reload, altLetter]).toEqual([true, true, true]);
    expect(cellAt(0).getAttribute("aria-label")).toBe(
      copy.cellAria(1, 1, null),
    );
    expect(cellAt(1).getAttribute("aria-label")).toBe(
      copy.cellAria(1, 2, null),
    );
  });
});

describe("physical typing after a clue or an on-screen key (T-WEB-S441)", () => {
  it("a clue tap hands focus to the board, so the next physical key lands", () => {
    render(<CrosswordScreen daily={DAILY} />);
    fireEvent.click(
      screen.getByRole("button", {
        name: `${copy.clueLabel(2, "down")} — verbo`,
      }),
    );
    expect(document.activeElement).toBe(cellAt(2));

    fireEvent.keyDown(document.activeElement ?? document.body, { key: "t" });
    expect(cellAt(2).getAttribute("aria-label")).toBe(copy.cellAria(1, 3, "t"));
  });

  it("an on-screen key tap hands focus to the board as well", () => {
    render(<CrosswordScreen daily={DAILY} />);
    tap(cellAt(0));
    const key = screen.getByRole("button", {
      name: copy.keyboard.letterAria("c"),
    });
    key.focus();
    fireEvent.click(key, { detail: 1 });
    expect(document.activeElement).toBe(cellAt(1));

    fireEvent.keyDown(document.activeElement ?? document.body, { key: "a" });
    expect(cellAt(1).getAttribute("aria-label")).toBe(copy.cellAria(1, 2, "a"));
  });
});

describe("the clue bar and lists (T-WEB-S438)", () => {
  it("lists both directions, and a clue button selects its entry", () => {
    render(<CrosswordScreen daily={DAILY} />);

    expect(
      screen.getByRole("button", {
        name: `${copy.clueLabel(2, "down")} — verbo`,
      }),
    ).toBeDefined();

    fireEvent.click(
      screen.getByRole("button", {
        name: `${copy.clueLabel(2, "down")} — verbo`,
      }),
    );

    expect(screen.getByRole("status").textContent).toContain(
      copy.clueLabel(2, "down"),
    );
    const tabbable = boardOf().querySelector('[data-cell-index][tabindex="0"]');
    expect(tabbable?.getAttribute("data-cell-index")).toBe("2");
  });
});

describe("daily rendering (T-WEB-S439)", () => {
  it("shows the play view once hydrated, with the shipped clue count", () => {
    render(<CrosswordScreen daily={DAILY} />);
    expect(
      screen.getAllByRole("button", { name: /horizontal|vertical/ }).length,
    ).toBe(3);
  });

  it("restores a concluded record as the conclusion, not the board", () => {
    const record: CrosswordPlayRecord = {
      v: 1,
      game: "crossword",
      date: DATE,
      entries: [
        "c",
        "a",
        "t",
        null,
        null,
        "a",
        null,
        "o",
        null,
        null,
        ...Array<null>(15).fill(null),
      ],
      elapsedMs: 30_000,
      hintsUsed: 0,
      concluded: true,
      pendingSync: false,
      syncOutcome: "recorded",
    };
    localStorage.setItem(
      `miolos:play:crossword:${DATE}`,
      JSON.stringify(record),
    );
    render(<CrosswordScreen daily={DAILY} />);
    expect(screen.queryByRole("group", { name: copy.boardAria })).toBeNull();
  });
});
