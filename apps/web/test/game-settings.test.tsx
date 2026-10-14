import {
  dailySudokuResponseSchema,
  FREE_HINTS_PER_PUZZLE,
  type DailySudokuResponse,
} from "@miolos/core";
import { generateDailySudoku } from "@miolos/games/sudoku";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GamesSection } from "../app/ajustes/games-section";
import { ArchiveSudokuScreen } from "../src/archive/sudoku-screen";
import { SudokuFreeScreen } from "../src/free-play/sudoku-free-screen";
import { formatElapsed, messages } from "../src/i18n";
import { playRecordKey, type SudokuPlayRecord } from "../src/play/play-record";
import wrongMark from "../src/play/wrong-mark.module.css";
import { readSettings, writeSettings } from "../src/settings/settings";
import { solutionDigits } from "../src/sudoku/engine";
import { PlaySkeleton } from "../src/sudoku/play-view";
import styles from "../src/sudoku/sudoku-board.module.css";
import { SudokuScreen } from "../src/sudoku/sudoku-screen";

const sync = vi.hoisted(() => ({
  startCompletionSync: vi.fn(() => () => undefined),
  flushPendingCompletions: vi.fn((record?: unknown) => Promise.resolve(record)),
}));
vi.mock("../src/play/sync", () => sync);

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/",
}));

const DATE = "2026-08-01";
const PUZZLE = generateDailySudoku({ seed: 42, weekday: 1 });
const DAILY: DailySudokuResponse = dailySudokuResponseSchema.parse({
  game: "sudoku",
  date: DATE,
  givens: PUZZLE.givens,
  tier: PUZZLE.tier,
});
const FREE_DEPS = { pickSeed: () => 42 };

const copy = messages.settings.games;
const FIRST_EMPTY = PUZZLE.givens.indexOf(0);

function patch(next: {
  showClock?: boolean;
  sudoku?: Partial<ReturnType<typeof readSettings>["games"]["sudoku"]>;
}): void {
  const current = readSettings();
  act(() => {
    writeSettings({
      showClock: next.showClock ?? current.showClock,
      games: {
        ...current.games,
        sudoku: { ...current.games.sudoku, ...next.sudoku },
      },
    });
  });
}

function cellAt(index: number): HTMLElement {
  const cell = document.querySelector<HTMLElement>(
    `[data-cell-index="${String(index)}"]`,
  );
  if (cell === null) {
    throw new Error(`no cell at ${String(index)}`);
  }
  return cell;
}

