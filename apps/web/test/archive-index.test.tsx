import type { Game } from "@miolos/core";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ArchiveIndexView } from "../app/arquivo/index-view";
import { recentDayGroups } from "../src/archive/group-days";
import { formatLongDate, formatMonth, messages } from "../src/i18n";

// The archive index (#31 AC 1/AC 5, ADR-0053 decision 1). The page above the
// view is a reader call plus a branch; every composition claim lives here,
// against the synchronous view RTL can render.

const GAMES: readonly Game[] = ["binairo", "nonogram", "sudoku", "termo"];

/** The reader's own shape: `(date, game)` pairs, `date DESC, game ASC`. */
function pairs(
  entries: readonly (readonly [string, readonly Game[]])[],
): readonly { readonly date: string; readonly game: Game }[] {
  return entries.flatMap(([date, games]) =>
    games.map((game) => ({ date, game })),
  );
}

describe("the archive index (T-WEB-S167)", () => {
  it("renders recent day rows and one link per archived month, newest first", () => {
    render(
      <ArchiveIndexView
        recent={[
          { date: "2026-08-13", games: [...GAMES] },
          { date: "2026-08-12", games: [...GAMES] },
        ]}
        months={["2026-08", "2026-07"]}
      />,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: messages.archive.title }),
    ).toBeInTheDocument();
    expect(screen.getByText(messages.archive.lead)).toBeInTheDocument();

    // Day rows are LINKS to the day page, one per date — not four game links
    // per date, which is the whole reason a day page exists.
    const newest = screen.getByRole("link", {
      name: messages.archive.dayRowAria(
        formatLongDate("2026-08-13"),
        GAMES.map((game) => messages.games[game].name),
      ),
    });
    expect(newest).toHaveAttribute("href", "/arquivo/2026-08-13");

    const months = screen.getAllByRole("link", { name: /de 2026$/ });
    expect(months.map((link) => link.getAttribute("href"))).toEqual([
      "/arquivo/mes/2026-08",
      "/arquivo/mes/2026-07",
    ]);
    expect(months[0]).toHaveTextContent(formatMonth("2026-08-01"));
  });

  it("the dates render in the tabular register, and the rows are not a tile grid", () => {
    const { container } = render(
      <ArchiveIndexView
        recent={[{ date: "2026-08-13", games: ["sudoku"] }]}
        months={["2026-08"]}
      />,
    );

    // ADR-0036 decision 1: a column of dates is a column of figures.
    const date = screen.getByText(formatLongDate("2026-08-13"));
    expect(date.className).toContain("rowDate");

    // A LIST of rows, never a grid of tiles — the rounded-icon-tile idiom is
    // an anti-reference, and a day row inside a card inside a section is how
    // card-inside-card happens.
    const list = container.querySelector("ul[class*='rows']");
    expect(list).not.toBeNull();
    expect(within(list as HTMLElement).getAllByRole("listitem")).toHaveLength(
      1,
    );
  });

  it("the over-fetch discards a trailing group that may be cut mid-date, then takes seven", () => {
    // 32 rows back over NINE dates: the window is full, so the last group is
    // possibly truncated and goes. `limit: 28` would have been wrong here —
    // 28 rows span eight dates once any date is short, and the eighth
    // truncates silently.
    const rows = pairs([
      ["2026-08-13", GAMES],
      ["2026-08-12", GAMES],
      ["2026-08-11", GAMES],
      ["2026-08-10", GAMES],
      ["2026-08-09", GAMES],
      ["2026-08-08", GAMES],
      ["2026-08-07", GAMES],
      ["2026-08-06", GAMES],
      ["2026-08-05", ["binairo", "nonogram", "sudoku", "termo"]],
    ]);
    expect(rows).toHaveLength(36);
    const full = recentDayGroups(rows.slice(0, 32), { limit: 32, count: 7 });
    expect(full.map((group) => group.date)).toEqual([
      "2026-08-13",
      "2026-08-12",
      "2026-08-11",
      "2026-08-10",
      "2026-08-09",
      "2026-08-08",
      "2026-08-07",
    ]);
    // The 32nd row is the first of 2026-08-05, and that partial group is the
    // one discarded: eight complete groups remain, seven render.
    expect(full).toHaveLength(7);

    // A SHORT window reached the archive's own floor, so nothing can be
    // truncated and the last group is kept.
    const short = pairs([
      ["2026-08-02", ["binairo", "sudoku"]],
      ["2026-08-01", ["binairo"]],
    ]);
    expect(
      recentDayGroups(short, { limit: 32, count: 7 }).map(
        (group) => group.date,
      ),
    ).toEqual(["2026-08-02", "2026-08-01"]);
  });
});

describe("the empty archive (T-WEB-S168)", () => {
  it("renders the honest pt-BR empty state with its marker — not a skeleton, not a 404", () => {
    const { container } = render(<ArchiveIndexView recent={[]} months={[]} />);

    expect(screen.getByText(messages.archive.empty)).toBeInTheDocument();
    // The resource exists and is empty. The marker is what the visual gate
    // asserts on, so it must be present in the empty state too.
    expect(container.querySelector("[data-page='arquivo']")).not.toBeNull();
    // No fake rows, no greyed slots, no skeleton.
    expect(screen.queryByRole("listitem")).toBeNull();
    expect(
      screen.queryByText(messages.archive.recent.heading),
    ).not.toBeInTheDocument();
  });
});

describe("the ragged archive, which is the real one (T-WEB-S182)", () => {
  it("a short day renders fewer names and NO placeholder", () => {
    render(
      <ArchiveIndexView
        recent={[
          // 2026-08-02 held two games; 2026-08-01 held one. Identical to the
          // shape a `killed_at` takedown produces, which matters because the
          // kill switch is the archive's whole reason for being uncached.
          { date: "2026-08-02", games: ["binairo", "sudoku"] },
          { date: "2026-08-01", games: ["binairo"] },
        ]}
        months={["2026-08"]}
      />,
    );

    const short = screen.getByRole("link", {
      name: messages.archive.dayRowAria(formatLongDate("2026-08-01"), [
        messages.games.binairo.name,
      ]),
    });
    // Exactly one name, and nothing standing in for the other three.
    expect(short).toHaveTextContent(messages.games.binairo.name);
    expect(short).not.toHaveTextContent(messages.games.termo.name);
    expect(short.textContent).not.toMatch(/de 4|—|--/);
  });

  it("the payload bounds hold — a 31-day month is at most 33 anchors, and the index lists one entry per month", () => {
    const dates = Array.from(
      { length: 31 },
      (_, index) => `2026-08-${String(index + 1).padStart(2, "0")}`,
    );
    const { container } = render(
      <ArchiveIndexView
        recent={dates.slice(0, 7).map((date) => ({ date, games: [...GAMES] }))}
        months={["2026-08", "2026-07"]}
      />,
    );
    // Seven day rows + two month chips + the one back link in the top bar.
    expect(container.querySelectorAll("a")).toHaveLength(10);
    // One entry per MONTH, never per day — the index's month list grows at
    // 12 rows a year, so it cannot reach a 2,000-element payload this decade.
    expect(screen.getAllByRole("link", { name: /de 2026$/ })).toHaveLength(2);
  });
});
