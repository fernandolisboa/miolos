import { describe, expect, it } from "vitest";

import { accentVars } from "../src/play/accent";
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

describe("the locked Sudoku key reads against the unlocked ones, in both themes (T-WEB-S594)", () => {
  const LOCKED = bodyOf(
    stylesheet("src/sudoku/sudoku-board.module.css"),
    '.keypadDigit[aria-pressed="true"]',
  );

  it("is filled with the accent and numbered in the ink on that accent", () => {
    expect(decl(LOCKED, "background")).toBe("var(--accent)");
    expect(decl(LOCKED, "color")).toBe("var(--ink-on-accent)");
    expect(accentVars("sudoku")).toMatchObject({
      "--accent": "var(--accent-sudoku)",
      "--ink-on-accent": "var(--paper-desk)",
    });
  });

  for (const theme of ["light", "dark"] as const) {
    it(`${theme}: the fill clears 3:1 on the unlocked key paper, and the numeral clears 3:1 on the fill`, () => {
      const tokens = colorTokens(theme);
      const hex = (name: string): string => {
        const value = tokens.get(name);
        if (value === undefined) {
          throw new Error(`${name} missing in ${theme}`);
        }
        return value;
      };

      expect(
        contrast(hex("--accent-sudoku"), hex("--paper-card")),
      ).toBeGreaterThanOrEqual(3);
      expect(
        contrast(hex("--paper-desk"), hex("--accent-sudoku")),
      ).toBeGreaterThanOrEqual(3);
    });
  }
});
