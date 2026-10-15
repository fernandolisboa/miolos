import { TIMED_GAMES, type MedalsResponse } from "@miolos/core";
import { act, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import StatsPage from "../app/estatisticas/page";
import styles from "../src/medals/medals-section.module.css";
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

function medalItems(container: HTMLElement): Element[] {
  return [...container.querySelectorAll(`.${styles.medal}`)];
}

describe("the earned medals (T-WEB-S161)", () => {
  it("draws one medal per earned id in catalog order, each a button named by the medal whose description is its tip — and silently drops an unknown id", async () => {
    const payload: MedalsResponse = {
      medals: ["streak-7", "some-future-medal", "first-win"],
    };
    medalsClient.fetchMedals.mockResolvedValue(payload);

    const { container } = render(<StatsPage />);

    expect(await screen.findByText(messages.medals.title)).toBeInTheDocument();
    const list = container.querySelector(`.${styles.list}`);
    expect(list?.tagName).toBe("UL");
    expect(list?.getAttribute("role")).toBe("list");

    const rows = within(list as HTMLElement).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(medalItems(container)).toHaveLength(2);

    const expected = ["first-win", "streak-7"] as const;
    rows.forEach((row, index) => {
      const copy = medalCopy[expected[index] ?? "first-win"];
      const button = within(row).getByRole("button", { name: copy.name });
      expect(button).toHaveAccessibleDescription(copy.description);
      expect(within(row).getByText(copy.name)).toBeVisible();
      expect(within(row).getByText(copy.description)).not.toBeVisible();
      expect(row.querySelectorAll("svg")).toHaveLength(1);
      expect(row.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    });
  });
});

describe("the medal section's nothings (T-WEB-S162)", () => {
  it("renders no medal DOM at all while unsettled, and the rest of the stats screen is unaffected", () => {
    medalsClient.fetchMedals.mockReturnValue(new Promise(() => undefined));

    const { container } = render(<StatsPage />);

    expect(screen.queryByText(messages.medals.title)).not.toBeInTheDocument();
    expect(medalItems(container)).toHaveLength(0);
    expect(container.querySelector(`.${styles.medals}`)).toBeNull();

    expect(screen.getByText(messages.stats.title)).toBeInTheDocument();
    expect(screen.getAllByText(messages.stats.rows.best)).toHaveLength(
      TIMED_GAMES.length,
    );
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
      expect(medalItems(container)).toHaveLength(0);
      expect(container.querySelector(`.${styles.medals}`)).toBeNull();

      expect(screen.getByText(messages.stats.title)).toBeInTheDocument();
      expect(
        screen.getByText(messages.stats.perfectDays.label),
      ).toBeInTheDocument();
    },
  );
});
