import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ArchiveMonthView } from "../app/arquivo/month-view";
import {
  archiveYears,
  publishedYears,
  yearMonths,
} from "../src/archive/calendar";
import { formatMonth, formatMonthShort, messages } from "../src/i18n";
import { bodyOf, decl, stylesheet } from "./css-source";

const copy = messages.archive.picker;

describe("the picker's periods (T-WEB-S1109)", () => {
  it("spans every year from the oldest to the newest archived one, linking only years with puzzles", () => {
    expect(archiveYears(["2026-11", "2026-01", "2025-12"])).toEqual([
      { period: "2025", linked: true },
      { period: "2026", linked: true },
    ]);
    expect(archiveYears(["2026-02", "2023-05"])).toEqual([
      { period: "2023", linked: true },
      { period: "2024", linked: false },
      { period: "2025", linked: false },
      { period: "2026", linked: true },
    ]);
    expect(archiveYears([])).toEqual([]);
  });

  it("lists the published years newest first, once each", () => {
    expect(publishedYears(["2026-11", "2026-01", "2025-12"])).toEqual([
      "2026",
      "2025",
    ]);
  });

  it("gives twelve months of a year, linked iff the month has puzzles", () => {
    const cells = yearMonths("2026", ["2026-11", "2026-08", "2025-12"]);
    expect(cells.map((cell) => cell.period)).toEqual(
      Array.from(
        { length: 12 },
        (_, index) => `2026-${String(index + 1).padStart(2, "0")}`,
      ),
    );
    expect(
      cells.filter((cell) => cell.linked).map((cell) => cell.period),
    ).toEqual(["2026-08", "2026-11"]);
  });

  it("names a month short, without the abbreviation's dot", () => {
    expect(formatMonthShort("2026-09-01")).toBe("set");
    expect(formatMonthShort("2026-05-01")).toBe("mai");
  });
});

const MONTHS = ["2026-11", "2026-10", "2025-12"];

function renderPicker(month = "2026-10") {
  const view = render(
    <ArchiveMonthView
      month={month}
      dates={new Set([`${month}-01`])}
      months={MONTHS}
    />,
  );
  const card = view.container.querySelector(
    "[class*='calendarCard']",
  ) as HTMLElement;
  const views = card.querySelector("[class*='calendarViews']") as HTMLElement;
  const [days, monthGrid, yearGrid] = [...views.children] as [
    HTMLElement,
    HTMLElement,
    HTMLElement,
  ];
  const title = () => within(card).getByRole("heading", { level: 2 });
  return { card, days, monthGrid, yearGrid, title } as const;
}

function active(panels: readonly HTMLElement[]): HTMLElement[] {
  return panels.filter((panel) => !panel.hasAttribute("inert"));
}

