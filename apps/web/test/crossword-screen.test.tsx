import {
  dailyCrosswordResponseSchema,
  FREE_HINTS_PER_PUZZLE,
  type DailyCrosswordResponse,
} from "@miolos/core";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { messages } from "../src/i18n";
import type { CrosswordPlayRecord } from "../src/play/play-record";
import boardStyles from "../src/crossword/crossword-board.module.css";
import clueStyles from "../src/crossword/clues.module.css";
import { CrosswordScreen } from "../src/crossword/crossword-screen";
import keyStyles from "../src/crossword/crossword-keyboard.module.css";
import { Keyboard, KeyboardSkeleton } from "../src/crossword/keyboard";
import { PlaySkeleton } from "../src/crossword/play-view";
import { ArchiveCrosswordScreen } from "../src/archive/crossword-screen";
import { archiveChrome } from "../src/archive/chrome";
import { bodyOf, decl, stylesheet } from "./css-source";
import { SEVEN_DAILY } from "./crossword-seven";

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
  return screen.getByRole("group", { name: copy.boardAria(5) });
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

  it("PageDown and PageUp jump to the column's last and first row", () => {
    render(<CrosswordScreen daily={DAILY} />);
    tap(cellAt(2));
    fireEvent.keyDown(boardOf(), { key: "PageDown" });
    expect(document.activeElement).toBe(cellAt(22));
    fireEvent.keyDown(boardOf(), { key: "PageUp" });
    expect(document.activeElement).toBe(cellAt(2));
  });
});

