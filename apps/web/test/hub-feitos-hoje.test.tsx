import { GAMES, type DayResponse, type Game } from "@miolos/core";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { formatElapsed, messages, playRoutes } from "../src/i18n";
import { DAY_GAMES } from "../src/play/day-games";
import {
  playRecordKey,
  writePlayRecord,
  type BinairoPlayRecord,
  type SudokuPlayRecord,
  type TermoPlayRecord,
} from "../src/play/play-record";
import { bodyOf, decl, stylesheet } from "./css-source";
import { jsonResponse, urlOf } from "./fetch-stub";
import { tileFor } from "./hub-tile";

const DATE = "2026-07-31";
const API_URL = "https://api.example.test";
const SUDOKU_MS = 512_000;
const BINAIRO_MS = 407_000;
const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

const sudoku = (): SudokuPlayRecord => ({
  v: 1,
  game: "sudoku",
  date: DATE,
  entries: Array.from({ length: 81 }, () => null),
  grid: Array.from({ length: 9 }, () => DIGITS).flat(),
  elapsedMs: SUDOKU_MS,
  hintsUsed: 0,
  concluded: true,
  pendingSync: false,
  syncOutcome: "recorded",
});

const binairo = (): BinairoPlayRecord => ({
  v: 1,
  game: "binairo",
  date: DATE,
  entries: Array.from({ length: 64 }, () => null),
  grid: Array.from({ length: 64 }, (_unused, index) =>
    index % 2 === 0 ? 0 : 1,
  ),
  elapsedMs: BINAIRO_MS,
  hintsUsed: 0,
  concluded: true,
  pendingSync: false,
  syncOutcome: "recorded",
});

const lostTermo = (): TermoPlayRecord => ({
  v: 1,
  game: "termo",
  date: DATE,
  guesses: "abcdef".split("").map((letter) => ({
    guess: letter.repeat(5),
    tiles: ["absent", "present", "absent", "absent", "present"],
  })),
  answer: "praga",
  outcome: "lost",
  elapsedMs: 188_000,
  hintsUsed: 0,
  concluded: true,
  pendingSync: false,
  syncOutcome: "recorded",
});

const finishedAt = (game: Game, date = DATE) =>
  JSON.stringify({ game, date, concluded: true });

function dayBody(games: Partial<DayResponse["games"]> = {}): DayResponse {
  return {
    date: DATE,
    games: {
      ...Object.fromEntries(GAMES.map((game) => [game, { status: "pending" }])),
      ...games,
    } as DayResponse["games"],
  };
}

function stubFetch(day: DayResponse = dayBody()) {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL) =>
      Promise.resolve(
        urlOf(input) === `${API_URL}/day`
          ? jsonResponse(200, day)
          : jsonResponse(401, { error: "no-session" }),
      ),
    ),
  );
}

function run(script: string): void {
  eval(script);
}

const loadTuck = () => import("../src/hub/tuck");
const loadServerDone = () => import("../src/hub/server-done");
const loadHojePage = async () => (await import("../app/page")).default;

interface Board {
  readonly hidden: readonly Game[];
  readonly rows: readonly Game[];
  readonly count: string;
  readonly grid: boolean;
  readonly list: boolean;
}

function boardOf(root: ParentNode): Board {
  const grid = root.querySelector<HTMLElement>("#hub-cards");
  const list = root.querySelector<HTMLElement>("#hub-done");
  if (grid === null || list === null) {
    throw new Error("no board");
  }
  return {
    hidden: [...grid.querySelectorAll<HTMLElement>("[data-hub-card]")]
      .filter((card) => card.hidden)
      .map((card) => card.dataset.hubCard as Game),
    rows: [...list.querySelectorAll<HTMLElement>("[data-hub-done]")]
      .filter((row) => !row.hidden)
      .map((row) => row.dataset.hubDone as Game),
    count: grid.style.getPropertyValue("--card-count"),
    grid: !grid.hidden,
    list: !list.hidden,
  };
}

const expected = (tucked: readonly Game[]): Board => ({
  hidden: tucked,
  rows: tucked,
  count: String(DAY_GAMES.length - tucked.length),
  grid: tucked.length < DAY_GAMES.length,
  list: tucked.length > 0,
});

