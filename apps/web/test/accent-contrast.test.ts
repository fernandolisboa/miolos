import { describe, expect, it } from "vitest";

import type { Game } from "@miolos/core";

import { accentVars } from "../src/play/accent";
import { stylesheet } from "./css-source";

const TOKENS: ReadonlyMap<string, string> = (() => {
  const css = stylesheet("../../packages/ui/tokens.css");
  const map = new Map<string, string>();
  for (const match of css.matchAll(/(--[\w-]+)\s*:\s*(#[0-9A-Fa-f]{6})\s*;/g)) {
    const name = match[1];
    const hex = match[2];

    if (name !== undefined && hex !== undefined) {
      map.set(name, hex.toUpperCase());
    }
  }

  if (map.size === 0) {
    throw new Error("no colour tokens resolved from packages/ui/tokens.css");
  }
  return map;
})();

function hexOf(token: string): string {
  const hex = TOKENS.get(token);
  if (hex === undefined) {
    throw new Error(`token ${token} not found in packages/ui/tokens.css`);
  }
  return hex;
}

function resolveVar(value: string): string {
  const match = /^var\((--[\w-]+)\)$/.exec(value);
  if (match?.[1] === undefined) {
    throw new Error(`not a single var() reference: ${value}`);
  }
  return hexOf(match[1]);
}

function luminance(hex: string): number {
  const channel = (index: number): number => {
    const srgb = parseInt(hex.slice(index, index + 2), 16) / 255;
    return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (hi + 0.05) / (lo + 0.05);
}

const GAMES: readonly Game[] = ["termo", "sudoku", "nonogram", "binairo"];

function pair(game: Game): { accent: string; ink: string } {
  const vars = accentVars(game);
  return {
    accent: resolveVar(String(vars["--accent"])),
    ink: resolveVar(String(vars["--ink-on-accent"])),
  };
}

describe("every game's filled-surface label clears AA on its own fill (T-WEB-S299)", () => {
  it("computes >= 4.5:1 for each game's --ink-on-accent ON its accent", () => {
    for (const game of GAMES) {
      const { accent, ink } = pair(game);
      expect(
        contrast(ink, accent),
        `${game}: ${ink} on ${accent}`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("reproduces the recorded figures, as its own control", () => {
    const recorded: Readonly<Record<Game, number>> = {
      sudoku: 7.5113,
      binairo: 5.3066,
      nonogram: 4.5063,
      termo: 4.8433,
    };
    for (const game of GAMES) {
      const { accent, ink } = pair(game);
      expect(contrast(ink, accent), game).toBeCloseTo(recorded[game], 3);
    }
  });
});

describe("the four cards carry one family treatment: deep fill, light paper label (T-WEB-S300)", () => {
  it("resolves every game's --ink-on-accent to a paper token", () => {
    for (const game of GAMES) {
      const value = String(accentVars(game)["--ink-on-accent"]);
      expect(value, game).toMatch(/^var\(--paper-[a-z]+\)$/);
    }
  });

  it("keeps every accent's luminance below the light-label ceiling", () => {
    for (const game of GAMES) {
      const { accent, ink } = pair(game);
      const ceiling = (luminance(ink) + 0.05) / 4.5 - 0.05;
      expect(luminance(accent), game).toBeLessThanOrEqual(ceiling);
    }
  });
});

describe("the non-text floors hold at the new value (T-WEB-S301)", () => {
  it("keeps every accent >= 3:1 against desk paper, the fill's own edge", () => {
    const desk = hexOf("--paper-desk");
    for (const game of GAMES) {
      expect(contrast(pair(game).accent, desk), game).toBeGreaterThanOrEqual(3);
    }
  });

  it("keeps the Termo tile's --ink border >= 3:1 on the deep fill", () => {
    expect(
      contrast(hexOf("--ink"), hexOf("--accent-termo")),
    ).toBeGreaterThanOrEqual(3);
  });
});
