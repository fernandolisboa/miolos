import { solveQueens } from "@miolos/games/queens";
import { act, fireEvent, render, renderHook } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BinairoScreen } from "../src/binairo/binairo-screen";
import { CrosswordScreen } from "../src/crossword/crossword-screen";
import { BinairoFreeScreen } from "../src/free-play/binairo-free-screen";
import { CrosswordFreeScreen } from "../src/free-play/crossword-free-screen";
import { NonogramFreeScreen } from "../src/free-play/nonogram-free-screen";
import { QueensFreeScreen } from "../src/free-play/queens-free-screen";
import { SudokuFreeScreen } from "../src/free-play/sudoku-free-screen";
import { useFreeBinairo } from "../src/free-play/use-free-binairo";
import { useFreeCrossword } from "../src/free-play/use-free-crossword";
import { useFreeNonogram } from "../src/free-play/use-free-nonogram";
import { useFreeQueens } from "../src/free-play/use-free-queens";
import { useFreeSudoku } from "../src/free-play/use-free-sudoku";
import { messages } from "../src/i18n";
import { solutionMarks } from "../src/nonogram/engine";
import { NonogramScreen } from "../src/nonogram/nonogram-screen";
import wrongMark from "../src/play/wrong-mark.module.css";
import { QueensScreen } from "../src/queens/queens-screen";
import {
  readSettings,
  writeSettings,
  type SettingsGame,
} from "../src/settings/settings";
import { SudokuScreen } from "../src/sudoku/sudoku-screen";
import binairoStyles from "../src/binairo/binairo-screen.module.css";
import queensStyles from "../src/queens/queens-board.module.css";
import sudokuStyles from "../src/sudoku/sudoku-board.module.css";
import { flushGeneration } from "./free-generation";

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
const SEED = 42;
const DEPS = { pickSeed: () => SEED };

interface Spec {
  readonly id: string;
  readonly game: SettingsGame;
  readonly daily: () => ReactElement;
  readonly free: () => ReactElement;
  readonly playable: readonly number[];
  readonly enter: (index: number, correct: boolean) => void;
  readonly ring: string | undefined;
  readonly pair: readonly [wrong: number, right: number] | null;
  readonly enterPair: (() => void) | null;
}

function cellAt(index: number): HTMLElement {
  const cell = document.querySelector<HTMLElement>(
    `[data-cell-index="${String(index)}"]`,
  );
  if (cell === null) {
    throw new Error(`no cell at index ${String(index)}`);
  }
  return cell;
}

function key(index: number, pressed: string): void {
  const cell = cellAt(index);
  act(() => {
    cell.focus();
  });
  fireEvent.keyDown(cell, { key: pressed });
}

function tapUntil(index: number, value: 0 | 1): void {
  for (let taps = 0; taps < 4; taps += 1) {
    const cell = document.querySelector<HTMLElement>(
      `[data-cell-index="${String(index)}"]`,
    );
    if (cell === null || cell.textContent === String(value)) {
      return;
    }
    fireEvent.click(cell);
  }
}

function notGiven<T>(cells: readonly (T | null)[]): readonly number[] {
  return cells.flatMap((cell, index) => (cell === null ? [index] : []));
}

function otherThan(digit: number): number {
  return (digit % 9) + 1;
}

async function settled<TPhase>(useGeneration: () => { phase: TPhase }) {
  const { result } = renderHook(useGeneration);
  await flushGeneration();
  return result.current.phase;
}

const sudoku = await settled(() => useFreeSudoku("medio", DEPS));
const binairo = await settled(() => useFreeBinairo("medio", DEPS));
const nonogram = await settled(() => useFreeNonogram("medio", DEPS));
const queens = await settled(() => useFreeQueens("medio", DEPS));
const crossword = await settled(() => useFreeCrossword(5, DEPS));

function ready<T>(phase: { kind: string; puzzle?: T }): T {
  if (phase.kind !== "ready" || phase.puzzle === undefined) {
    throw new Error("the pinned seed did not generate");
  }
  return phase.puzzle;
}

function sudokuSpec(): Spec {
  const { daily, solution } = ready(sudoku);
  const playable = daily.givens.flatMap((cell, index) =>
    cell === 0 ? [index] : [],
  );
  const row = (index: number) => Math.floor(index / 9);
  const first = playable[0] ?? 0;
  const mate = playable.find(
    (index) => index !== first && row(index) === row(first),
  );
  if (mate === undefined) {
    throw new Error("the pinned puzzle has no two empty cells in a row");
  }
  const forMate = solution[mate] ?? 1;
  return {
    id: "T-WEB-S583",
    game: "sudoku",
    daily: () => <SudokuScreen daily={{ ...daily, date: DATE }} />,
    free: () => <SudokuFreeScreen deps={DEPS} />,
    playable,
    enter: (index, correct) => {
      const target = solution[index] ?? 1;
      key(index, String(correct ? target : otherThan(target)));
    },
    ring: sudokuStyles.cellViolating,
    pair: [first, mate],
    enterPair: () => {
      key(first, String(forMate));
      key(mate, String(forMate));
    },
  };
}

