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

// The archive index (#31 AC 1/AC 5, ADR-0053 decision 1; the calendar since
// #163, plan 065 D1). Every composition claim lives here, against the
// synchronous view RTL can render; the LAST suite covers the page's own
// derivation and the row window it reads through, which is what replaced
// the truncation pin the day rows carried (step-6 correctness B1, issue
// F2). Weekday facts used in names below are calendar facts: 2026-08-01 is
// a Saturday, 08-02 a Sunday, 08-12 a Wednesday, 08-13 a Thursday.

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

    // The calendar section is headed by the month's own name — a heading,
    // exempt from the all-caps gate and not uppercase anyway.
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: formatMonth("2026-08-01"),
      }),
    ).toBeInTheDocument();

    // A published day is ONE date link to the day page — not four game
    // links, which is the whole reason a day page exists. The accessible
    // name carries the weekday, the one fact the aria-hidden header
    // withholds, and it STARTS with the visible numeral (WCAG 2.5.3).
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
    // `impeccable.yml` greps THIS page's HTML for the first
    // `/arquivo/mes/YYYY-MM` href and silently takes the empty-archive
    // skip branch when none exists (ADR-0053 decision 12): without a match
    // here, the month, day and play scans all stop running with no red
    // anywhere. This arm is the invariant a future redesign has to face.
    // Scoped honestly to a NON-EMPTY `months` (step-6 correctness N2): the
    // chips are the only carrier, so `months: []` renders none — a state
    // no consistent reader can produce, since an archived day implies its
    // month in `listArchivedMonths`.
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

    // Each link's own accessible name states its weekday, so the header
    // announces nothing — and each label is its OWN element, so no
    // uppercase run can grow past impeccable's 30-character threshold.
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
    // The resource exists and is empty. The marker is what the visual gate
    // asserts on, so it must be present in the empty state too.
    expect(container.querySelector("[data-page='arquivo']")).not.toBeNull();
    // No skeleton grid, no fake cells, no month heading over nothing.
    expect(container.querySelector("[class*='calendarGrid']")).toBeNull();
    expect(container.querySelectorAll("li")).toHaveLength(0);
    expect(screen.queryByRole("heading", { level: 2 })).toBeNull();
  });
});

describe("the ragged archive, which is the real one (T-WEB-S182)", () => {
  it("an absent day is an inert numeral — no link, no placeholder, no fake affordance", () => {
    const { container } = render(
      <ArchiveIndexView
        // 2026-08-01 and 08-02 are published; every other day of the month
        // — unpublished, killed, today, future — is the SAME absence.
        calendar={{
          month: "2026-08",
          dates: new Set(["2026-08-02", "2026-08-01"]),
        }}
        months={["2026-08"]}
      />,
    );

    // Exactly the two published days are links.
    const dayLinks = [...container.querySelectorAll("a")].filter((anchor) =>
      /^\/arquivo\/\d{4}-\d{2}-\d{2}$/.test(anchor.getAttribute("href") ?? ""),
    );
    expect(dayLinks).toHaveLength(2);
    expect(
      screen.getByRole("link", {
        name: dayAria(formatLongDate("2026-08-01"), "sábado"),
      }),
    ).toHaveAttribute("href", "/arquivo/2026-08-01");

    // The 15th renders as a bare aria-hidden numeral: present in the grid,
    // absent from the accessibility tree, inside no anchor.
    const inert = [...container.querySelectorAll("[class*='dayCellInert']")];
    expect(inert.length).toBe(29);
    const fifteenth = inert.find((cell) => cell.textContent === "15");
    expect(fifteenth).not.toBeUndefined();
    expect(fifteenth).toHaveAttribute("aria-hidden");
    expect(fifteenth?.closest("a")).toBeNull();
    // And nothing stands in for what is not there.
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
    // 31 day cells + two month chips + the one back link in the top bar.
    expect(container.querySelectorAll("a")).toHaveLength(34);
    // One entry per MONTH, never per day — the chip list grows at 12 rows
    // a year, so it cannot reach a 2,000-element payload this decade.
    expect(screen.getAllByRole("link", { name: /de 2026$/ })).toHaveLength(2);
    // The grid itself stays whole weeks: 2026-08 is the 6-week worst case.
    const grid = container.querySelector("[class*='calendarGrid']");
    expect(within(grid as HTMLElement).getAllByRole("listitem")).toHaveLength(
      31,
    );
    expect((grid as HTMLElement).querySelectorAll("li")).toHaveLength(42);
  });
});

/** `game` never matters to the derivation, only `date` — one is enough. */
function row(date: string, game: Game = "binairo"): ArchivedDay {
  return { date, game };
}

describe("the index's newest-month row window (T-WEB-S312)", () => {
  it("cuts ONLY the newest month out of a window that straddles two months", () => {
    // The reader answers `date DESC, game ASC`, so the newest month's rows
    // are a contiguous PREFIX and everything after them is older. July must
    // not leak into August's grid, or the index would light cells the month
    // it is showing never published.
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
    // The worst case the window exists for: 31 days × every game, which is
    // the window exactly. At exactly `NEWEST_MONTH_ROW_WINDOW` rows all 31
    // days must still be present — one row short and the OLDEST days of
    // the newest month would silently render inert although published.
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
    // A tripwire on the derivation rather than an independent proof: with
    // `NEWEST_MONTH_ROW_WINDOW = 31 * GAMES.length` this cannot fail, and
    // that is the point — it reds the day somebody writes the number out
    // by hand again while the product ships a fifth game (the exact silent
    // truncation step-6 correctness B1 / issue F2 named).
    expect(NEWEST_MONTH_ROW_WINDOW).toBeGreaterThanOrEqual(31 * GAMES.length);
  });

  it("the page READS through that window — the constant is not decorative", async () => {
    spies.listArchivedDays.mockResolvedValue([row("2026-08-13")]);
    spies.listArchivedMonths.mockResolvedValue(["2026-08"]);

    render(await ArchivePage());

    expect(spies.listArchivedDays).toHaveBeenCalledWith(spies.stubDb, {
      limit: NEWEST_MONTH_ROW_WINDOW,
    });
    // And the derivation reached the grid: the one published day is a link.
    expect(
      screen.getByRole("link", {
        name: dayAria(formatLongDate("2026-08-13"), "quinta-feira"),
      }),
    ).toHaveAttribute("href", "/arquivo/2026-08-13");
  });
});
