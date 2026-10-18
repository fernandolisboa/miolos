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
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { messages } from "../src/i18n";
import marks from "../src/play/mistake-marks.module.css";
import { NO_MISTAKES, type MistakeState } from "../src/play/mistakes";
import {
  playRecordKey,
  playRecordSchema,
  type PlayRecord,
} from "../src/play/play-record";
import {
  PlayScreenChrome,
  type PlayChromeReadouts,
} from "../src/play/screen-chrome";
import chrome from "../src/play/screen.module.css";
import { NO_HISTORY, useBoardEdits, type Editable } from "../src/play/undo";
import { useWrongCells } from "../src/play/use-wrong-cells";
import { GameSettings } from "../src/settings/game-settings";
import { readSettings, writeSettings } from "../src/settings/settings";
import { solutionDigits } from "../src/sudoku/engine";
import type { SudokuDigit } from "../src/sudoku/state";
import { useSudokuPlay } from "../src/sudoku/use-sudoku-play";

const sync = vi.hoisted(() => ({
  startCompletionSync: vi.fn(() => () => undefined),
  flushPendingCompletions: vi.fn((record?: unknown) => Promise.resolve(record)),
}));
vi.mock("../src/play/sync", () => sync);

const DATE = "2026-10-16";
const copy = messages.play.mistakes;
const flags = messages.settings.games.flags;

function setLimit(on: boolean, showErrors = false): void {
  const current = readSettings();
  act(() => {
    writeSettings({
      ...current,
      mistakeLimit: on,
      games: {
        ...current.games,
        nonogram: { ...current.games.nonogram, showErrors },
      },
    });
  });
}

beforeEach(() => {
  window.localStorage.clear();
  vi.clearAllMocks();
});

describe("Limite de 3 erros is a device setting, off by default, switchable where it applies (T-WEB-S845)", () => {
  it("defaults off and falls back to off on a bad value", () => {
    expect(readSettings().mistakeLimit).toBe(false);
    window.localStorage.setItem(
      "miolos-settings",
      JSON.stringify({ mistakeLimit: "sim" }),
    );
    expect(readSettings().mistakeLimit).toBe(false);
  });

  it("switches on and off in the general group, and is absent where no game can count", () => {
    const { unmount } = render(<GameSettings games={["sudoku"]} clock />);
    const toggle = screen.getByRole("switch", {
      name: flags.mistakeLimit.label,
    });
    expect(toggle).toHaveAttribute("aria-checked", "false");
    fireEvent.click(toggle);
    expect(readSettings().mistakeLimit).toBe(true);
    fireEvent.click(toggle);
    expect(readSettings().mistakeLimit).toBe(false);
    unmount();

    render(<GameSettings games={["minesweeper"]} clock />);
    expect(
      screen.queryByRole("switch", { name: flags.mistakeLimit.label }),
    ).toBeNull();
  });
});

function chromeWith(mistakesLeft: number | null) {
  const readouts: PlayChromeReadouts = {
    progressShort: "1/2",
    progressLong: "1 de 2",
    onReset: vi.fn(),
    onUndo: vi.fn(),
    mistakesLeft,
    hint: {
      ready: true,
      used: 0,
      explain: null,
      cell: null,
      onReveal: vi.fn(),
    },
  };
  return render(
    <PlayScreenChrome
      game="sudoku"
      pageModifier=""
      state={{ kind: "playing", readouts }}
      back={{ href: "/", label: "Hoje", ariaLabel: "Voltar" }}
      topDate="16 de outubro"
      note={null}
      clock="none"
      extraStat={null}
    >
      <div />
    </PlayScreenChrome>,
  );
}

