import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { formatDayInMonth, formatMonth, messages } from "../src/i18n";

// One month of the archive (#31 AC 1, ADR-0053 decision 1). The page is an
// async server component, so it is invoked as a plain function; the view it
// returns is rendered directly.

const spies = vi.hoisted(() => ({
  stubDb: {},
  getDb: vi.fn(),
  listArchivedDays: vi.fn(),
  listArchivedMonths: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("../src/db", () => ({ getDb: spies.getDb }));
vi.mock("@miolos/db", () => ({
  listArchivedDays: spies.listArchivedDays,
  listArchivedMonths: spies.listArchivedMonths,
}));
vi.mock("next/navigation", () => ({
  notFound: spies.notFound,
  redirect: vi.fn(),
}));

const { default: ArchiveMonthPage, generateMetadata } =
  await import("../app/arquivo/mes/[mes]/page");

beforeEach(() => {
  spies.getDb.mockReturnValue(spies.stubDb);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("the archive month page (T-WEB-S169)", () => {
  it("renders that month's day rows with previous/next month navigation", async () => {
    spies.listArchivedDays.mockResolvedValue([
      { date: "2026-08-02", game: "binairo" },
      { date: "2026-08-02", game: "sudoku" },
      { date: "2026-08-01", game: "binairo" },
    ]);
    spies.listArchivedMonths.mockResolvedValue([
      "2026-09",
      "2026-08",
      "2026-07",
    ]);

    render(
      await ArchiveMonthPage({ params: Promise.resolve({ mes: "2026-08" }) }),
    );

    // The reader is asked for the month's own inclusive edges, in SQL —
    // never a string slice over an unbounded read.
    expect(spies.listArchivedDays).toHaveBeenCalledWith(spies.stubDb, {
      from: "2026-08-01",
      to: "2026-08-31",
    });

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: formatMonth("2026-08-01"),
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);

    // `months` is newest-first, so NEXT is the neighbour before this one.
    expect(
      screen.getByRole("link", {
        name: messages.archive.month.next(formatMonth("2026-09-01")),
      }),
    ).toHaveAttribute("href", "/arquivo/mes/2026-09");
    expect(
      screen.getByRole("link", {
        name: messages.archive.month.previous(formatMonth("2026-07-01")),
      }),
    ).toHaveAttribute("href", "/arquivo/mes/2026-07");

    // One level up, never further: the month page's back is the index.
    expect(
      screen.getByRole("link", { name: messages.archive.backToIndexAria }),
    ).toHaveAttribute("href", "/arquivo");

    // The rows carry the DAY and its weekday, never the month and year the
    // `<h1>` directly above has just stated (step-6 F9). With 31 rows the old
    // shape left about six distinct words on the page, and the only varying
    // token — the leading day number — was not the visual anchor.
    expect(screen.getByText(formatDayInMonth("2026-08-02"))).toBeVisible();
    expect(screen.getByText(formatDayInMonth("2026-08-01"))).toBeVisible();
    expect(screen.queryByText("2 de agosto de 2026")).toBeNull();
    // The SAME string is the row's accessible name, so WCAG 2.5.3's
    // label-in-name holds in this mode too.
    expect(
      screen.getByRole("link", {
        name: messages.archive.dayRowAria(formatDayInMonth("2026-08-02"), [
          messages.games.binairo.name,
          messages.games.sudoku.name,
        ]),
      }),
    ).toHaveAttribute("href", "/arquivo/2026-08-02");
  });

  it("each sibling link is ABSENT at the archive's own edges", async () => {
    spies.listArchivedDays.mockResolvedValue([
      { date: "2026-08-01", game: "binairo" },
    ]);
    spies.listArchivedMonths.mockResolvedValue(["2026-08"]);

    render(
      await ArchiveMonthPage({ params: Promise.resolve({ mes: "2026-08" }) }),
    );

    // The sibling labels are "Mês anterior · …" / "Próximo mês · …" and
    // deliberately spend no `←` (step-6 F11 — in this product `←` means one
    // level up, and the month page's own back link uses it).
    expect(screen.queryByText(/Mês anterior/)).toBeNull();
    expect(screen.queryByText(/Próximo mês/)).toBeNull();
    // The back affordance is still there and still the only `←` on the page.
    expect(screen.getAllByText(/←/)).toHaveLength(1);
  });

  it("a month with no archived day is notFound(), and so is a malformed segment", async () => {
    spies.listArchivedDays.mockResolvedValue([]);
    spies.listArchivedMonths.mockResolvedValue(["2026-08"]);
    await expect(
      ArchiveMonthPage({ params: Promise.resolve({ mes: "2026-05" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(spies.notFound).toHaveBeenCalled();

    // A malformed segment never reaches the reader at all: parsed, never
    // cast, and refused before the round trip.
    //
    // `0000-01` and `0000-12` are the step-6 F2 cases and they are not
    // cosmetic additions to the table: `\d{4}` accepts year zero,
    // `monthDayBounds` binds `0000-01-01`/`0000-01-31` into `gte`/`lte` on a
    // `date` column, and Postgres answers `date/time field value out of
    // range` (22008) — an unhandled throw in an async server component, i.e.
    // an unauthenticated **500** on a route `robots.ts` now invites crawlers
    // to. The month is validated through `calendarDateString`, so "a year
    // that exists" has ONE definition in this repo, exactly as it does for
    // the day segment whose own year floor was added for the same bug class.
    for (const mes of [
      "2026-13",
      "2026-8",
      "abcd-01",
      "../2026-08",
      "2026",
      "0000-01",
      "0000-12",
    ]) {
      spies.listArchivedDays.mockClear();
      await expect(
        ArchiveMonthPage({ params: Promise.resolve({ mes }) }),
      ).rejects.toThrow("NEXT_NOT_FOUND");
      expect(spies.listArchivedDays).not.toHaveBeenCalled();
    }
  });

  it("February's inclusive upper bound is the real last day, leap year included", async () => {
    spies.listArchivedDays.mockResolvedValue([
      { date: "2028-02-29", game: "binairo" },
    ]);
    spies.listArchivedMonths.mockResolvedValue(["2028-02"]);
    await ArchiveMonthPage({ params: Promise.resolve({ mes: "2028-02" }) });
    expect(spies.listArchivedDays).toHaveBeenCalledWith(spies.stubDb, {
      from: "2028-02-01",
      to: "2028-02-29",
    });

    spies.listArchivedDays.mockClear();
    spies.listArchivedDays.mockResolvedValue([
      { date: "2026-02-28", game: "binairo" },
    ]);
    spies.listArchivedMonths.mockResolvedValue(["2026-02"]);
    await ArchiveMonthPage({ params: Promise.resolve({ mes: "2026-02" }) });
    expect(spies.listArchivedDays).toHaveBeenCalledWith(spies.stubDb, {
      from: "2026-02-01",
      to: "2026-02-28",
    });
  });

  it("generateMetadata and the page share ONE parser — a hostile segment yields no canonical", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ mes: "//evil.example.com" }),
    });
    expect(metadata.alternates).toBeUndefined();
    expect(metadata.robots).toEqual({ index: false });
  });
});
