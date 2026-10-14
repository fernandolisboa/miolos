import {
  dailyQueensResponseSchema,
  FREE_HINTS_PER_PUZZLE,
  type DailyQueensResponse,
} from "@miolos/core";
import { generateQueens, queensAttackedCells } from "@miolos/games/queens";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { messages } from "../src/i18n";
import {
  queensPlayRecordSchema,
  readPlayRecord,
  type QueensPlayRecord,
} from "../src/play/play-record";
import spotlightStyles from "../src/play/spotlight.module.css";
import styles from "../src/queens/queens-board.module.css";
import { QueensScreen } from "../src/queens/queens-screen";
import { fadedCells, reachedCells } from "../src/queens/shading";
import {
  initQueensPlayState,
  autoCrossingReducer,
  queensPlayReducer,
  type QueensPlayAction,
  type QueensPlayState,
} from "../src/queens/state";
import { readSettings, writeSettings } from "../src/settings/settings";

vi.mock("../src/play/sync", () => ({
  startCompletionSync: vi.fn(() => () => undefined),
  flushPendingCompletions: vi.fn(() => Promise.resolve(undefined)),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/rainhas",
}));

const DATE = "2026-10-14";
const SIDE = 7;

function dailyOf(size: number, regions: readonly number[]) {
  return dailyQueensResponseSchema.parse({
    game: "queens",
    date: DATE,
    size,
    regions,
  });
}

const STRIPES: DailyQueensResponse = dailyOf(
  SIDE,
  Array.from(
    { length: SIDE * SIDE },
    (_unused, index) => (Math.floor(index / SIDE) + 2 * (index % SIDE)) % SIDE,
  ),
);
const BOARD = { size: SIDE, regions: STRIPES.regions };
const PUZZLE = generateQueens({ seed: 20_261_014, weekday: 1 });
const DAILY = dailyOf(PUZZLE.size, PUZZLE.regions);

const at = (row: number, column: number) => row * SIDE + column;

function hydrated(daily: DailyQueensResponse): QueensPlayState {
  return queensPlayReducer(initQueensPlayState(daily), {
    type: "restore",
    record: undefined,
    now: 0,
  });
}

function run(
  autoCross: boolean,
  state: QueensPlayState,
  ...actions: QueensPlayAction[]
): QueensPlayState {
  const reduce = autoCross ? autoCrossingReducer : queensPlayReducer;
  return actions.reduce((current, action) => reduce(current, action), state);
}

const queen = (index: number): QueensPlayAction => ({
  type: "tap",
  index,
  press: "right",
});
const cross = (index: number): QueensPlayAction => ({
  type: "tap",
  index,
  press: "tap",
});
const clear = (index: number): QueensPlayAction[] => [
  { type: "select", index },
  { type: "clear-cell" },
];

const crossed = (state: QueensPlayState) =>
  state.entries.flatMap((entry, index) => (entry === 0 ? [index] : []));
const sorted = (cells: Iterable<number>) => [...cells].sort((a, b) => a - b);

