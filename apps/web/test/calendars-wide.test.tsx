import type { StatsCalendarResponse } from "@miolos/core";
import { render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ArchiveIndexView } from "../app/arquivo/index-view";
import { ArchiveMonthView } from "../app/arquivo/month-view";
import StatsPage from "../app/estatisticas/page";
import { adjacentMonths } from "../src/archive/calendar";
import {
  formatLongDate,
  formatMonth,
  messages,
  todaySaoPauloDate,
} from "../src/i18n";
import { bodyOf, decl, stylesheet } from "./css-source";

const clients = vi.hoisted(() => ({
  fetchStats: vi.fn(),
  fetchStatsCalendar: vi.fn(),
}));
vi.mock("../src/stats/stats-client", () => clients);

const medalsClient = vi.hoisted(() => ({ fetchMedals: vi.fn() }));
vi.mock("../src/medals/medals-client", () => medalsClient);

const CALENDAR: StatsCalendarResponse = {
  days: [
    { date: "2026-08-21", state: "onTime", perfect: false },
    { date: "2026-08-22", state: "missed", perfect: false },
    { date: "2026-09-01", state: "late", perfect: false },
  ],
};

beforeEach(() => {
  clients.fetchStats.mockResolvedValue(undefined);
  medalsClient.fetchMedals.mockReturnValue(new Promise(() => undefined));
});

afterEach(() => {
  vi.clearAllMocks();
});

async function renderMonths(
  calendar: StatsCalendarResponse | undefined,
): Promise<HTMLElement[]> {
  clients.fetchStatsCalendar.mockResolvedValue(calendar);
  const { container } = render(<StatsPage />);
  await waitFor(() => {
    expect(container.querySelector('[data-stats-state="skeleton"]')).toBeNull();
  });
  return [...container.querySelectorAll<HTMLElement>("[class*='_month_']")];
}

describe("the stats calendar draws whole months (T-WEB-S790)", () => {
  it("every day of a month shows its numeral; untracked days are bare and silent", async () => {
    const months = await renderMonths(CALENDAR);
    expect(months).toHaveLength(2);
    const [september, august] = months as [HTMLElement, HTMLElement];

    const days = august.querySelectorAll("[class*='_day_']");
    expect([...days].map((day) => day.textContent)).toEqual(
      Array.from({ length: 31 }, (_, index) => String(index + 1)),
    );
    expect(august.querySelectorAll("[data-state]")).toHaveLength(2);
    for (const day of days) {
      if (!day.hasAttribute("data-state")) {
        expect(day).toHaveAttribute("aria-hidden");
        expect(day).not.toHaveAttribute("role");
      }
    }
    expect(
      within(august).getByLabelText(
        messages.stats.calendar.dayAria.missed(formatLongDate("2026-08-22")),
      ),
    ).toHaveAttribute("data-state", "missed");

    expect(september.querySelectorAll("[class*='_day_']")).toHaveLength(30);
    expect(september.querySelectorAll("[data-state]")).toHaveLength(1);
  });

  it("each month carries the seven weekday initials, hidden from the reader", async () => {
    const months = await renderMonths(CALENDAR);
    for (const month of months) {
      const header = month.querySelector("[class*='weekdays']");
      expect(header).toHaveAttribute("aria-hidden");
      expect(
        [...(header as HTMLElement).children].map((cell) => cell.textContent),
      ).toEqual([...messages.stats.calendar.weekdays]);
    }
  });

  it("today, still playable, is marked so its missed state draws no ring", async () => {
    const today = todaySaoPauloDate(new Date());
    const months = await renderMonths({
      days: [{ date: today, state: "missed", perfect: false }],
    });
    const cell = months[0]?.querySelector("[data-today]");
    expect(cell).toHaveAttribute("data-state", "missed");
    expect(months[0]?.querySelectorAll("[data-today]")).toHaveLength(1);

    const sheet = stylesheet("app/estatisticas/stats-calendar.module.css");
    expect(
      decl(
        bodyOf(sheet, '.day[data-state="missed"][data-today]'),
        "box-shadow",
      ),
    ).toBe("none");
  });

  it("the neutral month on a settled null is a whole month of bare days", async () => {
    const months = await renderMonths(undefined);
    expect(months).toHaveLength(1);
    const month = months[0] as HTMLElement;
    expect(month.querySelectorAll("[data-state]")).toHaveLength(0);
    expect(
      month.querySelectorAll("[class*='_day_']").length,
    ).toBeGreaterThanOrEqual(28);
  });
});