function binairoSpec(): Spec {
  const { daily, solution } = ready(binairo);
  const playable = notGiven(daily.givens);
  const run = playable.find(
    (index) =>
      index % 8 >= 2 &&
      solution[index - 1] === solution[index - 2] &&
      solution[index - 1] !== solution[index] &&
      (daily.givens[index - 1] === null || daily.givens[index - 2] === null),
  );
  if (run === undefined) {
    throw new Error("the pinned puzzle has no x-x-y run to break");
  }
  const mate = daily.givens[run - 1] === null ? run - 1 : run - 2;
  const forRun = solution[run - 1] ?? 0;
  return {
    id: "T-WEB-S584",
    game: "binairo",
    daily: () => <BinairoScreen daily={{ ...daily, date: DATE }} />,
    free: () => <BinairoFreeScreen deps={DEPS} />,
    playable,
    enter: (index, correct) => {
      const target = solution[index] ?? 0;
      tapUntil(index, correct ? target : target === 1 ? 0 : 1);
    },
    ring: binairoStyles.cellViolating,
    pair: [run, mate],
    enterPair: () => {
      tapUntil(mate, solution[mate] ?? 0);
      tapUntil(run, forRun === 1 ? 1 : 0);
    },
  };
}

function nonogramSpec(): Spec {
  const { daily } = ready(nonogram);
  const solution = solutionMarks(daily.clues) ?? [];
  return {
    id: "T-WEB-S585",
    game: "nonogram",
    daily: () => <NonogramScreen daily={{ ...daily, date: DATE }} />,
    free: () => <NonogramFreeScreen deps={DEPS} />,
    playable: solution.map((_mark, index) => index),
    enter: (index, correct) => {
      const filled = (solution[index] === 1) === correct;
      key(index, filled ? "1" : "2");
    },
    ring: undefined,
    pair: null,
    enterPair: null,
  };
}

function queensSpec(): Spec {
  const { daily } = ready(queens);
  const solution = solveQueens({ size: daily.size, regions: daily.regions });
  const queenAt = solution?.indexOf(1) ?? 0;
  const sameRow = (solution ?? []).findIndex(
    (mark, index) =>
      mark === 0 &&
      Math.floor(index / daily.size) === Math.floor(queenAt / daily.size),
  );
  return {
    id: "T-WEB-S586",
    game: "queens",
    daily: () => <QueensScreen daily={{ ...daily, date: DATE }} />,
    free: () => <QueensFreeScreen deps={DEPS} />,
    playable: (solution ?? []).map((_mark, index) => index),
    enter: (index, correct) => {
      const queen = (solution?.[index] === 1) === correct;
      key(index, queen ? "1" : "2");
    },
    ring: queensStyles.cellConflict,
    pair: [sameRow, queenAt],
    enterPair: () => {
      key(queenAt, "1");
      key(sameRow, "1");
    },
  };
}

function crosswordSpec(): Spec {
  const { daily } = ready(crossword);
  const letters = daily.grid.flat();
  return {
    id: "T-WEB-S587",
    game: "crossword",
    daily: () => <CrosswordScreen daily={{ ...daily, date: DATE }} />,
    free: () => <CrosswordFreeScreen deps={DEPS} />,
    playable: letters.flatMap((letter, index) =>
      letter === null ? [] : [index],
    ),
    enter: (index, correct) => {
      const target = letters[index] ?? "a";
      const pressed = correct ? target : target === "z" ? "y" : "z";
      const cell = cellAt(index);
      fireEvent.pointerDown(cell);
      fireEvent.click(cell);
      fireEvent.keyDown(cell, { key: pressed });
    },
    ring: undefined,
    pair: null,
    enterPair: null,
  };
}

function setErrors(game: SettingsGame, showErrors: boolean): void {
  const current = readSettings();
  act(() => {
    writeSettings({
      ...current,
      games: {
        ...current.games,
        [game]: { ...current.games[game], showErrors },
      },
    });
  });
}

function marked(index: number): boolean {
  return cellAt(index).querySelector(`.${wrongMark.mark}`) !== null;
}

function labelOf(index: number): string {
  return cellAt(index).getAttribute("aria-label") ?? "";
}

