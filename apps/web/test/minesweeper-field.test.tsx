import {
  MINESWEEPER_LEVELS,
  chordBlock,
  cycleMinesweeperMark,
  layMines,
  newMinesweeperGame,
  openMinesweeperCell,
  type MinesweeperLevel,
  type MinesweeperState,
} from "@miolos/games/minesweeper";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { messages } from "../src/i18n";
import { minesweeperMessages } from "../src/minesweeper/messages";
import { Minefield } from "../src/minesweeper/minefield";
import styles from "../src/minesweeper/minefield.module.css";
import { cellView } from "../src/minesweeper/view";
import { bodyOf, decl, stylesheet } from "./css-source";
import { installPointerStubs, stubElementFromPoint } from "./pointer";

installPointerStubs();

const copy = { ...messages.games.minesweeper.play, ...minesweeperMessages };
const SEED = 20_261_015;

afterEach(() => {
  vi.restoreAllMocks();
});

function played(level: MinesweeperLevel, first = 0): MinesweeperState {
  return openMinesweeperCell(
    newMinesweeperGame(MINESWEEPER_LEVELS[level], SEED),
    first,
  );
}

function lostAt(level: MinesweeperLevel, first: number): MinesweeperState {
  const start = played(level, first);
  const mine = layMines({
    seed: SEED,
    size: MINESWEEPER_LEVELS[level],
    safe: [first],
  }).mines.findIndex(Boolean);
  return openMinesweeperCell(start, mine);
}

function mountField(game: MinesweeperState, tapMode: "open" | "flag" = "open") {
  const spies = { activate: vi.fn(), mark: vi.fn(), chord: vi.fn() };
  const view = render(
    <Minefield
      game={game}
      sizeClass={undefined}
      tapMode={tapMode}
      onActivate={spies.activate}
      onMark={spies.mark}
      onChord={spies.chord}
    />,
  );
  stubElementFromPoint(view.container);
  return { ...view, spies };
}

function cellAt(index: number): HTMLElement {
  const cell = document.querySelector<HTMLElement>(
    `[data-cell-index="${String(index)}"]`,
  );
  if (cell === null) {
    throw new Error(`no cell ${String(index)}`);
  }
  return cell;
}