describe("the stats months sit side by side (T-WEB-S791)", () => {
  const sheet = stylesheet("app/estatisticas/stats-calendar.module.css");

  it("the months fill an auto-fill grid and each month fills its track", () => {
    const months = bodyOf(sheet, ".months");
    expect(decl(months, "display")).toBe("grid");
    expect(decl(months, "grid-template-columns")).toMatch(
      /^repeat\(auto-fill, minmax\(\d+px, 1fr\)\)$/,
    );
    expect(decl(bodyOf(sheet, ".month"), "width")).toBeUndefined();
  });

  it("the weekday header rides the day grid's own template and gap", () => {
    const header = bodyOf(sheet, ".weekdays");
    const grid = bodyOf(sheet, ".monthGrid");
    expect(decl(header, "grid-template-columns")).toBe("repeat(7, 1fr)");
    expect(decl(header, "grid-template-columns")).toBe(
      decl(grid, "grid-template-columns"),
    );
    expect(decl(header, "gap")).toBe(decl(grid, "gap"));
  });

  it("a missed day wears its legend swatch's ring, so it differs from an untracked one", () => {
    expect(
      decl(
        bodyOf(
          sheet,
          '.day[data-state="missed"],\n.legendSwatch[data-state="missed"]',
        ),
        "box-shadow",
      ),
    ).toBe("inset 0 0 0 1px var(--line)");
    expect(decl(bodyOf(sheet, ".day"), "box-shadow")).toBeUndefined();
  });
});

describe("the archive steps between months on the calendar itself (T-WEB-S792)", () => {
  const MONTHS = ["2026-10", "2026-09", "2026-08"];

  it("a middle month: previous, its name, next — in that order, in the card", () => {
    const { container } = render(
      <ArchiveMonthView
        month="2026-09"
        dates={new Set(["2026-09-01"])}
        months={MONTHS}
      />,
    );

    const head = container.querySelector("[class*='calendarHead']");
    expect(head?.closest("[class*='calendarCard']")).not.toBeNull();
    const parts = [...(head as HTMLElement).children];
    expect(parts.map((part) => part.tagName)).toEqual(["A", "H2", "A"]);
    expect(parts[0]).toHaveAttribute("href", "/arquivo/mes/2026-08");
    expect(parts[0]).toHaveAccessibleName(
      messages.archive.month.previousAria(formatMonth("2026-08-01")),
    );
    expect(parts[1]).toHaveTextContent(formatMonth("2026-09-01"));
    expect(parts[2]).toHaveAttribute("href", "/arquivo/mes/2026-10");
    expect(parts[2]).toHaveAccessibleName(
      messages.archive.month.nextAria(formatMonth("2026-10-01")),
    );
  });

  it("the index shows the newest month with the same card, and only a way back", () => {
    const { container } = render(
      <ArchiveIndexView
        calendar={{ month: "2026-10", dates: new Set(["2026-10-01"]) }}
        months={MONTHS}
      />,
    );

    const head = container.querySelector("[class*='calendarHead']");
    const parts = [...(head as HTMLElement).children];
    expect(parts[0]).toHaveAttribute("href", "/arquivo/mes/2026-09");
    expect(parts[2]?.tagName).toBe("SPAN");
    expect(parts[2]).toHaveAttribute("aria-hidden");
  });

  it("the month list marks the month on screen", () => {
    render(
      <ArchiveMonthView
        month="2026-09"
        dates={new Set(["2026-09-01"])}
        months={MONTHS}
      />,
    );

    const current = screen.getByRole("link", {
      name: formatMonth("2026-09-01"),
    });
    expect(current).toHaveAttribute("aria-current", "true");
    expect(
      screen
        .getAllByRole("link", { name: /^\w+ de 2026$/ })
        .filter((link) => link.hasAttribute("aria-current")),
    ).toEqual([current]);
  });
});

describe("the current month chip keeps its label on hover (T-WEB-S792)", () => {
  it("its paper label outranks `.page a:hover`", () => {
    const sheet = stylesheet("app/arquivo/arquivo.module.css");
    const chip = bodyOf(
      sheet,
      '.page .monthChip[aria-current="true"],\n.page .monthChip[aria-current="true"]:hover',
    );
    expect(decl(chip, "color")).toBe("var(--paper-card)");
    expect(decl(chip, "background")).toBe("var(--ink)");
  });
});

describe("adjacentMonths (T-WEB-S793)", () => {
  const MONTHS = ["2026-10", "2026-09", "2026-08"];

  it("steps one month each way, and stops at both ends", () => {
    expect(adjacentMonths(MONTHS, "2026-09")).toEqual({
      previous: "2026-08",
      next: "2026-10",
    });
    expect(adjacentMonths(MONTHS, "2026-10")).toEqual({
      previous: "2026-09",
      next: undefined,
    });
    expect(adjacentMonths(MONTHS, "2026-08")).toEqual({
      previous: undefined,
      next: "2026-09",
    });
    expect(adjacentMonths(MONTHS, "2026-05")).toEqual({
      previous: undefined,
      next: undefined,
    });
  });
});
