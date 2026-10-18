import {
  dailySudokuResponseSchema,
  type DailySudokuResponse,
} from "@miolos/core";
import { generateDailySudoku } from "@miolos/games/sudoku";
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SudokuFreeScreen } from "../src/free-play/sudoku-free-screen";
import { messages } from "../src/i18n";
import { playRecordKey } from "../src/play/play-record";
import { readSettings, writeSettings } from "../src/settings/settings";
import { solutionDigits } from "../src/sudoku/engine";
import { SudokuScreen } from "../src/sudoku/sudoku-screen";
import { useSudokuPlay } from "../src/sudoku/use-sudoku-play";
import { flushGeneration } from "./free-generation";

vi.mock("../src/play/sync", () => ({
  startCompletionSync: vi.fn(() => () => undefined),
  flushPendingCompletions: vi.fn((record?: unknown) => Promise.resolve(record)),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/",
}));

const PUZZLE = generateDailySudoku({ seed: 42, weekday: 1 });
const DAILY: DailySudokuResponse = dailySudokuResponseSchema.parse({
  game: "sudoku",
  date: "2026-08-01",
  givens: PUZZLE.givens,
  tier: PUZZLE.tier,
});
const FREE_DEPS = { pickSeed: () => 42 };

const SOLUTION = solutionDigits(PUZZLE.givens) ?? [];
const EMPTIES = PUZZLE.givens.flatMap((given, index) =>
  given === 0 ? [index] : [],
);
const FIRST = EMPTIES[0] ?? 0;
const SECOND = EMPTIES[1] ?? 0;
const GIVEN = PUZZLE.givens.findIndex((given) => given !== 0);
const GIVEN_DIGIT = PUZZLE.givens[GIVEN] ?? 1;
const OTHER = (GIVEN_DIGIT % 9) + 1;
const keypad = messages.games.sudoku.play.keypad;

function setLockDigit(lockDigit: boolean): void {
  const current = readSettings();
  writeSettings({
    ...current,
    games: { ...current.games, sudoku: { ...current.games.sudoku, lockDigit } },
  });
}

function cell(index: number): HTMLElement {
  const found = document.querySelector<HTMLElement>(
    `[data-cell-index="${String(index)}"]`,
  );
  if (found === null) {
    throw new Error(`no cell at ${String(index)}`);
  }
  return found;
}

function key(digit: number): HTMLElement {
  return screen.getByLabelText(keypad.digitAria(digit));
}

function pointer(element: HTMLElement): void {
  fireEvent.click(element, { detail: 1 });
}

function tap(digit: number): void {
  pointer(key(digit));
}

function tapErase(): void {
  pointer(screen.getByLabelText(keypad.eraseAria));
}

function select(index: number): void {
  fireEvent.focus(cell(index));
}

function type(digit: number): void {
  fireEvent.keyDown(
    screen.getByRole("group", { name: messages.games.sudoku.play.boardAria }),
    {
      key: String(digit),
    },
  );
}

