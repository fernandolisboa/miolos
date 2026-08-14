import type { MedalsResponse } from "@miolos/core";
import { act, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import StatsPage from "../app/estatisticas/page";
import styles from "../app/estatisticas/page.module.css";
import { messages } from "../src/i18n";
import { medalCopy } from "../src/medals/copy";

// #30's medal section (ADR-0052, D7/D8), driven through the page shell
// with all three clients MOCKED — the stats-page.test.tsx seam: CI's
// `impeccable detect` only ever scans the anonymous zero state, which for
// medals is NOTHING AT ALL (D8), so the earned renderings below are
// verified HERE, not by the detect green.

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
  // The stats surfaces stay unsettled: these suites are about the medal
  // section, and the skeleton stats screen around it is the control that
  // the section renders (or vanishes) independently.
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
    // Payload deliberately OUT of catalog order, with a shape-valid id the
    // bundled catalog does not know: catalog order is the display order
    // (no date exists on the wire to sort by — D7), and the unknown id is
    // dropped at render, never an error (the drop-unknown rule, D6).
    const payload: MedalsResponse = {
      medals: ["streak-7", "some-future-medal", "first-win"],
    };
    medalsClient.fetchMedals.mockResolvedValue(payload);

    const { container } = render(<StatsPage />);

    // The section arrives with its heading and a real <ul> of <li> rows —
    // the list idiom, never a tile grid. role="list" is explicit and
    // load-bearing: `list-style: none` strips WebKit's list semantics,
    // and the explicit role is the standard workaround (step-6 fix).
    expect(await screen.findByText(messages.medals.title)).toBeInTheDocument();
    const list = container.querySelector(`.${styles.medalList}`);
    expect(list?.tagName).toBe("UL");
    expect(list?.getAttribute("role")).toBe("list");

    // Exactly the two KNOWN medals render — the unknown id is dropped —
    // and the rows are reachable BY ROLE, not only by class.
    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(medalRows(container)).toHaveLength(2);

    // Catalog order, not payload order (first-win precedes streak-7), and
    // the TEXT is reachable inside each listitem: the visible words ARE
    // the accessible content — no aria-label composer, no aria-hidden on
    // the words. The composed-label li announced NOTHING on
    // Safari/VoiceOver (name-PROHIBITED generic + hidden text — the
    // step-6 correctness finding this test now guards against).
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
      // No aria-hidden ancestor may sever the words from the tree.
      expect(
        row.querySelector(`.${styles.medalWords}`)?.closest("[aria-hidden]"),
      ).toBeNull();
    }

    // Every row carries the ONE uniform stamp-ring hook (`--accent-app`
    // rides this class in page.module.css — A8: no per-game hue).
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

    // The control: the surrounding screen still renders its own surfaces.
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

      // Flush the mocked fetch's settle (two microtask hops: the client's
      // promise, then the hook's setValue) so the absence below is the
      // SETTLED state, not the trivial pre-fetch one: the section renders
      // nothing rather than an empty shell — a placeholder section would
      // be fake UI (D8).
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(medalsClient.fetchMedals).toHaveBeenCalled();
      expect(screen.queryByText(messages.medals.title)).not.toBeInTheDocument();
      expect(medalRows(container)).toHaveLength(0);
      expect(container.querySelector(`.${styles.medals}`)).toBeNull();

      // The control again: the stats screen is unaffected.
      expect(screen.getByText(messages.stats.title)).toBeInTheDocument();
      expect(
        screen.getByText(messages.stats.perfectDays.label),
      ).toBeInTheDocument();
    },
  );
});