describe("Pular letras já preenchidas follows the device setting (T-WEB-S607)", () => {
  function typeAround(): void {
    tap(cellAt(1));
    fireEvent.keyDown(boardOf(), { key: "a" });
    tap(cellAt(0));
    fireEvent.keyDown(boardOf(), { key: "c" });
  }

  it("steps over a filled cell by default", () => {
    render(<CrosswordScreen daily={DAILY} />);
    typeAround();
    expect(document.activeElement).toBe(cellAt(2));
  });

  it("lands on the filled cell once the setting is off", () => {
    localStorage.setItem(
      "miolos-settings",
      JSON.stringify({ games: { crossword: { skipFilled: false } } }),
    );
    render(<CrosswordScreen daily={DAILY} />);
    typeAround();
    expect(document.activeElement).toBe(cellAt(1));
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
  it("steps over a leading block and fills a letter of the first open pista", () => {
    render(<CrosswordScreen daily={LEADING_BLOCK} />);
    fireEvent.click(
      screen.getByRole("button", {
        name: messages.play.hint.available(FREE_HINTS_PER_PUZZLE),
      }),
    );
    expect(cellAt(2).getAttribute("aria-label")).toBe(copy.cellAria(1, 3, "t"));
    expect(cellAt(1).getAttribute("aria-label")).toBe(
      copy.cellAria(1, 2, null),
    );
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

  it("a keyboard-activated on-screen key keeps focus for its arrow navigation", () => {
    render(<CrosswordScreen daily={DAILY} />);
    tap(cellAt(0));
    const key = screen.getByRole("button", {
      name: copy.keyboard.letterAria("c"),
    });
    key.focus();
    fireEvent.click(key, { detail: 0 });
    expect(document.activeElement).toBe(key);
    expect(cellAt(0).getAttribute("aria-label")).toBe(copy.cellAria(1, 1, "c"));
  });

  it("a key tap with nothing selected types into the first white cell", () => {
    render(<CrosswordScreen daily={LEADING_BLOCK} />);
    const key = screen.getByRole("button", {
      name: copy.keyboard.letterAria("a"),
    });
    key.focus();
    fireEvent.click(key, { detail: 1 });
    expect(cellAt(1).getAttribute("aria-label")).toBe(copy.cellAria(1, 2, "a"));
    expect(cellAt(0).getAttribute("aria-label")).toBe(copy.blockAria);
  });

  it("moves focus without scrolling the page back up to the board", () => {
    const focus = vi.spyOn(HTMLElement.prototype, "focus");
    render(<CrosswordScreen daily={DAILY} />);
    tap(cellAt(0));
    const key = screen.getByRole("button", {
      name: copy.keyboard.letterAria("c"),
    });
    key.focus();
    focus.mockClear();
    fireEvent.click(key, { detail: 1 });
    expect(focus.mock.calls.length).toBeGreaterThan(0);
    for (const [options] of focus.mock.calls) {
      expect(options).toEqual({ preventScroll: true });
    }
    focus.mockRestore();
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

describe("the clue list folds behind a Pistas button on a narrow board (T-WEB-S604)", () => {
  function toggle(): HTMLElement {
    return screen.getByRole("button", { name: copy.cluesHeading });
  }

  function lists(): HTMLElement {
    const id = toggle().getAttribute("aria-controls") ?? "";
    const element = document.getElementById(id);
    if (element === null) {
      throw new Error("the Pistas button controls no element");
    }
    return element;
  }

  function folded(): boolean {
    return lists().classList.contains(boardStyles.listsFolded ?? "");
  }

  it("asks for a tap until a cell is selected, instead of a blank bar", () => {
    render(<CrosswordScreen daily={DAILY} />);

    expect(screen.getByRole("status").textContent).toBe(copy.cluePrompt);
  });

  it("drops the prompt once a cell is selected, even a block", () => {
    render(<CrosswordScreen daily={DAILY} />);
    tap(cellAt(3));

    expect(screen.getByRole("status").textContent).toBe("\u00a0");
  });

  it("starts folded, opens on the button, and folds again once a clue is chosen", () => {
    render(<CrosswordScreen daily={DAILY} />);

    expect(toggle().getAttribute("aria-expanded")).toBe("false");
    expect(folded()).toBe(true);

    fireEvent.click(toggle());
    expect(toggle().getAttribute("aria-expanded")).toBe("true");
    expect(folded()).toBe(false);

    fireEvent.click(
      within(lists()).getByRole("button", {
        name: `${copy.clueLabel(2, "down")} — verbo`,
      }),
    );
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
    expect(folded()).toBe(true);
    expect(document.activeElement).toBe(cellAt(2));
  });

  it("folds only below a 640px board column, where the button shows", () => {
    const board = stylesheet("src/crossword/crossword-board.module.css");
    const narrow = bodyOf(board, "@container crossword (width < 640px)");
    const wide = bodyOf(board, "@container crossword (width >= 640px)");

    expect(decl(bodyOf(board, ".layout"), "container")).toBe(
      "crossword / inline-size",
    );
    expect(decl(bodyOf(narrow, ".listsFolded"), "display")).toBe("none");
    expect(board.replace(narrow, "")).not.toContain(".listsFolded");
    expect(decl(bodyOf(wide, ".toggle"), "display")).toBe("none");
  });
});

describe("the keyboard: apagar after P, under the board's column (T-WEB-S622)", () => {
  function liveKeyboard(): HTMLElement {
    return render(
      <Keyboard
        onLetter={vi.fn()}
        onErase={vi.fn()}
        activeKeyRef={{ current: null }}
      />,
    ).container;
  }

  it("ends row 1 with an apagar glyph and keeps row 3 letters only", () => {
    const keys = within(liveKeyboard()).getAllByRole("button");
    const erase = screen.getByRole("button", { name: copy.keyboard.eraseAria });

    expect(keys).toHaveLength(27);
    expect(keys[10]).toBe(erase);
    expect(erase.style.gridColumn).toBe("21 / span 2");
    expect(erase.textContent).toBe("");
    expect(erase.querySelector("svg")?.getAttribute("aria-hidden")).toBe(
      "true",
    );
    expect(keys[26]?.getAttribute("aria-label")).toBe(
      copy.keyboard.letterAria("m"),
    );
  });

  it("draws the skeleton's key boxes where and as the live keyboard does", () => {
    const boxes = (root: HTMLElement) =>
      [...root.querySelectorAll<HTMLElement>(`.${keyStyles.key ?? ""}`)].map(
        (key) => [key.style.gridColumn, key.innerHTML],
      );
    const live = boxes(liveKeyboard());

    expect(live).toHaveLength(27);
    expect(boxes(render(<KeyboardSkeleton />).container)).toEqual(live);
  });

  it("puts the keyboard in the board's column beside the clue list, never across both", () => {
    const board = stylesheet("src/crossword/crossword-board.module.css");
    const wide = bodyOf(board, "@container crossword (width >= 640px)");
    const areas = decl(bodyOf(wide, ".columns"), "grid-template-areas") ?? "";

    expect(areas.split(/\s*"\s*/).filter(Boolean)).toEqual([
      "well clues",
      "row  clues",
      "keys clues",
    ]);
    expect(decl(bodyOf(wide, ".keysSlot"), "grid-area")).toBe("keys");
    expect(
      decl(
        bodyOf(
          stylesheet("src/crossword/crossword-keyboard.module.css"),
          ".keyboard",
        ),
        "grid-template-columns",
      ),
    ).toBe("repeat(22, minmax(0, 1fr))");
  });
});

describe("the clue bar keeps one height for every clue (T-WEB-S605)", () => {
  it("is a fixed two lines, and a longer clue ends in an ellipsis there", () => {
    const clues = stylesheet("src/crossword/clues.module.css");
    const bar = bodyOf(clues, ".activeBar");
    const text = bodyOf(clues, ".activeText");

    expect(decl(bar, "height")).toBe(
      "calc(2 * 1.3em + 2 * var(--space-2) + 3px)",
    );
    expect(decl(bar, "line-height")).toBe("1.3");
    expect(decl(bar, "box-sizing")).toBe("border-box");
    expect(decl(text, "-webkit-line-clamp")).toBe("2");
    expect(decl(text, "overflow")).toBe("hidden");
    expect(clues).not.toMatch(/@container|@media \(max-width/);
  });

  it("keeps the whole clue in the status text a screen reader hears", () => {
    render(<CrosswordScreen daily={DAILY} />);
    fireEvent.click(
      screen.getByRole("button", {
        name: `${copy.clueLabel(2, "down")} — verbo`,
      }),
    );

    const status = screen.getByRole("status");
    expect(status.textContent).toBe(`${copy.clueLabel(2, "down")} · verbo`);
    expect(status.firstElementChild?.className).toBe(clueStyles.activeText);
  });
});

describe("a 7x7 daily lays its skeleton and board on seven tracks, at the 7x7 floor (T-WEB-S732)", () => {
  function sizing(container: HTMLElement) {
    return {
      tracks: container
        .querySelector<HTMLElement>(`.${boardStyles.grid ?? ""}`)
        ?.style.getPropertyValue("--crossword-size"),
      seven:
        container.querySelector(`.${boardStyles.pageSize7 ?? ""}`) !== null,
    };
  }

  it("sizes the daily and the archive skeleton from the side it is given", () => {
    const archive = archiveChrome(DATE);
    for (const skeleton of [
      <PlaySkeleton key="daily" date={DATE} size={7} />,
      <PlaySkeleton key="archive" date={DATE} size={7} archive={archive} />,
    ]) {
      expect(sizing(render(skeleton).container)).toEqual({
        tracks: "7",
        seven: true,
      });
    }
    expect(
      sizing(render(<PlaySkeleton date={DATE} size={5} />).container),
    ).toEqual({ tracks: "5", seven: false });
  });

  it("sizes the daily and the archive play view from the daily's grid", () => {
    for (const screenOf of [
      <CrosswordScreen key="daily" daily={SEVEN_DAILY} />,
      <ArchiveCrosswordScreen key="archive" daily={SEVEN_DAILY} />,
    ]) {
      expect(sizing(render(screenOf).container)).toEqual({
        tracks: "7",
        seven: true,
      });
    }
    expect(sizing(render(<CrosswordScreen daily={DAILY} />).container)).toEqual(
      { tracks: "5", seven: false },
    );
  });
});

describe("daily rendering (T-WEB-S439)", () => {
  it("lays the loading and the live grid on five tracks", () => {
    const fiveTracks = (container: HTMLElement) =>
      container
        .querySelector<HTMLElement>(`.${boardStyles.grid ?? ""}`)
        ?.style.getPropertyValue("--crossword-size");
    expect(
      fiveTracks(render(<PlaySkeleton date={DATE} size={5} />).container),
    ).toBe("5");
    expect(
      fiveTracks(render(<CrosswordScreen daily={DAILY} />).container),
    ).toBe("5");
  });

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
    expect(screen.queryByRole("group", { name: copy.boardAria(5) })).toBeNull();
  });
});

describe("the hint names its pista (T-WEB-S579)", () => {
  it("writes a letter of the selected pista and reads out which, keeping the selection", () => {
    const { container } = render(<CrosswordScreen daily={DAILY} />);
    tap(cellAt(7));
    expect(container.querySelector('[aria-live="polite"]')?.textContent).toBe(
      "",
    );

    fireEvent.click(
      screen.getByText(messages.play.hint.available(FREE_HINTS_PER_PUZZLE)),
    );

    expect(cellAt(2).getAttribute("aria-label")).toBe(copy.cellAria(1, 3, "t"));
    expect(container.querySelector('[aria-live="polite"]')?.textContent).toBe(
      "Uma letra da pista 2 vertical, que também ajuda na 1 horizontal: linha 1, coluna 3.",
    );
    expect(screen.getByRole("status").textContent).toContain(
      copy.clueLabel(2, "down"),
    );
  });
});
