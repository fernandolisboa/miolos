import { DAILY_MINESWEEPER_SIZE } from "@miolos/core";
import { MINESWEEPER_CUSTOM_LIMITS } from "@miolos/games/minesweeper";
import { describe, expect, it } from "vitest";

import { bodyOf, decl, pixels, stylesheet, token } from "./css-source";

const MINE_CSS = stylesheet("src/minesweeper/minefield.module.css");
const SHARED_CSS = stylesheet("src/play/screen.module.css");
const CELL_FLOOR = 24;
const CARD_PADDING = token("--space-4");
const CARD_BORDER = 2;
const SHADOW = pixels(
  /--shadow-lg:\s*(\d+px)/.exec(
    stylesheet("../../packages/ui/tokens.css"),
  )?.[1],
);
const FIELD = bodyOf(MINE_CSS, ".field");
const GAP = pixels(decl(FIELD, "gap"));
const FIELD_PADDING = pixels(decl(FIELD, "padding"));
const PAGE = bodyOf(MINE_CSS, ".pageMinefield");
const SHARED = bodyOf(MINE_CSS, ".pageMinefield,\n.customSize");
const CUSTOM = bodyOf(
  MINE_CSS.slice(MINE_CSS.indexOf(SHARED) + SHARED.length),
  ".customSize",
);
const PITCH = pixels(decl(PAGE, "--pitch"));
const CHROME = (() => {
  const match = /^calc\(2 \* var\(--space-4\) \+ (\d+)px\)$/.exec(
    decl(PAGE, "--chrome") ?? "",
  );
  if (match === null) {
    throw new Error("`--chrome` is not twice the card padding plus a constant");
  }
  return 2 * CARD_PADDING + Number(match[1]);
})();

const LEVELS = [
  ["pageBeginner", ".beginner", 9],
  ["pageIntermediate", ".intermediate", 16],
  ["pageExpert", ".expert", 30],
] as const;

function renderedCell(card: number, columns: number): number {
  const inside =
    card -
    2 * CARD_PADDING -
    CARD_BORDER -
    2 * FIELD_PADDING -
    (columns - 1) * GAP;
  return inside / columns;
}

function columnsOf(page: string, field: string): number {
  const group = bodyOf(MINE_CSS, `.${page},\n${field}`);
  return Number(decl(group, "--columns"));
}