function cell(index: number, daily = STRIPES): HTMLElement {
  const found = screen
    .getByRole("group", {
      name: messages.games.queens.play.boardAria(daily.size),
    })
    .querySelector<HTMLElement>(`[data-cell-index="${String(index)}"]`);
  if (found === null) {
    throw new Error(`no cell ${String(index)}`);
  }
  return found;
}
function setQueens(
  flags: Partial<ReturnType<typeof readSettings>["games"]["queens"]>,
) {
  const current = readSettings();
  act(() => {
    writeSettings({
      ...current,
      games: {
        ...current.games,
        queens: { ...current.games.queens, ...flags },
      },
    });
  });
}
describe("Marcar ✕ automático crosses for a queen and takes back only its own (T-WEB-S610)", () => {
  it("crosses a queen's undecided attacked cells and, when it leaves, clears only those, never a player ✕", () => {
    const mine = at(0, 3);
    const outside = at(5, 5);
    const start = run(true, hydrated(STRIPES), cross(mine), cross(outside));
    const placed = run(true, start, queen(at(0, 0)));

    expect(sorted(crossed(placed))).toEqual(
      sorted(new Set([...queensAttackedCells(BOARD, at(0, 0)), outside])),
    );
    expect([...placed.autoCrossed.keys()]).not.toContain(mine);

    const removed = run(true, placed, queen(at(0, 0)));
    expect(sorted(crossed(removed))).toEqual(sorted([mine, outside]));
    expect(removed.autoCrossed.size).toBe(0);
  });

  it("keeps a ✕ two queens claimed until the last of them leaves", () => {
    const first = at(0, 0);
    const second = at(2, 5);
    const shared = at(0, 5);
    const both = run(true, hydrated(STRIPES), queen(first), queen(second));
    expect(sorted(both.autoCrossed.get(shared) ?? [])).toEqual([first, second]);

    const one = run(true, both, queen(first));
    expect(one.entries[shared]).toBe(0);
    expect(one.entries[at(0, 1)]).toBeNull();
    expect(run(true, one, queen(second)).entries[shared]).toBeNull();
  });

  it("hands a ✕ the player changed back to the player", () => {
    const owner = at(0, 0);
    const later = at(2, 1);
    const cell = at(0, 1);
    const cleared = run(true, hydrated(STRIPES), queen(owner), ...clear(cell));
    expect(cleared.entries[cell]).toBeNull();
    expect(cleared.autoCrossed.has(cell)).toBe(false);

    const recrossed = run(true, cleared, queen(later));
    expect(recrossed.autoCrossed.get(cell)).toEqual(new Set([later]));
    const gone = run(true, recrossed, queen(later));
    expect(gone.entries[cell]).toBeNull();
    expect(run(true, gone, queen(owner)).entries[cell]).toBeNull();

    const mine = run(true, cleared, cross(cell), queen(owner));
    expect(mine.entries[cell]).toBe(0);
    expect(mine.autoCrossed.has(cell)).toBe(false);
  });

  it("crosses nothing when off, and still takes back what it crossed while on", () => {
    expect(crossed(run(false, hydrated(STRIPES), queen(at(0, 0))))).toEqual([]);

    const on = run(true, hydrated(STRIPES), queen(at(0, 0)));
    const off = run(false, on, queen(at(3, 3)));
    expect(off.autoCrossed.get(at(3, 4))).toBeUndefined();
    expect(off.entries[at(3, 4)]).toBeNull();
    expect(crossed(run(false, off, queen(at(0, 0))))).toEqual([]);
  });

  it("crosses for a queen a hint places", () => {
    const hinted = run(true, hydrated(DAILY), { type: "use-hint" });
    const revealed = hinted.hint.lastIndex;
    expect(revealed).not.toBeNull();
    expect(hinted.entries[revealed as number]).toBe(1);
    expect(hinted.autoCrossed.size).toBeGreaterThan(0);
  });

  it("empties on Recomeçar", () => {
    const placed = run(true, hydrated(STRIPES), queen(at(0, 0)));
    const reset = run(true, placed, { type: "reset" });
    expect(reset.autoCrossed.size).toBe(0);
    expect(reset.entries.every((entry) => entry === null)).toBe(true);
  });

  it("leaves the solving move alone", () => {
    const queens = PUZZLE.solution.flatMap((cell, index) =>
      cell === 1 ? [index] : [],
    );
    const last = queens.pop();
    expect(last).toBeDefined();
    const allButLast = run(false, hydrated(DAILY), ...queens.map(queen));
    const solved = run(true, allButLast, queen(last as number));
    expect(solved.status).toBe("solved");
    expect(crossed(solved)).toEqual([]);
  });

  it("saves its claims with the board, however many queens claim a ✕, and takes them back after a reload", () => {
    localStorage.clear();
    setQueens({ autoCross: true });
    const place = (index: number) => {
      act(() => {
        cell(index).focus();
      });
      fireEvent.keyDown(cell(index), { key: "1" });
    };
    const first = render(<QueensScreen daily={STRIPES} />);
    for (let line = 0; line < SIDE - 1; line += 1) {
      place(at(SIDE - 1, line));
      place(at(line, SIDE - 1));
    }
    const saved = readPlayRecord("queens", DATE);
    const corner =
      saved?.game === "queens"
        ? saved.autoCrossed?.find(
            (claim) => claim.cell === at(SIDE - 1, SIDE - 1),
          )
        : undefined;
    expect(corner?.by).toHaveLength(2 * (SIDE - 1));
    first.unmount();

    localStorage.clear();
    setQueens({ autoCross: true });
    const second = render(<QueensScreen daily={STRIPES} />);
    place(at(0, 0));
    second.unmount();
    render(<QueensScreen daily={STRIPES} />);
    expect(cell(at(0, 1))).toHaveClass(styles.cellMarked ?? "missing");
    place(at(0, 0));
    expect(cell(at(0, 1))).not.toHaveClass(styles.cellMarked ?? "missing");
  });

  it("keeps the record's old shape while no ✕ is automatic", () => {
    localStorage.clear();
    render(<QueensScreen daily={STRIPES} />);
    act(() => {
      cell(at(0, 0)).focus();
    });
    fireEvent.keyDown(cell(at(0, 0)), { key: "1" });
    const saved = readPlayRecord("queens", DATE);
    expect(saved?.game).toBe("queens");
    expect(saved).not.toHaveProperty("autoCrossed");
  });

  it("saves which ✕ are automatic and restores only the ones still standing", () => {
    const record: QueensPlayRecord = queensPlayRecordSchema.parse({
      v: 1,
      game: "queens",
      date: DATE,
      size: SIDE,
      entries: Array.from({ length: SIDE * SIDE }, (_unused, index) =>
        index === at(0, 0)
          ? 1
          : index === at(0, 1) || index === at(6, 6)
            ? 0
            : null,
      ),
      elapsedMs: 0,
      hintsUsed: 0,
      concluded: false,
      pendingSync: false,
      syncOutcome: "pending",
      autoCrossed: [
        { cell: at(0, 1), by: [at(0, 0)] },
        { cell: at(0, 2), by: [at(0, 0)] },
        { cell: at(6, 6), by: [at(5, 5)] },
      ],
    });
    const restored = queensPlayReducer(initQueensPlayState(STRIPES), {
      type: "restore",
      record,
      now: 0,
    });
    expect([...restored.autoCrossed]).toEqual([
      [at(0, 1), new Set([at(0, 0)])],
    ]);
    expect(crossed(run(true, restored, queen(at(0, 0))))).toEqual([at(6, 6)]);
  });

  it("parses a record without the field and refuses an index off the board", () => {
    const base = {
      v: 1,
      game: "queens",
      date: DATE,
      size: SIDE,
      entries: Array.from({ length: SIDE * SIDE }, () => null),
      elapsedMs: 0,
      hintsUsed: 0,
      concluded: false,
      pendingSync: false,
      syncOutcome: "pending",
    };
    expect(queensPlayRecordSchema.safeParse(base).success).toBe(true);
    expect(
      queensPlayRecordSchema.safeParse({
        ...base,
        autoCrossed: [{ cell: SIDE * SIDE, by: [0] }],
      }).success,
    ).toBe(false);
    expect(
      queensPlayRecordSchema.safeParse({
        ...base,
        autoCrossed: [{ cell: 1, by: [] }],
      }).success,
    ).toBe(false);
  });
});

