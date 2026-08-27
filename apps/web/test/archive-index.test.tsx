import { GAMES, type Game } from "@miolos/core";
import type { ArchivedDay } from "@miolos/db";
import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ArchiveIndexView } from "../app/arquivo/index-view";
import {
  newestMonthCalendar,
  NEWEST_MONTH_ROW_WINDOW,
} from "../src/archive/calendar";
import { formatLongDate, formatMonth, messages } from "../src/i18n";

const spies = vi.hoisted(() => ({
  stubDb: {},
  getDb: vi.fn(),
  listArchivedDays: vi.fn(),
  listArchivedMonths: vi.fn(),
}));

vi.mock("../src/db", () => ({ getDb: spies.getDb }));
vi.mock("@miolos/db", () => ({
  listArchivedDays: spies.listArchivedDays,
  listArchivedMonths: spies.listArchivedMonths,
}));

const { default: ArchivePage } = await import("../app/arquivo/page");

beforeEach(() => {
  spies.getDb.mockReturnValue(spies.stubDb);
});

afterEach(() => {
  vi.clearAllMocks();
});

const dayAria = messages.archive.calendar.dayAria;

describe("the archive index (T-WEB-S167)", () => {
  it("renders the newest month's clickable calendar and one link per archived month, newest first", () => {
    render(
      <ArchiveIndexView
        calendar={{
          month: "2026-08",
          dates: new Set(["2026-08-13", "2026-08-12"]),
        }}
        months={["2026-08", "2026-07"]}
      />,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: messages.archive.title }),
    ).toBeInTheDocument();
    expect(screen.getByText(messages.archive.lead)).toBeInTheDocument();

    expect(
      screen.getByRole("heading", {
        level: 2,
        name: formatMonth("2026-08-01"),
      }),
    ).toBeInTheDocument();

    const newest = screen.getByRole("link", {
      name: dayAria(formatLongDate("2026-08-13"), "quinta-feira"),
    });
    expect(newest).toHaveAttribute("href", "/arquivo/2026-08-13");
    expect(newest).toHaveTextContent("13");

    const months = screen.getAllByRole("link", { name: /de 2026$/ });
    expect(months.map((link) => link.getAttribute("href"))).toEqual([
      "/arquivo/mes/2026-08",
      "/arquivo/mes/2026-07",
    ]);
    expect(months[0]).toHaveTextContent(formatMonth("2026-08-01"));
  });

  it("keeps a month href in the body whenever a month exists — the visual gate's discovery grammar", () => {
    const { container } = render(
      <ArchiveIndexView
        calendar={{ month: "2026-08", dates: new Set(["2026-08-13"]) }}
        months={["2026-08"]}
      />,
    );
    expect(container.innerHTML).toMatch(/\/arquivo\/mes\/\d{4}-\d{2}/);
  });

  it("the weekday header is aria-hidden scaffolding: seven elements, three characters each", () => {
    const { container } = render(
      <ArchiveIndexView
        calendar={{ month: "2026-08", dates: new Set(["2026-08-13"]) }}
        months={["2026-08"]}
      />,
    );

    const header = container.querySelector("[class*='weekdays']");
    expect(header).not.toBeNull();
    expect(header).toHaveAttribute("aria-hidden");
    const labels = [...(header as HTMLElement).children].map(
      (element) => element.textContent,
    );
    expect(labels).toEqual([...messages.archive.calendar.weekdays]);
    for (const label of labels) {
      expect((label ?? "").length).toBeLessThanOrEqual(3);
    }
  });
});

describe("the empty archive (T-WEB-S168)", () => {
  it("renders the honest pt-BR empty state with its marker — not a skeleton grid, not a 404", () => {
    const { container } = render(
      <ArchiveIndexView calendar={undefined} months={[]} />,
    );

    expect(screen.getByText(messages.archive.empty)).toBeInTheDocument();

    expect(container.querySelector("[data-page='arquivo']")).not.toBeNull();

    expect(container.querySelector("[class*='calendarGrid']")).toBeNull();
    expect(container.querySelectorAll("li")).toHaveLength(0);
    expect(screen.queryByRole("heading", { level: 2 })).toBeNull();
  });
});

