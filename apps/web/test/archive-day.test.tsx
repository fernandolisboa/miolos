import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { formatLongDate, formatMonth, messages } from "../src/i18n";

// One archived day (#31 AC 1, ADR-0053 decision 1). The page is an async
// server component, invoked as a plain function; the view it returns is
// rendered directly.

const spies = vi.hoisted(() => ({
  stubDb: {},
  getDb: vi.fn(),
  listArchivedDays: vi.fn(),
  archiveDateClass: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
}));

vi.mock("../src/db", () => ({ getDb: spies.getDb }));
vi.mock("@miolos/db", () => ({
  listArchivedDays: spies.listArchivedDays,
  archiveDateClass: spies.archiveDateClass,
}));
vi.mock("next/navigation", () => ({
  notFound: spies.notFound,
  redirect: spies.redirect,
}));

const { default: ArchiveDayPage, generateMetadata } =
  await import("../app/arquivo/[data]/page");

beforeEach(() => {
  spies.getDb.mockReturnValue(spies.stubDb);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("the archive day page (T-WEB-S184)", () => {
  it("T-WEB-S184: renders one card per game that date holds, and a link up to its month", async () => {
    spies.listArchivedDays.mockResolvedValue([
      { date: "2026-08-03", game: "binairo" },
      { date: "2026-08-03", game: "nonogram" },
      { date: "2026-08-03", game: "sudoku" },
      { date: "2026-08-03", game: "termo" },
    ]);

    render(
      await ArchiveDayPage({ params: Promise.resolve({ data: "2026-08-03" }) }),
    );

    // One date, asked for as an inclusive one-day range through the wall.
    expect(spies.listArchivedDays).toHaveBeenCalledWith(spies.stubDb, {
      from: "2026-08-03",
      to: "2026-08-03",
    });
    // The archived path costs exactly ONE round trip: a row in hand is the
    // proof that the date is past, so the classifier is never consulted.
    expect(spies.archiveDateClass).not.toHaveBeenCalled();

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: formatLongDate("2026-08-03"),
      }),
    ).toBeInTheDocument();

    for (const game of ["binairo", "nonogram", "sudoku", "termo"] as const) {
      expect(
        screen.getByRole("link", {
          name: messages.archive.day.cardAria(
            messages.games[game].name,
            formatLongDate("2026-08-03"),
          ),
        }),
      ).toHaveAttribute("href", `/arquivo/2026-08-03/${game}`);
    }

    // One level up, never further: the day page's back is its month page.
    expect(
      screen.getByRole("link", {
        name: messages.archive.backToMonthAria(formatMonth("2026-08-01")),
      }),
    ).toHaveAttribute("href", "/arquivo/mes/2026-08");
  });

  it("T-WEB-S184: a short date renders fewer cards and NO placeholder", async () => {
    // 2026-08-01 is the archive's real floor shape: the cron gained sudoku on
    // 01, nonogram on 02 and termo on 03, with no backfill.
    spies.listArchivedDays.mockResolvedValue([
      { date: "2026-08-01", game: "binairo" },
      { date: "2026-08-01", game: "sudoku" },
    ]);

    render(
      await ArchiveDayPage({ params: Promise.resolve({ data: "2026-08-01" }) }),
    );

    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.queryByText(messages.games.termo.name)).toBeNull();
    expect(screen.queryByText(messages.games.nonogram.name)).toBeNull();
  });

  it("T-WEB-S184: an empty date is notFound(), and a malformed segment never reaches the reader", async () => {
    spies.listArchivedDays.mockResolvedValue([]);
    spies.archiveDateClass.mockResolvedValue("past");
    await expect(
      ArchiveDayPage({ params: Promise.resolve({ data: "2026-05-05" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");

    // `calendarDateString`, never a shape regex: `2026-02-30` is well-formed
    // and is not a day, and a shape regex accepts it.
    for (const data of ["2026-02-30", "mes", "../2026-08-01", "2026-8-1"]) {
      spies.listArchivedDays.mockClear();
      await expect(
        ArchiveDayPage({ params: Promise.resolve({ data }) }),
      ).rejects.toThrow("NEXT_NOT_FOUND");
      expect(spies.listArchivedDays).not.toHaveBeenCalled();
    }
  });

  it("T-WEB-S184: generateMetadata and the page share ONE parser — a hostile segment yields no canonical", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ data: "//evil.example.com" }),
    });
    expect(metadata.alternates).toBeUndefined();
    expect(metadata.robots).toEqual({ index: false });
  });
});
