import {
  dailySudokuResponseSchema,
  type DailySudokuResponse,
} from "@miolos/core";
import { generateDailySudoku, sudokuPeers } from "@miolos/games/sudoku";
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GamesSection } from "../app/ajustes/games-section";
import { SudokuFreeScreen } from "../src/free-play/sudoku-free-screen";
import { messages } from "../src/i18n";
import { playRecordKey, playRecordSchema } from "../src/play/play-record";
import { readSettings, writeSettings } from "../src/settings/settings";
import { solutionDigits } from "../src/sudoku/engine";
import styles from "../src/sudoku/sudoku-board.module.css";
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

const DATE = "2026-10-15";
const PUZZLE = generateDailySudoku({ seed: 42, weekday: 1 });
const DAILY: DailySudokuResponse = dailySudokuResponseSchema.parse({
  game: "sudoku",
  date: DATE,
  givens: PUZZLE.givens,
  tier: PUZZLE.tier,
});
const SOLUTION = solutionDigits(PUZZLE.givens) ?? [];
const EMPTIES = PUZZLE.givens.flatMap((given, index) =>
  given === 0 ? [index] : [],
);
const FIRST = EMPTIES[0] ?? 0;
const GIVEN = PUZZLE.givens.findIndex((given) => given !== 0);
const play = messages.games.sudoku.play;
const keypad = play.keypad;
const settingsCopy = messages.settings.games;

function cell(index: number): HTMLElement {
  const found = document.querySelector<HTMLElement>(
    `[data-cell-index="${String(index)}"]`,
  );
  if (found === null) {
    throw new Error(`no cell at ${String(index)}`);
  }
  return found;
}

const board = () => screen.getByRole("group", { name: play.boardAria });
const pencil = () => screen.getByRole("button", { name: keypad.notingAria });
const select = (index: number) => fireEvent.focus(cell(index));
const press = (key: string, init: KeyboardEventInit = {}) =>
  fireEvent.keyDown(board(), { key, ...init });
const tap = (name: string) =>
  fireEvent.click(screen.getByLabelText(name), { detail: 1 });

function notesIn(index: number): HTMLElement | null {
  return cell(index).querySelector<HTMLElement>(`.${styles.notes ?? ""}`);
}

function setSudoku(
  patch: Partial<ReturnType<typeof readSettings>["games"]["sudoku"]>,
) {
  const current = readSettings();
  writeSettings({
    ...current,
    games: { ...current.games, sudoku: { ...current.games.sudoku, ...patch } },
  });
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("a note change is saved with the day and comes back on reload (T-WEB-S836)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  function stored() {
    const raw = window.localStorage.getItem(playRecordKey("sudoku", DATE));
    if (raw === null) {
      throw new Error("no record was written");
    }
    return playRecordSchema.parse(JSON.parse(raw));
  }

  it("writes the masks and restores them in a new mount", () => {
    const first = renderHook(() => useSudokuPlay(DAILY));
    act(() => {
      vi.advanceTimersByTime(0);
    });
    act(() => {
      first.result.current.selectCell(FIRST);
    });
    act(() => {
      first.result.current.toggleNote(2);
      first.result.current.toggleNote(9);
    });

    const record = stored();
    expect("notes" in record && record.notes?.[FIRST]).toBe(0b1_0000_0010);
    first.unmount();

    const second = renderHook(() => useSudokuPlay(DAILY));
    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(second.result.current.state.notes[FIRST]).toBe(0b1_0000_0010);
  });

  it("leaves notes out of an untouched board and of a closed one", () => {
    const { result } = renderHook(() => useSudokuPlay(DAILY));
    act(() => {
      vi.advanceTimersByTime(0);
    });
    act(() => {
      result.current.selectCell(FIRST);
    });
    act(() => {
      result.current.toggleNote(2);
    });
    act(() => {
      result.current.toggleNote(2);
    });
    expect("notes" in stored()).toBe(false);

    for (const index of EMPTIES) {
      act(() => {
        result.current.selectCell(index);
      });
      act(() => {
        result.current.toggleNote(1);
      });
      act(() => {
        result.current.toggleNote(1);
      });
      act(() => {
        result.current.enterDigit(SOLUTION[index] ?? 1);
      });
    }
    const closed = stored();
    expect(closed.concluded).toBe(true);
    expect("notes" in closed).toBe(false);
  });

  it("writes no play record at all in free play", async () => {
    vi.useRealTimers();
    vi.stubGlobal("fetch", vi.fn());
    const { container } = render(
      <SudokuFreeScreen deps={{ pickSeed: () => 42 }} />,
    );
    await flushGeneration();
    const open = container.querySelector<HTMLElement>("[data-cell-index]");
    fireEvent.focus(open ?? container);
    tap(keypad.notingAria);
    press("5");

    expect(container.querySelector(`.${styles.notes ?? ""}`)).not.toBeNull();
    expect(
      Object.keys(window.localStorage).filter((key) =>
        key.startsWith("miolos:play:"),
      ),
    ).toEqual([]);
  });
});

