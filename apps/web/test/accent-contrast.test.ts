import { describe, expect, it } from "vitest";

import type { Game } from "@miolos/core";

import { accentVars } from "../src/play/accent";
import { colorTokens } from "./css-source";
import { contrast, luminance } from "./contrast";

const GAMES: readonly Game[] = ["termo", "sudoku", "nonogram", "binairo"];

function contrastTools(theme: "light" | "dark") {
  const tokens = colorTokens(theme);

  function hexOf(token: string): string {
    const hex = tokens.get(token);
    if (hex === undefined) {
      throw new Error(`token ${token} not found in the ${theme} block`);
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

  function pair(game: Game): { accent: string; ink: string } {
    const vars = accentVars(game);
    return {
      accent: resolveVar(String(vars["--accent"])),
      ink: resolveVar(String(vars["--ink-on-accent"])),
    };
  }

  return { hexOf, resolveVar, pair };
}

const LIGHT = contrastTools("light");
const DARK = contrastTools("dark");

describe("every game's filled-surface label clears AA on its own fill (T-WEB-S299)", () => {
  it("computes >= 4.5:1 for each game's --ink-on-accent ON its accent", () => {
    for (const game of GAMES) {
      const { accent, ink } = LIGHT.pair(game);
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
      const { accent, ink } = LIGHT.pair(game);
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
      const { accent, ink } = LIGHT.pair(game);
      const ceiling = (luminance(ink) + 0.05) / 4.5 - 0.05;
      expect(luminance(accent), game).toBeLessThanOrEqual(ceiling);
    }
  });
});

describe("the non-text floors hold at the new value (T-WEB-S301)", () => {
  it("keeps every accent >= 3:1 against desk paper, the fill's own edge", () => {
    const desk = LIGHT.hexOf("--paper-desk");
    for (const game of GAMES) {
      expect(
        contrast(LIGHT.pair(game).accent, desk),
        game,
      ).toBeGreaterThanOrEqual(3);
    }
  });

  it("keeps the Termo tile's --ink border >= 3:1 on the deep fill", () => {
    expect(
      contrast(LIGHT.hexOf("--ink"), LIGHT.hexOf("--accent-termo")),
    ).toBeGreaterThanOrEqual(3);
  });
});

describe("the ink-on-accent fallback holds in dark, too (T-WEB-S72a)", () => {
  it("clears >= 4.5:1 for the worst-case dark accent, the value every `var(--ink-on-accent, var(--paper-desk))` fallback in ink-on-accent.test.ts falls back to", () => {
    const desk = DARK.hexOf("--paper-desk");
    const worst = Math.min(
      ...GAMES.map((game) => contrast(desk, DARK.pair(game).accent)),
    );
    expect(worst).toBeGreaterThanOrEqual(4.5);
  });
});

describe("the accent-app border family clears the non-text floor in dark, too (T-WEB-S73a)", () => {
  it("keeps --accent-app >= 3:1 against both papers its ACCENT_BORDERS sites sit on", () => {
    const accentApp = DARK.hexOf("--accent-app");
    expect(
      contrast(accentApp, DARK.hexOf("--paper-desk")),
    ).toBeGreaterThanOrEqual(3);
    expect(
      contrast(accentApp, DARK.hexOf("--paper-card")),
    ).toBeGreaterThanOrEqual(3);
  });
});

describe("every game's filled-surface label clears AA on its own fill, dark (T-WEB-S299a)", () => {
  it("computes >= 4.5:1 for each game's --ink-on-accent ON its accent", () => {
    for (const game of GAMES) {
      const { accent, ink } = DARK.pair(game);
      expect(
        contrast(ink, accent),
        `${game}: ${ink} on ${accent}`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe("the paper label inverts in dark: dark ink on a lighter fill (T-WEB-S300a)", () => {
  it("keeps every accent's luminance high enough for EITHER dark paper label to clear 4.5:1", () => {
    for (const game of GAMES) {
      const accent = DARK.pair(game).accent;
      for (const label of ["--paper-desk", "--paper-card"] as const) {
        expect(
          contrast(DARK.hexOf(label), accent),
          `${game} vs ${label}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});

describe("the non-text floors hold at the new value, dark (T-WEB-S301a)", () => {
  it("keeps every accent >= 3:1 against desk paper, the fill's own edge", () => {
    const desk = DARK.hexOf("--paper-desk");
    for (const game of GAMES) {
      expect(
        contrast(DARK.pair(game).accent, desk),
        game,
      ).toBeGreaterThanOrEqual(3);
    }
  });

  it("keeps the Termo tile's --ink border >= 3:1 on the deep fill", () => {
    expect(
      contrast(DARK.hexOf("--ink"), DARK.hexOf("--accent-termo")),
    ).toBeGreaterThanOrEqual(3);
  });
});

function colorMix10(accentHex: string, paperHex: string): string {
  const channel = (hex: string, index: number): number =>
    parseInt(hex.slice(index, index + 2), 16);
  return (
    "#" +
    [1, 3, 5]
      .map((index) =>
        Math.round(
          channel(accentHex, index) * 0.1 + channel(paperHex, index) * 0.9,
        )
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}

describe("the two .cellHinted sites keep their hint glyph readable on its own 10%-accent tint, dark (T-WEB-S395)", () => {
  it("clears >= 4.5:1 for --accent-sudoku-text and --accent-binairo-text on color-mix(accent 10%, --paper-desk)", () => {
    for (const name of ["sudoku", "binairo"] as const) {
      const accent = DARK.hexOf(`--accent-${name}`);
      const text = DARK.hexOf(`--accent-${name}-text`);
      const background = colorMix10(accent, DARK.hexOf("--paper-desk"));
      expect(contrast(text, background), name).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("stays under 4.5:1 for the plain accent on the same background — the reason the -text token exists", () => {
    for (const name of ["sudoku", "binairo"] as const) {
      const accent = DARK.hexOf(`--accent-${name}`);
      const background = colorMix10(accent, DARK.hexOf("--paper-desk"));
      expect(contrast(accent, background), name).toBeLessThan(4.5);
    }
  });
});