function wait(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

function boardValues(): string[] {
  return EMPTIES.map((index) => cell(index).textContent ?? "");
}

function pressed(digit: number): string | null {
  return key(digit).getAttribute("aria-pressed");
}

beforeEach(() => {
  window.localStorage.clear();
  vi.useFakeTimers({ toFake: ["performance"] });
  setLockDigit(true);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("the Sudoku digit lock on the keypad (T-WEB-S592)", () => {
  describe("a second tap of the same digit within 300 ms", () => {
    it("locks it and leaves an empty cell empty", () => {
      render(<SudokuScreen daily={DAILY} />);
      select(FIRST);

      tap(7);
      expect(cell(FIRST)).toHaveTextContent("7");
      wait(120);
      tap(7);

      expect(cell(FIRST)).toHaveTextContent("");
      expect(pressed(7)).toBe("true");
      expect(pressed(6)).toBe("false");
    });

    it("leaves a cell that already held the same digit holding it", () => {
      render(<SudokuScreen daily={DAILY} />);
      select(FIRST);
      type(7);

      tap(7);
      wait(300);
      tap(7);

      expect(cell(FIRST)).toHaveTextContent("7");
      expect(pressed(7)).toBe("true");
    });

    it("leaves a cell that held another digit holding it", () => {
      render(<SudokuScreen daily={DAILY} />);
      select(FIRST);
      type(3);

      tap(7);
      wait(80);
      tap(7);

      expect(cell(FIRST)).toHaveTextContent("3");
      expect(pressed(7)).toBe("true");
    });

    it("locks with no cell selected, and on a given", () => {
      render(<SudokuScreen daily={DAILY} />);
      const before = boardValues();

      tap(4);
      wait(50);
      tap(4);
      expect(pressed(4)).toBe("true");
      expect(boardValues()).toEqual(before);

      tap(4);
      select(GIVEN);
      tap(5);
      wait(50);
      tap(5);
      expect(pressed(5)).toBe("true");
      expect(cell(GIVEN)).toHaveAttribute("aria-disabled", "true");
      expect(boardValues()).toEqual(before);
    });
  });

  it("treats a second tap 301 ms later as another single press", () => {
    render(<SudokuScreen daily={DAILY} />);
    select(FIRST);

    tap(7);
    wait(301);
    tap(7);

    expect(cell(FIRST)).toHaveTextContent("");
    expect(pressed(7)).toBe("false");
  });

  it("does not pair a tap on one digit with a tap on another", () => {
    render(<SudokuScreen daily={DAILY} />);
    select(FIRST);

    tap(7);
    wait(50);
    tap(8);

    expect(cell(FIRST)).toHaveTextContent("8");
    expect(pressed(7)).toBe("false");
    expect(pressed(8)).toBe("false");
  });

  describe("while a digit is locked", () => {
    function locked(digit: number): void {
      tap(digit);
      wait(50);
      tap(digit);
    }

    it("tapping the locked digit releases it and writes nothing", () => {
      render(<SudokuScreen daily={DAILY} />);
      select(FIRST);
      locked(7);

      wait(1000);
      tap(7);

      expect(pressed(7)).toBe("false");
      expect(cell(FIRST)).toHaveTextContent("");
    });

    it("a double tap on the locked digit releases it and keeps the last cell it wrote", () => {
      render(<SudokuScreen daily={DAILY} />);
      locked(7);
      pointer(cell(SECOND));
      expect(cell(SECOND)).toHaveTextContent("7");

      wait(1000);
      tap(7);
      wait(80);
      tap(7);

      expect(cell(SECOND)).toHaveTextContent("7");
      expect(pressed(7)).toBe("false");
    });

    it("a triple tap on the locked digit releases it and still keeps the cell", () => {
      render(<SudokuScreen daily={DAILY} />);
      locked(7);
      pointer(cell(SECOND));

      wait(1000);
      tap(7);
      wait(80);
      tap(7);
      wait(80);
      tap(7);

      expect(cell(SECOND)).toHaveTextContent("7");
      expect(pressed(7)).toBe("false");
    });

    it("another digit writes as it always does, then unlocks", () => {
      render(<SudokuScreen daily={DAILY} />);
      select(FIRST);
      locked(7);

      wait(1000);
      tap(2);

      expect(cell(FIRST)).toHaveTextContent("2");
      expect(pressed(7)).toBe("false");
      expect(pressed(2)).toBe("false");
    });

    it("Apagar clears as it always does, then unlocks", () => {
      render(<SudokuScreen daily={DAILY} />);
      select(FIRST);
      type(5);
      locked(7);

      wait(1000);
      tapErase();

      expect(cell(FIRST)).toHaveTextContent("");
      expect(pressed(7)).toBe("false");
    });

    it("a pointer tap on a cell selects it and toggles the digit there", () => {
      render(<SudokuScreen daily={DAILY} />);
      locked(7);

      pointer(cell(SECOND));
      expect(cell(SECOND)).toHaveTextContent("7");
      expect(cell(SECOND)).toHaveAttribute("tabindex", "0");

      pointer(cell(SECOND));
      expect(cell(SECOND)).toHaveTextContent("");
      expect(pressed(7)).toBe("true");
    });

    it("a pointer tap on a given selects it, writes nothing and locks its digit", () => {
      render(<SudokuScreen daily={DAILY} />);
      locked(OTHER);
      const before = boardValues();

      pointer(cell(GIVEN));

      expect(cell(GIVEN)).toHaveAttribute("tabindex", "0");
      expect(boardValues()).toEqual(before);
      expect(pressed(GIVEN_DIGIT)).toBe("true");
      expect(pressed(OTHER)).toBe("false");
    });

    it("a keyboard activation of a cell does not write", () => {
      render(<SudokuScreen daily={DAILY} />);
      locked(7);

      fireEvent.click(cell(SECOND));

      expect(cell(SECOND)).toHaveTextContent("");
    });

    it("a tap that restarts the 300 ms window cannot pair with one before a cell tap", () => {
      render(<SudokuScreen daily={DAILY} />);
      select(FIRST);

      tap(7);
      pointer(cell(SECOND));
      wait(20);
      tap(7);

      expect(pressed(7)).toBe("false");
    });
  });

  describe("only pointer taps on the keypad can lock", () => {
    it("a keyboard activation of a key (detail 0) never locks", () => {
      render(<SudokuScreen daily={DAILY} />);
      select(FIRST);

      fireEvent.click(key(7));
      fireEvent.click(key(7));

      expect(cell(FIRST)).toHaveTextContent("");
      expect(pressed(7)).toBe("false");
    });

    it("a keyboard activation of Apagar or a typed digit never locks either", () => {
      render(<SudokuScreen daily={DAILY} />);
      select(FIRST);

      type(7);
      type(7);
      type(7);
      fireEvent.click(screen.getByLabelText(keypad.eraseAria));

      expect(cell(FIRST)).toHaveTextContent("");
      expect(pressed(7)).toBe("false");
    });

    it("a typed digit leaves a locked digit locked", () => {
      render(<SudokuScreen daily={DAILY} />);
      select(FIRST);
      tap(7);
      wait(50);
      tap(7);

      type(4);

      expect(cell(FIRST)).toHaveTextContent("4");
      expect(pressed(7)).toBe("true");
    });
  });

  describe("with the setting off", () => {
    beforeEach(() => {
      setLockDigit(false);
    });

    it("the keys carry no aria-pressed", () => {
      render(<SudokuScreen daily={DAILY} />);

      for (const digit of [1, 5, 9]) {
        expect(key(digit)).not.toHaveAttribute("aria-pressed");
      }
    });

    it("a quick double tap writes and clears, as today", () => {
      render(<SudokuScreen daily={DAILY} />);
      select(FIRST);

      tap(7);
      expect(cell(FIRST)).toHaveTextContent("7");
      wait(50);
      tap(7);

      expect(cell(FIRST)).toHaveTextContent("");
      expect(key(7)).not.toHaveAttribute("aria-pressed");
    });

    it("a pointer tap on a cell selects it and writes nothing", () => {
      render(<SudokuScreen daily={DAILY} />);
      select(FIRST);
      type(5);

      pointer(cell(SECOND));

      expect(cell(SECOND)).toHaveAttribute("tabindex", "0");
      expect(cell(FIRST)).toHaveAttribute("tabindex", "-1");
      expect(cell(SECOND)).toHaveTextContent("");
      expect(cell(FIRST)).toHaveTextContent("5");
    });
  });

  it("turning the setting off while locked releases the digit", () => {
    render(<SudokuScreen daily={DAILY} />);
    tap(7);
    wait(50);
    tap(7);
    expect(pressed(7)).toBe("true");

    act(() => {
      setLockDigit(false);
    });
    pointer(cell(SECOND));
    act(() => {
      setLockDigit(true);
    });

    expect(cell(SECOND)).toHaveTextContent("");
    expect(pressed(7)).toBe("false");
  });

  it("never writes the lock into the saved play record", () => {
    render(<SudokuScreen daily={DAILY} />);
    tap(7);
    wait(50);
    tap(7);

    pointer(cell(FIRST));

    const saved = window.localStorage.getItem(
      playRecordKey("sudoku", DAILY.date),
    );
    expect(saved).toContain('"entries"');
    expect(saved).not.toContain("lock");
  });

  it("is on the free-play board too", async () => {
    render(<SudokuFreeScreen deps={FREE_DEPS} />);
    await flushGeneration();
    select(FIRST);

    tap(7);
    wait(100);
    tap(7);

    expect(cell(FIRST)).toHaveTextContent("");
    expect(pressed(7)).toBe("true");

    pointer(cell(SECOND));
    expect(cell(SECOND)).toHaveTextContent("7");
  });
});

describe("a lock tap cannot un-solve the board (T-WEB-S592)", () => {
  function nearlySolved() {
    const hook = renderHook(() => useSudokuPlay(DAILY));
    act(() => {
      for (const index of EMPTIES.slice(1)) {
        hook.result.current.selectCell(index);
        hook.result.current.enterDigit(SOLUTION[index] ?? 1);
      }
    });
    return hook;
  }

  it("a double tap that completes the board leaves it solved and filled", () => {
    const { result } = nearlySolved();
    act(() => {
      result.current.selectCell(FIRST);
    });
    expect(result.current.state.status).toBe("playing");
    const digit = SOLUTION[FIRST] ?? 1;

    act(() => {
      result.current.lock.pressDigit(digit, true);
    });
    expect(result.current.state.status).toBe("solved");
    act(() => {
      vi.advanceTimersByTime(100);
      result.current.lock.pressDigit(digit, true);
    });

    expect(result.current.state.status).toBe("solved");
    expect(result.current.state.entries[FIRST]).toBe(digit);
  });

  it("a locked-digit cell tap that completes the board leaves it solved", () => {
    const { result } = nearlySolved();
    const digit = SOLUTION[FIRST] ?? 1;
    act(() => {
      result.current.lock.pressDigit(digit, true);
      vi.advanceTimersByTime(100);
      result.current.lock.pressDigit(digit, true);
    });
    expect(result.current.lock.locked).toBe(digit);

    act(() => {
      result.current.lock.tapCell(FIRST);
    });
    expect(result.current.state.status).toBe("solved");
    act(() => {
      result.current.lock.tapCell(FIRST);
    });

    expect(result.current.state.status).toBe("solved");
    expect(result.current.state.entries[FIRST]).toBe(digit);
  });
});

describe("a double tap on a board cell fixes the digit it shows (T-WEB-S606)", () => {
  function doubleTap(index: number): void {
    pointer(cell(index));
    wait(120);
    pointer(cell(index));
  }

  function lockFromKeypad(digit: number): void {
    tap(digit);
    wait(50);
    tap(digit);
    wait(1000);
  }

  function fillFirst(digit: number): void {
    select(FIRST);
    type(digit);
  }

  it("locks a given's digit, selects the cell and writes nothing", () => {
    render(<SudokuScreen daily={DAILY} />);
    const before = boardValues();

    doubleTap(GIVEN);

    expect(pressed(GIVEN_DIGIT)).toBe("true");
    expect(cell(GIVEN)).toHaveAttribute("tabindex", "0");
    expect(boardValues()).toEqual(before);
  });

  it("locks a player entry's digit and leaves the entry in place", () => {
    render(<SudokuScreen daily={DAILY} />);
    fillFirst(3);

    doubleTap(FIRST);

    expect(pressed(3)).toBe("true");
    expect(cell(FIRST)).toHaveTextContent("3");
  });

  it("then fills empty cells with that digit", () => {
    render(<SudokuScreen daily={DAILY} />);
    doubleTap(GIVEN);
    wait(1000);

    pointer(cell(SECOND));

    expect(cell(SECOND)).toHaveTextContent(String(GIVEN_DIGIT));
  });

  describe("while another digit is locked", () => {
    it("switches the lock to a given's digit", () => {
      render(<SudokuScreen daily={DAILY} />);
      lockFromKeypad(OTHER);
      const before = boardValues();

      doubleTap(GIVEN);

      expect(pressed(GIVEN_DIGIT)).toBe("true");
      expect(pressed(OTHER)).toBe("false");
      expect(boardValues()).toEqual(before);
    });

    it("switches the lock to an entry's digit and gives the entry back", () => {
      render(<SudokuScreen daily={DAILY} />);
      fillFirst(3);
      lockFromKeypad(8);
      const before = boardValues();

      doubleTap(FIRST);

      expect(pressed(3)).toBe("true");
      expect(pressed(8)).toBe("false");
      expect(boardValues()).toEqual(before);
    });
  });

  describe("on a cell showing the locked digit", () => {
    it("an entry releases the lock and keeps the entry", () => {
      render(<SudokuScreen daily={DAILY} />);
      fillFirst(3);
      lockFromKeypad(3);
      const before = boardValues();

      doubleTap(FIRST);

      expect(pressed(3)).toBe("false");
      expect(boardValues()).toEqual(before);
    });

    it("a given releases the lock", () => {
      render(<SudokuScreen daily={DAILY} />);
      lockFromKeypad(GIVEN_DIGIT);
      const before = boardValues();

      doubleTap(GIVEN);

      expect(pressed(GIVEN_DIGIT)).toBe("false");
      expect(boardValues()).toEqual(before);
    });
  });

  it.each([
    ["no lock", null, "true"],
    ["the same digit locked", 3, "false"],
    ["another digit locked", 8, "true"],
  ] as const)(
    "a triple tap on an entry with %s ends as the double tap did and changes no entry",
    (_name, lockedDigit, threeLocked) => {
      render(<SudokuScreen daily={DAILY} />);
      fillFirst(3);
      if (lockedDigit !== null) {
        lockFromKeypad(lockedDigit);
      }
      const before = boardValues();

      doubleTap(FIRST);
      wait(120);
      pointer(cell(FIRST));

      expect(pressed(3)).toBe(threeLocked);
      expect(boardValues()).toEqual(before);
    },
  );

  it("treats taps 301 ms apart as two single taps", () => {
    render(<SudokuScreen daily={DAILY} />);

    pointer(cell(GIVEN));
    wait(301);
    pointer(cell(GIVEN));

    expect(pressed(GIVEN_DIGIT)).toBe("false");
  });

  it("does not pair taps on two different cells", () => {
    render(<SudokuScreen daily={DAILY} />);
    fillFirst(GIVEN_DIGIT);

    pointer(cell(GIVEN));
    wait(50);
    pointer(cell(FIRST));

    expect(pressed(GIVEN_DIGIT)).toBe("false");
  });

  it("a keypad tap between the two cell taps breaks the pair", () => {
    render(<SudokuScreen daily={DAILY} />);

    pointer(cell(GIVEN));
    tap(OTHER);
    pointer(cell(GIVEN));

    expect(pressed(GIVEN_DIGIT)).toBe("false");
  });

  it("a double tap on an empty cell never locks", () => {
    render(<SudokuScreen daily={DAILY} />);

    doubleTap(FIRST);

    expect(cell(FIRST)).toHaveTextContent("");
    for (const digit of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
      expect(pressed(digit)).toBe("false");
    }
  });

  it("a quick triple tap on an empty cell keeps the lock and toggles as before", () => {
    render(<SudokuScreen daily={DAILY} />);
    lockFromKeypad(7);

    doubleTap(FIRST);
    wait(120);
    pointer(cell(FIRST));

    expect(pressed(7)).toBe("true");
    expect(cell(FIRST)).toHaveTextContent("7");
  });

  it("a keyboard activation of a cell never locks", () => {
    render(<SudokuScreen daily={DAILY} />);

    fireEvent.click(cell(GIVEN));
    fireEvent.click(cell(GIVEN));

    expect(pressed(GIVEN_DIGIT)).toBe("false");
  });

  it("does nothing with the setting off", () => {
    setLockDigit(false);
    render(<SudokuScreen daily={DAILY} />);
    fillFirst(3);
    const before = boardValues();

    doubleTap(FIRST);
    doubleTap(GIVEN);

    expect(key(3)).not.toHaveAttribute("aria-pressed");
    expect(key(GIVEN_DIGIT)).not.toHaveAttribute("aria-pressed");
    expect(boardValues()).toEqual(before);
  });

  it("is on the free-play board too", async () => {
    render(<SudokuFreeScreen deps={FREE_DEPS} />);
    await flushGeneration();

    doubleTap(GIVEN);

    expect(pressed(GIVEN_DIGIT)).toBe("true");
  });
});

describe("a placed-out digit still locks and still writes (T-WEB-S654)", () => {
  const DIGIT = ([1, 2, 3, 4, 5, 6, 7, 8, 9] as const).reduce((best, digit) =>
    PUZZLE.givens.filter((given) => given === digit).length >
    PUZZLE.givens.filter((given) => given === best).length
      ? digit
      : best,
  );
  const MISSING = EMPTIES.filter((index) => SOLUTION[index] === DIGIT);
  const ELSEWHERE = EMPTIES.find((index) => SOLUTION[index] !== DIGIT) ?? 0;

  it("locks the faded key and writes a tenth copy with it", () => {
    render(<SudokuScreen daily={DAILY} />);
    for (const index of MISSING) {
      select(index);
      type(DIGIT);
    }
    select(GIVEN);
    const complete = () =>
      screen.getByLabelText(keypad.digitCompleteAria(DIGIT));

    pointer(complete());
    wait(50);
    pointer(complete());
    wait(1000);
    expect(complete()).toHaveAttribute("aria-pressed", "true");

    pointer(cell(ELSEWHERE));

    expect(cell(ELSEWHERE)).toHaveTextContent(String(DIGIT));
    expect(
      screen.getByLabelText(keypad.digitOverAria(DIGIT, 10)),
    ).toHaveAttribute("aria-pressed", "true");
  });
});

describe("one tap on a filled cell switches the locked digit (T-WEB-S952)", () => {
  function lockFromKeypad(digit: number): void {
    tap(digit);
    wait(50);
    tap(digit);
    wait(1000);
  }

  it("on an entry, locks its digit and keeps the entry", () => {
    render(<SudokuScreen daily={DAILY} />);
    select(FIRST);
    type(3);
    lockFromKeypad(8);
    const before = boardValues();

    pointer(cell(FIRST));

    expect(pressed(3)).toBe("true");
    expect(pressed(8)).toBe("false");
    expect(boardValues()).toEqual(before);
  });

  it("a quick second tap keeps the new digit locked, and an empty cell then takes it", () => {
    render(<SudokuScreen daily={DAILY} />);
    lockFromKeypad(OTHER);

    pointer(cell(GIVEN));
    wait(120);
    pointer(cell(GIVEN));
    expect(pressed(GIVEN_DIGIT)).toBe("true");

    wait(1000);
    pointer(cell(SECOND));
    expect(cell(SECOND)).toHaveTextContent(String(GIVEN_DIGIT));
  });

  it("is on the free-play board too", async () => {
    render(<SudokuFreeScreen deps={FREE_DEPS} />);
    await flushGeneration();
    const given = document.querySelector<HTMLElement>(
      '[data-cell-index][aria-disabled="true"]',
    );
    if (given === null) {
      throw new Error("no given on the free board");
    }
    const shown = Number(given.textContent);
    lockFromKeypad((shown % 9) + 1);

    pointer(given);

    expect(pressed(shown)).toBe("true");
  });
});
