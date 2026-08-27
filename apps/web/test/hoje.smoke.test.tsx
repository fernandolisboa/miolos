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

function cardFor(game: Game): HTMLElement {
  const card = screen.getByText(messages.games[game].name).closest("article");
  if (card === null) {
    throw new Error(`the ${game} card is not inside an <article>`);
  }
  return card;
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(`${DATE}T12:00:00Z`));
  window.localStorage.clear();

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

describe("the hub's done/pending tiles (T-WEB-S16)", () => {
  it("links exactly the games that have a play route, and nothing else", () => {
    render(<HojePage />);

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

    expect(
      card.getByText(messages.hoje.doneResultLong(ELAPSED)),
    ).toBeInTheDocument();
    expect(
      card.getByText(messages.hoje.doneResultShort(ELAPSED)),
    ).toBeInTheDocument();
    expect(card.queryByText(messages.hoje.playCta)).not.toBeInTheDocument();

    expect(screen.getAllByText(messages.hoje.playCta)).toHaveLength(3);
    expect(
      screen.getByText(messages.hoje.completedOfTotal(1, 4)),
    ).toBeInTheDocument();
  });

  it("keeps the done card navigable, where the frame draws an inert span", () => {
    writePlayRecord(concludedSudoku());

    render(<HojePage />);

    const link = within(cardFor("sudoku")).getByLabelText(
      messages.hoje.doneAria(messages.games.sudoku.name, ELAPSED),
    );
    expect(link).toHaveAttribute("href", routes.sudoku);
  });

  it("keeps a PLAYED game out of the meta line's count (T-WEB-S80)", () => {
    //

    writePlayRecord(concludedSudoku());
    writePlayRecord(lostTermo());

    render(<HojePage />);

    expect(
      screen.getByText(messages.hoje.completedOfTotal(1, 4)),
    ).toBeInTheDocument();
  });

  it("counts a WON termo, which publishes no duration at all", () => {
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

describe("the Termo tile, activated (T-WEB-S101)", () => {
  it("gives the pending card a real href, where it had none", () => {
    render(<HojePage />);

    const cta = within(cardFor("termo"))
      .getByText(messages.hoje.playCta)
      .closest("a");
    expect(cta).toHaveAttribute("href", routes.termo);
  });

  it("renders a WON termo as a done link, with no duration (T-WEB-S80)", () => {
    writePlayRecord(wonTermo());

    render(<HojePage />);

    const card = within(cardFor("termo"));
    const link = card.getByLabelText(
      messages.hoje.completedAria(messages.games.termo.name),
    );
    expect(link).toHaveAttribute("href", routes.termo);
    expect(card.getByText(messages.hoje.done)).toBeInTheDocument();
    expect(card.queryByText(messages.hoje.playCta)).not.toBeInTheDocument();

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

    expect(card.getByText(messages.hoje.played)).toBeInTheDocument();
    expect(card.queryByText(messages.hoje.done)).not.toBeInTheDocument();
    expect(card.queryByText(messages.hoje.playCta)).not.toBeInTheDocument();
    expect(cardFor("termo").textContent).not.toMatch(/\d{2}:\d{2}/);

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

    const markup = renderToStaticMarkup(<HojePage />);

    expect(readStorage).not.toHaveBeenCalled();
    expect(clock).not.toHaveBeenCalled();
    expect(markup).toContain(messages.hoje.completedOfTotal(0, 4));
    expect(markup).not.toContain(messages.hoje.done);
    expect(markup).not.toContain(ELAPSED);
  });

  it("reserves one box for the pending button and for the done stamp", () => {
    const css = stylesheet("app/page.module.css");

    expect(decl(bodyOf(css, ".card"), "--cta-box-min-height")).toBe("38px");
    expect(decl(bodyOf(css, ".cta"), "min-height")).toBe(
      "var(--cta-box-min-height)",
    );
    expect(decl(bodyOf(css, ".done"), "min-height")).toBe(
      "var(--cta-box-min-height)",
    );

    const mobile = bodyOf(css, "@media (max-width: 768px)");
    expect(decl(bodyOf(mobile, ".card"), "--cta-box-min-height")).toBe(
      "var(--touch-target-min)",
    );
  });
});

describe("the hub's first paint stays fetch-free (T-WEB-S127)", () => {
  it("renders the server markup without storage, clock or fetch", () => {
    const readStorage = vi.spyOn(Storage.prototype, "getItem");
    const clock = vi.spyOn(Date, "now");

    const markup = renderToStaticMarkup(<HojePage />);

    expect(readStorage).not.toHaveBeenCalled();
    expect(clock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();

    expect(markup).toContain(messages.hoje.streak.aria(0));
  });

  it("control: the island's mount effect does fire the same spy", async () => {
    render(<HubStreak />);

    await Promise.resolve();
    await Promise.resolve();

    expect(fetchMock).toHaveBeenCalledWith("https://api.example.test/streak", {
      credentials: "include",
    });
  });
});
