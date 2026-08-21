import { describe, expect, it } from "vitest";

import { bodyOf, decl, pixels, stylesheet, token } from "./css-source";

/**
 * The calendar's geometry, asserted from stylesheet text because jsdom
 * implements no layout (`test/css-source.ts`) — the T-WEB-S221 idiom
 * (#163, plan 065 test 3). Both historical archive gate breaks were
 * CALENDAR-dated, not commit-dated (the 21-row overflow, the 31-char
 * all-caps label), so the worst-case shape is pinned here as arithmetic
 * over the declarations the sheet actually ships, before any preview scan
 * runs.
 */

const sheet = stylesheet("app/arquivo/arquivo.module.css");

/** The sheet's single mobile section — overrides are read from inside it. */
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
    // The column template carries the touch floor itself: minmax(44px, 1fr)
    // can never yield a column under 44px, at any width.
    const columns = decl(
      bodyOf(sheet, ".calendarGrid"),
      "grid-template-columns",
    );
    expect(columns).toBe("repeat(7, minmax(var(--touch-target-min), 1fr))");
    expect(token("--touch-target-min")).toBe(44);

    // The forcing arithmetic, over the declared values (the sheet's own
    // 2px-gap comment records why the gap is off the 4pt scale): at the
    // 390px reference viewport the page leaves 390 − 2 × pagePad, the card
    // spends 2 × border + 2 × cardPad, and seven floor columns plus six
    // gaps must fit what remains.
    const pagePad = token(
      // `.page`'s mobile padding is `var(--space-5) …` — first term.
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
    // And the mobile card actually spans the page, so the columns can use it.
    expect(decl(bodyOf(mobile(), ".calendarCard"), "width")).toBe("100%");
    expect(decl(bodyOf(mobile(), ".calendarCard"), "box-sizing")).toBe(
      "border-box",
    );
  });

  it("the weekday header rides the grid's own template — two blocks, one geometry", () => {
    // Split into two blocks so the line-anchored reader can see each; this
    // arm is what keeps them in lockstep (the sheet's comment points here).
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
    // DESIGN.md's ≥44px is two-axis for an interactive tile; the column
    // track alone would leave height to line-height. The stats
    // `.day`/`.dayPad` idiom, applied to all three cell kinds.
    for (const cell of [".dayCellLink", ".dayCellInert", ".dayCellPad"]) {
      expect(decl(bodyOf(sheet, cell), "aspect-ratio"), cell).toBe("1");
    }
    // The link tile's border is inside the square, or the axes disagree.
    expect(decl(bodyOf(sheet, ".dayCellLink"), "box-sizing")).toBe(
      "border-box",
    );
  });

  it("within the calendar's own rules, uppercase lives on .weekday alone", () => {
    // SCOPED, never a whole-sheet sweep: `.barKicker`, `.monthChip`,
    // `.monthNavKicker`, `.cardKicker` and `.doneChip` carry the transform
    // legitimately elsewhere on this sheet. Here the one carrier is the
    // 3-character weekday label — per-element, so impeccable's
    // `all-caps-body` (>30 chars of DIRECT text) is unreachable by
    // construction.
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
    // Historical break 1 (`first-viewport-column-overflow`): a flex column
    // shell put the archive's children in the rule's 0.25–0.9 band and the
    // gate fired at 21 archived rows, on the calendar rather than on a
    // commit. Normal block flow at every width is the shipped fix; this
    // arm is what keeps a redesign from reintroducing the shell under the
    // grid.
    expect(decl(bodyOf(sheet, ".page"), "display")).toBeUndefined();
    expect(decl(bodyOf(mobile(), ".page"), "display")).toBeUndefined();
    // The card is a lone fit-content block on desk paper, not a column
    // partner: nothing about it is flex either.
    expect(decl(bodyOf(sheet, ".calendarCard"), "display")).toBeUndefined();
    expect(decl(bodyOf(sheet, ".calendarCard"), "width")).toBe("fit-content");
  });
});
