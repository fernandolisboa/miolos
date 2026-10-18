import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { deriveColoredClues } from "../../src/colored-nonogram/clues";
import { coloredRuns } from "../../src/colored-nonogram/index";
import { FC_SEED } from "../daily-arbitraries";

describe("deriveColoredClues", () => {
  it("same-tone runs keep a gap, different tones touch", () => {
    const tones = ["bb.b", "rbb.", "...r", "r..r"].join("");

    expect(deriveColoredClues(4, tones)).toEqual({
      size: 4,
      palette: ["r", "b"],
      rows: [
        [
          { tone: 2, length: 2 },
          { tone: 2, length: 1 },
        ],
        [
          { tone: 1, length: 1 },
          { tone: 2, length: 2 },
        ],
        [{ tone: 1, length: 1 }],
        [
          { tone: 1, length: 1 },
          { tone: 1, length: 1 },
        ],
      ],
      cols: [
        [
          { tone: 2, length: 1 },
          { tone: 1, length: 1 },
          { tone: 1, length: 1 },
        ],
        [{ tone: 2, length: 2 }],
        [{ tone: 2, length: 1 }],
        [
          { tone: 2, length: 1 },
          { tone: 1, length: 2 },
        ],
      ],
    });
  });
});

describe("coloredRuns", () => {
  it("only matches a line's runs on a subset of its painted cells when the subset is all of them", () => {
    fc.assert(
      fc.property(
        fc
          .array(fc.integer({ min: 0, max: 3 }), {
            minLength: 1,
            maxLength: 10,
          })
          .chain((line) =>
            fc.tuple(
              fc.constant(line),
              fc.array(fc.boolean(), {
                minLength: line.length,
                maxLength: line.length,
              }),
            ),
          ),
        ([line, kept]) => {
          const subset = line.map((tone, k) => (kept[k] === true ? tone : 0));
          if (
            JSON.stringify(coloredRuns(subset)) ===
            JSON.stringify(coloredRuns(line))
          ) {
            expect(subset).toEqual(line);
          }
        },
      ),
      { seed: FC_SEED, numRuns: 500 },
    );
  });
});
