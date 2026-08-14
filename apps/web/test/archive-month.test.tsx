import { readFileSync } from "node:fs";
import { join } from "node:path";

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
    // The composed sentence is the ACCESSIBLE NAME; the visible label is a
    // kicker over a month, in two elements (step-7 V1, pinned below).
    expect(
      screen.getByRole("link", {
        name: messages.archive.month.nextAria(formatMonth("2026-09-01")),
      }),
    ).toHaveAttribute("href", "/arquivo/mes/2026-09");
    expect(
      screen.getByRole("link", {
        name: messages.archive.month.previousAria(formatMonth("2026-07-01")),
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

  // The sibling links, pinned against the gate that broke on them (step-7
  // V1). `impeccable`'s `all-caps-body` fires on any non-heading element with
  // MORE THAN 30 characters of direct text under `text-transform: uppercase`
  // (`checks.mjs:3463-3467`), and it grants no interactive or `nav` exemption
  // — that one belongs to `undersized-ui-text`, twenty lines above it. The
  // single composed label reached 32 characters in fevereiro and 31 in
  // setembro, novembro and dezembro, and the CI job scans the NEWEST month
  // page, which always has a `previous` sibling: four months in every twelve
  // would have redded `detect` with no commit causing it and none able to fix
  // it. Nothing asserted the label's shape, exactly as nothing asserted the
  // row's before F9.
  it("no sibling label can reach impeccable's all-caps gate, in any month", async () => {
    // Every month as `previous`, at a four-digit year — the year's length is
    // constant, so this is the whole space.
    for (let m = 1; m <= 12; m += 1) {
      const previous = `2026-${String(m).padStart(2, "0")}`;
      spies.listArchivedDays.mockResolvedValue([
        { date: "2027-01-01", game: "binairo" },
      ]);
      spies.listArchivedMonths.mockResolvedValue(["2027-01", previous]);

      const { container, unmount } = render(
        await ArchiveMonthPage({ params: Promise.resolve({ mes: "2027-01" }) }),
      );

      const nav = container.querySelector("nav");
      expect(nav).not.toBeNull();
      for (const el of [nav!, ...nav!.querySelectorAll("*")]) {
        // impeccable's own predicate, element by element: the direct text
        // run is what `hasDirectText` reads, and 30 is its threshold.
        const direct = [...el.childNodes]
          .filter((n) => n.nodeType === 3)
          .map((n) => n.textContent ?? "")
          .join("")
          .trim();
        expect(
          direct.length,
          `${previous}: <${el.tagName.toLowerCase()}> carries ${direct.length} characters of direct text ("${direct}")`,
        ).toBeLessThanOrEqual(30);
      }

      // And the direction and the month are separate elements, so the month
      // — the only varying token — is never inside the uppercase one.
      const kickers = [...nav!.querySelectorAll("span")].map(
        (s) => s.textContent,
      );
      expect(kickers).toContain(messages.archive.month.previous);
      expect(kickers).toContain(formatMonth(`${previous}-01`));

      // The composed sentence survives as the accessible name, so WCAG
      // 2.5.3's label-in-name still holds over the visible words.
      expect(
        screen.getByRole("link", {
          name: messages.archive.month.previousAria(
            formatMonth(`${previous}-01`),
          ),
        }),
      ).toHaveAttribute("href", `/arquivo/mes/${previous}`);

      unmount();
      vi.clearAllMocks();
      spies.getDb.mockReturnValue(spies.stubDb);
    }
  });

  it("the uppercase transform lives on the kicker alone, in the stylesheet", () => {
    // The DOM half above cannot see CSS, and the CSS half is where the gate
    // actually reads: `ink-on-accent.test.ts`'s source-scan idiom.
    const sheet = readFileSync(
      join(import.meta.dirname, "..", "app", "arquivo", "arquivo.module.css"),
      "utf8",
    );
    const block = (selector: string) => {
      const at = sheet.indexOf(`\n${selector} {`);
      expect(
        at,
        `${selector} is missing from arquivo.module.css`,
      ).toBeGreaterThan(-1);
      return sheet.slice(at, sheet.indexOf("}", at));
    };
    expect(block(".monthNavKicker")).toContain("text-transform: uppercase");
    expect(block(".monthNavLink")).not.toContain("text-transform");
    expect(block(".monthNavMonth")).not.toContain("text-transform");
    // Tracking follows the uppercase, for `wide-tracking`'s sake.
    expect(block(".monthNavMonth")).not.toContain("letter-spacing");
  });

  it("generateMetadata and the page share ONE parser — a hostile segment yields no canonical", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ mes: "//evil.example.com" }),
    });
    expect(metadata.alternates).toBeUndefined();
    expect(metadata.robots).toEqual({ index: false });
  });
});