describe("the minefield draws the engine's state, one button per cell (T-WEB-S885)", () => {
  it("lays out the level's cells under one labelled group with a single tab stop", () => {
    mountField(newMinesweeperGame(MINESWEEPER_LEVELS.intermediate, SEED));

    expect(
      screen.getByRole("group", { name: copy.boardAria(16, 16) }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(256);
    expect(
      screen.getAllByRole("button").filter((b) => b.tabIndex === 0),
    ).toHaveLength(1);
    expect(cellAt(0)).toHaveAccessibleName(
      copy.cellAria(1, 1, copy.cell.hidden),
    );
  });

  it("names an open number, an empty cell, a flag and a question mark", () => {
    const game = Array.from({ length: 81 }, (_unused, first) =>
      played("beginner", first),
    ).find((candidate) => candidate.open.filter(Boolean).length > 9);
    if (game === undefined) {
      throw new Error("no first open floods");
    }
    const field = game.field;
    const number = game.open.findIndex(
      (isOpen, i) => isOpen && (field?.counts[i] ?? 0) > 0,
    );
    const empty = game.open.findIndex(
      (isOpen, i) => isOpen && field?.counts[i] === 0,
    );
    const hidden = game.open.findIndex((isOpen) => !isOpen);
    const flagged = {
      ...game,
      marks: game.marks.map((m, i) =>
        i === hidden
          ? ("flag" as const)
          : i === hidden + 1
            ? ("question" as const)
            : m,
      ),
    };
    mountField(flagged);

    const row = (i: number) => Math.floor(i / 9) + 1;
    const col = (i: number) => (i % 9) + 1;
    expect(cellAt(number)).toHaveAccessibleName(
      copy.cellAria(
        row(number),
        col(number),
        copy.cell.count(field?.counts[number] ?? 0),
      ),
    );
    expect(cellAt(empty)).toHaveAccessibleName(
      copy.cellAria(row(empty), col(empty), copy.cell.empty),
    );
    expect(cellAt(hidden)).toHaveAccessibleName(
      copy.cellAria(row(hidden), col(hidden), copy.cell.flag),
    );
    expect(cellAt(hidden + 1)).toHaveAccessibleName(
      copy.cellAria(row(hidden + 1), col(hidden + 1), copy.cell.question),
    );
  });

  it("shows a lost game: the mine hit, the other mines, the wrong flags crossed, the right flags kept", () => {
    const lost = lostAt("beginner", 40);
    const field = lost.field;
    if (field === null || lost.hit === null) {
      throw new Error("the fixture did not lose");
    }
    const others = field.mines
      .map((m, i) => (m && i !== lost.hit ? i : -1))
      .filter((i) => i >= 0);
    const safeClosed = lost.open.findIndex(
      (isOpen, i) => !isOpen && !field.mines[i],
    );
    const marked = {
      ...lost,
      marks: lost.marks.map((m, i) =>
        i === others[0]
          ? ("flag" as const)
          : i === safeClosed
            ? ("flag" as const)
            : m,
      ),
    };

    expect(cellView(marked, lost.hit)).toBe("hit");
    expect(cellView(marked, others[0] ?? -1)).toBe("flag");
    expect(cellView(marked, others[1] ?? -1)).toBe("mine");
    expect(cellView(marked, safeClosed)).toBe("wrongFlag");

    mountField(marked);
    expect(cellAt(lost.hit)).toHaveAccessibleName(
      copy.cellAria(
        Math.floor(lost.hit / 9) + 1,
        (lost.hit % 9) + 1,
        copy.cell.hit,
      ),
    );
    expect(cellAt(safeClosed)).toHaveAccessibleName(
      copy.cellAria(
        Math.floor(safeClosed / 9) + 1,
        (safeClosed % 9) + 1,
        copy.cell.wrongFlag,
      ),
    );
  });

  it("opens with the mouse when the button is released, marks on the right button, chords on both", () => {
    const { container, spies } = mountField(
      newMinesweeperGame(MINESWEEPER_LEVELS.beginner, SEED),
    );
    const board = container.firstElementChild as HTMLElement;

    fireEvent.pointerDown(board, {
      pointerId: 1,
      pointerType: "mouse",
      button: 0,
      clientX: 4,
    });
    fireEvent.pointerUp(board, {
      pointerId: 1,
      pointerType: "mouse",
      button: 0,
      clientX: 4,
    });
    fireEvent.pointerDown(board, {
      pointerId: 1,
      pointerType: "mouse",
      button: 2,
      clientX: 5,
    });
    fireEvent.pointerUp(board, {
      pointerId: 1,
      pointerType: "mouse",
      button: 2,
      clientX: 5,
    });
    fireEvent.pointerDown(board, {
      pointerId: 1,
      pointerType: "mouse",
      button: 1,
      clientX: 6,
    });
    fireEvent.pointerUp(board, {
      pointerId: 1,
      pointerType: "mouse",
      button: 1,
      clientX: 6,
    });

    expect(spies.activate.mock.calls).toStrictEqual([[4]]);
    expect(spies.mark.mock.calls).toStrictEqual([[5]]);
    expect(spies.chord.mock.calls).toStrictEqual([[6]]);
  });

  it("lets Bandeira turn a tap into a mark, but never a keyboard open", () => {
    const { container, spies } = mountField(
      newMinesweeperGame(MINESWEEPER_LEVELS.beginner, SEED),
      "flag",
    );
    const board = container.firstElementChild as HTMLElement;

    fireEvent.pointerDown(board, {
      pointerId: 1,
      pointerType: "touch",
      button: 0,
      clientX: 2,
    });
    fireEvent.pointerUp(board, {
      pointerId: 1,
      pointerType: "touch",
      button: 0,
      clientX: 2,
    });
    expect(spies.mark.mock.calls).toStrictEqual([[2]]);
    expect(spies.activate).not.toHaveBeenCalled();

    fireEvent.click(cellAt(3));
    expect(spies.activate.mock.calls).toStrictEqual([[3]]);
  });

  it("lets a tap on an open number chord in Bandeira, and a tap on a closed cell flag", () => {
    const game = played("beginner", 40);
    const number = game.open.findIndex(
      (isOpen, i) => isOpen && (game.field?.counts[i] ?? 0) > 0,
    );
    const closed = game.open.findIndex((isOpen) => !isOpen);
    const { container, spies } = mountField(game, "flag");
    const board = container.firstElementChild as HTMLElement;
    const tap = (clientX: number) => {
      const touch = { pointerId: 1, pointerType: "touch", button: 0, clientX };
      fireEvent.pointerDown(board, touch);
      fireEvent.pointerUp(board, touch);
    };

    tap(number);
    expect(spies.activate.mock.calls).toStrictEqual([[number]]);
    expect(spies.mark).not.toHaveBeenCalled();

    tap(closed);
    expect(spies.mark.mock.calls).toStrictEqual([[closed]]);
  });

  it("does not open twice for one mouse click: the click that follows a pointer press is ignored", () => {
    const { spies } = mountField(
      newMinesweeperGame(MINESWEEPER_LEVELS.beginner, SEED),
    );

    fireEvent.click(cellAt(1), { detail: 1 });

    expect(spies.activate).not.toHaveBeenCalled();
  });

  it("marks on F and leaves a browser shortcut alone", () => {
    const { spies } = mountField(
      newMinesweeperGame(MINESWEEPER_LEVELS.beginner, SEED),
    );

    cellAt(7).focus();
    fireEvent.keyDown(cellAt(7), { key: "f" });
    fireEvent.keyDown(cellAt(7), { key: "f", ctrlKey: true });

    expect(spies.mark.mock.calls).toStrictEqual([[7]]);
  });

  it("moves the one tab stop with the arrows, Home, End, PageUp and PageDown, inside the board", () => {
    mountField(newMinesweeperGame(MINESWEEPER_LEVELS.beginner, SEED));

    cellAt(0).focus();
    fireEvent.keyDown(cellAt(0), { key: "ArrowLeft" });
    expect(document.activeElement).toBe(cellAt(0));
    fireEvent.keyDown(cellAt(0), { key: "ArrowDown" });
    expect(document.activeElement).toBe(cellAt(9));
    fireEvent.keyDown(cellAt(9), { key: "End" });
    expect(document.activeElement).toBe(cellAt(17));
    fireEvent.keyDown(cellAt(17), { key: "PageDown" });
    expect(document.activeElement).toBe(cellAt(80));
    fireEvent.keyDown(cellAt(80), { key: "Home" });
    expect(document.activeElement).toBe(cellAt(72));
    fireEvent.keyDown(cellAt(72), { key: "PageUp" });
    expect(document.activeElement).toBe(cellAt(0));
    expect(cellAt(0).tabIndex).toBe(0);
    expect(cellAt(80).tabIndex).toBe(-1);
  });

  it("blocks the page menu over the board", () => {
    const { container } = mountField(
      newMinesweeperGame(MINESWEEPER_LEVELS.beginner, SEED),
    );

    expect(
      fireEvent.contextMenu(container.firstElementChild as HTMLElement),
    ).toBe(false);
  });

  it("paints each number from its own token, one of eight", () => {
    const css = stylesheet("src/minesweeper/minefield.module.css");
    for (let n = 1; n <= 8; n += 1) {
      expect(decl(bodyOf(css, `.count${String(n)}`), "color")).toBe(
        `var(--mine-${String(n)})`,
      );
    }
  });

  it("is a touch surface that scrolls the page and never selects or calls out", () => {
    const field = bodyOf(
      stylesheet("src/minesweeper/minefield.module.css"),
      ".field",
    );

    expect(decl(field, "touch-action")).toBe("manipulation");
    expect(decl(field, "-webkit-touch-callout")).toBe("none");
    expect(decl(field, "user-select")).toBe("none");
  });
});

describe("the keyboard moves on the grid as it is drawn, wide or turned (T-WEB-S888)", () => {
  function turned(on: boolean): void {
    const real = window.getComputedStyle.bind(window);
    vi.spyOn(window, "getComputedStyle").mockImplementation(
      (element, pseudo) => {
        const style = real(element, pseudo);
        return on && element.getAttribute("role") === "group"
          ? new Proxy(style, {
              get: (target, key): unknown =>
                key === "gridAutoFlow" ? "column" : Reflect.get(target, key),
            })
          : style;
      },
    );
  }

  it("wide, a 16 by 30 board ends a row at column 29 and a column at row 15", () => {
    turned(false);
    mountField(newMinesweeperGame(MINESWEEPER_LEVELS.expert, SEED));

    cellAt(0).focus();
    fireEvent.keyDown(cellAt(0), { key: "End" });
    expect(document.activeElement).toBe(cellAt(29));
    fireEvent.keyDown(cellAt(29), { key: "PageDown" });
    expect(document.activeElement).toBe(cellAt(15 * 30 + 29));
  });

  it("turned, it is 30 rows of 16: End stops at the 16th column, PageDown at the 30th row", () => {
    turned(true);
    mountField(newMinesweeperGame(MINESWEEPER_LEVELS.expert, SEED));

    cellAt(0).focus();
    fireEvent.keyDown(cellAt(0), { key: "End" });
    expect(document.activeElement).toBe(cellAt(15 * 30));
    cellAt(0).focus();
    fireEvent.keyDown(cellAt(0), { key: "PageDown" });
    expect(document.activeElement).toBe(cellAt(29));
  });

  it("turned, an arrow moves along the screen: down is the next board column, right the next board row", () => {
    turned(true);
    mountField(newMinesweeperGame(MINESWEEPER_LEVELS.expert, SEED));

    cellAt(0).focus();
    fireEvent.keyDown(cellAt(0), { key: "ArrowDown" });
    expect(document.activeElement).toBe(cellAt(1));
    fireEvent.keyDown(cellAt(1), { key: "ArrowRight" });
    expect(document.activeElement).toBe(cellAt(31));
  });
});

describe("a press sinks its own closed cell, and a chord its closed 3×3, as Windows does (T-WEB-S943)", () => {
  function chordable(): {
    game: MinesweeperState;
    at: number;
    flag: number;
    closed: number;
  } {
    const game = played("beginner", 40);
    const at = game.open.findIndex(
      (open, i) => open && chordBlock(game, i).length > 1,
    );
    const [flag, closed] = chordBlock(game, at);
    if (at < 0 || flag === undefined || closed === undefined) {
      throw new Error(
        "the fixture has no open number with two closed neighbours",
      );
    }
    return {
      game: cycleMinesweeperMark(game, flag, false),
      at,
      flag,
      closed,
    };
  }

  const pressedCells = () =>
    [...document.querySelectorAll<HTMLElement>("[data-cell-index]")]
      .filter((cell) => cell.classList.contains(styles.pressed ?? "pressed"))
      .map((cell) => Number(cell.dataset.cellIndex));
  const mouse = { pointerId: 1, pointerType: "mouse" } as const;

  function pressAt(board: HTMLElement, clientX: number, button = 0) {
    const buttons = button === 0 ? 1 : button === 2 ? 2 : 4;
    fireEvent.pointerDown(board, { ...mouse, button, buttons, clientX });
  }

  function releaseAt(board: HTMLElement, clientX: number, button = 0) {
    fireEvent.pointerUp(board, { ...mouse, button, buttons: 0, clientX });
  }

  it("sinks only the closed cell under a left press, and nothing over a number or a flag", () => {
    const { game, at, flag, closed } = chordable();
    const { container } = mountField(game);
    const board = container.firstElementChild as HTMLElement;

    pressAt(board, closed);
    expect(pressedCells()).toStrictEqual([closed]);
    releaseAt(board, 99);
    expect(pressedCells()).toStrictEqual([]);

    pressAt(board, at);
    expect(pressedCells()).toStrictEqual([]);
    releaseAt(board, at);

    pressAt(board, flag);
    expect(pressedCells()).toStrictEqual([]);
    releaseAt(board, flag);
  });

  it("sinks the closed, unflagged 3×3 once the right button joins, until the first release", () => {
    const { game, at, flag } = chordable();
    const { container } = mountField(game);
    const board = container.firstElementChild as HTMLElement;

    pressAt(board, at);
    fireEvent.pointerMove(board, {
      ...mouse,
      button: 2,
      buttons: 3,
      clientX: at,
    });

    expect(pressedCells()).toStrictEqual([...chordBlock(game, at)]);
    expect(pressedCells().length).toBeGreaterThan(0);
    expect(pressedCells()).not.toContain(flag);
    expect(pressedCells()).not.toContain(at);
    fireEvent.pointerMove(board, {
      ...mouse,
      button: 2,
      buttons: 1,
      clientX: at,
    });
    expect(pressedCells()).toStrictEqual([]);
  });

  it("sinks a closed cell with its closed neighbours under a middle press, and nothing under a right press", () => {
    const { game, closed } = chordable();
    const { container } = mountField(game);
    const board = container.firstElementChild as HTMLElement;

    pressAt(board, closed, 1);
    expect(pressedCells()).toStrictEqual(
      [...chordBlock(game, closed)].sort((a, b) => a - b),
    );
    expect(pressedCells()).toContain(closed);
    releaseAt(board, closed, 1);

    pressAt(board, closed, 2);
    expect(pressedCells()).toStrictEqual([]);
  });

  it("draws a pressed cell as an open one", () => {
    const css = stylesheet("src/minesweeper/minefield.module.css");
    expect(bodyOf(css, ".open,\n.pressed")).toContain("var(--cell-open)");
  });
});

describe("a mouse left click on an open number does nothing; a tap or a key still chords it (T-WEB-S944)", () => {
  function numbered(): { game: MinesweeperState; number: number } {
    const game = played("beginner", 40);
    const number = game.open.findIndex(
      (isOpen, i) => isOpen && (game.field?.counts[i] ?? 0) > 0,
    );
    return { game, number };
  }

  it.each(["open", "flag"] as const)(
    "with %s taps, a left click on the number opens, marks and chords nothing",
    (tapMode) => {
      const { game, number } = numbered();
      const { container, spies } = mountField(game, tapMode);
      const board = container.firstElementChild as HTMLElement;
      const click = { pointerId: 1, pointerType: "mouse", clientX: number };

      fireEvent.pointerDown(board, { ...click, button: 0, buttons: 1 });
      fireEvent.pointerUp(board, { ...click, button: 0, buttons: 0 });

      expect(spies.activate).not.toHaveBeenCalled();
      expect(spies.mark).not.toHaveBeenCalled();
      expect(spies.chord).not.toHaveBeenCalled();
    },
  );

  it("lets a tap and the keyboard reach the number, where the engine chords", () => {
    const { game, number } = numbered();
    const { container, spies } = mountField(game);
    const board = container.firstElementChild as HTMLElement;
    const tap = { pointerId: 1, pointerType: "touch", button: 0 };

    fireEvent.pointerDown(board, { ...tap, clientX: number });
    fireEvent.pointerUp(board, { ...tap, clientX: number });
    fireEvent.click(cellAt(number), { detail: 0 });

    expect(spies.activate.mock.calls).toStrictEqual([[number], [number]]);
  });
});
