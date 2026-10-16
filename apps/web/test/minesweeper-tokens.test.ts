import { describe, expect, it } from "vitest";

import { colorTokens, bodyOf, stylesheet } from "./css-source";
import { contrast } from "./contrast";

const NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

describe("Campo Minado's accent and number family are tokens, in every theme, and read as text (T-WEB-S883)", () => {
  for (const theme of ["light", "dark"] as const) {
    const tokens = colorTokens(theme);
    const hex = (name: string): string => {
      const value = tokens.get(name);
      if (value === undefined) {
        throw new Error(`${name} missing from the ${theme} block`);
      }
      return value;
    };

    it(`${theme}: each of the eight numbers clears 4.5:1 on the open cell`, () => {
      for (const n of NUMBERS) {
        expect(
          contrast(hex(`--mine-${String(n)}`), hex("--cell-open")),
          `--mine-${String(n)}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    });

    it(`${theme}: ink reads on the covered and the open cell, and the two are told apart`, () => {
      for (const paper of ["--cell-open", "--cell-cover"]) {
        expect(
          contrast(hex("--ink"), hex(paper)),
          `--ink on ${paper}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
      expect(
        contrast(hex("--cell-cover"), hex("--cell-open")),
      ).toBeGreaterThanOrEqual(1.25);
    });

    it(`${theme}: the eight numbers are eight different colours`, () => {
      const colours = NUMBERS.map((n) => hex(`--mine-${String(n)}`));
      expect(new Set(colours).size).toBe(8);
    });

    it(`${theme}: carries the accent`, () => {
      expect(hex("--accent-minesweeper")).toMatch(/^#[0-9A-F]{6}$/);
    });
  }

  it("repeats the tokens in the media-query dark block, the same values as the explicit one", () => {
    const css = stylesheet("../../packages/ui/tokens.css");
    const media = bodyOf(
      bodyOf(css, "@media (prefers-color-scheme: dark)"),
      ':root:not([data-theme="light"])',
    );
    const explicit = bodyOf(css, ':root[data-theme="dark"]');
    for (const name of [
      "--accent-minesweeper",
      "--cell-cover",
      "--cell-open",
      ...NUMBERS.map((n) => `--mine-${String(n)}`),
    ]) {
      const pick = (body: string) =>
        new RegExp(`${name}:\\s*([^;]+);`).exec(body)?.[1];
      expect(pick(media), name).toBeDefined();
      expect(pick(media), name).toBe(pick(explicit));
    }
  });
});
