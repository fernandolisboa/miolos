import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BRAIN, BrandMark } from "../src/components/brand-mark";
import { BoardCard } from "../src/play/board-card";

const WEB = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file: string) => readFileSync(path.join(WEB, file), "utf8");
const tokensCss = read("../../packages/ui/tokens.css");
const sheet = read("src/components/brand-mark.module.css");

const LOBE_TOKENS = [
  "--accent-termo",
  "--accent-sudoku",
  "--accent-nonogram",
  "--accent-binairo",
  "--accent-crossword",
  "--accent-queens",
];

describe("the brand mark (T-WEB-S750)", () => {
  it("is decorative, builds its lobes from cells in six classes, and never writes a colour literal", () => {
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
      const lobes = new Set(
        [...svg.querySelectorAll("rect")].map((cell) =>
          cell.getAttribute("class"),
        ),
      );
      expect(lobes.size).toBeGreaterThanOrEqual(svg === detailed ? 6 : 5);
    }
    expect(detailed.querySelectorAll("rect").length).toBeGreaterThan(
      small.querySelectorAll("rect").length,
    );
  });

  it("colours the paper, the ink and every lobe from tokens", () => {
    const used = [...sheet.matchAll(/var\((--[a-z-]+)\)/g)].map((m) => m[1]);
    for (const token of [...LOBE_TOKENS, "--paper-card", "--ink"]) {
      expect(used).toContain(token);
      expect(tokensCss).toContain(`${token}:`);
    }
  });
});

describe("the favicon and the app-icon master (T-WEB-S753)", () => {
  it("draw the component's brain, take every colour literal from the tokens file, and the favicon follows a dark system scheme", () => {
    for (const file of ["app/icon.svg", "scripts/app-icon.svg"]) {
      const svg = read(file);
      expect(svg, file).toContain(BRAIN);
      const literals = svg.match(/#[0-9A-Fa-f]{6}\b/g) ?? [];
      expect(literals.length, file).toBeGreaterThan(0);
      for (const literal of literals) {
        expect(tokensCss.toUpperCase(), `${file} ${literal}`).toContain(
          literal.toUpperCase(),
        );
      }
    }
    expect(read("app/icon.svg")).toContain("prefers-color-scheme: dark");
  });
});

describe("a loading board shows the brand mark shuffling its cells (T-WEB-S754)", () => {
  it("draws the shuffling mark on a placeholder board, never over an overlay or a live board", () => {
    const shuffling = (node: HTMLElement) =>
      node.querySelectorAll("svg[aria-hidden='true'] rect").length > 0;

    const loading = render(
      <BoardCard placeholder>
        <div />
      </BoardCard>,
    );
    expect(shuffling(loading.container)).toBe(true);
    loading.unmount();

    const withOverlay = render(
      <BoardCard placeholder overlay={<p>indisponível</p>}>
        <div />
      </BoardCard>,
    );
    expect(shuffling(withOverlay.container)).toBe(false);
    withOverlay.unmount();

    const live = render(
      <BoardCard>
        <div />
      </BoardCard>,
    );
    expect(shuffling(live.container)).toBe(false);
  });

  it("cycles the cells through the lobe accents and blank paper, and stands still under reduced motion", () => {
    const keyframes = sheet.slice(sheet.indexOf("@keyframes"));
    for (const token of [...LOBE_TOKENS, "--paper-card"]) {
      expect(keyframes).toContain(`fill: var(${token})`);
    }
    const calm = sheet.slice(sheet.indexOf("prefers-reduced-motion"));
    expect(calm).toContain(".shuffling rect");
    expect(calm).toContain("animation: none");
  });
});
