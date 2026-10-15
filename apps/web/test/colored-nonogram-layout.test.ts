import { generateColoredNonogram } from "@miolos/games/colored-nonogram";
import { describe, expect, it } from "vitest";

import {
  bodyOf,
  boardFloor,
  decl,
  pixels,
  stylesheet,
  token,
} from "./css-source";

const COLORED = stylesheet("src/colored-nonogram/colored-board.module.css");
const MONO = stylesheet("src/nonogram/nonogram-board.module.css");
const MOBILE = bodyOf(MONO, "@media (max-width: 768px)");
const SHARED_MOBILE = bodyOf(
  stylesheet("src/play/screen.module.css"),
  "@media (max-width: 768px)",
);

const DIGIT = 6.609375;
const SEEDS = Array.from({ length: 300 }, (_unused, seed) => seed);

function pair(value: string | undefined): readonly [number, number] {
  const [block = "", inline = block] = (value ?? "").split(/\s+/);
  return [pixels(block), pixels(inline)];
}

const [CHIP_PAD_BLOCK, CHIP_PAD_INLINE] = pair(
  decl(bodyOf(COLORED, ".chip"), "padding"),
);
const CHIP_FONT = pixels(decl(bodyOf(COLORED, ".chip"), "font-size"));
const CHIP_HEIGHT = CHIP_FONT + 2 * CHIP_PAD_BLOCK;
const chipWidth = (length: number) =>
  String(length).length * DIGIT + 2 * CHIP_PAD_INLINE;

const ROW_GAP = pixels(decl(bodyOf(MONO, ".clueCol"), "row-gap"));
const COL_RAIL_PAD = pixels(
  decl(bodyOf(MONO, ".clueCol"), "padding-block-end"),
);
const COLUMN_GAP = pixels(decl(bodyOf(MONO, ".clueRow"), "column-gap"));
const ROW_RAIL_PAD = pixels(
  decl(bodyOf(MONO, ".clueRow"), "padding-inline-end"),
);

function rails(size: number) {
  const puzzles = SEEDS.map((seed) => generateColoredNonogram(seed, size));
  const tall = (runs: readonly unknown[]) => {
    const n = Math.max(1, runs.length);
    return n * CHIP_HEIGHT + (n - 1) * ROW_GAP + COL_RAIL_PAD;
  };
  const wide = (runs: readonly { readonly length: number }[]) =>
    (runs.length === 0
      ? chipWidth(0)
      : runs.reduce((sum, run) => sum + chipWidth(run.length), 0)) +
    (Math.max(1, runs.length) - 1) * COLUMN_GAP +
    ROW_RAIL_PAD;
  return {
    overhang: Math.max(
      ...puzzles.map(
        ({ clues }) =>
          Math.max(...clues.cols.map(tall)) - Math.max(...clues.rows.map(wide)),
      ),
    ),
    rowRail: Math.max(...puzzles.flatMap(({ clues }) => clues.rows.map(wide))),
    longestColumnRun: Math.max(
      ...puzzles.flatMap(({ clues }) =>
        clues.cols.flatMap((runs) => runs.map((run) => run.length)),
      ),
    ),
    controls: Math.max(...puzzles.map(({ clues }) => clues.palette.length + 1)),
  };
}

const TOGGLE_CHROME =
  2 * token("--space-1") +
  2 * pixels(decl(bodyOf(MONO, ".brushToggle"), "border")?.split(" ")[0]);

describe("the coloured board fits: overhang, chips and palette at the 280px floor (T-WEB-S879)", () => {
  for (const size of [5, 10, 15] as const) {
    it(`size ${String(size)}: --board-overhang covers the tallest column rail over the widest row rail`, () => {
      const declared = pixels(
        decl(
          bodyOf(COLORED, `.pageColored.overhang${String(size)}`),
          "--board-overhang",
        ),
      );
      const { overhang } = rails(size);
      expect(declared).toBeGreaterThanOrEqual(overhang);
      expect(declared - overhang).toBeLessThan(3);
    });
  }

  it("keeps a one-digit column chip inside a 15×15 cell at the floor", () => {
    const { rowRail, longestColumnRun } = rails(15);
    const padding = pixels(decl(bodyOf(SHARED_MOBILE, ".gridCard"), "padding"));
    const cell = (boardFloor() - 2 * padding - 2 - rowRail) / 15;
    expect(longestColumnRun).toBeLessThan(10);
    expect(cell).toBeGreaterThanOrEqual(chipWidth(9));
  });

  it("narrows segments to 36×48 with a 2px gap, and the widest palette fits the floor", () => {
    const compact = bodyOf(MONO, ".brushToggleCompact > .control");
    const narrow = bodyOf(MOBILE, ".brushToggleNarrow > .control");
    expect([decl(compact, "width"), decl(compact, "height")]).toEqual([
      "36px",
      "48px",
    ]);
    expect(decl(narrow, "width")).toBe("36px");
    expect(decl(bodyOf(MOBILE, ".control"), "height")).toBe("48px");
    expect(decl(bodyOf(MONO, ".brushToggleCompact"), "gap")).toBe("2px");
    expect(decl(bodyOf(MOBILE, ".brushToggleNarrow"), "gap")).toBe("2px");

    const controls = Math.max(
      ...[5, 10, 15].map((size) => rails(size).controls),
    );
    expect(controls).toBeLessThanOrEqual(6);
    expect(
      controls * 36 + (controls - 1) * 2 + TOGGLE_CHROME,
    ).toBeLessThanOrEqual(boardFloor());
    const desktop = pixels(decl(bodyOf(MONO, ".control"), "width"));
    expect(
      4 * desktop + 3 * token("--space-1") + TOGGLE_CHROME,
    ).toBeLessThanOrEqual(boardFloor());
  });
});
