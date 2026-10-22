import { dailySudokuResponseSchema } from "@miolos/core";
import { generateDailySudoku } from "@miolos/games/sudoku";
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
} from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BinairoFreeScreen } from "../src/free-play/binairo-free-screen";
import { CrosswordFreeScreen } from "../src/free-play/crossword-free-screen";
import { NonogramFreeScreen } from "../src/free-play/nonogram-free-screen";
import { QueensFreeScreen } from "../src/free-play/queens-free-screen";
import { SudokuFreeScreen } from "../src/free-play/sudoku-free-screen";
import { messages } from "../src/i18n";
import {
  playRecordKey,
  playRecordSchema,
  type PlayRecord,
} from "../src/play/play-record";
import { NO_HISTORY, useBoardEdits, type Editable } from "../src/play/undo";
import { UndoControl } from "../src/play/undo-control";
import { useSudokuPlay } from "../src/sudoku/use-sudoku-play";
import { NO_MISTAKES } from "../src/play/mistakes";
import { bodyOf, decl, stylesheet } from "./css-source";
import { flushGeneration } from "./free-generation";

const sync = vi.hoisted(() => ({
  startCompletionSync: vi.fn(() => () => undefined),
  flushPendingCompletions: vi.fn(() => Promise.resolve()),
}));
vi.mock("../src/play/sync", () => sync);

const LABEL = messages.play.undo;
const REDO_LABEL = messages.play.redo;
const TIP_CSS = stylesheet("src/play/undo-control.module.css");
const SCREEN_CSS = stylesheet("src/play/screen.module.css");
const DATE = "2026-10-15";
const SEED = 20_261_015;

function board(overrides: Partial<Editable> = {}): Editable {
  return {
    date: DATE,
    timer: { accumulatedMs: 0, runningSince: null },
    status: "playing",
    now: 0,
    hydrated: true,
    entries: [null, null],
    hint: { used: 0, lastIndex: null, reason: null, spotlight: [] },
    history: NO_HISTORY,
    mistakes: NO_MISTAKES,
    ...overrides,
  };
}

function undoButton(): HTMLElement {
  return screen.getByRole("button", { name: LABEL });
}

function redoButton(): HTMLElement {
  return screen.getByRole("button", { name: REDO_LABEL });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useBoardEdits offers Recomeçar and undo only when they can act (T-WEB-S826)", () => {
  it("offers neither on an untouched board", () => {
    const { result } = renderHook(() => useBoardEdits(board(), vi.fn()));
    expect(result.current).toEqual({
      onReset: null,
      onUndo: null,
      onRedo: null,
      mistakesLeft: null,
    });
  });

  it("dispatches each once there is a decided cell and a step", () => {
    const dispatch = vi.fn();
    const touched = board({
      entries: [1, null],
      history: {
        ...NO_HISTORY,
        steps: [{ entries: [null, null] }],
        open: true,
      },
    });
    const { result } = renderHook(() => useBoardEdits(touched, dispatch));
    result.current.onUndo?.();
    result.current.onReset?.();
    expect(dispatch.mock.calls).toEqual([
      [{ type: "undo" }],
      [{ type: "reset" }],
    ]);
  });

  it("offers no undo on a solved board", () => {
    const solved = board({
      status: "solved",
      entries: [1, 1],
      history: { ...NO_HISTORY, steps: [{ entries: [1, null] }], open: true },
    });
    const { result } = renderHook(() => useBoardEdits(solved, vi.fn()));
    expect(result.current.onUndo).toBeNull();
  });
});

