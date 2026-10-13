import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  generateQueens,
  nextQueensStep,
  type QueensBoard,
  type QueensElimination,
  type QueensPuzzle,
  type QueensStep,
  type QueensUnit,
} from "../../src/queens/index";
import { FC_SEED, seedArb, weekdayArb } from "../daily-arbitraries";
import { board, entries } from "./fixtures";

type Entries = readonly (0 | 1 | null)[];

const revealArb = fc.array(fc.nat({ max: 3 }), {
  minLength: 81,
  maxLength: 81,
});

function unitsOf(size: number): QueensUnit[] {
  const kinds = ["row", "column", "region"] as const;
  return kinds.flatMap((kind) =>
    Array.from({ length: size }, (_, index) => ({ kind, index })),
  );
}

function unitCells(
  { size, regions }: QueensBoard,
  { kind, index }: QueensUnit,
): number[] {
  return regions.flatMap((region, cell) => {
    const at =
      kind === "row"
        ? Math.floor(cell / size)
        : kind === "column"
          ? cell % size
          : region;
    return at === index ? [cell] : [];
  });
}

function touches({ size, regions }: QueensBoard, a: number, b: number) {
  const rows = Math.abs(Math.floor(a / size) - Math.floor(b / size));
  const cols = Math.abs((a % size) - (b % size));
  return (
    a !== b &&
    (rows === 0 ||
      cols === 0 ||
      regions[a] === regions[b] ||
      (rows === 1 && cols === 1))
  );
}

function freeIn(target: QueensBoard, marks: Entries, cells: number[]) {
  return cells.filter(
    (cell) =>
      marks[cell] === null &&
      !marks.some((mark, queen) => mark === 1 && touches(target, queen, cell)),
  );
}

function firstSingle(target: QueensBoard, marks: Entries): QueensUnit | null {
  const open = unitsOf(target.size).filter((unit) =>
    unitCells(target, unit).every((cell) => marks[cell] !== 1),
  );
  return (
    open.find(
      (unit) => freeIn(target, marks, unitCells(target, unit)).length === 1,
    ) ?? null
  );
}

function expectHonest(puzzle: QueensPuzzle, marks: Entries, step: QueensStep) {
  const cells = unitCells(puzzle, step.unit);
  expect(puzzle.solution[step.index]).toBe(1);
  expect(marks[step.index]).toBeNull();
  expect(step.cells).toEqual(cells);
  if (step.after === null) {
    expect(firstSingle(puzzle, marks)).toEqual(step.unit);
    expect(freeIn(puzzle, marks, cells)).toEqual([step.index]);
  } else {
    expect(firstSingle(puzzle, marks)).toBeNull();
  }
}

function walk(puzzle: QueensPuzzle, start: Entries): void {
  const marks = [...start];
  for (
    let placed = marks.filter((mark) => mark === 1).length;
    placed < puzzle.size;
    placed += 1
  ) {
    const step = nextQueensStep(puzzle, marks);
    expect(step).not.toBeNull();
    expectHonest(puzzle, marks, step!);
    marks[step!.index] = 1;
  }
  expect(nextQueensStep(puzzle, marks)).toBeNull();
}

const SINGLES = [
  {
    name: "a row",
    regions: "0001222 0000220 0300200 0000400 5000000 0000000 0000006",
    marks: "...Q... .....Q. .Q..... ....Q.. Q...... ....... ......Q",
    index: 37,
    unit: { kind: "row", index: 5 },
  },
  {
    name: "a column",
    regions: "0000000 0100000 0023000 0023040 0223300 5222306 2222366",
    marks: "....... .Q..... ...Q... .....Q. ....... ....... .......",
    index: 4,
    unit: { kind: "column", index: 4 },
  },
  {
    name: "a region",
    regions: "0001222 0000220 0300200 0000400 5000000 0000000 0000006",
    marks: "....... ....... ....... ....... ....... ....... .......",
    index: 3,
    unit: { kind: "region", index: 1 },
  },
  {
    name: "a region the player's X's leave with one cell",
    regions: "0001112 0001122 0331111 3331415 3311155 1115556 1115556",
    marks: "......x ......x ......x ....Q.. ......x ....... .......",
    index: 12,
    unit: { kind: "region", index: 2 },
  },
] as const;

