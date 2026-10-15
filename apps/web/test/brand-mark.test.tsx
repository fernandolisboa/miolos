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

type Point = readonly [number, number];
const SUBPIXEL = 0.1;

function outlinePoints(d: string): Point[] {
  const numbers = (text: string) => (text.match(/-?[\d.]+/g) ?? []).map(Number);
  const [mx = 0, my = 0] = numbers(d);
  const points: Point[] = [[mx, my]];
  for (const segment of d.match(/[LC][^LCZ]+/g) ?? []) {
    const [ax, ay] = points.at(-1) ?? [mx, my];
    const n = numbers(segment);
    for (let t = 0.02; t <= 1.0001; t += 0.02) {
      if (segment.startsWith("L")) {
        points.push([ax + t * ((n[0] ?? 0) - ax), ay + t * ((n[1] ?? 0) - ay)]);
        continue;
      }
      const u = 1 - t;
      const cubic = (a: number, b = 0, c = 0, e = 0) =>
        u ** 3 * a + 3 * u ** 2 * t * b + 3 * u * t ** 2 * c + t ** 3 * e;
      points.push([cubic(ax, n[0], n[2], n[4]), cubic(ay, n[1], n[3], n[5])]);
    }
  }
  return points;
}

function distanceOutside(outline: readonly Point[], [x, y]: Point): number {
  let inside = false;
  let nearest = Infinity;
  outline.forEach(([ax, ay], i) => {
    const [bx, by] = outline[(i + 1) % outline.length] ?? [ax, ay];
    if (ay > y !== by > y && x < ((bx - ax) * (y - ay)) / (by - ay) + ax) {
      inside = !inside;
    }
    const length = (bx - ax) ** 2 + (by - ay) ** 2 || 1;
    const t = Math.max(
      0,
      Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / length),
    );
    nearest = Math.min(
      nearest,
      Math.hypot(x - ax - t * (bx - ax), y - ay - t * (by - ay)),
    );
  });
  return inside ? 0 : nearest;
}

function edgePoints(rect: Element): Point[] {
  const at = (name: string) => Number(rect.getAttribute(name));
  const [x, y, side, rx] = [at("x"), at("y"), at("width"), at("rx")];
  const cornerInset = rx * (1 - Math.SQRT1_2);
  const points: Point[] = [
    [x + cornerInset, y + cornerInset],
    [x + side - cornerInset, y + cornerInset],
    [x + cornerInset, y + side - cornerInset],
    [x + side - cornerInset, y + side - cornerInset],
  ];
  for (
    let along = rx;
    along <= side - rx + 1e-9;
    along += (side - 2 * rx) / 4
  ) {
    points.push(
      [x + along, y],
      [x + along, y + side],
      [x, y + along],
      [x + side, y + along],
    );
  }
  return points;
}

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
    const outline = outlinePoints(BRAIN);
    const { container } = render(
      <>
        <BrandMark />
        <BrandMark detailed />
      </>,
    );
    for (const svg of container.querySelectorAll("svg")) {
      const ink = svg.querySelector(`.${String(styles.ink)}`);
      const halfStroke = Number(ink?.getAttribute("stroke-width")) / 2;
      const outside = [...svg.querySelectorAll("rect")].filter((rect) =>
        edgePoints(rect).some(
          (point) => distanceOutside(outline, point) > halfStroke + SUBPIXEL,
        ),
      );
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

  it("cycles the cells through the lobe accents and blank paper", () => {
    expect(sheet).toMatch(/\.shuffling rect \{\s*animation: shuffle-a /);
    const keyframes = sheet.slice(sheet.indexOf("@keyframes"));
    for (const token of [...LOBE_TOKENS, "--paper-card"]) {
      expect(keyframes).toContain(`fill: var(${token})`);
    }
  });
});
