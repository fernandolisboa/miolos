import { describe, expect, it } from "vitest";

import { bodyOf, decl, pixels, stylesheet, token } from "./css-source";

const MINE_CSS = stylesheet("src/minesweeper/minefield.module.css");
const SHARED_CSS = stylesheet("src/play/screen.module.css");
const CELL_FLOOR = 24;
const CARD_CHROME = 2 * token("--space-4") + 2;
const SHADOW = pixels(
  /--shadow-lg:\s*(\d+px)/.exec(
    stylesheet("../../packages/ui/tokens.css"),
  )?.[1],
);

const LEVELS = [
  ["pageBeginner", 9],
  ["pageIntermediate", 16],
  ["pageExpert", 30],
] as const;

function calcPx(value: string | undefined): number {
  const match = /^calc\((\d+) \* 24px \+ 2 \* var\(--space-4\) \+ 2px\)$/.exec(
    value ?? "",
  );
  if (match === null) {
    throw new Error(`\`${String(value)}\` is not cells * 24px + the card`);
  }
  return Number(match[1]) * CELL_FLOOR + CARD_CHROME;
}

describe("the board well can hold a board that outgrows it, and no other game notices (T-WEB-S889)", () => {
  const well = bodyOf(SHARED_CSS, ".boardWell");

  it("scrolls sideways only when a game asks, centres safely, and leaves room for the card's shadow", () => {
    expect(decl(well, "overflow-x")).toBe("var(--board-overflow-x, visible)");
    expect(decl(well, "padding-inline-end")).toBe(
      "var(--board-shadow-slack, 0px)",
    );
    expect(well).toMatch(/align-items:\s*safe center;/);
    expect(well).toMatch(/align-items:\s*center;\s*align-items:\s*safe center/);
  });

  it("lets a floor win over the height-and-width fit", () => {
    expect(decl(well, "--board-side")?.replace(/\s+/g, " ")).toMatch(
      /^max\( min\(.*\), var\(--board-floor-side, 0px\) \)$/,
    );
  });

  it("is left alone by the six daily games' sheets", () => {
    for (const sheet of [
      "src/sudoku/sudoku-board.module.css",
      "src/binairo/binairo-screen.module.css",
      "src/queens/queens-board.module.css",
      "src/nonogram/nonogram-board.module.css",
      "src/termo/termo-board.module.css",
      "src/crossword/crossword-board.module.css",
    ]) {
      expect(stylesheet(sheet), sheet).not.toMatch(
        /--board-(floor-side|overflow-x|shadow-slack)/,
      );
    }
  });
});

describe("Campo Minado keeps 24px cells and scrolls the rest (T-WEB-S889)", () => {
  it("sets custom properties only on the page, never a property of the shared layout", () => {
    for (const selector of [
      ".pageMinefield",
      ...LEVELS.map(([page]) => `.${page}`),
    ]) {
      const names = [
        ...bodyOf(MINE_CSS, selector).matchAll(/^\s*([\w-]+)\s*:/gm),
      ].map((match) => match[1] ?? "");
      expect(names.length, selector).toBeGreaterThan(0);
      for (const name of names) {
        expect(name, selector).toMatch(/^--/);
      }
    }
  });

  it("scrolls the well, squares the card and reserves the shadow", () => {
    const page = bodyOf(MINE_CSS, ".pageMinefield");

    expect(decl(page, "--board-overflow-x")).toBe("auto");
    expect(decl(page, "--grid-card-rot")).toBe("0deg");
    expect(pixels(decl(page, "--board-shadow-slack"))).toBe(SHADOW);
    expect(pixels(decl(page, "--board-below"))).toBe(SHADOW);
  });

  it.each(LEVELS)(
    "%s: the floor is its columns at 24px plus the card, and the well is that tall",
    (page, columns) => {
      const body = bodyOf(MINE_CSS, `.${page}`);
      const floor = calcPx(decl(body, "--board-floor-side"));

      expect(floor).toBe(columns * CELL_FLOOR + CARD_CHROME);
      expect((floor - CARD_CHROME) / columns).toBeGreaterThanOrEqual(
        CELL_FLOOR,
      );
      expect(calcPx(decl(body, "--board-min"))).toBeGreaterThanOrEqual(
        columns === 30 ? 30 * CELL_FLOOR + CARD_CHROME : floor,
      );
    },
  );

  it("holds Especialista at 24px cells in both views: its ceiling is its floor", () => {
    const body = bodyOf(MINE_CSS, ".pageExpert");

    expect(calcPx(decl(body, "--board-max"))).toBe(
      calcPx(decl(body, "--board-floor-side")),
    );
  });

  it("turns Especialista into 16 columns of 30 rows when 30 cells no longer fit the well", () => {
    const query = bodyOf(MINE_CSS, "@container (max-width: 753px)");
    const wide = 30 * CELL_FLOOR + CARD_CHROME;

    expect(753).toBe(wide - 1);
    const turned = bodyOf(query, ".expert");
    expect(decl(turned, "grid-template-columns")).toBe(
      "repeat(16, minmax(0, 1fr))",
    );
    expect(decl(turned, "grid-template-rows")).toBe("repeat(30, auto)");
    expect(decl(turned, "grid-auto-flow")).toBe("column");
    expect(decl(bodyOf(MINE_CSS, ".expert"), "grid-auto-flow")).toBeUndefined();
    expect(
      calcPx(decl(bodyOf(query, ".pageExpert [data-board-card]"), "width")),
    ).toBe(16 * CELL_FLOOR + CARD_CHROME);
  });
});
