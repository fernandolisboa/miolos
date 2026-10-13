import { describe, expect, it } from "vitest";

import { contrast } from "./contrast";
import { bodyOf, colorTokens, decl, stylesheet } from "./css-source";

const MARK = decl(
  bodyOf(stylesheet("src/play/wrong-mark.module.css"), ".mark"),
  "background",
);

const SURFACES = [
  "--paper-desk",
  "--paper-card",
  "--paper-tint",
  "--accent-sudoku",
  "--accent-nonogram",
  "--accent-binairo",
  "--accent-crossword",
  "--accent-queens",
  ...Array.from(
    { length: 9 },
    (_unused, at) => `--queens-region-${String(at + 1)}`,
  ),
];

describe("the wrong-cell flag reads on every surface it can sit on, in both themes (T-WEB-S594)", () => {
  it("is drawn from the error red and the card paper", () => {
    expect(MARK).toContain("var(--accent-app)");
    expect(MARK).toContain("var(--paper-card)");
  });

  for (const theme of ["light", "dark"] as const) {
    it(`${theme}: the red clears 3:1 on the paper band, and the band or the red clears 3:1 on each surface`, () => {
      const tokens = colorTokens(theme);
      const hex = (name: string): string => {
        const value = tokens.get(name);
        if (value === undefined) {
          throw new Error(`${name} missing in ${theme}`);
        }
        return value;
      };
      const red = hex("--accent-app");
      const paper = hex("--paper-card");

      expect(contrast(red, paper)).toBeGreaterThanOrEqual(3);
      for (const surface of SURFACES) {
        const best = Math.max(
          contrast(paper, hex(surface)),
          contrast(red, hex(surface)),
        );
        expect(best, `${theme} ${surface}`).toBeGreaterThanOrEqual(3);
      }
    });
  }
});