describe("the calendar drills from days to months to years (T-WEB-S1110)", () => {
  it("opens on the days; the title names the month and is a button described as a month picker", () => {
    const { days, monthGrid, yearGrid, title } = renderPicker();

    expect(active([days, monthGrid, yearGrid])).toEqual([days]);
    expect(title()).toHaveAccessibleName(formatMonth("2026-10-01"));
    const button = within(title()).getByRole("button");
    expect(button).toHaveAccessibleDescription(copy.monthsHint);
  });

  it("the month view shows the year's twelve months, and only months with puzzles are links", () => {
    const { days, monthGrid, yearGrid, title } = renderPicker();
    fireEvent.click(within(title()).getByRole("button"));

    expect(active([days, monthGrid, yearGrid])).toEqual([monthGrid]);
    expect(title()).toHaveAccessibleName("2026");
    expect(within(monthGrid).getAllByRole("listitem")).toHaveLength(12);

    const links = within(monthGrid).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/arquivo/mes/2026-10",
      "/arquivo/mes/2026-11",
    ]);
    expect(links[0]).toHaveAccessibleName(formatMonth("2026-10-01"));
    expect(links[0]).toHaveAttribute("aria-current", "true");
    expect(links[0]).toHaveFocus();
    expect(monthGrid).toHaveTextContent(formatMonthShort("2026-01-01"));
  });

  it("steps to another year with puzzles, never past the archive's edges", () => {
    const { card, monthGrid, title } = renderPicker();
    fireEvent.click(within(title()).getByRole("button"));

    expect(
      within(card).queryByRole("button", { name: /^Próximo ano/ }),
    ).toBeNull();
    fireEvent.click(
      within(card).getByRole("button", { name: copy.previousYearAria("2025") }),
    );

    expect(title()).toHaveAccessibleName("2025");
    expect(
      within(monthGrid)
        .getAllByRole("link")
        .map((link) => link.getAttribute("href")),
    ).toEqual(["/arquivo/mes/2025-12"]);
    expect(
      within(card).queryByRole("button", { name: /^Ano anterior/ }),
    ).toBeNull();
    expect(within(title()).getByRole("button")).toHaveFocus();
  });

  it("the year view offers the years with puzzles; picking one opens its months", () => {
    const { days, monthGrid, yearGrid, title } = renderPicker();
    fireEvent.click(within(title()).getByRole("button"));
    fireEvent.click(within(title()).getByRole("button"));

    expect(active([days, monthGrid, yearGrid])).toEqual([yearGrid]);
    expect(title()).toHaveTextContent("2025–2026");
    const years = within(yearGrid).getAllByRole("button");
    expect(years.map((year) => year.textContent)).toEqual(["2025", "2026"]);
    expect(years[1]).toHaveAttribute("aria-current", "true");
    expect(years[1]).toHaveFocus();

    fireEvent.click(years[0] as HTMLElement);
    expect(active([days, monthGrid, yearGrid])).toEqual([monthGrid]);
    expect(title()).toHaveAccessibleName("2025");
    expect(within(monthGrid).getByRole("link")).toHaveFocus();
  });

  it("choosing the month already on screen goes back to its days instead of reloading it", () => {
    const { days, monthGrid, yearGrid, title } = renderPicker();
    fireEvent.click(within(title()).getByRole("button"));

    const current = within(monthGrid).getByRole("link", {
      name: formatMonth("2026-10-01"),
    });
    const notCancelled = fireEvent.click(current);

    expect(notCancelled).toBe(false);
    expect(active([days, monthGrid, yearGrid])).toEqual([days]);
    expect(within(title()).getByRole("button")).toHaveFocus();
  });
});

describe("Escape climbs back one level (T-WEB-S1111)", () => {
  it("years → months → days, focus on the title each time", () => {
    const { card, days, monthGrid, yearGrid, title } = renderPicker();
    fireEvent.click(within(title()).getByRole("button"));
    fireEvent.click(within(title()).getByRole("button"));

    fireEvent.keyDown(screen.getByRole("button", { name: "2026" }), {
      key: "Escape",
    });
    expect(active([days, monthGrid, yearGrid])).toEqual([monthGrid]);
    expect(within(title()).getByRole("button")).toHaveFocus();

    fireEvent.keyDown(card, { key: "Escape" });
    expect(active([days, monthGrid, yearGrid])).toEqual([days]);
    expect(within(title()).getByRole("button")).toHaveFocus();
  });
});

describe("the picker's stylesheet (T-WEB-S1112)", () => {
  const sheet = stylesheet("app/arquivo/arquivo.module.css");

  it("stacks the three views in one cell, so the card keeps the day view's size", () => {
    expect(decl(bodyOf(sheet, ".calendarViews"), "display")).toBe("grid");
    expect(decl(bodyOf(sheet, ".calendarViews > *"), "grid-area")).toBe(
      "1 / 1",
    );
    expect(
      decl(bodyOf(sheet, ".calendarViews > [data-off]"), "visibility"),
    ).toBe("hidden");
  });

  it("sets month and year cells in the UI face with tabular figures (ADR-0036)", () => {
    const cell = bodyOf(sheet, ".periodCellLink,\n.periodCellInert");
    expect(decl(cell, "font-family")).toBe("var(--font-ui)");
    expect(decl(cell, "font-variant-numeric")).toBe("tabular-nums");
  });

  it("below 390px the day columns shrink instead of overflowing the card", () => {
    const narrow = sheet.slice(sheet.indexOf("@media (max-width: 389px)"));
    expect(
      decl(
        bodyOf(narrow, ".weekdays,\n  .calendarGrid"),
        "grid-template-columns",
      ),
    ).toBe("repeat(7, minmax(0, 1fr))");
  });

  it("a period cell is at least a touch target tall", () => {
    expect(decl(bodyOf(sheet, ".periodGrid"), "grid-template-rows")).toBe(
      "repeat(4, minmax(var(--touch-target-min), 1fr))",
    );
  });
});