const ELIMINATIONS: readonly {
  readonly board: string;
  readonly regions: string;
  readonly marks: string;
  readonly index: number;
  readonly unit: QueensUnit;
  readonly after: QueensElimination;
}[] = [
  {
    board: "a region confined to one row",
    regions: "0001122 3111112 3311111 3114111 3334441 3354441 3354641",
    marks: "....... ....... ....... ....... ....... ..Q.... ....Q..",
    index: 13,
    unit: { kind: "region", index: 2 },
    after: "regionInRow",
  },
  {
    board: "a region confined to one column",
    regions: "0001112 0001122 0331111 3331415 3311155 1115556 1115556",
    marks: "....... ....... ....... ....Q.. ....... ....... .......",
    index: 12,
    unit: { kind: "region", index: 2 },
    after: "regionInColumn",
  },
  {
    board: "a row confined to one region",
    regions: "0000122 0330122 2322222 2222245 2222255 2226555 2255555",
    marks: "....... ....... ....... .....Q. ....... ...Q... ......Q",
    index: 15,
    unit: { kind: "row", index: 2 },
    after: "rowInRegion",
  },
  {
    board: "a column confined to one region",
    regions: "0001222 0300022 3300222 4400022 4000222 0050022 0000026",
    marks: "...Q... ....... ....... ....... ....... ..Q.... ......Q",
    index: 25,
    unit: { kind: "column", index: 4 },
    after: "columnInRegion",
  },
  {
    board: "a cell that would empty a unit",
    regions: "0001111 0200111 3330141 3333445 3334455 3344454 6644444",
    marks: "....... .Q..... ...Q... ....... ..Q.... ....... Q......",
    index: 27,
    unit: { kind: "row", index: 3 },
    after: "blocking",
  },
  {
    board: "regionInRow then regionInColumn, a tie the first wins",
    regions: "0001222 0003222 0003324 0533324 4533344 4663344 4444444",
    marks: "...Q... ....... ....... ....... ....... ....... .......",
    index: 37,
    unit: { kind: "row", index: 5 },
    after: "regionInRow",
  },
  {
    board:
      "blocking, blocking, regionGroupRows, regionInColumn, the hardest not the last",
    regions:
      "001111111 001111122 033441522 334444552 364445555 664455575 688777777 688877777 688777777",
    marks:
      "......... ......... ..Q...... ........Q ......... ......... ......... ......... .........",
    index: 1,
    unit: { kind: "region", index: 0 },
    after: "regionGroupRows",
  },
  {
    board: "regionGroupColumns before a later regionGroupRows, a tier-3 tie",
    regions:
      "011111111 011112111 001112111 003122244 003352244 003655444 766655584 766555544 776555544",
    marks:
      "........x .x......x ...x....x ...xx.... .xx...... ..x...... .......Q. .x.x..... ...x.....",
    index: 23,
    unit: { kind: "region", index: 2 },
    after: "regionGroupColumns",
  },
];

describe("nextQueensStep", () => {
  it.each(SINGLES)(
    "names $name with one open cell, with no elimination",
    ({ regions, marks, index, unit }) => {
      const target = board(regions);

      expect(nextQueensStep(target, entries(marks))).toEqual({
        index,
        unit,
        cells: unitCells(target, unit),
        after: null,
      });
    },
  );

  it.each(ELIMINATIONS)(
    "names $after as the elimination behind the queen on $board",
    ({ regions, marks, index, unit, after }) => {
      const target = board(regions);

      expect(nextQueensStep(target, entries(marks))).toEqual({
        index,
        unit,
        cells: unitCells(target, unit),
        after,
      });
    },
  );

  it("returns null when every queen is placed or a unit is dead", () => {
    const monday = board(
      "0000112 0030111 3431111 3331111 3351111 3331111 3331161",
    );
    expect(
      nextQueensStep(
        monday,
        entries("......Q ...Q... .Q..... ....Q.. ..Q.... Q...... .....Q."),
      ),
    ).toBeNull();
    expect(
      nextQueensStep(
        monday,
        entries("xxxxxxx ....... ....... ....... ....... ....... ......."),
      ),
    ).toBeNull();
  });

  it("returns null where the ladder stalls, short of the queens of a board beyond it", () => {
    const beyond = board(
      "0111121 0111111 0011113 4005111 4555661 4445611 4446611",
    );
    const solution = [5, 9, 20, 22, 31, 35, 46];
    const marks: (0 | 1 | null)[] = beyond.regions.map(() => null);
    for (
      let step = nextQueensStep(beyond, marks);
      step !== null;
      step = nextQueensStep(beyond, marks)
    ) {
      expect(solution).toContain(step.index);
      marks[step.index] = 1;
    }

    expect(marks.filter((mark) => mark === 1).length).toBeLessThan(7);
  });

  it("gives the same step for the same board", () => {
    const puzzle = generateQueens({ seed: 297, weekday: 7 });
    const bare = puzzle.regions.map(() => null);

    expect(nextQueensStep(puzzle, bare)).toEqual(nextQueensStep(puzzle, bare));
  });

  // ADR-0055: worst 2440 ms × 4 → 10 s.
  it("walks every daily to its solution one honest queen at a time, bare and from correct partial boards", () => {
    fc.assert(
      fc.property(seedArb, weekdayArb, revealArb, (seed, weekday, reveal) => {
        const puzzle = generateQueens({ seed, weekday });
        walk(
          puzzle,
          puzzle.regions.map(() => null),
        );
        walk(
          puzzle,
          puzzle.solution.map((value, cell) =>
            reveal[cell] === 0 ? value : null,
          ),
        );
      }),
      { seed: FC_SEED, numRuns: 100 },
    );
  }, 10_000);
});