describe("notes sit in fixed slots and are named for a screen reader (T-WEB-S837)", () => {
  it("draws each note in the slot of its digit, hidden from the tree", () => {
    render(<SudokuScreen daily={DAILY} />);
    select(FIRST);
    press("n");
    press("2");
    press("9");

    const notes = notesIn(FIRST);
    expect(notes).toHaveAttribute("aria-hidden", "true");
    expect(
      [...(notes?.children ?? [])].map((slot) => slot.textContent),
    ).toEqual(["", "2", "", "", "", "", "", "", "9"]);
    expect(notesIn(EMPTIES[1] ?? 0)).toBeNull();
  });

  it("shows only the value once the cell is filled, and none on a given", () => {
    render(<SudokuScreen daily={DAILY} />);
    select(FIRST);
    press("n");
    press("2");
    press("n");
    press("7");

    expect(notesIn(FIRST)).toBeNull();
    expect(cell(FIRST).textContent).toBe("7");
  });

  it("adds the notes to the cell's name", () => {
    render(<SudokuScreen daily={DAILY} />);
    const bare = cell(FIRST).getAttribute("aria-label") ?? "";
    select(FIRST);
    press("2", { key: "@", code: "Digit2", shiftKey: true });
    press("5", { key: "%", code: "Digit5", shiftKey: true });

    expect(cell(FIRST)).toHaveAttribute(
      "aria-label",
      play.cellNotesAria(bare, [2, 5]),
    );
    expect(cell(FIRST).getAttribute("aria-label")).toContain("rascunho 2, 5");
  });
});

