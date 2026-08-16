import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { render, screen } from "@testing-library/react";
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
  SNAPSHOT_CACHE_LIMIT,
  useRecordSnapshot,
} from "../src/play/use-record-snapshot";

/**
 * T-WEB-S213 (plan 043 §4 seam 1, ADR-0056 decision 1).
 *
 * `getSnapshot` must return a referentially stable value or
 * `useSyncExternalStore` loops forever. The shipped reader kept ONE
 * module-level cache slot, so N consumers with different keys on one page
 * evicted each other on every read and every one of them got a fresh object
 * back: React throws `Maximum update depth exceeded`.
 *
 * Two axes, because the defect has two and only one of them was ever
 * recorded. Across GAMES, which is what a per-game chip on one card row is
 * (four consumers, one date). And across DATES, which is what
 * `/arquivo/<data>` opened: the date is a URL variable there for the first
 * time, so a single date-keyed slot has the identical defect one level up.
 *
 * The assertion is deliberately not "no throw". Each probe asserts the record
 * it read is ITS OWN — a cache that answered every key with the last-written
 * value would satisfy a throw-free test and hand three of four cards another
 * game's state.
 */

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

/** A distinct, recognisable duration per (game, date) pair. */
function elapsedFor(game: Game, date: string): number {
  const gameTerm = (
    ["binairo", "sudoku", "nonogram", "termo"] as const
  ).indexOf(game);
  return 100_000 + gameTerm * 1_000 + (date === DATE ? 0 : 7);
}

function seed(game: Game, date: string): void {
  writePlayRecord(BUILDERS[game](date, elapsedFor(game, date)));
}

/**
 * Exactly what a per-card done chip is: one consumer of the shared reader,
 * mounted once per card. It renders what it read, so the assertion can be
 * about the record and not merely about survival.
 */
function Probe({ game, date }: { readonly game: Game; readonly date: string }) {
  const snapshot = useRecordSnapshot(game, date);
  const record = snapshot.hydrated ? snapshot.record : undefined;
  return (
    <span data-testid={`${game}|${date}`}>
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
    // The axis `/arquivo/<data>` opened, and the one a date-keyed single slot
    // would still get wrong.
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
    // The archive's ~99% case: most cards hold no record at all. A cache that
    // answered a missing key with the neighbour's entry would paint a chip on
    // a game this device never finished — the false done ADR-0031 decision 2
    // forbids by name.
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

/** Source with its comments removed — prose is not code (napkin item 3). */
function code(source: string): string {
  return source
    .replaceAll(/\/\*[\s\S]*?\*\//g, "")
    .replaceAll(/^[ \t]*\/\/.*$/gm, "")
    .replaceAll(/\{\/\*[\s\S]*?\*\/\}/g, "");
}

const APP_ROOT = join(import.meta.dirname, "..");

/**
 * Every module under `src/` and `app/` that CALLS the hook. The declaring
 * module is excluded by path and not by pattern: it is the only file where
 * `useRecordSnapshot(` is a definition rather than a consumer.
 */
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

/**
 * T-WEB-S214 (plan 043 §4 seam 2, ADR-0056 decision 1). The bound, in the two
 * forms a test can actually hold.
 *
 * (a) A FLOOR under the constant, rendered at that floor. `bound >= live
 *     maximum` is the safe property — 16 live consumers against a 16-entry
 *     cache were measured stable and 17 measured looping — so a test that
 *     renders fewer than it declares proves nothing about the declaration.
 * (b) An INVENTORY of the call-site files, so a new consumer file cannot
 *     arrive without the bound being re-derived against it.
 *
 * The inventory's limit, stated because it is easy to over-read: it pins
 * FILES, not mounts. A surface that reuses a file already on the list adds no
 * row and stays green while raising the live maximum — an archive MONTH page
 * would mount 31 × 4 through `app/arquivo/day-card.tsx` alone. That growth is
 * held by ADR-0056 decision 1, by the hook's docblock and by review, and this
 * comment says so rather than letting the green be read as a guarantee.
 */
describe("the snapshot cache's bound (T-WEB-S214)", () => {
  it("declares a limit at or above the games-times-two floor", () => {
    expect(SNAPSHOT_CACHE_LIMIT).toBeGreaterThanOrEqual(GAMES.length * 2);
  });

  it("renders GAMES.length * 2 live consumers without looping", () => {
    const dates = [DATE, OTHER_DATE];
    for (const date of dates) for (const game of GAMES) seed(game, date);

    render(
      <>
        {dates.map((date) =>
          GAMES.map((game) => (
            <Probe key={`${game}|${date}`} game={game} date={date} />
          )),
        )}
      </>,
    );

    expect(screen.getAllByTestId(/\|/).length).toBe(GAMES.length * 2);
    for (const date of dates)
      for (const game of GAMES) expectOwnRecord(game, date);
  });

  it("pins the inventory of call-site files, so a new one re-derives the bound", () => {
    // Five files, and the live maximum re-derived against them: a conclusion
    // mounts 2 (the shared reader plus its nested per-game one, same key), and
    // `/arquivo/<data>` mounts 4 (one card per game, one date). Bound 16.
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
    // And a doc block naming the hook is prose, not a call site.
    expect(code("/** calls useRecordSnapshot(game, date) */")).not.toContain(
      "useRecordSnapshot(",
    );
  });
});
