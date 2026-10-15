import {
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
  return openMinesweeperCell(newMinesweeperGame(level, SEED), first);
}

function lostAt(level: MinesweeperLevel, first: number): MinesweeperState {
  const start = played(level, first);
  const mine = layMines({ seed: SEED, level, safe: first }).mines.findIndex(
    Boolean,
  );
  return openMinesweeperCell(start, mine);
}

function mountField(
  game: MinesweeperState,
  tapMode: "reveal" | "flag" = "reveal",
) {
  const spies = { activate: vi.fn(), mark: vi.fn(), chord: vi.fn() };
  const view = render(
    <Minefield
      game={game}
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
    mountField(newMinesweeperGame("intermediate", SEED));

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
      newMinesweeperGame("beginner", SEED),
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
      newMinesweeperGame("beginner", SEED),
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

  it("does not open twice for one mouse click: the click that follows a pointer press is ignored", () => {
    const { spies } = mountField(newMinesweeperGame("beginner", SEED));

    fireEvent.click(cellAt(1), { detail: 1 });

    expect(spies.activate).not.toHaveBeenCalled();
  });

  it("marks on F and leaves a browser shortcut alone", () => {
    const { spies } = mountField(newMinesweeperGame("beginner", SEED));

    cellAt(7).focus();
    fireEvent.keyDown(cellAt(7), { key: "f" });
    fireEvent.keyDown(cellAt(7), { key: "f", ctrlKey: true });

    expect(spies.mark.mock.calls).toStrictEqual([[7]]);
  });

  it("moves the one tab stop with the arrows, Home, End, PageUp and PageDown, inside the board", () => {
    mountField(newMinesweeperGame("beginner", SEED));

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
    const { container } = mountField(newMinesweeperGame("beginner", SEED));

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
    mountField(newMinesweeperGame("expert", SEED));

    cellAt(0).focus();
    fireEvent.keyDown(cellAt(0), { key: "End" });
    expect(document.activeElement).toBe(cellAt(29));
    fireEvent.keyDown(cellAt(29), { key: "PageDown" });
    expect(document.activeElement).toBe(cellAt(15 * 30 + 29));
  });

  it("turned, it is 30 rows of 16: End stops at the 16th column, PageDown at the 30th row", () => {
    turned(true);
    mountField(newMinesweeperGame("expert", SEED));

    cellAt(0).focus();
    fireEvent.keyDown(cellAt(0), { key: "End" });
    expect(document.activeElement).toBe(cellAt(15 * 30));
    cellAt(0).focus();
    fireEvent.keyDown(cellAt(0), { key: "PageDown" });
    expect(document.activeElement).toBe(cellAt(29));
  });

  it("turned, an arrow moves along the screen: down is the next board column, right the next board row", () => {
    turned(true);
    mountField(newMinesweeperGame("expert", SEED));

    cellAt(0).focus();
    fireEvent.keyDown(cellAt(0), { key: "ArrowDown" });
    expect(document.activeElement).toBe(cellAt(1));
    fireEvent.keyDown(cellAt(1), { key: "ArrowRight" });
    expect(document.activeElement).toBe(cellAt(31));
  });
});
