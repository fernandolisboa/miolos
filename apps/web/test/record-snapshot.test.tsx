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

/**
 * A distinct, recognisable duration per (game, date) pair — distinct along
 * BOTH axes, so a probe handed a neighbour's entry cannot coincide with its
 * own. Derived from `GAMES` rather than from a literal list standing beside
 * it: a fifth game would otherwise take `indexOf` → `-1` on the literal and
 * collide with the first (step-6 finding m7).
 */
function elapsedFor(game: Game, date: string): number {
  const gameTerm = GAMES.indexOf(game);
  const dateTerm = Number(date.replaceAll("-", "")) % 10_000;
  return 1_000_000 + gameTerm * 100_000 + dateTerm;
}

function seed(game: Game, date: string): void {
  writePlayRecord(BUILDERS[game](date, elapsedFor(game, date)));
}

/**
 * Exactly what a per-card done chip is: one consumer of the shared reader,
 * mounted once per card. It renders what it read, so the assertion can be
 * about the record and not merely about survival.
 */
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

/** `n` (game, date) pairs, `GAMES.length` per date, all distinct. */
function pairs(n: number): { game: Game; date: string }[] {
  return Array.from({ length: n }, (_unused, i) => ({
    game: GAMES[i % GAMES.length] as Game,
    // 2026-07-01 upwards; `n / 4` distinct dates, ≤ 31 for every n used here.
    date: `2026-07-${String(Math.floor(i / GAMES.length) + 1).padStart(2, "0")}`,
  }));
}

/**
 * T-WEB-S214 (plan 043 §4 seam 2, ADR-0056 decision 1, step-6 blocker B2).
 *
 * THE PROPERTY IS "ANY N", AND IT IS EXERCISED RATHER THAN DECLARED. The
 * first repair replaced one cache slot with a `Map` bounded at 16 entries and
 * trimmed on the read path, and this test held a FLOOR under that constant
 * plus an inventory of call-site FILES. Both arms were green while bound + 1
 * live consumers reinstated the original defect — measured `Maximum update
 * depth exceeded` at 17, plain and in StrictMode — and the file inventory
 * could not see it coming, because the surface most likely to raise the mount
 * count (an archive month page, 31 × 4 = 124 consumers) reuses
 * `app/arquivo/day-card.tsx` and adds no file.
 *
 * So the bound is gone (`readSnapshot` can only ever ADD) and the assertion
 * is the property itself, at 4, 16, 17, 32 and 128 live consumers: no loop,
 * and every consumer reading ITS OWN record. 17 and 128 are on the list
 * because they are the two shapes the old bound failed at — one past it and
 * one far past it.
 *
 * THE SWEEP IS THE ONLY THING THAT DELETES, and both directions are asserted:
 * it cannot collect an entry a live consumer just read, and when it does
 * collect one the cost is exactly ONE re-render rather than a loop.
 *
 * The call-site inventory survives, under a DIFFERENT justification — there
 * is no bound left for it to force a re-derivation of. What a new consumer
 * file now owes is a read against the widened staleness window: an entry
 * lives as long as it is read, so a reader rendering a payload field that
 * `sameToTheReader` does not compare is handed a stale snapshot. That is the
 * hook's docblock's standing obligation, and this arm is what makes a new
 * reader arrive in front of it.
 */
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
      // A loop is `Maximum update depth exceeded`, but a cache thrashing just
      // below that is still a defect: a mount settles in one render each.
      for (const { game, date } of consumers)
        expect(renderCounts.get(`${game}|${date}`)).toBe(1);
    });
  }

  it("the sweep cannot collect an entry a live consumer has just read", () => {
    const consumers = pairs(GAMES.length * 2);
    for (const { game, date } of consumers) seed(game, date);
    // Read BEFORE the render, so every entry's `lastReadAt` is at or after it
    // and `beforeMount + SNAPSHOT_STALE_MS` is inside the window for all of
    // them — the boundary, deterministically, however long the mount takes.
    const beforeMount = Date.now();
    render(
      <>
        {consumers.map(({ game, date }) => (
          <Probe key={`${game}|${date}`} game={game} date={date} />
        ))}
      </>,
    );

    // Exactly what the poll does, one tick later: sweep, then notify.
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
    // And a doc block naming the hook is prose, not a call site.
    expect(code("/** calls useRecordSnapshot(game, date) */")).not.toContain(
      "useRecordSnapshot(",
    );
  });
});