describe("the chrome draws the marks left and the frozen board (T-WEB-S846)", () => {
  it("draws three marks with the ones spent cut, in the stats card and the phone title", () => {
    chromeWith(2);
    const drawn = screen.getAllByRole("img", { name: copy.aria(2) });
    expect(drawn).toHaveLength(2);
    expect(drawn.map((node) => node.className)).toEqual([
      expect.stringContaining(chrome.mistakesBar ?? "?"),
      expect.stringContaining(chrome.mistakesCard ?? "?"),
    ]);
    for (const node of drawn) {
      expect([...node.children].map((mark) => mark.className)).toEqual([
        marks.left,
        marks.left,
        marks.spent,
      ]);
    }
    expect(screen.getByText(copy.label)).toBeInTheDocument();
    expect(screen.queryByRole("status")).toBeNull();
    expect(document.querySelector("main")).not.toHaveAttribute("data-frozen");
  });

  it("puts the frozen line where the hint was and marks the page frozen", () => {
    chromeWith(0);
    const status = screen.getByRole("status", { name: copy.frozen });
    expect(status).toHaveAttribute("data-short", copy.frozenShort);
    expect(
      screen.queryByRole("button", { name: messages.play.hint.available(3) }),
    ).toBeNull();
    expect(document.querySelector("main")).toHaveAttribute("data-frozen");
    expect(
      screen.getByRole("button", { name: messages.play.reset.label }),
    ).toBeInTheDocument();
  });

  it("draws nothing with the limit off", () => {
    chromeWith(null);
    expect(screen.queryByRole("img", { name: /erros/ })).toBeNull();
    expect(screen.queryByText(copy.label)).toBeNull();
  });
});

function board(overrides: Partial<Editable> = {}): Editable {
  return {
    date: DATE,
    timer: { accumulatedMs: 0, runningSince: null },
    status: "playing",
    pendingSync: false,
    now: 0,
    hydrated: true,
    entries: [null, null, null, null],
    hint: { used: 0, lastIndex: null, reason: null, spotlight: [] },
    history: NO_HISTORY,
    mistakes: NO_MISTAKES,
    ...overrides,
  };
}

const counted = (cells: number[]): MistakeState => ({
  ...NO_MISTAKES,
  cells,
});

describe("useBoardEdits offers Recomeçar for a count alone and no undo while frozen (T-WEB-S846a)", () => {
  it("with the limit on", () => {
    setLimit(true);
    const empty = renderHook(() =>
      useBoardEdits(board({ mistakes: counted([1]) }), vi.fn()),
    );
    expect(empty.result.current.onReset).not.toBeNull();
    expect(empty.result.current.mistakesLeft).toBe(2);

    const frozen = renderHook(() =>
      useBoardEdits(
        board({
          entries: [1, 2, 3, null],
          history: { ...NO_HISTORY, steps: [{ entries: [] }], open: false },
          mistakes: counted([0, 1, 2]),
        }),
        vi.fn(),
      ),
    );
    expect(frozen.result.current.onUndo).toBeNull();
    expect(frozen.result.current.onReset).not.toBeNull();
    expect(frozen.result.current.mistakesLeft).toBe(0);
  });

  it("with the limit off", () => {
    setLimit(false);
    const { result } = renderHook(() =>
      useBoardEdits(
        board({
          history: { ...NO_HISTORY, steps: [{ entries: [] }], open: false },
          mistakes: counted([0, 1, 2]),
        }),
        vi.fn(),
      ),
    );
    expect(result.current.onReset).toBeNull();
    expect(result.current.onUndo).toBeTypeOf("function");
    expect(result.current.mistakesLeft).toBeNull();
  });
});

describe("with only the limit on, a wrong mark sits on counted cells still wrong, never the held one (T-WEB-S847)", () => {
  const solution = [1, 1, 1, 1, 0];
  const wrongs = [0, 0, 0, 1, 1];

  function wrongWith(mistakes: MistakeState, entries = wrongs) {
    return renderHook(() =>
      useWrongCells("nonogram", solution, null, entries, mistakes),
    ).result.current;
  }

  it("marks only the counted cell of a drag that made many wrong", () => {
    setLimit(true);
    expect([...wrongWith(counted([0]))]).toEqual([0]);
  });

  it("drops the mark once the counted cell is fixed, and on a held cell", () => {
    setLimit(true);
    expect([...wrongWith(counted([0]), [1, 0, 0, 1, 1])]).toEqual([]);
    expect([
      ...wrongWith({
        cells: [0, 4],
        held: { index: 4, before: null },
        stroke: false,
      }),
    ]).toEqual([0]);
  });

  it("marks every wrong cell with Mostrar erros on, and none with both off", () => {
    setLimit(true, true);
    expect([...wrongWith(counted([0]))]).toEqual([0, 1, 2, 4]);
    setLimit(false);
    expect([...wrongWith(counted([0]))]).toEqual([]);
  });
});

