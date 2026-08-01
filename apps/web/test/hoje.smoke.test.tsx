import { GAMES, type Game } from "@miolos/core";
import { render, screen, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import HojePage from "../app/page";
import { formatElapsed, messages, playRoutes, routes } from "../src/i18n";
import {
  writePlayRecord,
  type SudokuPlayRecord,
} from "../src/play/play-record";
import { bodyOf, decl, stylesheet } from "./css-source";

// Smoke test for the Hoje screen (one per screen, spec seam 5). Every
// assertion goes through the messages module — never string literals —
// proving the copy is externalized.

/**
 * The hub renders the SERVER's São Paulo day (plan 018 §11.3): it is a
 * `force-dynamic` server component and derives the date itself, so the
 * records these tests seed have to be written under that same day. São Paulo
 * is UTC−3, so 12:00Z is 09:00 local on the same calendar date.
 */
const DATE = "2026-07-31";
const ELAPSED_MS = 512_000;
const ELAPSED = formatElapsed(ELAPSED_MS);

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

function concludedSudoku(
  overrides: Partial<SudokuPlayRecord> = {},
): SudokuPlayRecord {
  return {
    v: 1,
    game: "sudoku",
    date: DATE,
    entries: Array.from({ length: 81 }, () => null),
    grid: Array.from({ length: 9 }, () => DIGITS).flat(),
    elapsedMs: ELAPSED_MS,
    hintsUsed: 0,
    concluded: true,
    pendingSync: false,
    syncOutcome: "recorded",
    ...overrides,
  };
}

/** One game's card, scoped — four cards render the same chrome. */
function cardFor(game: Game): HTMLElement {
  const card = screen.getByText(messages.games[game].name).closest("article");
  if (card === null) {
    throw new Error(`the ${game} card is not inside an <article>`);
  }
  return card;
}

beforeEach(() => {
  // Only Date: the record store's 1 s poll stays on real timers, so nothing
  // here depends on advancing it.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(`${DATE}T12:00:00Z`));
  window.localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("Hoje page", () => {
  it("renders the masthead, meta line and streak from the messages module", () => {
    render(<HojePage />);
    // One product name, one source of truth: the hub renders `brand.wordmark`
    // itself now (plan 018 §13.1 finished the migration and deleted the
    // `hoje.wordmark` alias), and so do /binairo and the conclusion (§12.6).
    expect(screen.getByText(messages.brand.wordmark)).toBeInTheDocument();
    expect(
      screen.getByText(messages.hoje.completedOfTotal(0, 4)),
    ).toBeInTheDocument();
    expect(screen.getByText(messages.hoje.streak.label)).toBeInTheDocument();
    expect(
      screen.getByLabelText(messages.hoje.streak.aria(0)),
    ).toBeInTheDocument();
  });

  it("renders all four game cards pending, with copy from the messages module", () => {
    render(<HojePage />);
    for (const game of Object.values(messages.games)) {
      expect(screen.getByText(game.name)).toBeInTheDocument();
      expect(screen.getByText(game.kicker)).toBeInTheDocument();
      expect(screen.getByText(game.description)).toBeInTheDocument();
    }
    expect(screen.getAllByText(messages.hoje.playCta)).toHaveLength(4);
    expect(screen.getAllByText(messages.hoje.playCtaShort)).toHaveLength(4);
  });

  it("renders the secondary links from the messages module", () => {
    render(<HojePage />);
    for (const label of Object.values(messages.hoje.links)) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("reserves both dormant ad-slot placements at their final heights", () => {
    const { container } = render(<HojePage />);
    const desktop = container.querySelector<HTMLElement>(
      '[data-ad-placement="hub-desktop"]',
    );
    const mobile = container.querySelector<HTMLElement>(
      '[data-ad-placement="hub-mobile"]',
    );
    expect(desktop).not.toBeNull();
    expect(mobile).not.toBeNull();
    expect(desktop?.style.minHeight).toBe("60px");
    expect(mobile?.style.minHeight).toBe("64px");
  });

  it("never uses the frames' streak labels (amendment table: sequência)", () => {
    const { container } = render(<HojePage />);
    expect(container.textContent).not.toContain("dias seguidos");
  });
});

/**
 * The tiles read THIS DEVICE's day state (ADR-0031, plan 018 §11.3). It can
 * only understate: a game solved on another device reads pending here, which
 * is also the cold-profile answer and also what `impeccable detect` scans.
 */
describe("the hub's done/pending tiles (T-WEB-S16)", () => {
  it("links exactly the games that have a play route, and nothing else", () => {
    render(<HojePage />);

    // Driven by the map itself rather than by a count (this replaces plan
    // 017's `links only the Binairo card`): #25/#27 add a key to `playRoutes`
    // and this assertion follows them without an edit.
    expect(Object.keys(playRoutes).length).toBeGreaterThan(0);
    for (const game of GAMES) {
      const cta = within(cardFor(game))
        .getByText(messages.hoje.playCta)
        .closest("a");
      const route = playRoutes[game];
      if (route === undefined) {
        // A dead href would be fake navigation.
        expect(cta).not.toHaveAttribute("href");
      } else {
        expect(cta).toHaveAttribute("href", route);
      }
    }
  });

  it("renders a concluded game as a Feito chip plus its own tabular result", () => {
    writePlayRecord(concludedSudoku());

    render(<HojePage />);

    const card = within(cardFor("sudoku"));
    expect(card.getByText(messages.hoje.done)).toBeInTheDocument();
    // Two result strings, one hidden per viewport — a distinct mobile string,
    // never a runtime truncation (F1:64 "em 07:12", F2:63 "07:12").
    expect(
      card.getByText(messages.hoje.doneResultLong(ELAPSED)),
    ).toBeInTheDocument();
    expect(
      card.getByText(messages.hoje.doneResultShort(ELAPSED)),
    ).toBeInTheDocument();
    expect(card.queryByText(messages.hoje.playCta)).not.toBeInTheDocument();
    // Only that card: the other three keep the pending button.
    expect(screen.getAllByText(messages.hoje.playCta)).toHaveLength(3);
    expect(
      screen.getByText(messages.hoje.completedOfTotal(1, 4)),
    ).toBeInTheDocument();
  });

  it("keeps the done card navigable, where the frame draws an inert span", () => {
    // Deviation 12 (plan 018 §11.3): with the archive at #31, an inert done
    // card would leave a player no in-app route back to the conclusion they
    // just earned — /sudoku restores straight into it.
    writePlayRecord(concludedSudoku());

    render(<HojePage />);

    const link = within(cardFor("sudoku")).getByLabelText(
      messages.hoje.doneAria(messages.games.sudoku.name, ELAPSED),
    );
    expect(link).toHaveAttribute("href", routes.sudoku);
  });

  it("understates rather than guesses: a part-played record reads pending", () => {
    writePlayRecord(concludedSudoku({ concluded: false, grid: undefined }));

    render(<HojePage />);

    const card = within(cardFor("sudoku"));
    expect(card.queryByText(messages.hoje.done)).not.toBeInTheDocument();
    expect(card.getByText(messages.hoje.playCta)).toBeInTheDocument();
    expect(
      screen.getByText(messages.hoje.completedOfTotal(0, 4)),
    ).toBeInTheDocument();
  });
});

describe("the hub's first paint (T-WEB-S17)", () => {
  it("paints every card pending, without reading storage or the clock", () => {
    writePlayRecord(concludedSudoku());
    const readStorage = vi.spyOn(Storage.prototype, "getItem");
    const clock = vi.spyOn(Date, "now");

    // The server render IS the pre-hydration paint: `useSyncExternalStore`
    // takes the server snapshot, so this markup is exactly what the client
    // hydrates against, and hydration can only ever ADD a done tile — the
    // monotone direction (ADR-0031).
    const markup = renderToStaticMarkup(<HojePage />);

    expect(readStorage).not.toHaveBeenCalled();
    expect(clock).not.toHaveBeenCalled();
    expect(markup).toContain(messages.hoje.completedOfTotal(0, 4));
    expect(markup).not.toContain(messages.hoje.done);
    expect(markup).not.toContain(ELAPSED);
  });

  /**
   * jsdom has no layout, so the reserved box can only be asserted as the
   * declaration the stylesheet actually ships (see ./css-source). `.cta`'s
   * computed desktop height is `var(--space-3)` 12px + the 14px
   * `--text-button` line box + 12px = 38px, and the done state is a
   * structurally different element — an outlined chip plus a tabular result —
   * so its height is not automatically equal. One custom property feeds both,
   * which makes them identical by construction rather than by measurement
   * (plan 018 §11.3).
   */
  it("reserves one box for the pending button and for the done stamp", () => {
    const css = stylesheet("app/page.module.css");

    expect(decl(bodyOf(css, ".card"), "--cta-box-min-height")).toBe("38px");
    expect(decl(bodyOf(css, ".cta"), "min-height")).toBe(
      "var(--cta-box-min-height)",
    );
    expect(decl(bodyOf(css, ".done"), "min-height")).toBe(
      "var(--cta-box-min-height)",
    );

    // And the mobile touch target reaches both for the same reason.
    const mobile = bodyOf(css, "@media (max-width: 768px)");
    expect(decl(bodyOf(mobile, ".card"), "--cta-box-min-height")).toBe(
      "var(--touch-target-min)",
    );
  });
});