const CASES: readonly (readonly [string, () => void, readonly Game[]])[] = [
  ["none finished", () => undefined, []],
  [
    "a completed and a played game",
    () => {
      writePlayRecord(sudoku());
      writePlayRecord(lostTermo());
    },
    ["termo", "sudoku"],
  ],
  [
    "an open record, another day, another game's key, broken JSON",
    () => {
      writePlayRecord({ ...binairo(), concluded: false, grid: undefined });
      localStorage.setItem(
        playRecordKey("queens", DATE),
        finishedAt("queens", "2026-07-30"),
      );
      localStorage.setItem(
        playRecordKey("nonogram", DATE),
        finishedAt("queens"),
      );
      localStorage.setItem(playRecordKey("crossword", DATE), "{");
    },
    [],
  ],
  [
    "a game the server confirmed on an earlier visit",
    () => {
      localStorage.setItem(
        "miolos:hub-server-done",
        JSON.stringify({ date: DATE, games: ["minesweeper"] }),
      );
    },
    ["minesweeper"],
  ],
  [
    "every game",
    () => {
      for (const game of DAY_GAMES) {
        localStorage.setItem(playRecordKey(game, DATE), finishedAt(game));
      }
    },
    [...DAY_GAMES],
  ],
];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(`${DATE}T12:00:00Z`));
  localStorage.clear();
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_API_URL", API_URL);
  stubFetch();
  delete document.documentElement.dataset.hubHold;
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("a daily finished today leaves the grid for Feitos hoje (T-WEB-S1098)", () => {
  it.each(CASES)("%s", async (_name, seed, tucked) => {
    seed();
    const { tuckedGames } = await loadTuck();
    expect([...tuckedGames(DATE)]).toEqual(tucked);
  });

  it("counts a game the server holds as finished, and mirrors it for the next load of that day only", async () => {
    const { tuckedGames } = await loadTuck();
    const { forgetServerDone, mirrorServerDone } = await loadServerDone();
    expect([...tuckedGames(DATE, ["queens"])]).toEqual(["queens"]);

    mirrorServerDone("2026-07-30", ["termo"]);
    expect([...tuckedGames(DATE)]).toEqual([]);
    mirrorServerDone(DATE, ["queens"]);
    expect([...tuckedGames(DATE)]).toEqual(["queens"]);
    forgetServerDone();
    expect([...tuckedGames(DATE)]).toEqual([]);
  });

  it("tucks nothing when storage throws", async () => {
    writePlayRecord(sudoku());
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    const { tuckedGames } = await loadTuck();
    expect([...tuckedGames(DATE)]).toEqual([]);
  });
});

