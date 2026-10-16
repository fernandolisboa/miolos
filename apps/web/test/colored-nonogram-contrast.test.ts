import { CONFUSABLE_TONE_PAIRS } from "@miolos/games/colored-nonogram";
import { PICTURE_TONES } from "@miolos/games/nonogram-colors";
import { describe, expect, it } from "vitest";

import { contrast, deltaE76, mixHex, type Vision } from "./contrast";
import { bodyOf, colorTokens, decl, stylesheet } from "./css-source";

const THEMES = ["light", "dark"] as const;

function hexIn(theme: (typeof THEMES)[number]) {
  const tokens = colorTokens(theme);
  return (name: string): string => {
    const value = tokens.get(name);
    if (value === undefined) {
      throw new Error(`${name} missing in ${theme}`);
    }
    return value;
  };
}

const COLORED = stylesheet("src/colored-nonogram/colored-board.module.css");
const NONOGRAM_SHEET = stylesheet("src/nonogram/nonogram-board.module.css");

const HAIRLINE = "1px solid color-mix(in srgb, var(--ink) 50%, transparent)";

describe("every tone carries its label, caret, ring and chip edge, and meets the paper on a hairline, in both themes (T-WEB-S875)", () => {
  for (const theme of THEMES) {
    it(`${theme}: each --ink-on-tone clears 4.5:1 on its tone, and the --ink chip edge clears 3:1 on the card`, () => {
      const hex = hexIn(theme);
      for (const tone of PICTURE_TONES) {
        expect(
          contrast(hex(`--ink-on-tone-${tone}`), hex(`--tone-${tone}`)),
          `${theme} ${tone}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
      expect(
        contrast(hex("--ink"), hex("--paper-card")),
      ).toBeGreaterThanOrEqual(3);
    });

    it(`${theme}: the ruled hairline edges every tone against the paper at 3:1 or more, and stays under 3:1 inside a run`, () => {
      const hex = hexIn(theme);
      const desk = hex("--paper-desk");
      const ink = hex("--ink");
      expect(contrast(mixHex(ink, desk, 0.5), desk)).toBeGreaterThanOrEqual(3);
      for (const tone of PICTURE_TONES) {
        const fill = hex(`--tone-${tone}`);
        const onTone = mixHex(ink, fill, 0.5);
        expect(
          contrast(onTone, desk),
          `${theme} ${tone}`,
        ).toBeGreaterThanOrEqual(3);
        expect(contrast(onTone, fill), `${theme} ${tone}`).toBeLessThan(3);
      }
    });
  }

  it("leaves a painted cell on the ruled field's hairline, and draws the chip numeral, the hint ring and the caret in the tone's ink", () => {
    expect(decl(bodyOf(NONOGRAM_SHEET, ".cell"), "border-top")).toBe(HAIRLINE);
    expect(decl(bodyOf(NONOGRAM_SHEET, ".cell"), "border-left")).toBe(HAIRLINE);
    expect(decl(bodyOf(COLORED, ".cellTone"), "box-shadow")).toBeUndefined();
    expect(decl(bodyOf(COLORED, ".cellTone"), "--wrong-edge")).toBe(
      "var(--cell-ink)",
    );
    expect(decl(bodyOf(COLORED, ".cellToneHinted"), "box-shadow")).toBe(
      "inset 0 0 0 2px var(--cell-ink)",
    );
    expect(decl(bodyOf(COLORED, ".chip"), "color")).toBe("var(--cell-ink)");
    expect(decl(bodyOf(COLORED, ".chip"), "box-shadow")).toBe(
      "inset 0 0 0 1px var(--ink)",
    );
    expect(decl(bodyOf(NONOGRAM_SHEET, ".cell:focus-visible"), "outline")).toBe(
      "2px solid var(--cell-ink, var(--ink))",
    );
  });
});

const MACHADO_2009: Readonly<Record<string, Vision>> = {
  normal: [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ],
  protan: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deutan: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritan: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
};

const CONFUSABLE_BELOW = 10;

function pairKey(a: string, b: string): string {
  return [a, b].sort().join("");
}

describe("the confusable tone pairs are exactly the token pairs a colour-blind player can mix up (T-WEB-S876)", () => {
  it(`lists every pair whose ΔE76 drops under ${String(CONFUSABLE_BELOW)} for any vision, in either theme`, () => {
    const measured: string[] = [];
    PICTURE_TONES.forEach((a, at) => {
      for (const b of PICTURE_TONES.slice(at + 1)) {
        const worst = Math.min(
          ...THEMES.flatMap((theme) => {
            const hex = hexIn(theme);
            return Object.values(MACHADO_2009).map((vision) =>
              deltaE76(hex(`--tone-${a}`), hex(`--tone-${b}`), vision),
            );
          }),
        );
        if (worst < CONFUSABLE_BELOW) {
          measured.push(pairKey(a, b));
        }
      }
    });

    expect(measured.sort()).toEqual(
      CONFUSABLE_TONE_PAIRS.map(([a, b]) => pairKey(a, b)).sort(),
    );
  });
});
