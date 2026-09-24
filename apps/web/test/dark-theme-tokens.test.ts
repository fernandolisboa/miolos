import { describe, expect, it } from "vitest";

import { bodyOf, colorTokens, stylesheet } from "./css-source";

function normalize(body: string): string {
  return body
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join("\n");
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

describe("the two dark blocks stay byte-identical and every light colour token has a dark twin (T-WEB-S390)", () => {
  const css = stylesheet("../../packages/ui/tokens.css");

  it("keeps the media-query block and the [data-theme] block the same, once indentation is stripped", () => {
    const mediaQuery = bodyOf(
      bodyOf(css, "@media (prefers-color-scheme: dark)"),
      ':root:not([data-theme="light"])',
    );
    const attribute = bodyOf(css, ':root[data-theme="dark"]');
    expect(normalize(mediaQuery)).toBe(normalize(attribute));
  });

  it("gives every plain light colour token a dark twin, and vice versa", () => {
    const isTextToken = (name: string): boolean => name.endsWith("-text");
    const light = [...colorTokens("light").keys()].filter(
      (name) => !isTextToken(name),
    );
    const dark = [...colorTokens("dark").keys()].filter(
      (name) => !isTextToken(name),
    );
    expect(dark.sort()).toEqual(light.sort());
  });

  it("spells the light accent-*-text tokens through var(), never a literal (their dark twins are pinned at T-WEB-S395)", () => {
    const light = bodyOf(css, ":root");
    expect(light).toContain("--accent-sudoku-text: var(--accent-sudoku);");
    expect(light).toContain("--accent-binairo-text: var(--accent-binairo);");
  });
});

describe("the dark paper floors hold (T-WEB-S391)", () => {
  const dark = colorTokens("dark");
  const hexOf = (name: string): string => {
    const hex = dark.get(name);
    if (hex === undefined) {
      throw new Error(`token ${name} missing from the dark block`);
    }
    return hex;
  };
  const papers = ["--paper-desk", "--paper-card", "--paper-tint"] as const;

  it("keeps --ink and --ink-2 >= 4.5:1 on every paper", () => {
    for (const ink of ["--ink", "--ink-2"] as const) {
      for (const paper of papers) {
        expect(
          contrast(hexOf(ink), hexOf(paper)),
          `${ink} on ${paper}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("keeps --ink at 50% over --paper-card >= 3:1, the hairline floor", () => {
    const ink = hexOf("--ink").slice(1);
    const card = hexOf("--paper-card").slice(1);
    const mixed = [0, 2, 4]
      .map((offset) => {
        const inkChannel = parseInt(ink.slice(offset, offset + 2), 16);
        const cardChannel = parseInt(card.slice(offset, offset + 2), 16);
        return Math.round((inkChannel + cardChannel) / 2)
          .toString(16)
          .padStart(2, "0");
      })
      .join("");
    expect(contrast(`#${mixed}`, hexOf("--paper-card"))).toBeGreaterThanOrEqual(
      3,
    );
  });
});