describe("Rascunho on the keypad and the keyboard (T-WEB-S838)", () => {
  it("toggles with the pencil key, which reports it with aria-pressed", () => {
    render(<SudokuScreen daily={DAILY} />);
    expect(pencil()).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(pencil());
    expect(pencil()).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(pencil());
    expect(pencil()).toHaveAttribute("aria-pressed", "false");
  });

  it("toggles with N and n, and leaves Ctrl+N to the browser", () => {
    render(<SudokuScreen daily={DAILY} />);
    press("N");
    expect(pencil()).toHaveAttribute("aria-pressed", "true");
    press("n");
    expect(pencil()).toHaveAttribute("aria-pressed", "false");
    press("n", { ctrlKey: true });
    expect(pencil()).toHaveAttribute("aria-pressed", "false");
  });

  it("writes a note on Shift+digit, read from the key's code", () => {
    render(<SudokuScreen daily={DAILY} />);
    select(FIRST);
    press("@", { code: "Digit2", shiftKey: true });

    expect(notesIn(FIRST)?.children[1]?.textContent).toBe("2");
    expect(cell(FIRST).textContent).toBe("2");
    expect(pencil()).toHaveAttribute("aria-pressed", "false");
  });

  it("writes a value when Shift is how the layout types a digit (AZERTY)", () => {
    render(<SudokuScreen daily={DAILY} />);
    select(FIRST);
    press("4", { code: "Digit4", shiftKey: true });

    expect(notesIn(FIRST)).toBeNull();
    expect(cell(FIRST).textContent).toBe("4");
  });

  it("turns the digit keys and the digit buttons into notes while it is on", () => {
    render(<SudokuScreen daily={DAILY} />);
    select(FIRST);
    fireEvent.click(pencil());

    expect(screen.getByLabelText(keypad.noteDigitAria(5))).toBeInTheDocument();
    tap(keypad.noteDigitAria(5));
    press("6");

    const slots = [...(notesIn(FIRST)?.children ?? [])].map(
      (slot) => slot.textContent,
    );
    expect(slots[4]).toBe("5");
    expect(slots[5]).toBe("6");
    expect(slots.filter((slot) => slot !== "")).toHaveLength(2);

    fireEvent.click(pencil());
    press("5");
    expect(notesIn(FIRST)).toBeNull();
    expect(cell(FIRST).textContent).toBe("5");
  });

  it("erases a notes-only cell's notes with the eraser key", () => {
    render(<SudokuScreen daily={DAILY} />);
    select(FIRST);
    press("#", { code: "Digit3", shiftKey: true });
    press("Backspace");
    expect(notesIn(FIRST)).toBeNull();
  });

  it("does nothing to a given and ignores Shift on a bare number it does not know", () => {
    render(<SudokuScreen daily={DAILY} />);
    select(GIVEN);
    press("!", { code: "Digit1", shiftKey: true });
    press(")", { code: "Digit0", shiftKey: true });
    expect(cell(GIVEN).getAttribute("aria-label")).not.toContain("rascunho");
  });
});

describe("notes and Número fixo, Mostrar erros and the tally stay apart (T-WEB-S833a)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["performance"] });
    setSudoku({ lockDigit: true });
  });

  it("releases a fixed number when Rascunho turns on, and fixes none while on", () => {
    render(<SudokuScreen daily={DAILY} />);
    tap(keypad.digitAria(4));
    tap(keypad.digitAria(4));
    expect(screen.getByLabelText(keypad.digitAria(4))).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    fireEvent.click(pencil());
    const noted = screen.getByLabelText(keypad.noteDigitAria(4));
    expect(noted).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(noted, { detail: 1 });
    fireEvent.click(noted, { detail: 1 });
    expect(noted).toHaveAttribute("aria-pressed", "false");
  });

  it("brings the peer notes back when a double tap fixes the digit", () => {
    render(<SudokuScreen daily={DAILY} />);
    const peer = sudokuPeers(FIRST).find((index) => PUZZLE.givens[index] === 0);
    if (peer === undefined) {
      throw new Error("the first empty cell has an empty peer");
    }
    const digit = 8;
    select(peer);
    press("n");
    press(String(digit));
    press("n");
    const before = cell(peer).getAttribute("aria-label");

    select(FIRST);
    tap(keypad.digitAria(digit));
    expect(cell(peer).getAttribute("aria-label")).not.toBe(before);
    tap(keypad.digitAria(digit));

    expect(cell(FIRST).textContent).toBe("");
    expect(cell(peer).getAttribute("aria-label")).toBe(before);
  });

  it("is not seen by the same-digit highlight, Mostrar erros or the tally", () => {
    setSudoku({ showErrors: true });
    render(<SudokuScreen daily={DAILY} />);
    const wrong = SOLUTION[FIRST] === 1 ? 2 : 1;

    select(FIRST);
    press("n");
    press(String(wrong));
    press("n");

    expect(cell(FIRST).getAttribute("aria-label")).not.toContain(
      messages.play.wrongCell(""),
    );

    const shown = PUZZLE.givens[GIVEN] ?? 0;
    select(FIRST);
    press("n");
    press(String(shown));
    press("n");
    select(GIVEN);
    const sameDigit = styles.cellSameDigit ?? "";
    expect(sameDigit).not.toBe("");
    expect(cell(GIVEN).className).toContain(sameDigit);
    expect(cell(FIRST).className).not.toContain(sameDigit);
  });

  it("leaves a digit's tally at eight when its ninth copy is only a note", () => {
    render(<SudokuScreen daily={DAILY} />);
    const digit = SOLUTION[FIRST] ?? 1;
    for (const index of EMPTIES) {
      if (index !== FIRST && SOLUTION[index] === digit) {
        select(index);
        press(String(digit));
      }
    }
    expect(screen.getByLabelText(keypad.digitAria(digit))).toBeInTheDocument();

    select(FIRST);
    press("!", { code: `Digit${String(digit)}`, shiftKey: true });

    expect(notesIn(FIRST)).not.toBeNull();
    expect(screen.getByLabelText(keypad.digitAria(digit))).toBeInTheDocument();
    expect(screen.queryByLabelText(keypad.digitCompleteAria(digit))).toBeNull();
  });
});

