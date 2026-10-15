import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BRAIN, BrandMark } from "../src/components/brand-mark";
import styles from "../src/components/brand-mark.module.css";
import { BoardCard } from "../src/play/board-card";

const WEB = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file: string) => readFileSync(path.join(WEB, file), "utf8");
const tokensCss = read("../../packages/ui/tokens.css");
const sheet = read("src/components/brand-mark.module.css");

const LOBES = [
  "termo",
  "sudoku",
  "nonogram",
  "binairo",
  "crossword",
  "queens",
] as const;

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

  it("keeps every cell inside the outer edge of the outline, so it needs no clip path", () => {
    const nums = (BRAIN.match(/-?[\d.]+/g) ?? []).map(Number);
    const outline: [number, number][] = [[nums[0] ?? 0, nums[1] ?? 0]];
    for (const segment of BRAIN.slice(1).match(/[LC][^LCZ]+/g) ?? []) {
      const n = (segment.match(/-?[\d.]+/g) ?? []).map(Number);
      const [x0, y0] = outline.at(-1) ?? [0, 0];
      const ctrl = segment[0] === "L" ? [x0, y0, ...n, ...n] : n;
      for (let t = 0.02; t <= 1.0001; t += 0.02) {
        const w = [
          (1 - t) ** 3,
          3 * (1 - t) ** 2 * t,
          3 * (1 - t) * t ** 2,
          t ** 3,
        ];
        const at = (k: number) =>
          (w[0] ?? 0) * (k ? y0 : x0) +
          [1, 2, 3].reduce(
            (sum, i) => sum + (w[i] ?? 0) * (ctrl[2 * i - 2 + k] ?? 0),
            0,
          );
        outline.push([at(0), at(1)]);
      }
    }
    const reach = ([x, y]: [number, number]) => {
      let inside = false;
      let nearest = Infinity;
      outline.forEach(([ax, ay], i) => {
        const [bx, by] = outline[(i + 1) % outline.length] ?? [ax, ay];
        if (ay > y !== by > y && x < ((bx - ax) * (y - ay)) / (by - ay) + ax)
          inside = !inside;
        const len = (bx - ax) ** 2 + (by - ay) ** 2 || 1;
        const t = Math.max(
          0,
          Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / len),
        );
        nearest = Math.min(
          nearest,
          Math.hypot(x - ax - t * (bx - ax), y - ay - t * (by - ay)),
        );
      });
      return inside ? 0 : nearest;
    };

    const { container } = render(
      <>
        <BrandMark />
        <BrandMark detailed />
      </>,
    );
    for (const svg of container.querySelectorAll("svg")) {
      const halfStroke =
        Number(
          svg.querySelector("path:last-of-type")?.getAttribute("stroke-width"),
        ) / 2;
      const outside = [...svg.querySelectorAll("rect")].filter((rect) => {
        const at = (name: string) => Number(rect.getAttribute(name));
        const [x, y, side] = [at("x"), at("y"), at("width")];
        const r = Number(rect.getAttribute("rx")) * 0.3;
        const corners: [number, number][] = [
          [x + r, y + r],
          [x + side - r, y + r],
          [x + r, y + side - r],
          [x + side - r, y + side - r],
        ];
        return corners.some((corner) => reach(corner) > halfStroke + 0.05);
      });
      expect(outside.map((rect) => rect.outerHTML)).toEqual([]);
    }
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

  it("place the same cells in the same lobes as the component", () => {
    const favicon = read("app/icon.svg");
    const lightFill = new Map(
      LOBES.map((lobe) => [
        favicon.match(new RegExp(`\\.${lobe} \\{ fill: (#[0-9A-F]{6})`))?.[1],
        lobe,
      ]),
    );
    const num = (value: string | null | undefined) =>
      Number(Number(value).toFixed(2));
    const cellsIn = (markup: string, lobeOf: (rect: Element) => string) =>
      [
        ...new DOMParser()
          .parseFromString(markup, "image/svg+xml")
          .querySelectorAll("svg[viewBox='3 4 58 52'] rect"),
      ].map((rect) => [
        num(rect.getAttribute("x")),
        num(rect.getAttribute("y")),
        num(rect.getAttribute("width")),
        lobeOf(rect),
      ]);
    const { container } = render(
      <>
        <BrandMark />
        <BrandMark detailed />
      </>,
    );
    const lobeByClass = new Map(LOBES.map((lobe) => [styles[lobe], lobe]));
    const [small, detailed] = [...container.querySelectorAll("svg")].map(
      (svg) =>
        cellsIn(svg.outerHTML, (rect) =>
          String(lobeByClass.get(rect.getAttribute("class") ?? "")),
        ),
    );
    expect(small?.length).toBeGreaterThan(20);
    expect(detailed?.length).toBeGreaterThan(small?.length ?? 0);
    expect(
      cellsIn(favicon, (rect) => String(rect.getAttribute("class"))),
    ).toEqual(small);
    expect(
      cellsIn(read("scripts/app-icon.svg"), (rect) =>
        String(lightFill.get(rect.getAttribute("fill") ?? "")),
      ),
    ).toEqual(detailed);
  });
});

describe("a loading board shows the brand mark shuffling its cells (T-WEB-S754)", () => {
  it("draws the shuffling mark on a placeholder board, never over an overlay or a live board", () => {
    const shuffling = (node: HTMLElement) =>
      [...node.querySelectorAll("svg[aria-hidden='true']")].some(
        (svg) =>
          svg.classList.contains(String(styles.shuffling)) &&
          svg.querySelector("rect") !== null,
      );

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

  it("cycles the cells through the lobe accents and blank paper; T-WEB-S405 holds every animated selector still under reduced motion", () => {
    const keyframes = sheet.slice(sheet.indexOf("@keyframes"));
    for (const token of [...LOBE_TOKENS, "--paper-card"]) {
      expect(keyframes).toContain(`fill: var(${token})`);
    }
  });
});