function concludedRecord(): SudokuPlayRecord {
  const solution = solutionDigits(PUZZLE.givens) ?? [];
  return {
    v: 1,
    game: "sudoku",
    date: DATE,
    entries: PUZZLE.givens.map((given, index) =>
      given === 0 ? (solution[index] ?? null) : null,
    ),
    grid: [...solution],
    elapsedMs: 272_000,
    hintsUsed: 0,
    concluded: true,
    pendingSync: false,
    syncOutcome: "recorded",
  };
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("Mostrar cronômetro hides the clock and nothing else (T-WEB-S589)", () => {
  it("shows no timer and no Tempo row on the daily, the archive and the skeleton", () => {
    patch({ showClock: false });

    const daily = render(<SudokuScreen daily={DAILY} />);
    expect(screen.queryByRole("timer")).toBeNull();
    expect(screen.queryByText(messages.play.timerLabel)).toBeNull();
    daily.unmount();

    const archive = render(<ArchiveSudokuScreen daily={DAILY} />);
    expect(screen.queryByRole("timer")).toBeNull();
    expect(screen.queryByText(messages.play.timerLabel)).toBeNull();
    archive.unmount();

    render(<PlaySkeleton date={DATE} tier={DAILY.tier} />);
    expect(screen.queryByText(messages.play.timerLabel)).toBeNull();
  });

  it("shows the clock by default, including in the server markup", () => {
    expect(
      renderToStaticMarkup(<PlaySkeleton date={DATE} tier={DAILY.tier} />),
    ).toContain(messages.play.timerLabel);
    render(<SudokuScreen daily={DAILY} />);
    expect(screen.getAllByRole("timer").length).toBeGreaterThan(0);
  });

  it("keeps counting while hidden", () => {
    vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
    patch({ showClock: false });
    render(<SudokuScreen daily={DAILY} />);

    act(() => {
      vi.advanceTimersByTime(65_000);
    });
    patch({ showClock: true });
    expect(screen.getAllByRole("timer")[0]?.textContent).toMatch(/^01:0[4-6]$/);
  });

  it("shows the recorded time on a concluded day with the clock hidden", async () => {
    patch({ showClock: false });
    localStorage.setItem(
      playRecordKey("sudoku", DATE),
      JSON.stringify(concludedRecord()),
    );
    render(<SudokuScreen daily={DAILY} />);
    await act(async () => {
      await import("../src/play/conclusion-view");
    });

    const stamped = messages.conclusion.stampAria(
      messages.games.sudoku.conclusion.title,
      formatElapsed(272_000),
      0,
    );
    expect(screen.getByLabelText(stamped)).toBeInTheDocument();
  });
});

describe("Destacar linha, coluna e bloco paints the selection's reach only when on (T-WEB-S590)", () => {
  function reach(): number {
    return document.querySelectorAll(
      `.${styles.cellUnit}, .${styles.cellSameDigit}`,
    ).length;
  }

  it("paints the unit and the same digit by default, nothing when off", () => {
    render(<SudokuScreen daily={DAILY} />);
    act(() => {
      cellAt(FIRST_EMPTY).focus();
    });
    expect(reach()).toBeGreaterThan(0);

    patch({ sudoku: { highlightSelection: false } });
    expect(reach()).toBe(0);
  });

  it("still spotlights the cells a hint explains, with the highlight off", () => {
    patch({ sudoku: { highlightSelection: false } });
    render(<SudokuScreen daily={DAILY} />);
    expect(reach()).toBe(0);

    fireEvent.click(
      screen.getByRole("button", {
        name: messages.play.hint.available(FREE_HINTS_PER_PUZZLE),
      }),
    );
    expect(reach()).toBeGreaterThan(0);
  });
});

describe("Ajustes lists every setting, saves it on this device and updates open boards (T-WEB-S593)", () => {
  it("groups the switches: the clock under Em todos os jogos, then each game's own", () => {
    render(<GamesSection />);

    const general = screen.getByRole("group", { name: copy.general });
    expect(
      within(general)
        .getAllByRole("switch")
        .map((s) => s.textContent),
    ).toEqual([copy.on]);
    expect(
      within(general).getByRole("switch", { name: copy.flags.showClock.label }),
    ).toBeInTheDocument();

    const sudoku = screen.getByRole("group", { name: "Sudoku" });
    expect(
      within(sudoku)
        .getAllByRole("switch")
        .map((s) => s.getAttribute("aria-labelledby")),
    ).toHaveLength(3);
    for (const label of [
      copy.flags.showErrors.label,
      copy.flags.lockDigit.label,
      copy.flags.highlightSelection.label,
    ]) {
      expect(
        within(sudoku).getByRole("switch", { name: label }),
      ).toBeInTheDocument();
    }
    for (const name of ["Binairo", "Rainhas", "Cruzadinha"]) {
      const group = screen.getByRole("group", { name });
      expect(within(group).getAllByRole("switch")).toHaveLength(1);
      expect(
        within(group).getByRole("switch", {
          name: copy.flags.showErrors.label,
        }),
      ).toBeInTheDocument();
    }
    const nonogram = screen.getByRole("group", { name: "Nonogram" });
    expect(within(nonogram).getAllByRole("switch")).toHaveLength(2);
    expect(
      within(nonogram).getByRole("switch", {
        name: copy.flags.strikePlacedRuns.label,
      }),
    ).toBeInTheDocument();
  });

  it("describes each switch and can turn every one off and on again", () => {
    render(<GamesSection />);
    for (const toggle of screen.getAllByRole("switch")) {
      const before = toggle.getAttribute("aria-checked");
      expect(toggle).toHaveAccessibleDescription();
      fireEvent.click(toggle);
      expect(toggle.getAttribute("aria-checked")).not.toBe(before);
      fireEvent.click(toggle);
      expect(toggle.getAttribute("aria-checked")).toBe(before);
    }
  });

  it("persists a switch to this device and updates a mounted board at once", () => {
    render(
      <>
        <SudokuScreen daily={DAILY} />
        <GamesSection />
      </>,
    );
    const cell = cellAt(FIRST_EMPTY);
    act(() => {
      cell.focus();
    });
    const wrongDigit =
      ((solutionDigits(PUZZLE.givens)?.[FIRST_EMPTY] ?? 1) % 9) + 1;
    fireEvent.keyDown(cell, { key: String(wrongDigit) });
    expect(cell.querySelector(`.${wrongMark.mark}`)).toBeNull();

    const sudoku = screen.getByRole("group", { name: "Sudoku" });
    fireEvent.click(
      within(sudoku).getByRole("switch", { name: copy.flags.showErrors.label }),
    );

    expect(cell.querySelector(`.${wrongMark.mark}`)).not.toBeNull();
    expect(
      JSON.parse(localStorage.getItem("miolos-settings") ?? "{}"),
    ).toMatchObject({ games: { sudoku: { showErrors: true } } });
  });
});

describe("the in-game dialog carries the same switches for this game (T-WEB-S593)", () => {
  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = function showModal() {
      this.setAttribute("open", "");
      this.querySelector<HTMLElement>("button")?.focus();
    };
    HTMLDialogElement.prototype.close = function close() {
      this.removeAttribute("open");
      this.dispatchEvent(new Event("close"));
    };
  });

  it("opens with the clock group and this game's switches, and Fechar returns focus to the button", () => {
    render(<SudokuScreen daily={DAILY} />);
    const trigger = screen.getByRole("button", { name: copy.dialog.trigger });

    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: copy.dialog.title });
    expect(within(dialog).getByText(copy.dialog.note)).toBeInTheDocument();
    expect(
      within(dialog).getByRole("switch", { name: copy.flags.showClock.label }),
    ).toHaveFocus();
    for (const label of [
      copy.flags.showErrors.label,
      copy.flags.lockDigit.label,
      copy.flags.highlightSelection.label,
    ]) {
      expect(
        within(dialog).getByRole("switch", { name: label }),
      ).toBeInTheDocument();
    }

    fireEvent.click(
      within(dialog).getByRole("button", { name: copy.dialog.close }),
    );
    expect(dialog).not.toHaveAttribute("open");
    expect(trigger).toHaveFocus();
    expect(
      within(dialog).queryAllByRole("switch", { hidden: true }),
    ).toHaveLength(0);
  });

  it("free play has no clock, so its dialog leaves the general group out", () => {
    render(<SudokuFreeScreen deps={FREE_DEPS} />);

    fireEvent.click(screen.getByRole("button", { name: copy.dialog.trigger }));
    const dialog = screen.getByRole("dialog", { name: copy.dialog.title });
    expect(within(dialog).queryByText(copy.general)).toBeNull();
    expect(
      within(dialog).queryByRole("switch", {
        name: copy.flags.showClock.label,
      }),
    ).toBeNull();
    expect(
      within(dialog).getByRole("switch", { name: copy.flags.showErrors.label }),
    ).toBeInTheDocument();
  });

  it("a switch thrown in the dialog reaches the board behind it", () => {
    render(<SudokuScreen daily={DAILY} />);
    fireEvent.click(screen.getByRole("button", { name: copy.dialog.trigger }));
    const dialog = screen.getByRole("dialog", { name: copy.dialog.title });

    const clock = within(dialog).getByRole("switch", {
      name: copy.flags.showClock.label,
    });
    fireEvent.click(clock);
    expect(screen.queryByRole("timer")).toBeNull();

    fireEvent.click(
      within(dialog).getByRole("switch", { name: copy.flags.showClock.label }),
    );
    expect(screen.getAllByRole("timer").length).toBeGreaterThan(0);
  });

  it("does not render the chrome's button on a loading skeleton", () => {
    render(<PlaySkeleton date={DATE} tier={DAILY.tier} />);
    expect(
      screen.queryByRole("button", { name: copy.dialog.trigger }),
    ).toBeNull();
  });
});