describe("Recomeçar is offered on a board that holds only notes (T-WEB-S832a)", () => {
  const reset = () =>
    screen.getByRole("button", { name: messages.play.reset.label });

  it("on the daily screen, and clears them", () => {
    render(<SudokuScreen daily={DAILY} />);
    expect(reset()).toHaveAttribute("aria-disabled", "true");
    select(FIRST);
    press("#", { code: "Digit3", shiftKey: true });
    expect(reset()).toHaveAttribute("aria-disabled", "false");

    fireEvent.click(reset());
    fireEvent.click(reset());
    expect(notesIn(FIRST)).toBeNull();
  });

  it("in free play", async () => {
    vi.stubGlobal("fetch", vi.fn());
    render(<SudokuFreeScreen deps={{ pickSeed: () => 42 }} />);
    await flushGeneration();
    expect(reset()).toHaveAttribute("aria-disabled", "true");
    select(FIRST);
    press("#", { code: "Digit3", shiftKey: true });

    expect(reset()).toHaveAttribute("aria-disabled", "false");
  });
});

describe("Limpar rascunho ao preencher is a setting that starts on (T-WEB-S839)", () => {
  it("defaults to on and falls back to on for a stored value that is not a boolean", () => {
    expect(readSettings().games.sudoku.cleanNotes).toBe(true);

    window.localStorage.setItem(
      "miolos-settings",
      JSON.stringify({ games: { sudoku: { cleanNotes: "no" } } }),
    );
    expect(readSettings().games.sudoku.cleanNotes).toBe(true);
  });

  it("takes the digit out of the peers' notes when on, and keeps them when off", () => {
    const peer = sudokuPeers(FIRST).find((index) => PUZZLE.givens[index] === 0);
    if (peer === undefined) {
      throw new Error("the first empty cell has an empty peer");
    }
    const run = () => {
      const view = render(<SudokuScreen daily={DAILY} />);
      select(peer);
      press("^", { code: "Digit6", shiftKey: true });
      select(FIRST);
      press("6");
      const kept = notesIn(peer) !== null;
      view.unmount();
      window.localStorage.clear();
      return kept;
    };

    expect(run()).toBe(false);
    setSudoku({ cleanNotes: false });
    expect(run()).toBe(true);
  });

  it("shows its switch in Ajustes and in the Sudoku dialog", async () => {
    HTMLDialogElement.prototype.showModal = function showModal() {
      this.setAttribute("open", "");
    };
    const { unmount } = render(<GamesSection />);
    const group = screen.getByRole("group", { name: "Sudoku" });
    const toggle = within(group).getByRole("switch", {
      name: settingsCopy.flags.cleanNotes.label,
    });
    expect(toggle).toHaveAttribute("aria-checked", "true");
    fireEvent.click(toggle);
    expect(readSettings().games.sudoku.cleanNotes).toBe(false);
    unmount();

    render(<SudokuScreen daily={DAILY} />);
    fireEvent.click(
      screen.getByRole("button", { name: settingsCopy.dialog.trigger }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: settingsCopy.dialog.title,
    });
    expect(
      within(dialog).getByRole("switch", {
        name: settingsCopy.flags.cleanNotes.label,
      }),
    ).toHaveAttribute("aria-checked", "false");
  });
});