describe("the ragged archive, which is the real one (T-WEB-S182)", () => {
  it("an absent day is an inert numeral — no link, no placeholder, no fake affordance", () => {
    const { container } = render(
      <ArchiveIndexView
        calendar={{
          month: "2026-08",
          dates: new Set(["2026-08-02", "2026-08-01"]),
        }}
        months={["2026-08"]}
      />,
    );

    const dayLinks = [...container.querySelectorAll("a")].filter((anchor) =>
      /^\/arquivo\/\d{4}-\d{2}-\d{2}$/.test(anchor.getAttribute("href") ?? ""),
    );
    expect(dayLinks).toHaveLength(2);
    expect(
      screen.getByRole("link", {
        name: dayAria(formatLongDate("2026-08-01"), "sábado"),
      }),
    ).toHaveAttribute("href", "/arquivo/2026-08-01");

    const inert = [...container.querySelectorAll("[class*='dayCellInert']")];
    expect(inert.length).toBe(29);
    const fifteenth = inert.find((cell) => cell.textContent === "15");
    expect(fifteenth).not.toBeUndefined();
    expect(fifteenth).toHaveAttribute("aria-hidden");
    expect(fifteenth?.closest("a")).toBeNull();

    for (const cell of inert) {
      expect(cell.textContent).not.toMatch(/de 4|—|--/);
    }
  });

  it("the payload bounds hold — a full 31-day month is 31 day anchors, one chip per month", () => {
    const dates = new Set(
      Array.from(
        { length: 31 },
        (_, index) => `2026-08-${String(index + 1).padStart(2, "0")}`,
      ),
    );
    const { container } = render(
      <ArchiveIndexView
        calendar={{ month: "2026-08", dates }}
        months={["2026-08", "2026-07"]}
      />,
    );

    expect(container.querySelectorAll("a")).toHaveLength(34);

    expect(screen.getAllByRole("link", { name: /de 2026$/ })).toHaveLength(2);

    const grid = container.querySelector("[class*='calendarGrid']");
    expect(within(grid as HTMLElement).getAllByRole("listitem")).toHaveLength(
      31,
    );
    expect((grid as HTMLElement).querySelectorAll("li")).toHaveLength(42);
  });
});

function row(date: string, game: Game = "binairo"): ArchivedDay {
  return { date, game };
}

describe("the index's newest-month row window (T-WEB-S312)", () => {
  it("cuts ONLY the newest month out of a window that straddles two months", () => {
    const calendar = newestMonthCalendar([
      row("2026-08-02", "binairo"),
      row("2026-08-02", "sudoku"),
      row("2026-08-01", "binairo"),
      row("2026-07-31", "binairo"),
      row("2026-07-30", "sudoku"),
    ]);

    expect(calendar?.month).toBe("2026-08");
    expect([...(calendar?.dates ?? [])].toSorted()).toEqual([
      "2026-08-01",
      "2026-08-02",
    ]);
  });

  it("covers a FULL month at exactly the window's size — the boundary, with nothing dropped", () => {
    const days = Array.from(
      { length: 31 },
      (_, index) => `2026-08-${String(31 - index).padStart(2, "0")}`,
    );
    const window = days.flatMap((date) => GAMES.map((game) => row(date, game)));
    expect(window).toHaveLength(NEWEST_MONTH_ROW_WINDOW);

    const calendar = newestMonthCalendar(window);
    expect(calendar?.month).toBe("2026-08");
    expect(calendar?.dates.size).toBe(31);
    expect([...(calendar?.dates ?? [])].toSorted()).toEqual(days.toSorted());
  });

  it("an empty archive is no calendar at all — never a skeleton month", () => {
    expect(newestMonthCalendar([])).toBeUndefined();
  });

  it("the window is the GAME LIST's own bound, so a fifth game widens it", () => {
    expect(NEWEST_MONTH_ROW_WINDOW).toBeGreaterThanOrEqual(31 * GAMES.length);
  });

  it("the page READS through that window — the constant is not decorative", async () => {
    spies.listArchivedDays.mockResolvedValue([row("2026-08-13")]);
    spies.listArchivedMonths.mockResolvedValue(["2026-08"]);

    render(await ArchivePage());

    expect(spies.listArchivedDays).toHaveBeenCalledWith(spies.stubDb, {
      limit: NEWEST_MONTH_ROW_WINDOW,
    });

    expect(
      screen.getByRole("link", {
        name: dayAria(formatLongDate("2026-08-13"), "quinta-feira"),
      }),
    ).toHaveAttribute("href", "/arquivo/2026-08-13");
  });
});
