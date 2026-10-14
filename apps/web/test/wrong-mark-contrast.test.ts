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

describe("the tallied Sudoku keys read in both themes (T-WEB-S652)", () => {
  const SHEET = stylesheet("src/sudoku/sudoku-board.module.css");
  const MIX =
    /^color-mix\(in srgb, var\((--[\w-]+)\) (\d+)%, var\((--[\w-]+)\)\)$/;

  for (const theme of ["light", "dark"] as const) {
    it(`${theme}: the complete key is dimmer than an open key and above 3:1; the over key and both pressed keys clear 3:1`, () => {
      const tokens = colorTokens(theme);
      const hex = (name: string): string => {
        const value = tokens.get(name);
        if (value === undefined) {
          throw new Error(`${name} missing in ${theme}`);
        }
        return value;
      };
      const paint = (value: string): string => {
        const mixed = MIX.exec(value);
        if (mixed === null) {
          return hex(/^var\((--[\w-]+)\)$/.exec(value)?.[1] ?? value);
        }
        const [, top = "", share = "0", base = ""] = mixed;
        const weight = Number(share) / 100;
        return `#${[1, 3, 5]
          .map((at) =>
            Math.round(
              parseInt(hex(top).slice(at, at + 2), 16) * weight +
                parseInt(hex(base).slice(at, at + 2), 16) * (1 - weight),
            )
              .toString(16)
              .padStart(2, "0"),
          )
          .join("")}`;
      };
      const rule = (selector: string, property: string): string => {
        const value = decl(bodyOf(SHEET, selector), property);
        if (value === undefined) {
          throw new Error(`${selector} sets no ${property}`);
        }
        return paint(value);
      };
      const card = hex("--paper-card");
      const open = contrast(hex("--accent-sudoku"), card);
      const complete = contrast(rule(".keypadComplete", "color"), card);

      expect(complete).toBeGreaterThanOrEqual(3);
      expect(complete).toBeLessThan(open);
      expect(
        contrast(rule(".keypadOver", "color"), card),
      ).toBeGreaterThanOrEqual(3);
      for (const pressed of [".keypadComplete", ".keypadOver"]) {
        const selector = `${pressed}[aria-pressed="true"]`;
        expect(
          contrast(rule(selector, "color"), rule(selector, "background")),
          selector,
        ).toBeGreaterThanOrEqual(3);
      }
    });
  }
});
