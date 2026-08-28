import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { GAMES, type Game } from "@miolos/core";

import {
  writePlayRecord,
  type BinairoPlayRecord,
  type NonogramPlayRecord,
  type PlayRecord,
  type SudokuPlayRecord,
  type TermoPlayRecord,
} from "../src/play/play-record";
import {
  pruneStaleSnapshots,
  SNAPSHOT_STALE_MS,
  useRecordSnapshot,
} from "../src/play/use-record-snapshot";

const DATE = "2026-07-30";
const OTHER_DATE = "2026-07-29";

type Tiles = TermoPlayRecord["guesses"][number]["tiles"];
const MISS: Tiles = ["absent", "present", "absent", "absent", "present"];
const WIN: Tiles = ["correct", "correct", "correct", "correct", "correct"];

function binairoRecord(date: string, elapsedMs: number): BinairoPlayRecord {
  return {
    v: 1,
    game: "binairo",
    date,
    entries: Array.from({ length: 64 }, () => null),
    elapsedMs,
    hintsUsed: 0,
    concluded: true,
    pendingSync: false,
    syncOutcome: "recorded",
  };
}

function sudokuRecord(date: string, elapsedMs: number): SudokuPlayRecord {
  return {
    v: 1,
    game: "sudoku",
    date,
    entries: Array.from({ length: 81 }, () => null),
    elapsedMs,
    hintsUsed: 0,
    concluded: true,
    pendingSync: false,
    syncOutcome: "recorded",
  };
}

function nonogramRecord(date: string, elapsedMs: number): NonogramPlayRecord {
  return {
    v: 1,
    game: "nonogram",
    date,
    size: 5,
    entries: Array.from({ length: 25 }, () => null),
    elapsedMs,
    hintsUsed: 0,
    concluded: true,
    pendingSync: false,
    syncOutcome: "recorded",
  };
}

function termoRecord(date: string, elapsedMs: number): TermoPlayRecord {
  return {
    v: 1,
    game: "termo",
    date,
    guesses: [
      { guess: "cafes", tiles: [...MISS] },
      { guess: "praga", tiles: [...WIN] },
    ],
    answer: "praga",
    outcome: "won",
    elapsedMs,
    hintsUsed: 0,
    concluded: true,
    pendingSync: false,
    syncOutcome: "recorded",
  };
}

const BUILDERS: Record<Game, (date: string, elapsedMs: number) => PlayRecord> =
  {
    binairo: binairoRecord,
    sudoku: sudokuRecord,
    nonogram: nonogramRecord,
    termo: termoRecord,
  };

function elapsedFor(game: Game, date: string): number {
  const gameTerm = GAMES.indexOf(game);
  const dateTerm = Number(date.replaceAll("-", "")) % 10_000;
  return 1_000_000 + gameTerm * 100_000 + dateTerm;
}

function seed(game: Game, date: string): void {
  writePlayRecord(BUILDERS[game](date, elapsedFor(game, date)));
}

const renderCounts = new Map<string, number>();

function Probe({ game, date }: { readonly game: Game; readonly date: string }) {
  const snapshot = useRecordSnapshot(game, date);
  const record = snapshot.hydrated ? snapshot.record : undefined;
  const key = `${game}|${date}`;
  renderCounts.set(key, (renderCounts.get(key) ?? 0) + 1);
  return (
    <span data-testid={key}>
      {record === undefined
        ? "none"
        : `${record.game}|${record.date}|${String(record.elapsedMs)}`}
    </span>
  );
}

function expectOwnRecord(game: Game, date: string): void {
  expect(screen.getByTestId(`${game}|${date}`).textContent).toBe(
    `${game}|${date}|${String(elapsedFor(game, date))}`,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  renderCounts.clear();
});

describe("useRecordSnapshot is N-consumer safe (T-WEB-S213)", () => {
  it("renders four games on one date, each reading its own record", () => {
    const games: readonly Game[] = ["binairo", "sudoku", "nonogram", "termo"];
    for (const game of games) seed(game, DATE);

    render(
      <>
        {games.map((game) => (
          <Probe key={game} game={game} date={DATE} />
        ))}
      </>,
    );

    for (const game of games) expectOwnRecord(game, DATE);
  });

  it("renders two DATES for one game on one page, each reading its own record", () => {
    seed("sudoku", DATE);
    seed("sudoku", OTHER_DATE);

    render(
      <>
        <Probe game="sudoku" date={DATE} />
        <Probe game="sudoku" date={OTHER_DATE} />
      </>,
    );

    expectOwnRecord("sudoku", DATE);
    expectOwnRecord("sudoku", OTHER_DATE);
  });

  it("keeps a consumer whose record is ABSENT reading absent beside consumers that are not", () => {
    seed("sudoku", DATE);

    render(
      <>
        <Probe game="sudoku" date={DATE} />
        <Probe game="termo" date={DATE} />
      </>,
    );

    expectOwnRecord("sudoku", DATE);
    expect(screen.getByTestId(`termo|${DATE}`).textContent).toBe("none");
  });
});

