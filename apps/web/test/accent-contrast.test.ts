import { describe, expect, it } from "vitest";

import type { Game } from "@miolos/core";

import { accentVars } from "../src/play/accent";
import { stylesheet } from "./css-source";

/**
 * The gate on ADR-0067 (#161) — the family contrast arithmetic, computed
 * rather than trusted.
 *
 * Fernando's #161 finding was that the Termo hub card read as the odd one
 * out: a light mustard fill with a dark label beside three deep fills with
 * light labels. The root was one number — `--accent-termo` #C08A1E's
 * relative luminance, nearly double the next-lightest game accent — and the
 * fix is one number too: the token deepened to #8D6212 so `--paper-desk` ON
 * it clears PRODUCT.md's 4.5:1, and `accentVars("termo")` joined the other
 * three on a light paper label.
 *
 * The T-WEB-S230 idiom, cited as precedent: resolve the real tokens from
 * `packages/ui/tokens.css` at run time (never a hex copied into the test,
 * which would go stale the day the token moves) and run the arithmetic the
 * browser's own contrast check would. ADR-0041 consequence (h) closed with
 * "this table is the thing to recompute rather than trust" — this file is
 * that recomputation, mechanical, on every gate run. jsdom resolves no
 * custom property and composites nothing, so the WCAG 2.x math lives here
 * in full; its control is that it reproduces ADR-0041's shipped figures
 * exactly (sudoku 7.5113:1, binairo 5.3066:1), asserted below.
 */

/** `--<name>: #HEX;` pairs from `packages/ui/tokens.css`, comments stripped. */
const TOKENS: ReadonlyMap<string, string> = (() => {
  const css = stylesheet("../../packages/ui/tokens.css");
  const map = new Map<string, string>();
  for (const match of css.matchAll(/(--[\w-]+)\s*:\s*(#[0-9A-Fa-f]{6})\s*;/g)) {
    const name = match[1];
    const hex = match[2];
    // Both groups are unconditional in the pattern; the guard is what
    // `noUncheckedIndexedAccess` wants to see rather than a real branch.
    if (name !== undefined && hex !== undefined) {
      map.set(name, hex.toUpperCase());
    }
  }
  // A silent empty map would turn every assertion below into arithmetic
  // over `undefined`. Fail the file at import instead.
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

/** Resolves `var(--x)` from an `accentVars` value to its hex. */
function resolveVar(value: string): string {
  const match = /^var\((--[\w-]+)\)$/.exec(value);
  if (match?.[1] === undefined) {
    throw new Error(`not a single var() reference: ${value}`);
  }
  return hexOf(match[1]);
}

/** WCAG 2.x relative luminance of a 6-digit hex colour. */
function luminance(hex: string): number {
  const channel = (index: number): number => {
    const srgb = parseInt(hex.slice(index, index + 2), 16) / 255;
    return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/** WCAG 2.x contrast ratio between two hex colours. */
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
    // The shipped record: sudoku and binairo from ADR-0041 consequence (h),
    // nonogram from ISS-A2's fix, termo from ADR-0067 decision 1. A drift
    // here means either a token moved (re-run the sweep, ADR-0041 (h)'s own
    // closing instruction) or this file's math broke — both are findings.
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
    // #161's harmonization, pinned in shape rather than in hue: a game whose
    // fill is too light for any paper label (the old mustard) cannot rejoin
    // the palette without reopening ADR-0067. ADR-0041 decision 2's range is
    // untouched — this asserts the shipped VALUES, not a narrowed range.
    for (const game of GAMES) {
      const value = String(accentVars(game)["--ink-on-accent"]);
      expect(value, game).toMatch(/^var\(--paper-[a-z]+\)$/);
    }
  });

  it("keeps every accent's luminance below the light-label ceiling", () => {
    // The label floor restated as a bound on the token itself: a paper label
    // needs L(accent) <= (L(paper) + 0.05) / 4.5 - 0.05. For desk paper that
    // is 0.15925; card is looser. Asserted against each game's OWN paper so
    // the bound is exact, not approximate.
    for (const game of GAMES) {
      const { accent, ink } = pair(game);
      const ceiling = (luminance(ink) + 0.05) / 4.5 - 0.05;
      expect(luminance(accent), game).toBeLessThanOrEqual(ceiling);
    }
  });
});

describe("the non-text floors hold at the new value (T-WEB-S301)", () => {
  it("keeps every accent >= 3:1 against desk paper, the fill's own edge", () => {
    // The old mustard FAILED this (2.7311:1, ADR-0041's context table): its
    // fills were below WCAG 1.4.11's floor against the desk around them and
    // needed a border or mark as the carrier. Since ADR-0067 the whole
    // family clears it.
    const desk = hexOf("--paper-desk");
    for (const game of GAMES) {
      expect(contrast(pair(game).accent, desk), game).toBeGreaterThanOrEqual(3);
    }
  });

  it("keeps the Termo tile's --ink border >= 3:1 on the deep fill", () => {
    // `.tileCorrect` / `.keyCorrect` draw an `--ink` border ON the accent
    // fill as the state's border carrier. 3.0996:1 at #8D6212 — and this
    // bound is why ADR-0067 rejected the darker candidates (#8A5F0F was
    // 2.97:1): the token is pinched between this floor and T-WEB-S300's
    // label ceiling, so a future nudge reds one side or the other here
    // rather than shipping quietly.
    expect(
      contrast(hexOf("--ink"), hexOf("--accent-termo")),
    ).toBeGreaterThanOrEqual(3);
  });
});