describe("the pre-paint script tucks the server's markup as React will (T-WEB-S1099)", () => {
  it.each(CASES)("%s", async (_name, seed, tucked) => {
    const HojePage = await loadHojePage();
    const { tuckScript, holdScript, tuckedGames } = await loadTuck();
    document.body.innerHTML = renderToString(<HojePage />);
    seed();

    run(holdScript);
    expect(document.documentElement.dataset.hubHold).toBe("");
    run(tuckScript(DATE));

    expect(boardOf(document)).toEqual(expected(tucked));
    expect(boardOf(document).hidden).toEqual([...tuckedGames(DATE)]);
    expect(document.documentElement.dataset.hubHold).toBeUndefined();
  });

  it("leaves the server layout and lifts the hold when the board is missing", async () => {
    writePlayRecord(sudoku());
    const { tuckScript, holdScript } = await loadTuck();
    run(holdScript);
    run(tuckScript(DATE));
    expect(document.documentElement.dataset.hubHold).toBeUndefined();
  });

  it("reads only the lineup's own keys and escapes what it embeds", async () => {
    const { tuckScript } = await loadTuck();
    const read = vi.spyOn(Storage.prototype, "getItem");
    const key = vi.spyOn(Storage.prototype, "key");
    run(tuckScript(DATE));
    expect(key).not.toHaveBeenCalled();
    expect(tuckScript(DATE)).not.toMatch(/<\//);
    document.body.innerHTML = "<div id=hub-cards></div><div id=hub-done></div>";
    run(tuckScript(DATE));
    expect(read).toHaveBeenCalledTimes(DAY_GAMES.length + 1);
  });
});

describe("the board settles once, before hydration (T-WEB-S1100)", () => {
  it("hydrates the script's layout without an error or a change, then drops the scripts", async () => {
    const HojePage = await loadHojePage();
    const { tuckScript, holdScript } = await loadTuck();
    const container = document.createElement("div");
    document.body.append(container);
    container.innerHTML = renderToString(<HojePage />);
    writePlayRecord(sudoku());
    writePlayRecord(lostTermo());
    run(holdScript);
    run(tuckScript(DATE));
    const before = boardOf(container);

    const recoverable = vi.fn();
    const consoleError = vi.spyOn(console, "error");
    let root: ReturnType<typeof hydrateRoot> | undefined;
    await act(async () => {
      root = hydrateRoot(container, <HojePage />, {
        onRecoverableError: recoverable,
      });
      await Promise.resolve();
    });

    expect(before).toEqual(expected(["termo", "sudoku"]));
    expect(boardOf(container)).toEqual(before);
    expect(recoverable).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
    expect(container.querySelector("script")).toBeNull();
    expect(
      container.querySelector<HTMLElement>("#hub-cards")?.dataset.hubSettled,
    ).toBeUndefined();
    act(() => {
      root?.unmount();
    });
  });

  it("lifts the hold on mount when the tuck script never ran", async () => {
    document.documentElement.dataset.hubHold = "";
    const HojePage = await loadHojePage();
    render(<HojePage />);
    expect(document.documentElement.dataset.hubHold).toBeUndefined();
  });

  it("polls each game's record from one place only, the card or the row that shows it", async () => {
    writePlayRecord(sudoku());
    writePlayRecord(lostTermo());
    const poll = vi.spyOn(window, "setInterval");
    const HojePage = await loadHojePage();
    render(<HojePage />);
    const perSecond = poll.mock.calls.filter(([, delay]) => delay === 1000);
    expect(perSecond).toHaveLength(DAY_GAMES.length + 1);
  });

  it.each([
    [
      "a game finished after the script ran",
      () => {
        writePlayRecord(sudoku());
      },
      messages.hoje.playedAria(messages.games.termo.name),
    ],
    [
      "a record gone after the script ran",
      () => {
        localStorage.removeItem(playRecordKey("termo", DATE));
      },
      messages.games.termo.name,
    ],
  ])(
    "keeps what the script painted when storage changes before hydration: %s",
    async (_name, change, row) => {
      const HojePage = await loadHojePage();
      const { tuckScript, holdScript } = await loadTuck();
      const container = document.createElement("div");
      document.body.append(container);
      container.innerHTML = renderToString(<HojePage />);
      writePlayRecord(lostTermo());
      run(holdScript);
      run(tuckScript(DATE));
      change();

      let root: ReturnType<typeof hydrateRoot> | undefined;
      await act(async () => {
        root = hydrateRoot(container, <HojePage />);
        await Promise.resolve();
      });

      expect(boardOf(container)).toEqual(expected(["termo"]));
      expect(
        within(tileFor("termo")).getByRole("link", { name: row }),
      ).toBeInTheDocument();
      act(() => {
        root?.unmount();
      });
    },
  );

  it("renders the partition in the first commit after a client navigation, with no script", async () => {
    writePlayRecord(sudoku());
    const HojePage = await loadHojePage();
    const { container } = render(<HojePage />);
    expect(boardOf(container)).toEqual(expected(["sudoku"]));
    expect(container.querySelector("script")).toBeNull();
  });
});

describe("a game finished after the board settled never moves it (T-WEB-S1101)", () => {
  it("flips the card's stamp in place for another tab and for the server, and tucks both on the next visit", async () => {
    writePlayRecord(sudoku());
    stubFetch(
      dayBody({ nonogram: { status: "completed", elapsedMs: BINAIRO_MS } }),
    );
    const HojePage = await loadHojePage();
    const first = render(<HojePage />);

    writePlayRecord(binairo());
    window.dispatchEvent(new StorageEvent("storage"));
    const elapsed = formatElapsed(BINAIRO_MS);
    await waitFor(() => {
      for (const game of ["binairo", "nonogram"] as const) {
        expect(
          within(tileFor(game)).getByLabelText(
            messages.hoje.doneAria(messages.games[game].name, elapsed),
          ),
        ).toBeInTheDocument();
      }
    });
    expect(boardOf(first.container)).toEqual(expected(["sudoku"]));

    first.unmount();
    vi.resetModules();
    stubFetch();
    const NextVisit = await loadHojePage();
    const next = render(<NextVisit />);
    expect(boardOf(next.container)).toEqual(
      expected(["sudoku", "nonogram", "binairo"]),
    );
  });
});

describe("the hub's stylesheet hides a tucked tile and counts only what shows (T-WEB-S1102)", () => {
  const css = stylesheet("app/page.module.css");
  const phone = bodyOf(css, "@media (max-width: 768px)");

  it("keeps the board unseen while the hold is on", () => {
    expect(
      decl(
        bodyOf(
          css,
          ":root[data-hub-hold] .games,\n:root[data-hub-hold] .doneToday",
        ),
        "visibility",
      ),
    ).toBe("hidden");
  });

  it("reserves the masthead's stamp line, two lines where the stamp wraps", () => {
    expect(decl(bodyOf(css, ".metaLine"), "min-block-size")).toBe("20px");
    expect(
      decl(
        bodyOf(bodyOf(css, "@media (max-width: 374px)"), ".metaLine"),
        "min-block-size",
      ),
    ).toBe("38px");
  });

  it("lets [hidden] beat every display the board sets", () => {
    expect(
      decl(
        bodyOf(
          css,
          ".games[hidden],\n.card[hidden],\n.doneToday[hidden],\n.doneItem[hidden]",
        ),
        "display",
      ),
    ).toBe("none");
  });

  it("draws the rows as equal slips across the content box, and as one sheet of 52px rows on a phone", () => {
    expect(decl(bodyOf(css, ".doneList"), "grid-template-columns")).toBe(
      "repeat(auto-fit, minmax(330px, 1fr))",
    );
    expect(decl(bodyOf(css, ".doneRow"), "min-height")).toBe("52px");
    expect(decl(bodyOf(phone, ".doneList"), "display")).toBe("block");
    expect(
      decl(
        bodyOf(phone, ".doneItem:nth-child(n + 2 of :not([hidden]))"),
        "border-top",
      ),
    ).toBe("1px solid var(--line)");
  });
});

describe("a Feitos hoje row (T-WEB-S1103)", () => {
  it("links to the daily with the swatch, the name, the result and the chip", async () => {
    writePlayRecord(sudoku());
    writePlayRecord(lostTermo());
    const HojePage = await loadHojePage();
    render(<HojePage />);

    const sudokuRow = tileFor("sudoku");
    const link = within(sudokuRow).getByRole("link", {
      name: messages.hoje.doneAria(
        messages.games.sudoku.name,
        formatElapsed(SUDOKU_MS),
      ),
    });
    expect(link).toHaveAttribute("href", playRoutes.sudoku);
    expect(link.textContent).toBe(
      `${messages.games.sudoku.name}${formatElapsed(SUDOKU_MS)}${messages.hoje.done}`,
    );

    const termo = within(tileFor("termo")).getByRole("link", {
      name: messages.hoje.playedAria(messages.games.termo.name),
    });
    expect(termo.textContent).toBe(
      `${messages.games.termo.name}${messages.hoje.played}`,
    );
    expect(
      screen.getByRole("heading", { name: messages.hoje.doneToday }),
    ).toBeInTheDocument();
  });

  it("fetches Termo's result once, for its row and not its tucked card", async () => {
    writePlayRecord({
      ...lostTermo(),
      guesses: [{ guess: "praga", tiles: Array(5).fill("correct") }],
      outcome: "won",
    } as TermoPlayRecord);
    const HojePage = await loadHojePage();
    render(<HojePage />);
    await waitFor(() => {
      expect(tileFor("termo").textContent).toContain(messages.hoje.done);
    });
    const stats = vi
      .mocked(fetch)
      .mock.calls.filter(([input]) => urlOf(input) === `${API_URL}/stats`);
    expect(stats).toHaveLength(1);
  });

  it("shows only the name until the day's state is known", async () => {
    localStorage.setItem(
      "miolos:hub-server-done",
      JSON.stringify({ date: DATE, games: ["queens"] }),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => undefined)),
    );
    const HojePage = await loadHojePage();
    render(<HojePage />);

    const row = within(tileFor("queens")).getByRole("link", {
      name: messages.games.queens.name,
    });
    expect(row.textContent).toBe(messages.games.queens.name);
  });

  it("has no heading at all while nothing is finished", async () => {
    const HojePage = await loadHojePage();
    render(<HojePage />);
    expect(
      screen.queryByRole("heading", { name: messages.hoje.doneToday }),
    ).toBeNull();
  });
});