describe("the Rainhas hint corrects a wrong queen before the ✕ it caused (T-WEB-S611)", () => {
  it("removes the wrong queen even when its ✕ on a solution cell comes first", () => {
    const size = PUZZLE.size;
    const row = PUZZLE.solution.findIndex(
      (cell, index) => cell === 1 && index % size < size - 1,
    );
    const right = Math.floor(row / size) * size + size - 1;
    const wrong = run(true, hydrated(DAILY), queen(right));
    expect(wrong.entries[row]).toBe(0);

    const hinted = run(true, wrong, { type: "use-hint" });
    expect(hinted.hint.lastIndex).toBe(right);
    expect(hinted.entries[right]).toBe(0);
    expect(hinted.entries[row]).toBeNull();
  });
});

describe("the highlight and the fade follow the rules and the switches (T-WEB-S612)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("reaches the selection's row, column and region, and fades what shares a line with a queen", () => {
    const entries = STRIPES.regions.map((): 0 | 1 | null => null);
    expect(sorted(reachedCells(BOARD, null, entries))).toEqual([]);
    const reach = reachedCells(BOARD, at(3, 3), entries);
    for (let index = 0; index < SIDE * SIDE; index += 1) {
      const sharesLine =
        Math.floor(index / SIDE) === 3 ||
        index % SIDE === 3 ||
        STRIPES.regions[index] === STRIPES.regions[at(3, 3)];
      expect(reach.has(index), String(index)).toBe(sharesLine);
    }

    entries[at(0, 0)] = 1;
    entries[at(4, 2)] = 1;
    entries[at(0, 4)] = 0;
    const faded = fadedCells(BOARD, entries);
    expect(faded.has(at(0, 0))).toBe(false);
    expect(reachedCells(BOARD, at(0, 3), entries).has(at(0, 0))).toBe(false);
    expect(faded.has(at(0, 4))).toBe(true);
    expect(faded.has(at(6, 0))).toBe(true);
    expect(faded.has(at(4, 6))).toBe(true);
    expect(faded.has(at(6, 2))).toBe(true);
    expect(faded.has(at(1, 1))).toBe(false);
    expect(faded.has(at(5, 4))).toBe(false);
  });

  const marked = (name: string | undefined) =>
    document.querySelectorAll(`.${name ?? "missing"}`).length;

  it("paints the reach and the fade on the board only while each switch is on", () => {
    render(<QueensScreen daily={STRIPES} />);
    act(() => {
      cell(at(3, 3)).focus();
    });
    expect(cell(at(3, 0))).toHaveClass(styles.cellReach ?? "missing");
    expect(cell(at(1, 1))).not.toHaveClass(styles.cellReach ?? "missing");

    act(() => {
      cell(at(0, 0)).click();
      cell(at(0, 0)).click();
    });
    expect(cell(at(0, 6))).toHaveClass(styles.cellFaded ?? "missing");
    expect(cell(at(0, 0))).not.toHaveClass(styles.cellFaded ?? "missing");
    act(() => {
      cell(at(0, 3)).focus();
    });
    expect(cell(at(0, 6))).toHaveClass(styles.cellReach ?? "missing");
    expect(cell(at(0, 0))).not.toHaveClass(styles.cellReach ?? "missing");

    setQueens({ highlightRegion: false, fadeQueenLines: false });
    expect(marked(styles.cellReach)).toBe(0);
    expect(marked(styles.cellFaded)).toBe(0);
  });

  it("drops the reach while a hint lights its unit, as the Sudoku does", () => {
    render(<QueensScreen daily={DAILY} />);
    act(() => {
      cell(0, DAILY).focus();
    });
    expect(marked(styles.cellReach)).toBeGreaterThan(0);

    act(() => {
      screen
        .getByText(messages.play.hint.available(FREE_HINTS_PER_PUZZLE))
        .click();
    });
    expect(marked(spotlightStyles.spotlit)).toBeGreaterThan(0);
    expect(marked(styles.cellReach)).toBe(0);
  });

  it("crosses for the player on the board once Marcar ✕ automático is on", () => {
    setQueens({ autoCross: true });
    render(<QueensScreen daily={STRIPES} />);
    act(() => {
      cell(at(0, 0)).click();
      cell(at(0, 0)).click();
    });
    expect(cell(at(0, 6))).toHaveClass(styles.cellMarked ?? "missing");
  });
});
