import { describe, expect, it } from "vitest";

import { bodyOf, decl, pixels, stylesheet, token } from "./css-source";

const sheet = stylesheet("app/arquivo/arquivo.module.css");

function mobile(): string {
  const at = sheet.indexOf("@media (max-width: 768px)");
  expect(at).toBeGreaterThan(-1);
  return sheet.slice(at);
}

const CALENDAR_SELECTORS = [
  ".calendarCard",
  ".weekdays",
  ".weekday",
  ".calendarGrid",
  ".dayCellLink",
  ".dayCellInert",
  ".dayCellPad",
  ".dayNumeral",
] as const;

describe("the archive calendar's cell geometry (T-WEB-S311)", () => {
  it("seven 44px-floor columns fit the 390px viewport at the mobile paddings", () => {
    const columns = decl(
      bodyOf(sheet, ".calendarGrid"),
      "grid-template-columns",
    );
    expect(columns).toBe("repeat(7, minmax(var(--touch-target-min), 1fr))");
    expect(token("--touch-target-min")).toBe(44);

    const pagePad = token(
      decl(bodyOf(mobile(), ".page"), "padding")
        ?.split(/\s+/)[0]
        ?.replace(/^var\(|\)$/g, "") ?? "",
    );
    const cardPad = token(
      decl(bodyOf(mobile(), ".calendarCard"), "padding")?.replace(
        /^var\(|\)$/g,
        "",
      ) ?? "",
    );
    const border = pixels(
      decl(bodyOf(sheet, ".calendarCard"), "border")?.split(/\s+/)[0],
    );
    const gap = pixels(decl(bodyOf(mobile(), ".calendarGrid"), "gap"));
    expect(gap).toBe(2);
    expect(7 * 44 + 6 * gap + 2 * cardPad + 2 * border).toBeLessThanOrEqual(
      390 - 2 * pagePad,
    );

    expect(decl(bodyOf(mobile(), ".calendarCard"), "width")).toBe("100%");
    expect(decl(bodyOf(mobile(), ".calendarCard"), "box-sizing")).toBe(
      "border-box",
    );
  });

  it("the weekday header rides the grid's own template — two blocks, one geometry", () => {
    const header = bodyOf(sheet, ".weekdays");
    const grid = bodyOf(sheet, ".calendarGrid");
    expect(decl(header, "grid-template-columns")).toBe(
      decl(grid, "grid-template-columns"),
    );
    expect(decl(header, "gap")).toBe(decl(grid, "gap"));
    expect(decl(bodyOf(mobile(), ".weekdays"), "gap")).toBe(
      decl(bodyOf(mobile(), ".calendarGrid"), "gap"),
    );
  });

  it("every cell is SQUARE, so the 44px floor holds on the block axis too", () => {
    for (const cell of [".dayCellLink", ".dayCellInert", ".dayCellPad"]) {
      expect(decl(bodyOf(sheet, cell), "aspect-ratio"), cell).toBe("1");
    }

    expect(decl(bodyOf(sheet, ".dayCellLink"), "box-sizing")).toBe(
      "border-box",
    );
  });

  it("within the calendar's own rules, uppercase lives on .weekday alone", () => {
    for (const selector of CALENDAR_SELECTORS) {
      const transform = decl(bodyOf(sheet, selector), "text-transform");
      if (selector === ".weekday") {
        expect(transform).toBe("uppercase");
      } else {
        expect(transform, selector).toBeUndefined();
      }
    }
  });

  it("the numerals align: --font-ui with tabular figures (ADR-0036 decision 1)", () => {
    const numeral = bodyOf(sheet, ".dayNumeral");
    expect(decl(numeral, "font-family")).toBe("var(--font-ui)");
    expect(decl(numeral, "font-variant-numeric")).toBe("tabular-nums");
  });

  it(".page declares no display:flex at ANY width — the 21-row overflow's pin", () => {
    expect(decl(bodyOf(sheet, ".page"), "display")).toBeUndefined();
    expect(decl(bodyOf(mobile(), ".page"), "display")).toBeUndefined();

    expect(decl(bodyOf(sheet, ".calendarCard"), "display")).toBeUndefined();
    expect(decl(bodyOf(sheet, ".calendarCard"), "width")).toBe("fit-content");
  });
});