describe("UndoControl is a quiet icon named Desfazer (T-WEB-S827)", () => {
  it("shows no word, names itself and its tooltip Desfazer, and undoes on click", () => {
    const onUndo = vi.fn();
    render(<UndoControl onUndo={onUndo} onRedo={null} />);
    const button = undoButton();

    expect(button.textContent).toBe("");
    expect(decl(bodyOf(TIP_CSS, ".control::after"), "content")).toBe(
      "attr(aria-label)",
    );
    expect(button).toHaveAttribute("aria-disabled", "false");
    fireEvent.click(button);
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it("shows its tooltip only on the live control, and fits a 320px screen", () => {
    expect(
      decl(
        bodyOf(TIP_CSS, '.control[aria-disabled="false"]:hover::after'),
        "opacity",
      ),
    ).toBe("1");
    expect(decl(bodyOf(TIP_CSS, ".control:not(button)"), "cursor")).toBe(
      "default",
    );
    const phone = bodyOf(SCREEN_CSS, "@media (max-width: 1023px)");
    expect(decl(bodyOf(phone, ".reset"), "gap")).toBe("0");
    const narrow = bodyOf(SCREEN_CSS, "@media (max-width: 374px)");
    expect(decl(bodyOf(narrow, ".hint"), "padding-inline")).toBe(
      "var(--space-3)",
    );
    const narrowest = bodyOf(SCREEN_CSS, "@media (max-width: 359px)");
    expect(decl(bodyOf(narrowest, ".page"), "grid-template-areas")).toMatch(
      /"reset reset"\s+"hint {2}hint"$/,
    );
  });

  it("stays focusable and does nothing when there is nothing to undo", () => {
    render(<UndoControl onUndo={null} onRedo={null} />);
    const button = undoButton();
    button.focus();
    fireEvent.click(button);

    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).not.toBeDisabled();
    expect(button).toHaveFocus();
  });
});

describe("Ctrl+Z and ⌘+Z undo, unless something else owns the keyboard (T-WEB-S828)", () => {
  function chord(target: Element, init: KeyboardEventInit): boolean {
    return fireEvent.keyDown(target, { key: "z", ...init });
  }

  it("undoes on Ctrl+Z and ⌘+Z, and takes the browser's default", () => {
    const onUndo = vi.fn();
    render(<UndoControl onUndo={onUndo} onRedo={null} />);

    expect(chord(document.body, { ctrlKey: true })).toBe(false);
    expect(chord(document.body, { metaKey: true, key: "Z" })).toBe(false);
    expect(onUndo).toHaveBeenCalledTimes(2);
  });

  it("never undoes on Shift, a bare z or a board with nothing to undo", () => {
    const onUndo = vi.fn();
    const { rerender } = render(<UndoControl onUndo={onUndo} onRedo={null} />);
    chord(document.body, { ctrlKey: true, shiftKey: true });
    chord(document.body, {});
    rerender(<UndoControl onUndo={null} onRedo={null} />);
    expect(chord(document.body, { ctrlKey: true })).toBe(true);
    expect(onUndo).not.toHaveBeenCalled();
  });

  it("leaves a text field, the Ajustes dialog and the Recomeçar question alone", () => {
    const onUndo = vi.fn();
    const { rerender } = render(
      <div>
        <UndoControl onUndo={onUndo} onRedo={null} />
        <input aria-label="campo" />
      </div>,
    );
    chord(screen.getByLabelText("campo"), { ctrlKey: true });

    rerender(
      <div>
        <UndoControl onUndo={onUndo} onRedo={null} />
        <dialog open aria-label="Ajustes" />
      </div>,
    );
    chord(document.body, { ctrlKey: true });

    rerender(
      <div>
        <UndoControl onUndo={onUndo} onRedo={null} />
        <div role="group" aria-label="Recomeçar o puzzle?" />
      </div>,
    );
    chord(document.body, { ctrlKey: true });

    expect(onUndo).not.toHaveBeenCalled();
  });
});

describe("every grid game carries undo, and a daily undo is saved (T-WEB-S829)", () => {
  const deps = { pickSeed: () => SEED };
  const screens: readonly (readonly [string, ReactElement])[] = [
    ["Sudoku", <SudokuFreeScreen key="s" deps={deps} />],
    ["Nonogram", <NonogramFreeScreen key="n" deps={deps} />],
    ["Binairo", <BinairoFreeScreen key="b" deps={deps} />],
    ["Rainhas", <QueensFreeScreen key="q" deps={deps} />],
    ["Cruzadinha", <CrosswordFreeScreen key="c" deps={deps} />],
  ];

  function cells(container: HTMLElement): readonly (string | null)[] {
    return [...container.querySelectorAll("[data-cell-index]")].map(
      (cell) => cell.getAttribute("aria-label") ?? cell.textContent,
    );
  }

  function firstMove(container: HTMLElement): void {
    const moved = () => undoButton().getAttribute("aria-disabled") === "false";
    for (const cell of container.querySelectorAll<HTMLElement>(
      "[data-cell-index]",
    )) {
      fireEvent.click(cell, { detail: 0 });
      const board = cell.closest<HTMLElement>('[role="group"]');
      for (const key of ["1", "a"]) {
        if (moved()) {
          return;
        }
        if (board !== null) {
          fireEvent.keyDown(board, { key });
        }
      }
      if (moved()) {
        return;
      }
    }
  }

  it.each(screens)(
    "%s free play starts with undo idle, and undo takes back the first move",
    async (_name, element) => {
      vi.stubGlobal("fetch", vi.fn());
      const { container } = render(element);
      await flushGeneration();
      const fresh = cells(container);
      expect(undoButton()).toHaveAttribute("aria-disabled", "true");

      firstMove(container);
      expect(undoButton()).toHaveAttribute("aria-disabled", "false");
      expect(cells(container)).not.toEqual(fresh);

      fireEvent.click(undoButton());
      expect(cells(container)).toEqual(fresh);
      expect(undoButton()).toHaveAttribute("aria-disabled", "true");
      vi.unstubAllGlobals();
    },
  );

  describe("daily Sudoku", () => {
    const puzzle = generateDailySudoku({ seed: SEED, weekday: 1 });
    const daily = dailySudokuResponseSchema.parse({
      game: "sudoku",
      date: DATE,
      givens: puzzle.givens,
      tier: puzzle.tier,
    });
    const open = puzzle.givens.indexOf(0);

    function stored(): PlayRecord {
      const raw = window.localStorage.getItem(playRecordKey("sudoku", DATE));
      if (raw === null) {
        throw new Error("no record was written");
      }
      return playRecordSchema.parse(JSON.parse(raw));
    }

    beforeEach(() => {
      window.localStorage.clear();
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("rewrites the record without the undone digit", () => {
      const { result } = renderHook(() => useSudokuPlay(daily));
      act(() => {
        vi.advanceTimersByTime(0);
      });
      act(() => {
        result.current.selectCell(open);
        result.current.enterDigit(9);
      });
      const entered = stored();
      expect("entries" in entered && entered.entries[open]).toBe(9);

      act(() => {
        result.current.edits.onUndo?.();
      });
      const undone = stored();
      expect("entries" in undone && undone.entries[open]).toBeNull();
      expect(result.current.edits.onUndo).toBeNull();
    });
  });
});

describe("useBoardEdits offers redo only while an undone step waits (T-WEB-S962)", () => {
  const undone = {
    ...NO_HISTORY,
    redo: [{ entries: [1, null] }],
  };

  it("dispatches redo once a step was undone", () => {
    const dispatch = vi.fn();
    const { result } = renderHook(() =>
      useBoardEdits(board({ history: undone }), dispatch),
    );
    expect(result.current.onUndo).toBeNull();
    result.current.onRedo?.();
    expect(dispatch.mock.calls).toEqual([[{ type: "redo" }]]);
  });

  it("offers no redo on a solved board", () => {
    const { result } = renderHook(() =>
      useBoardEdits(board({ status: "solved", history: undone }), vi.fn()),
    );
    expect(result.current.onRedo).toBeNull();
  });
});

describe("UndoControl pairs Desfazer with a mirrored Refazer tile (T-WEB-S963)", () => {
  it("names the second tile Refazer, idle until something can be redone", () => {
    const onRedo = vi.fn();
    const { rerender } = render(<UndoControl onUndo={null} onRedo={null} />);
    expect(redoButton()).toHaveAttribute("aria-disabled", "true");
    expect(redoButton().textContent).toBe("");

    rerender(<UndoControl onUndo={null} onRedo={onRedo} />);
    fireEvent.click(redoButton());
    expect(redoButton()).toHaveAttribute("aria-disabled", "false");
    expect(onRedo).toHaveBeenCalledTimes(1);
  });

  it("tilts the pair apart and keeps them one unit in the row", () => {
    expect(decl(bodyOf(TIP_CSS, ".control"), "--tilt")).toBe("-3deg");
    expect(decl(bodyOf(TIP_CSS, ".control + .control"), "--tilt")).toBe("3deg");
    expect(decl(bodyOf(TIP_CSS, ".pair"), "margin-left")).toBe("-5px");
  });
});

describe("Ctrl+Shift+Z, ⌘+Shift+Z and Ctrl+Y redo (T-WEB-S964)", () => {
  function press(init: KeyboardEventInit): boolean {
    return fireEvent.keyDown(document.body, init);
  }

  it("redoes on each, and takes the browser's default", () => {
    const onUndo = vi.fn();
    const onRedo = vi.fn();
    render(<UndoControl onUndo={onUndo} onRedo={onRedo} />);

    expect(press({ key: "Z", ctrlKey: true, shiftKey: true })).toBe(false);
    expect(press({ key: "z", metaKey: true, shiftKey: true })).toBe(false);
    expect(press({ key: "y", ctrlKey: true })).toBe(false);
    expect(onRedo).toHaveBeenCalledTimes(3);
    expect(onUndo).not.toHaveBeenCalled();
  });

  it("leaves ⌘+Y, Alt and a board with nothing to redo alone", () => {
    const onRedo = vi.fn();
    const { rerender } = render(
      <UndoControl onUndo={vi.fn()} onRedo={onRedo} />,
    );
    expect(press({ key: "y", metaKey: true })).toBe(true);
    expect(
      press({ key: "z", ctrlKey: true, shiftKey: true, altKey: true }),
    ).toBe(true);
    rerender(<UndoControl onUndo={vi.fn()} onRedo={null} />);
    expect(press({ key: "z", ctrlKey: true, shiftKey: true })).toBe(true);
    expect(onRedo).not.toHaveBeenCalled();
  });

  it("leaves a text field and the Recomeçar question alone", () => {
    const onRedo = vi.fn();
    const { rerender } = render(
      <div>
        <UndoControl onUndo={null} onRedo={onRedo} />
        <input aria-label="campo" />
      </div>,
    );
    fireEvent.keyDown(screen.getByLabelText("campo"), {
      key: "y",
      ctrlKey: true,
    });
    rerender(
      <div>
        <UndoControl onUndo={null} onRedo={onRedo} />
        <div role="group" aria-label="Recomeçar o puzzle?" />
      </div>,
    );
    press({ key: "y", ctrlKey: true });
    expect(onRedo).not.toHaveBeenCalled();
  });
});

describe("every grid game redoes an undone move, and a new move drops it (T-WEB-S965)", () => {
  const deps = { pickSeed: () => SEED };
  const screens: readonly (readonly [string, ReactElement])[] = [
    ["Sudoku", <SudokuFreeScreen key="s" deps={deps} />],
    ["Nonogram", <NonogramFreeScreen key="n" deps={deps} />],
    ["Binairo", <BinairoFreeScreen key="b" deps={deps} />],
    ["Rainhas", <QueensFreeScreen key="q" deps={deps} />],
    ["Cruzadinha", <CrosswordFreeScreen key="c" deps={deps} />],
  ];

  function cells(container: HTMLElement): readonly (string | null)[] {
    return [...container.querySelectorAll("[data-cell-index]")].map(
      (cell) => cell.getAttribute("aria-label") ?? cell.textContent,
    );
  }

  function move(container: HTMLElement, from = 0): void {
    const before = cells(container);
    const all = [
      ...container.querySelectorAll<HTMLElement>("[data-cell-index]"),
    ].slice(from);
    for (const cell of all) {
      fireEvent.click(cell, { detail: 0 });
      const group = cell.closest<HTMLElement>('[role="group"]');
      for (const key of ["1", "a"]) {
        if (cells(container).join() !== before.join()) {
          return;
        }
        if (group !== null) {
          fireEvent.keyDown(group, { key });
        }
      }
      if (cells(container).join() !== before.join()) {
        return;
      }
    }
  }

  it.each(screens)("%s free play", async (_name, element) => {
    vi.stubGlobal("fetch", vi.fn());
    const { container } = render(element);
    await flushGeneration();
    expect(redoButton()).toHaveAttribute("aria-disabled", "true");

    move(container);
    const moved = cells(container);
    fireEvent.click(undoButton());
    expect(redoButton()).toHaveAttribute("aria-disabled", "false");

    fireEvent.click(redoButton());
    expect(cells(container)).toEqual(moved);
    expect(redoButton()).toHaveAttribute("aria-disabled", "true");

    fireEvent.click(undoButton());
    move(container, 20);
    expect(redoButton()).toHaveAttribute("aria-disabled", "true");
    vi.unstubAllGlobals();
  });
});