describe("the board well can hold a board that outgrows it, and no other game notices (T-WEB-S889)", () => {
  const well = bodyOf(SHARED_CSS, ".boardWell");

  it("leaves scrolling, alignment and the shadow's room to the game that needs them", () => {
    expect(well).not.toMatch(/overflow|padding-inline-end|safe center/);
  });

  it("lets a floor win over the height-and-width fit", () => {
    expect(decl(well, "--board-side")?.replace(/\s+/g, " ")).toMatch(
      /^max\( min\(.*\), var\(--board-floor-side, 0px\) \)$/,
    );
  });

  it("is left alone by every daily game's sheet", () => {
    for (const sheet of [
      "src/sudoku/sudoku-board.module.css",
      "src/binairo/binairo-screen.module.css",
      "src/queens/queens-board.module.css",
      "src/nonogram/nonogram-board.module.css",
      "src/termo/termo-board.module.css",
      "src/crossword/crossword-board.module.css",
    ]) {
      expect(stylesheet(sheet), sheet).not.toMatch(/--board-floor-side/);
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
    const well = bodyOf(MINE_CSS, ".pageMinefield :has(> [data-board-card])");

    expect(decl(well, "overflow-x")).toBe("auto");
    expect(decl(well, "align-items")).toBe("safe center");
    expect(pixels(decl(well, "padding-inline-end"))).toBe(SHADOW);
    expect(decl(PAGE, "--grid-card-rot")).toBe("0deg");
    expect(decl(PAGE, "--grid-card-pad")).toBe("var(--space-4)");
    expect(pixels(decl(PAGE, "--board-below"))).toBe(SHADOW);
  });

  it.each(LEVELS)(
    "%s: its one floor is its columns at 25px plus the card, and no cell renders under 24px",
    (page, field, columns) => {
      expect(columnsOf(page, field)).toBe(columns);
      expect(decl(SHARED, "--floor")).toBe(
        "calc(var(--columns) * var(--pitch) + var(--chrome))",
      );
      expect(decl(SHARED, "--board-floor-side")).toBe("var(--floor)");
      expect(decl(PAGE, "--board-min")).toBe("var(--floor)");

      const floor = columns * PITCH + CHROME;
      expect(renderedCell(floor, columns)).toBeGreaterThanOrEqual(CELL_FLOOR);
      expect(renderedCell(floor, columns)).toBeLessThan(CELL_FLOOR + 1);
    },
  );

  it("holds Especialista at its floor in both views: its ceiling is its floor", () => {
    expect(decl(bodyOf(MINE_CSS, ".pageExpert"), "--board-max")).toBe(
      "var(--floor)",
    );
  });

  it("turns Especialista into 16 columns of 30 rows when 30 cells no longer fit a laptop-narrow well", () => {
    const media = bodyOf(MINE_CSS, "@media (width < 1280px)");
    const query = bodyOf(media, "@container (max-width: 785px)");

    expect(785).toBe(30 * PITCH + CHROME - 1);
    const turned = bodyOf(query, ".expert:not(.finished)");
    expect(decl(turned, "--columns")).toBe("16");
    expect(decl(turned, "grid-template-rows")).toBe("repeat(30, auto)");
    expect(decl(turned, "grid-auto-flow")).toBe("column");
    expect(decl(FIELD, "grid-template-columns")).toBe(
      "repeat(var(--columns), minmax(0, 1fr))",
    );
    expect(decl(bodyOf(MINE_CSS, ".field"), "grid-auto-flow")).toBeUndefined();
    expect(decl(bodyOf(query, ".pageExpert [data-board-card]"), "width")).toBe(
      "calc(16 * var(--pitch) + var(--chrome))",
    );
    expect(renderedCell(16 * PITCH + CHROME, 16)).toBeGreaterThanOrEqual(
      CELL_FLOOR,
    );
  });

  it("keeps Especialista landscape from 1280px, overhanging its column instead of scrolling it", () => {
    const media = bodyOf(MINE_CSS, "@media (width >= 1280px)");
    const well = bodyOf(media, ".pageExpert :has(> [data-board-card])");

    expect(decl(well, "overflow-x")).toBe("visible");
    expect(decl(well, "align-items")).toBe("center");
    expect(decl(bodyOf(media, ".pageExpert"), "--board-min")).toBe(
      "calc(16 * var(--pitch) + var(--chrome))",
    );
  });
});

describe("the daily field is 16 by 10, fits the well's height and keeps 24px cells below it (T-WEB-S929)", () => {
  const daily = bodyOf(MINE_CSS, ".pageDaily");

  it("lays out the core's ten columns", () => {
    expect(columnsOf("pageDaily", ".daily")).toBe(
      DAILY_MINESWEEPER_SIZE.columns,
    );
  });

  it("caps the card's width by the well's height through the board's own aspect", () => {
    expect(decl(daily, "--board-aspect")).toBe(
      `calc(${String(DAILY_MINESWEEPER_SIZE.columns)} / ${String(DAILY_MINESWEEPER_SIZE.rows)})`,
    );
  });

  it("reserves the floor card's height, whose cells are 24px, and scrolls below it", () => {
    expect(decl(daily, "--board-min")).toBe(
      `calc(${String(DAILY_MINESWEEPER_SIZE.rows)} * var(--pitch) + var(--chrome))`,
    );
    expect(decl(SHARED, "--board-floor-side")).toBe("var(--floor)");
    const floor = DAILY_MINESWEEPER_SIZE.columns * PITCH + CHROME;
    expect(
      renderedCell(floor, DAILY_MINESWEEPER_SIZE.columns),
    ).toBeGreaterThanOrEqual(CELL_FLOOR);
  });
});

describe("a custom size derives its floor, height, aspect and ceiling from its rows and columns (T-WEB-S1050)", () => {
  const { rows: ROWS, columns: COLUMNS } = MINESWEEPER_CUSTOM_LIMITS;

  function ceiling(columns: number): number {
    const floor = columns * PITCH + CHROME;
    return Math.max(floor, Math.min(620, columns * 40 + CHROME));
  }

  it("is a box-less wrapper that shares the levels' floor", () => {
    expect(decl(CUSTOM, "display")).toBe("contents");
    expect(decl(CUSTOM, "--floor")).toBeUndefined();
    expect(decl(CUSTOM, "--board-floor-side")).toBeUndefined();
    expect(decl(SHARED, "--floor")).toBe(
      "calc(var(--columns) * var(--pitch) + var(--chrome))",
    );
  });

  it("reserves the floor card's height, never its width", () => {
    expect(decl(CUSTOM, "--board-min")).toBe(
      "calc(var(--rows) * var(--pitch) + var(--chrome))",
    );
    expect(decl(CUSTOM, "--board-aspect")).toBe(
      "calc(var(--columns) / var(--rows))",
    );
  });

  it("caps the card at 40px a cell up to 620px, and never below its floor", () => {
    expect(decl(CUSTOM, "--board-max")?.replace(/\s+/g, " ")).toBe(
      "max( var(--floor), min(620px, calc(var(--columns) * 40px + var(--chrome))) )",
    );
    expect(ceiling(9)).toBe(396);
    expect(ceiling(16)).toBe(620);
    expect(ceiling(30)).toBe(30 * PITCH + CHROME);
  });

  it("keeps every cell at 24px or more at the floor, whatever the size", () => {
    for (let columns = COLUMNS.min; columns <= COLUMNS.max; columns += 1) {
      const floor = columns * PITCH + CHROME;
      expect(
        renderedCell(floor, columns),
        String(columns),
      ).toBeGreaterThanOrEqual(CELL_FLOOR);
      expect(ceiling(columns)).toBeGreaterThanOrEqual(floor);
    }
    expect(ROWS.max * PITCH + CHROME).toBe(636);
  });
});
