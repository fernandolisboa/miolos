import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BrandMark } from "../src/components/brand-mark";

const WEB = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file: string) => readFileSync(path.join(WEB, file), "utf8");
const tokensCss = read("../../packages/ui/tokens.css");

const accentsOf = (svg: SVGElement) =>
  [...svg.querySelectorAll("rect")].map((cell) => cell.getAttribute("class"));

describe("the brand mark (T-WEB-S750)", () => {
  it("is decorative, draws one cell per game when detailed and three sealing-wax cells when small, and never writes a colour literal", () => {
    const { container } = render(
      <>
        <BrandMark detailed />
        <BrandMark />
      </>,
    );
    const [detailed, small] = [...container.querySelectorAll("svg")];
    if (!detailed || !small) throw new Error("two marks expected");

    for (const svg of [detailed, small]) {
      expect(svg).toHaveAttribute("aria-hidden", "true");
      expect(svg.outerHTML).not.toMatch(/#[0-9a-f]{3,8}\b|var\(/i);
    }
    expect(new Set(accentsOf(detailed)).size).toBe(6);
    expect(accentsOf(small)).toHaveLength(3);
    expect(new Set(accentsOf(small)).size).toBe(1);

    const clipIds = [...container.querySelectorAll("clipPath")].map(
      (clip) => clip.id,
    );
    expect(new Set(clipIds).size).toBe(2);
  });

  it("colours every cell from a game accent token, or the app accent on the small mark", () => {
    const sheet = read("src/components/brand-mark.module.css");
    const used = [...sheet.matchAll(/var\((--[a-z-]+)\)/g)].map((m) => m[1]);
    for (const token of [
      "--accent-termo",
      "--accent-sudoku",
      "--accent-nonogram",
      "--accent-binairo",
      "--accent-crossword",
      "--accent-queens",
      "--accent-app",
      "--paper-card",
      "--ink",
    ]) {
      expect(used).toContain(token);
      expect(tokensCss).toContain(`${token}:`);
    }
  });
});

describe("the favicon and the app-icon master (T-WEB-S753)", () => {
  it("take every colour literal from the tokens file, and the favicon follows a dark system scheme", () => {
    for (const file of ["app/icon.svg", "scripts/app-icon.svg"]) {
      const literals = read(file).match(/#[0-9A-Fa-f]{6}\b/g) ?? [];
      expect(literals.length, file).toBeGreaterThan(0);
      for (const literal of literals) {
        expect(tokensCss.toUpperCase(), `${file} ${literal}`).toContain(
          literal.toUpperCase(),
        );
      }
    }
    expect(read("app/icon.svg")).toContain("prefers-color-scheme: dark");
    expect(read("scripts/render-icons.mjs")).toContain('"app-icon.svg"');
  });
});
