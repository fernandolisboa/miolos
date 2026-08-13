import { GAMES, type Game } from "@miolos/core";
import { render, screen, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HubStreak } from "../app/hub-streak";
import HojePage from "../app/page";
import { formatElapsed, messages, playRoutes, routes } from "../src/i18n";
import {
  writePlayRecord,
  type NonogramPlayRecord,
  type SudokuPlayRecord,
  type TermoPlayRecord,
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

const NONOGRAM_ELAPSED_MS = 623_000;
const NONOGRAM_ELAPSED = formatElapsed(NONOGRAM_ELAPSED_MS);

function concludedNonogram(
  overrides: Partial<NonogramPlayRecord> = {},
): NonogramPlayRecord {
  return {
    v: 1,
    game: "nonogram",
    date: DATE,
    size: 5,
    entries: Array.from({ length: 25 }, () => null),
    grid: Array.from({ length: 25 }, (_unused, index) =>
      index % 3 === 0 ? 1 : 0,
    ),
    elapsedMs: NONOGRAM_ELAPSED_MS,
    hintsUsed: 0,
    concluded: true,
    pendingSync: false,
    syncOutcome: "recorded",
    ...overrides,
  };
}

/**
 * Termo's two closed shapes (#27, ADR-0044). NEITHER publishes a duration:
 * a lost Termo is *played* and a won one's elapsed time includes every
 * per-guess round trip, so ADR-0045 decision 4 keeps the number off the tile.
 */
type Tiles = TermoPlayRecord["guesses"][number]["tiles"];
const TERMO_MISS: Tiles = ["absent", "present", "absent", "absent", "present"];
const TERMO_WIN: Tiles = [
  "correct",
  "correct",
  "correct",
  "correct",
  "correct",
];

function wonTermo(overrides: Partial<TermoPlayRecord> = {}): TermoPlayRecord {
  return {
    v: 1,
    game: "termo",
    date: DATE,
    guesses: [
      { guess: "cafes", tiles: [...TERMO_MISS] },
      { guess: "praga", tiles: [...TERMO_WIN] },
    ],
    answer: "praga",
    outcome: "won",
    elapsedMs: 188_000,
    hintsUsed: 0,
    concluded: true,
    pendingSync: false,
    syncOutcome: "recorded",
    ...overrides,
  };
}

const lostTermo = () =>
  wonTermo({
    guesses: "abcdef".split("").map((letter) => ({
      guess: letter.repeat(5),
      tiles: [...TERMO_MISS],
    })),
    outcome: "lost",
  });

/** One game's card, scoped — four cards render the same chrome. */
function cardFor(game: Game): HTMLElement {
  const card = screen.getByText(messages.games[game].name).closest("article");
  if (card === null) {
    throw new Error(`the ${game} card is not inside an <article>`);
  }
  return card;
}

/** The streak fetch's answer in this suite: an anonymous 401, so every hub
 *  case keeps the shipped zero state and every existing assertion —
 *  `streak.aria(0)` included — passes unchanged. */
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  // Only Date: the record store's 1 s poll stays on real timers, so nothing
  // here depends on advancing it.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(`${DATE}T12:00:00Z`));
  window.localStorage.clear();
  // The env stub and the fetch stub are a MANDATORY PAIR (plan 027 §8, the
  // shipped API-client suites' discipline): with only the fetch stub,
  // `fetchStreak`'s env guard short-circuits, the stub is dead code and
  // every hub case logs the loud console.error the guard exists for.
  vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.example.test");
  fetchMock = vi.fn(() =>
    Promise.resolve(
      new Response(JSON.stringify({ error: "no-session" }), { status: 401 }),
    ),
  );
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
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
    // 017's `links only the Binairo card`): #23 added sudoku's key to
    // `playRoutes` and #25 nonogram's, #27 added termo's, and this assertion
    // follows them without an edit. The map is total since #75, so there is
    // no dead-href arm left to assert — every card links its route.
    expect(Object.keys(playRoutes).length).toBeGreaterThan(0);
    for (const game of GAMES) {
      const cta = within(cardFor(game))
        .getByText(messages.hoje.playCta)
        .closest("a");
      expect(cta).toHaveAttribute("href", playRoutes[game]);
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

  it("keeps a PLAYED game out of the meta line's count (T-WEB-S80)", () => {
    // ADR-0008 decision 4 / ADR-0044 decision 5: a lost Termo is *played*,
    // never *completed*, and "a day containing a lost Termo is not perfect,
    // whatever else happened." `HubProgress` therefore reads `completedCount`
    // and a played entry does not move it.
    //
    // The meta line is the half of that split B6 could drive with no route in
    // `playRoutes`; the termo CARD's own shape is asserted in the activation
    // block below, which is where the other half landed (T-WEB-S101).
    writePlayRecord(concludedSudoku());
    writePlayRecord(lostTermo());

    render(<HojePage />);

    expect(
      screen.getByText(messages.hoje.completedOfTotal(1, 4)),
    ).toBeInTheDocument();
  });

  it("counts a WON termo, which publishes no duration at all", () => {
    // The other side: `completed` with `elapsedMs: undefined` is still a
    // completion, and the count is the one place that must not confuse the
    // missing number for a missing result.
    writePlayRecord(concludedSudoku());
    writePlayRecord(wonTermo());

    render(<HojePage />);

    expect(
      screen.getByText(messages.hoje.completedOfTotal(2, 4)),
    ).toBeInTheDocument();
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

/**
 * The activation itself (T-WEB-S55, plan 020 §17). `playRoutes.nonogram` is
 * the whole behavioural change #25 makes to this already-shipped screen: the
 * card's action stops being an href-less `<a>` and becomes a `<Link>`.
 *
 * T-WEB-S16's first case cannot prove it. That one reads `playRoutes[game]`
 * on both sides of its assertion, so it follows the map wherever it goes and
 * would stay green with the key absent — which is exactly what makes it a
 * good structural test and a useless activation test. These two name
 * `routes.nonogram` instead.
 */
describe("the Nonogram tile, activated (T-WEB-S55)", () => {
  it("gives the pending card a real href, where it had none", () => {
    render(<HojePage />);

    const cta = within(cardFor("nonogram"))
      .getByText(messages.hoje.playCta)
      .closest("a");
    expect(cta).toHaveAttribute("href", routes.nonogram);
  });

  it("keeps the concluded card navigable back to its conclusion", () => {
    writePlayRecord(concludedNonogram());

    render(<HojePage />);

    const link = within(cardFor("nonogram")).getByLabelText(
      messages.hoje.doneAria(messages.games.nonogram.name, NONOGRAM_ELAPSED),
    );
    expect(link).toHaveAttribute("href", routes.nonogram);
    expect(
      screen.getByText(messages.hoje.completedOfTotal(1, 4)),
    ).toBeInTheDocument();
  });
});

/**
 * #27's own copy of T-WEB-S55, which the block above says in terms is owed
 * (plan 022 §17.2). `playRoutes.termo` is the whole behavioural change #27
 * makes to this already-shipped screen, and Termo is the LAST of the four to
 * be routed: the instant the key lands, `hub-day-state.tsx`'s `route ===
 * undefined` branch is dead for every game and the front door's first card
 * stops being an href-less `<a>`.
 *
 * The three cases here are the three shapes that card can now take — pending,
 * won and lost — and the last two are the `.done`-link half of **T-WEB-S80**,
 * which commit B6 could not drive: with no route in the map, `HubCardAction`
 * returned the href-less anchor whatever the day state said, so B6 drove the
 * meta-line half alone and deferred this one here. Both statuses have to be
 * asserted, because `HubCardAction`'s guard splits on `status` and never on
 * `elapsedMs` (plan 022 §15.3) and neither Termo shape publishes a duration:
 * the shipped `elapsedMs !== undefined` guard would have dropped BOTH through
 * to "Jogar hoje", on a game that can no longer be played today.
 */
describe("the Termo tile, activated (T-WEB-S101)", () => {
  it("gives the pending card a real href, where it had none", () => {
    render(<HojePage />);

    const cta = within(cardFor("termo"))
      .getByText(messages.hoje.playCta)
      .closest("a");
    expect(cta).toHaveAttribute("href", routes.termo);
  });

  it("renders a WON termo as a done link, with no duration (T-WEB-S80)", () => {
    // `completedAria`, not `doneAria`: the third composer exists because a won
    // Termo is completed and has no duration to name (ADR-0045 decision 4).
    writePlayRecord(wonTermo());

    render(<HojePage />);

    const card = within(cardFor("termo"));
    const link = card.getByLabelText(
      messages.hoje.completedAria(messages.games.termo.name),
    );
    expect(link).toHaveAttribute("href", routes.termo);
    expect(card.getByText(messages.hoje.done)).toBeInTheDocument();
    expect(card.queryByText(messages.hoje.playCta)).not.toBeInTheDocument();
    // No duration at all — not the record's own, not any other. `formatElapsed`
    // output is `mm:ss`, so the absence is asserted on the shape.
    expect(cardFor("termo").textContent).not.toMatch(/\d{2}:\d{2}/);
    expect(
      screen.getByText(messages.hoje.completedOfTotal(1, 4)),
    ).toBeInTheDocument();
  });

  it("renders a LOST termo as a played link, never the play CTA (T-WEB-S80)", () => {
    writePlayRecord(lostTermo());

    render(<HojePage />);

    const card = within(cardFor("termo"));
    const link = card.getByLabelText(
      messages.hoje.playedAria(messages.games.termo.name),
    );
    expect(link).toHaveAttribute("href", routes.termo);
    // The hub's chip register is capitalised — "Jogado", against the day
    // card's lowercase "jogado" (plan 022 §15.3).
    expect(card.getByText(messages.hoje.played)).toBeInTheDocument();
    expect(card.queryByText(messages.hoje.done)).not.toBeInTheDocument();
    expect(card.queryByText(messages.hoje.playCta)).not.toBeInTheDocument();
    expect(cardFor("termo").textContent).not.toMatch(/\d{2}:\d{2}/);
    // And it is still not a completion.
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

/**
 * T-WEB-S17's contract extended over the streak island (#19, plan 027 §8):
 * the streak arrives in a MOUNT EFFECT only, so the server render — which is
 * also the pre-hydration paint — still touches nothing. The positive control
 * is the #28 convention: the same spy the negative reads is proven live by
 * the client render beside it, so the negative cannot go vacuously green.
 */
describe("the hub's first paint stays fetch-free (T-WEB-S127)", () => {
  it("renders the server markup without storage, clock or fetch", () => {
    const readStorage = vi.spyOn(Storage.prototype, "getItem");
    const clock = vi.spyOn(Date, "now");

    const markup = renderToStaticMarkup(<HojePage />);

    expect(readStorage).not.toHaveBeenCalled();
    expect(clock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    // The server markup shows the honest zero the client hydrates against;
    // hydration only ever raises it (ADR-0031's monotone direction).
    expect(markup).toContain(messages.hoje.streak.aria(0));
  });

  it("control: the island's mount effect does fire the same spy", async () => {
    render(<HubStreak />);
    // Two microtask turns settle the mock's promise chain.
    await Promise.resolve();
    await Promise.resolve();

    expect(fetchMock).toHaveBeenCalledWith("https://api.example.test/streak", {
      credentials: "include",
    });
  });
});
