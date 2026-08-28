import type { MedalsResponse } from "@miolos/core";
import { act, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import StatsPage from "../app/estatisticas/page";
import styles from "../app/estatisticas/page.module.css";
import { messages } from "../src/i18n";
import { medalCopy } from "../src/medals/copy";

const clients = vi.hoisted(() => ({
  fetchStats: vi.fn(),
  fetchStatsCalendar: vi.fn(),
}));
vi.mock("../src/stats/stats-client", () => clients);

const medalsClient = vi.hoisted(() => ({
  fetchMedals: vi.fn(),
}));
vi.mock("../src/medals/medals-client", () => medalsClient);

beforeEach(() => {
  clients.fetchStats.mockReturnValue(new Promise(() => undefined));
  clients.fetchStatsCalendar.mockReturnValue(new Promise(() => undefined));
});

afterEach(() => {
  vi.restoreAllMocks();
});

function medalRows(container: HTMLElement): Element[] {
  return [...container.querySelectorAll(`.${styles.medalRow}`)];
}

describe("the earned medal list (T-WEB-S161)", () => {
  it("renders LIST rows in catalog order whose visible name and description are the reachable accessible content, with the uniform stamp-ring — and silently drops an unknown id", async () => {
    const payload: MedalsResponse = {
      medals: ["streak-7", "some-future-medal", "first-win"],
    };
    medalsClient.fetchMedals.mockResolvedValue(payload);

    const { container } = render(<StatsPage />);

    expect(await screen.findByText(messages.medals.title)).toBeInTheDocument();
    const list = container.querySelector(`.${styles.medalList}`);
    expect(list?.tagName).toBe("UL");
    expect(list?.getAttribute("role")).toBe("list");

    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(medalRows(container)).toHaveLength(2);

    const [first, second] = rows as [HTMLElement, HTMLElement];
    expect(
      within(first).getByText(medalCopy["first-win"].name),
    ).toBeInTheDocument();
    expect(
      within(first).getByText(medalCopy["first-win"].description),
    ).toBeInTheDocument();
    expect(
      within(second).getByText(medalCopy["streak-7"].name),
    ).toBeInTheDocument();
    expect(
      within(second).getByText(medalCopy["streak-7"].description),
    ).toBeInTheDocument();
    for (const row of rows) {
      expect(
        row.querySelector(`.${styles.medalWords}`)?.closest("[aria-hidden]"),
      ).toBeNull();
    }

    for (const row of rows) {
      expect(row.querySelectorAll(`.${styles.medalRing}`)).toHaveLength(1);
    }
  });
});

describe("the medal section's nothings (T-WEB-S162)", () => {
  it("renders no medal DOM at all while unsettled, and the rest of the stats screen is unaffected", () => {
    medalsClient.fetchMedals.mockReturnValue(new Promise(() => undefined));

    const { container } = render(<StatsPage />);

    expect(screen.queryByText(messages.medals.title)).not.toBeInTheDocument();
    expect(medalRows(container)).toHaveLength(0);
    expect(container.querySelector(`.${styles.medals}`)).toBeNull();

    expect(screen.getByText(messages.stats.title)).toBeInTheDocument();
    expect(screen.getAllByText(messages.stats.rows.best)).toHaveLength(3);
  });

  it.each([
    ["settled-null", undefined],
    ["zero earned", { medals: [] }],
    [
      "all-unknown ids",
      { medals: ["some-future-medal", "another-future-medal"] },
    ],
  ])(
    "renders no medal DOM at all on %s — no heading, no count, no placeholder",
    async (_label, payload) => {
      medalsClient.fetchMedals.mockResolvedValue(payload);

      const { container } = render(<StatsPage />);

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(medalsClient.fetchMedals).toHaveBeenCalled();
      expect(screen.queryByText(messages.medals.title)).not.toBeInTheDocument();
      expect(medalRows(container)).toHaveLength(0);
      expect(container.querySelector(`.${styles.medals}`)).toBeNull();

      expect(screen.getByText(messages.stats.title)).toBeInTheDocument();
      expect(
        screen.getByText(messages.stats.perfectDays.label),
      ).toBeInTheDocument();
    },
  );
});
