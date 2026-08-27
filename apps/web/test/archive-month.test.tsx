import { readFileSync } from "node:fs";
import { join } from "node:path";

import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { formatLongDate, formatMonth, messages } from "../src/i18n";

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
  it("renders that month's calendar grid with previous/next month navigation", async () => {
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

    const { container } = render(
      await ArchiveMonthPage({ params: Promise.resolve({ mes: "2026-08" }) }),
    );

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

    const grid = container.querySelector("[class*='calendarGrid']");
    expect(grid).not.toBeNull();
    expect((grid as HTMLElement).querySelectorAll("li")).toHaveLength(42);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);

    expect(
      screen.getByRole("link", {
        name: messages.archive.calendar.dayAria(
          formatLongDate("2026-08-02"),
          "domingo",
        ),
      }),
    ).toHaveAttribute("href", "/arquivo/2026-08-02");

    expect(screen.queryByText("2 de agosto de 2026")).toBeNull();

    const anchors = [...container.querySelectorAll("a")].map(
      (anchor) => anchor.getAttribute("href") ?? "",
    );
    expect(
      anchors.filter((href) => /^\/arquivo\/\d{4}-\d{2}-\d{2}$/.test(href)),
    ).toEqual(["/arquivo/2026-08-01", "/arquivo/2026-08-02"]);

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

    expect(
      screen.getByRole("link", { name: messages.archive.backToIndexAria }),
    ).toHaveAttribute("href", "/arquivo");
  });

  it("each sibling link is ABSENT at the archive's own edges", async () => {
    spies.listArchivedDays.mockResolvedValue([
      { date: "2026-08-01", game: "binairo" },
    ]);
    spies.listArchivedMonths.mockResolvedValue(["2026-08"]);

    render(
      await ArchiveMonthPage({ params: Promise.resolve({ mes: "2026-08" }) }),
    );

    expect(screen.queryByText(/Mês anterior/)).toBeNull();
    expect(screen.queryByText(/Próximo mês/)).toBeNull();

    expect(screen.getAllByText(/←/)).toHaveLength(1);
  });

  it("a month with no archived day is notFound(), and so is a malformed segment", async () => {
    spies.listArchivedDays.mockResolvedValue([]);
    spies.listArchivedMonths.mockResolvedValue(["2026-08"]);
    await expect(
      ArchiveMonthPage({ params: Promise.resolve({ mes: "2026-05" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(spies.notFound).toHaveBeenCalled();

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

  it("no element of the month page can reach impeccable's all-caps gate, in any month", async () => {
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
      for (const el of container.querySelectorAll("*")) {
        if (/^H[1-6]$/.test(el.tagName)) {
          continue;
        }

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

      const kickers = [...nav!.querySelectorAll("span")].map(
        (s) => s.textContent,
      );
      expect(kickers).toContain(messages.archive.month.previous);
      expect(kickers).toContain(formatMonth(`${previous}-01`));

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

    expect(block(".monthNavMonth")).not.toContain("letter-spacing");

    expect(block(".weekday")).toContain("text-transform: uppercase");
    expect(block(".dayCellLink")).not.toContain("text-transform");
    expect(block(".dayNumeral")).not.toContain("text-transform");
  });

  it("generateMetadata and the page share ONE parser — a hostile segment yields no canonical", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ mes: "//evil.example.com" }),
    });
    expect(metadata.alternates).toBeUndefined();
    expect(metadata.robots).toEqual({ index: false });
  });
});