function code(source: string): string {
  return source
    .replaceAll(/\/\*[\s\S]*?\*\//g, "")
    .replaceAll(/^[ \t]*\/\/.*$/gm, "")
    .replaceAll(/\{\/\*[\s\S]*?\*\/\}/g, "");
}

const APP_ROOT = join(import.meta.dirname, "..");

function callSiteFiles(): string[] {
  const found: string[] = [];
  const declaringModule = join(
    APP_ROOT,
    "src",
    "play",
    "use-record-snapshot.ts",
  );
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(path);
      } else if (
        /\.tsx?$/.test(entry.name) &&
        path !== declaringModule &&
        code(readFileSync(path, "utf8")).includes("useRecordSnapshot(")
      ) {
        found.push(relative(APP_ROOT, path).replaceAll("\\", "/"));
      }
    }
  };
  walk(join(APP_ROOT, "src"));
  walk(join(APP_ROOT, "app"));
  return found.sort();
}

function pairs(n: number): { game: Game; date: string }[] {
  return Array.from({ length: n }, (_unused, i) => ({
    game: GAMES[i % GAMES.length] as Game,

    date: `2026-07-${String(Math.floor(i / GAMES.length) + 1).padStart(2, "0")}`,
  }));
}

describe("the snapshot cache is stable at any N (T-WEB-S214)", () => {
  for (const n of [4, 16, 17, 32, 128]) {
    it(`renders ${String(n)} live consumers, each reading its own record`, () => {
      const consumers = pairs(n);
      for (const { game, date } of consumers) seed(game, date);

      render(
        <>
          {consumers.map(({ game, date }) => (
            <Probe key={`${game}|${date}`} game={game} date={date} />
          ))}
        </>,
      );

      expect(screen.getAllByTestId(/\|/).length).toBe(n);
      for (const { game, date } of consumers) expectOwnRecord(game, date);

      for (const { game, date } of consumers)
        expect(renderCounts.get(`${game}|${date}`)).toBe(1);
    });
  }

  it("the sweep cannot collect an entry a live consumer has just read", () => {
    const consumers = pairs(GAMES.length * 2);
    for (const { game, date } of consumers) seed(game, date);

    const beforeMount = Date.now();
    render(
      <>
        {consumers.map(({ game, date }) => (
          <Probe key={`${game}|${date}`} game={game} date={date} />
        ))}
      </>,
    );

    act(() => {
      pruneStaleSnapshots(beforeMount + SNAPSHOT_STALE_MS);
      window.dispatchEvent(new StorageEvent("storage"));
    });

    for (const { game, date } of consumers) {
      expectOwnRecord(game, date);
      expect(renderCounts.get(`${game}|${date}`)).toBe(1);
    }
  });

  it("collects an entry past the window, and that costs one render, not a loop", () => {
    const consumers = pairs(GAMES.length * 2);
    for (const { game, date } of consumers) seed(game, date);
    render(
      <>
        {consumers.map(({ game, date }) => (
          <Probe key={`${game}|${date}`} game={game} date={date} />
        ))}
      </>,
    );

    act(() => {
      pruneStaleSnapshots(Date.now() + SNAPSHOT_STALE_MS + 1);
      window.dispatchEvent(new StorageEvent("storage"));
    });

    for (const { game, date } of consumers) {
      expectOwnRecord(game, date);
      expect(renderCounts.get(`${game}|${date}`)).toBe(2);
    }
  });

  it("pins the inventory of call-site files, so a new reader arrives in front of the staleness window", () => {
    expect(callSiteFiles()).toEqual([
      "app/arquivo/day-card.tsx",
      "src/archive/late-result.tsx",
      "src/nonogram/nonogram-conclusion.tsx",
      "src/play/conclusion-view.tsx",
      "src/termo/termo-conclusion.tsx",
    ]);
  });

  it("the inventory scan is not vacuous — it sees a call and not an import", () => {
    expect(code("import { useRecordSnapshot } from './x';")).not.toContain(
      "useRecordSnapshot(",
    );
    expect(code("const s = useRecordSnapshot(game, date);")).toContain(
      "useRecordSnapshot(",
    );

    expect(code("/** calls useRecordSnapshot(game, date) */")).not.toContain(
      "useRecordSnapshot(",
    );
  });
});