beforeEach(() => {
  localStorage.clear();
  sync.flushPendingCompletions.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const SETTINGS_KEY = "miolos-settings";

function storedRecords(): Record<string, string | null> {
  return Object.fromEntries(
    Object.keys(localStorage)
      .filter((name) => name !== SETTINGS_KEY)
      .sort()
      .map((name) => [name, localStorage.getItem(name)]),
  );
}

function solveDaily(spec: Spec, showErrors: boolean) {
  localStorage.clear();
  sync.flushPendingCompletions.mockClear();
  vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-08-01T12:00:00Z") });
  const view = render(spec.daily());
  setErrors(spec.game, showErrors);
  spec.enter(spec.playable[0] ?? 0, false);
  for (const index of spec.playable) {
    if (
      document.querySelector(`[data-cell-index="${String(index)}"]`) === null
    ) {
      break;
    }
    spec.enter(index, true);
  }
  expect(document.querySelector("[data-cell-index]")).toBeNull();
  const outcome = {
    records: storedRecords(),
    flushed: sync.flushPendingCompletions.mock.calls.at(-1)?.[0],
  };
  view.unmount();
  vi.useRealTimers();
  return outcome;
}

const SPECS: readonly (readonly [string, () => Spec])[] = [
  ["Sudoku", sudokuSpec],
  ["Binairo", binairoSpec],
  ["Nonogram", nonogramSpec],
  ["Rainhas", queensSpec],
  ["Cruzadinha", crosswordSpec],
];

for (const [name, make] of SPECS) {
  const spec = make();
  describe(`${name} marks a cell that contradicts the solution only when asked (${spec.id})`, () => {
    for (const mode of ["daily", "free"] as const) {
      it(`${mode}: nothing by default, a mark and its name with the setting on, gone when corrected or turned off`, async () => {
        render(mode === "daily" ? spec.daily() : spec.free());
        if (mode === "free") {
          await flushGeneration();
        }
        const at = spec.playable[0] ?? 0;
        spec.enter(at, false);
        const plain = labelOf(at);
        expect(marked(at)).toBe(false);

        setErrors(spec.game, true);
        expect(marked(at)).toBe(true);
        expect(labelOf(at)).toBe(messages.play.wrongCell(plain));

        spec.enter(at, true);
        expect(marked(at)).toBe(false);
        expect(labelOf(at)).not.toContain(messages.play.wrongCell(""));

        spec.enter(at, false);
        expect(marked(at)).toBe(true);
        setErrors(spec.game, false);
        expect(marked(at)).toBe(false);
        expect(labelOf(at)).toBe(plain);
      });
    }

    it("never marks an empty cell, and a correct entry stays unmarked", () => {
      setErrors(spec.game, true);
      render(spec.daily());
      for (const index of spec.playable.slice(0, 6)) {
        expect(marked(index)).toBe(false);
      }
      const at = spec.playable[1] ?? 0;
      spec.enter(at, true);
      expect(marked(at)).toBe(false);
    });

    if (spec.pair !== null && spec.enterPair !== null) {
      const [wrong, right] = spec.pair;
      const enterPair = spec.enterPair;
      it("sits on top of a rule ring: of two cells that conflict only the wrong one carries the mark", () => {
        setErrors(spec.game, true);
        render(spec.daily());
        enterPair();

        expect(cellAt(wrong).classList.contains(spec.ring ?? "?")).toBe(true);
        expect(cellAt(right).classList.contains(spec.ring ?? "?")).toBe(true);
        expect(marked(wrong)).toBe(true);
        expect(marked(right)).toBe(false);
      });
    }
  });
}

for (const [name, make] of SPECS) {
  const spec = make();
  describe(`${name}: Mostrar erros changes nothing that is recorded (T-WEB-S588)`, () => {
    it(
      "writes the same play record and hands sync the same concluded record, with no hint spent",
      { timeout: 20_000 },
      () => {
        const off = solveDaily(spec, false);
        const on = solveDaily(spec, true);

        expect(on.flushed).toBeDefined();
        expect(on).toEqual(off);
        expect(on.flushed).toMatchObject({ hintsUsed: 0, concluded: true });
      },
    );

    it("free play writes nothing and fetches nothing, with the setting on", async () => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      const setItem = vi.spyOn(Storage.prototype, "setItem");
      setErrors(spec.game, true);
      setItem.mockClear();

      render(spec.free());
      await flushGeneration();
      spec.enter(spec.playable[0] ?? 0, false);

      expect(marked(spec.playable[0] ?? 0)).toBe(true);
      expect(setItem).not.toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
}