describe("a daily played under the limit (T-WEB-S848a)", () => {
  const PUZZLE = generateDailySudoku({ seed: 20_261_016, weekday: 1 });
  const DAILY: DailySudokuResponse = dailySudokuResponseSchema.parse({
    game: "sudoku",
    date: DATE,
    givens: PUZZLE.givens,
    tier: PUZZLE.tier,
  });
  const SOLUTION = solutionDigits(PUZZLE.givens) ?? [];
  const OPEN = PUZZLE.givens.flatMap((given, index) =>
    given === 0 ? [index] : [],
  );
  const right = (index: number) => SOLUTION[index] as SudokuDigit;
  const wrong = (index: number) => ((right(index) % 9) + 1) as SudokuDigit;

  function stored(): PlayRecord {
    const raw = window.localStorage.getItem(playRecordKey("sudoku", DATE));
    return playRecordSchema.parse(JSON.parse(raw ?? "null"));
  }

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function started() {
    const hook = renderHook(() => useSudokuPlay(DAILY));
    act(() => {
      vi.advanceTimersByTime(0);
    });
    return hook;
  }

  function enter(
    play: ReturnType<typeof useSudokuPlay>,
    index: number,
    digit: SudokuDigit,
  ) {
    act(() => {
      play.selectCell(index);
    });
    act(() => {
      play.enterDigit(digit);
    });
  }

  it("keeps the record free of mistakes with the limit off", () => {
    const { result } = started();
    enter(result.current, OPEN[0] ?? 0, wrong(OPEN[0] ?? 0));
    expect("mistakes" in stored()).toBe(false);
  });

  it("freezes on the third, restarts, solves and posts today's completion with no mistakes in it", () => {
    setLimit(true);
    const { result } = started();
    const [a = 0, b = 0, c = 0] = OPEN;
    enter(result.current, a, wrong(a));
    expect(stored()).toMatchObject({ mistakes: [a] });
    enter(result.current, b, wrong(b));
    enter(result.current, c, wrong(c));
    expect(result.current.edits.mistakesLeft).toBe(0);
    expect(result.current.edits.onUndo).toBeNull();
    expect(result.current.hintReady).toBe(true);

    act(() => {
      result.current.edits.onReset?.();
    });
    expect(result.current.edits.mistakesLeft).toBe(3);
    expect("mistakes" in stored()).toBe(false);

    for (const index of OPEN) {
      enter(result.current, index, right(index));
    }
    expect(result.current.state.status).toBe("solved");
    act(() => {
      vi.advanceTimersByTime(0);
    });
    const completion = stored();
    expect(completion).toMatchObject({ concluded: true, pendingSync: true });
    expect("mistakes" in completion).toBe(false);
    expect(sync.flushPendingCompletions).toHaveBeenCalledTimes(1);
    const [posted] = sync.flushPendingCompletions.mock.calls[0] ?? [];
    expect(posted).toMatchObject({ concluded: true, mistakes: undefined });
  });
});

describe("the frozen page fades the board but not the live region (T-WEB-S846)", () => {
  it("is anchored on the page's data-frozen", () => {
    chromeWith(0);
    const main = document.querySelector("main");
    expect(main).not.toBeNull();
    expect(
      within(main as HTMLElement).getByRole("status", { name: copy.frozen }),
    ).toHaveClass(chrome.hint ?? "?", chrome.frozen ?? "?");
  });
});
