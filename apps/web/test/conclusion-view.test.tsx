import type { Game } from "@miolos/core";
import { render, screen, waitFor, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ConclusionView } from "../src/play/conclusion-view";
import {
  writePlayRecord,
  type BinairoPlayRecord,
  type NonogramPlayRecord,
  type SudokuPlayRecord,
  type TermoPlayRecord,
} from "../src/play/play-record";
import type { ConclusionPicture } from "../src/play/types";
import { useRecordSnapshot } from "../src/play/use-record-snapshot";
import { TermoConclusion } from "../src/termo/termo-conclusion";
import { formatElapsed, messages, routes } from "../src/i18n";
import { bodyOf, decl, pixels, stylesheet, token } from "./css-source";

const sync = vi.hoisted(() => ({
  startCompletionSync: vi.fn(() => () => undefined),
  flushPendingCompletions: vi.fn(() => Promise.resolve()),
}));
vi.mock("../src/play/sync", () => sync);

//

const bootstrapMock = vi.hoisted(() => ({
  ensureSession: vi.fn<() => Promise<void>>(() => Promise.resolve()),
}));
vi.mock("../src/session/bootstrap", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../src/session/bootstrap")>();
  return { ...actual, ensureSession: bootstrapMock.ensureSession };
});

const DATE = "2026-07-30";
const ELAPSED_MS = 407_000;
const ELAPSED = formatElapsed(ELAPSED_MS);

const SUDOKU_ELAPSED_MS = 512_000;
const SUDOKU_ELAPSED = formatElapsed(SUDOKU_ELAPSED_MS);

const NONOGRAM_ELAPSED_MS = 623_000;

const TERMO_ELAPSED_MS = 188_000;
const TERMO_ELAPSED = formatElapsed(TERMO_ELAPSED_MS);

function concluded(
  overrides: Partial<BinairoPlayRecord> = {},
): BinairoPlayRecord {
  return {
    v: 1,
    game: "binairo",
    date: DATE,
    entries: Array.from({ length: 64 }, () => null),
    grid: Array.from({ length: 64 }, (_unused, index) =>
      index % 2 === 0 ? 0 : 1,
    ),
    elapsedMs: ELAPSED_MS,
    hintsUsed: 0,
    concluded: true,
    pendingSync: false,
    syncOutcome: "recorded",
    ...overrides,
  };
}

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
    elapsedMs: SUDOKU_ELAPSED_MS,
    hintsUsed: 0,
    concluded: true,
    pendingSync: false,
    syncOutcome: "recorded",
    ...overrides,
  };
}

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
const MISS: Tiles = ["absent", "present", "absent", "absent", "present"];
const WIN: Tiles = ["correct", "correct", "correct", "correct", "correct"];

function wonTermo(overrides: Partial<TermoPlayRecord> = {}): TermoPlayRecord {
  return {
    v: 1,
    game: "termo",
    date: DATE,
    guesses: [
      { guess: "cafes", tiles: [...MISS] },
      { guess: "praga", tiles: [...WIN] },
    ],
    answer: "praga",
    outcome: "won",
    elapsedMs: TERMO_ELAPSED_MS,
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
      tiles: [...MISS],
    })),
    outcome: "lost",
  });

function dayCard(): HTMLElement {
  const card = screen
    .getByText(messages.conclusion.dayCard.title)
    .closest("section");
  if (card === null) {
    throw new Error("the day card is not inside a <section>");
  }
  return card;
}

function streakResponse(streak: number, todayCounts: boolean): Response {
  return new Response(JSON.stringify({ date: DATE, streak, todayCounts }), {
    status: 200,
  });
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
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
});

describe("the stamp (T-WEB-17)", () => {
  it("renders the real elapsed time and the hint line, from the messages module", () => {
    writePlayRecord(concluded());

    render(
      <ConclusionView
        game="binairo"
        date={DATE}
        copy={messages.games.binairo.conclusion}
      />,
    );

    expect(
      screen.getByLabelText(
        messages.conclusion.stampAria(
          messages.games.binairo.conclusion.title,
          ELAPSED,
          0,
        ),
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(messages.conclusion.stampLabel),
    ).toBeInTheDocument();
    expect(screen.getByText(messages.conclusion.hints(0))).toBeInTheDocument();
  });

  it("follows hintsUsed for the italic line under the time", () => {
    writePlayRecord(concluded({ hintsUsed: 1 }));

    render(
      <ConclusionView
        game="binairo"
        date={DATE}
        copy={messages.games.binairo.conclusion}
      />,
    );

    expect(screen.getByText(messages.conclusion.hints(1))).toBeInTheDocument();
    expect(
      screen.queryByText(messages.conclusion.hints(0)),
    ).not.toBeInTheDocument();
  });

  it("keeps the <h1> the first element child of its wrapper", () => {
    writePlayRecord(concluded());

    render(
      <ConclusionView
        game="binairo"
        date={DATE}
        copy={messages.games.binairo.conclusion}
      />,
    );

    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.previousElementSibling).toBeNull();
    expect(heading.parentElement?.firstElementChild).toBe(heading);
  });

  it("never uses the frames' streak labels (amendment table: sequência)", () => {
    writePlayRecord(concluded());

    const { container } = render(
      <ConclusionView
        game="binairo"
        date={DATE}
        copy={messages.games.binairo.conclusion}
      />,
    );

    expect(container.textContent).not.toContain("dias seguidos");
  });
});

describe("the day card and the CTA (T-WEB-18)", () => {
  it("shows Binairo done and the other three honestly missing", () => {
    writePlayRecord(concluded());

    render(
      <ConclusionView
        game="binairo"
        date={DATE}
        copy={messages.games.binairo.conclusion}
      />,
    );

    expect(
      screen.getByText(messages.conclusion.dayCard.title),
    ).toBeInTheDocument();

    expect(
      screen.getAllByText(messages.conclusion.dayCard.missing),
    ).toHaveLength(3);

    expect(
      screen.getByText(messages.conclusion.dayCard.games.nonogram),
    ).toBeInTheDocument();
    expect(
      screen.getByText(messages.conclusion.dayCard.games.nonogramShort),
    ).toBeInTheDocument();
  });

  it("points the CTA at Hoje and the statistics link at /estatisticas", () => {
    writePlayRecord(concluded());
    writePlayRecord(concludedNonogram());
    writePlayRecord(concludedSudoku());
    writePlayRecord(wonTermo());

    render(
      <ConclusionView
        game="binairo"
        date={DATE}
        copy={messages.games.binairo.conclusion}
      />,
    );

    expect(
      screen.getByText(messages.conclusion.ctaHome).closest("a"),
    ).toHaveAttribute("href", routes.home);

    expect(
      screen.getByText(messages.conclusion.stats).closest("a"),
    ).toHaveAttribute("href", routes.stats);
  });
});

describe("the CTA chains to the next pending daily (T-WEB-S19)", () => {
  it("offers the next playable game, in the day's order", () => {
    writePlayRecord(concluded());
    writePlayRecord(wonTermo());

    render(
      <ConclusionView
        game="binairo"
        date={DATE}
        copy={messages.games.binairo.conclusion}
      />,
    );

    expect(
      screen
        .getByText(messages.conclusion.ctaNext(messages.games.sudoku.name))
        .closest("a"),
    ).toHaveAttribute("href", routes.sudoku);
    expect(
      screen.queryByText(messages.conclusion.ctaHome),
    ).not.toBeInTheDocument();
  });

  it("takes the DESTINATION game's accent, not the celebrated game's", () => {
    //

    writePlayRecord(concluded());
    writePlayRecord(wonTermo());

    render(
      <ConclusionView
        game="binairo"
        date={DATE}
        copy={messages.games.binairo.conclusion}
      />,
    );

    const cta = screen
      .getByText(messages.conclusion.ctaNext(messages.games.sudoku.name))
      .closest("a");
    expect(cta?.style.getPropertyValue("--accent")).toBe(
      "var(--accent-sudoku)",
    );
  });

  it("never chains back to the game whose stamp is on screen", () => {
    //

    writePlayRecord(concludedSudoku({ concluded: false, grid: undefined }));
    writePlayRecord(wonTermo());

    render(
      <ConclusionView
        game="sudoku"
        date={DATE}
        copy={messages.games.sudoku.conclusion}
        result={{ elapsedMs: SUDOKU_ELAPSED_MS, hintsUsed: 0 }}
      />,
    );

    expect(
      screen
        .getByText(messages.conclusion.ctaNext(messages.games.nonogram.name))
        .closest("a"),
    ).toHaveAttribute("href", routes.nonogram);
    expect(
      screen.queryByText(
        messages.conclusion.ctaNext(messages.games.sudoku.name),
      ),
    ).not.toBeInTheDocument();
  });

  it("falls back to Hoje when every playable daily is done", () => {
    writePlayRecord(concluded());
    writePlayRecord(concludedNonogram());
    writePlayRecord(concludedSudoku());
    writePlayRecord(wonTermo());

    render(
      <ConclusionView
        game="sudoku"
        date={DATE}
        copy={messages.games.sudoku.conclusion}
      />,
    );

    const cta = screen.getByText(messages.conclusion.ctaHome).closest("a");
    expect(cta).toHaveAttribute("href", routes.home);

    expect(cta?.style.getPropertyValue("--accent")).toBe("");
  });
});

describe("the chaining CTA, re-pointed at Termo (T-WEB-S101)", () => {
  it("offers Termo first from a shipped conclusion, and links it", () => {
    writePlayRecord(concluded());

    render(
      <ConclusionView
        game="binairo"
        date={DATE}
        copy={messages.games.binairo.conclusion}
      />,
    );

    const cta = screen
      .getByText(messages.conclusion.ctaNext(messages.games.termo.name))
      .closest("a");
    expect(cta).toHaveAttribute("href", routes.termo);

    expect(
      screen.queryByText(
        messages.conclusion.ctaNext(messages.games.sudoku.name),
      ),
    ).not.toBeInTheDocument();
  });

  it("paints it with Termo's own light label on Termo's own fill", () => {
    writePlayRecord(concluded());

    render(
      <ConclusionView
        game="binairo"
        date={DATE}
        copy={messages.games.binairo.conclusion}
      />,
    );

    const cta = screen
      .getByText(messages.conclusion.ctaNext(messages.games.termo.name))
      .closest("a");
    expect(cta?.style.getPropertyValue("--accent")).toBe("var(--accent-termo)");

    expect(cta?.style.getPropertyValue("--ink-on-accent")).toBe(
      "var(--paper-desk)",
    );
  });
});

describe("the day card reads per-game records (T-WEB-S18)", () => {
  it("shows this device's binairo time and an honest falta for the rest", () => {
    writePlayRecord(concluded());

    render(
      <ConclusionView
        game="binairo"
        date={DATE}
        copy={messages.games.binairo.conclusion}
      />,
    );

    const chips = within(dayCard());
    expect(chips.getByText(ELAPSED)).toBeInTheDocument();
    expect(
      chips.getAllByText(messages.conclusion.dayCard.missing),
    ).toHaveLength(3);
  });

  it("shows each concluded game's OWN time, never the current game's", () => {
    writePlayRecord(concluded());
    writePlayRecord(concludedSudoku());

    render(
      <ConclusionView
        game="binairo"
        date={DATE}
        copy={messages.games.binairo.conclusion}
      />,
    );

    const chips = within(dayCard());
    expect(chips.getByText(ELAPSED)).toBeInTheDocument();
    expect(chips.getByText(SUDOKU_ELAPSED)).toBeInTheDocument();
    expect(
      chips.getAllByText(messages.conclusion.dayCard.missing),
    ).toHaveLength(2);
  });

  it("counts the game being celebrated as done before its record is written", () => {
    writePlayRecord(concluded({ concluded: false, grid: undefined }));

    render(
      <ConclusionView
        game="binairo"
        date={DATE}
        copy={messages.games.binairo.conclusion}
        result={{ elapsedMs: ELAPSED_MS, hintsUsed: 0 }}
      />,
    );

    const chips = within(dayCard());
    expect(chips.getByText(ELAPSED)).toBeInTheDocument();
    expect(
      chips.getAllByText(messages.conclusion.dayCard.missing),
    ).toHaveLength(3);
  });

  it("understates rather than guesses: another device's solve reads falta", () => {
    writePlayRecord(concluded());
    writePlayRecord(concludedSudoku({ concluded: false }));

    render(
      <ConclusionView
        game="binairo"
        date={DATE}
        copy={messages.games.binairo.conclusion}
      />,
    );

    const chips = within(dayCard());
    expect(chips.queryByText(SUDOKU_ELAPSED)).not.toBeInTheDocument();
    expect(
      chips.getAllByText(messages.conclusion.dayCard.missing),
    ).toHaveLength(3);
  });
});

describe("the record snapshot is keyed on {game, date} (T-WEB-S20)", () => {
  function RecordProbe({
    game,
    date,
  }: {
    readonly game: Game;
    readonly date: string;
  }) {
    const snapshot = useRecordSnapshot(game, date);
    return (
      <output>
        {snapshot.hydrated ? (snapshot.record?.game ?? "none") : "not read"}
      </output>
    );
  }

  it("stamps each conclusion with its own game's record", () => {
    writePlayRecord(concluded());
    writePlayRecord(concludedSudoku());

    const binairo = render(
      <ConclusionView
        game="binairo"
        date={DATE}
        copy={messages.games.binairo.conclusion}
      />,
    );
    expect(screen.getByRole("img")).toHaveAccessibleName(
      messages.conclusion.stampAria(
        messages.games.binairo.conclusion.title,
        ELAPSED,
        0,
      ),
    );
    binairo.unmount();

    render(
      <ConclusionView
        game="sudoku"
        date={DATE}
        copy={messages.games.sudoku.conclusion}
      />,
    );

    const stamp = screen.getByRole("img");
    expect(stamp).toHaveAccessibleName(
      messages.conclusion.stampAria(
        messages.games.sudoku.conclusion.title,
        SUDOKU_ELAPSED,
        0,
      ),
    );
    expect(stamp.textContent).toContain(SUDOKU_ELAPSED);
    expect(stamp.textContent).not.toContain(ELAPSED);
  });

  it("never hands the second game the first game's record", () => {
    writePlayRecord(concluded());
    writePlayRecord(concludedSudoku({ elapsedMs: ELAPSED_MS }));

    const first = render(<RecordProbe game="binairo" date={DATE} />);
    expect(screen.getByRole("status")).toHaveTextContent("binairo");
    first.unmount();

    render(<RecordProbe game="sudoku" date={DATE} />);

    expect(screen.getByRole("status")).toHaveTextContent("sudoku");
  });
});

describe("the sync line (T-WEB-19)", () => {
  it("says the result is queued while it is still pending", () => {
    writePlayRecord(concluded({ pendingSync: true, syncOutcome: "pending" }));

    render(
      <ConclusionView
        game="binairo"
        date={DATE}
        copy={messages.games.binairo.conclusion}
      />,
    );

    expect(
      screen.getByText(messages.conclusion.sync.pending),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(messages.conclusion.sync.rejected),
    ).not.toBeInTheDocument();
  });

  it("says so when the server refused it, and drops the pending line", () => {
    writePlayRecord(concluded({ syncOutcome: "rejected" }));

    render(
      <ConclusionView
        game="binairo"
        date={DATE}
        copy={messages.games.binairo.conclusion}
      />,
    );

    expect(
      screen.getByText(messages.conclusion.sync.rejected),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(messages.conclusion.sync.pending),
    ).not.toBeInTheDocument();
  });

  it("says nothing while the only record is the still-playing one", () => {
    writePlayRecord(
      concluded({
        concluded: false,
        grid: undefined,
        pendingSync: false,
        syncOutcome: "pending",
      }),
    );

    render(
      <ConclusionView
        game="binairo"
        date={DATE}
        copy={messages.games.binairo.conclusion}
        result={{ elapsedMs: ELAPSED_MS, hintsUsed: 0 }}
      />,
    );

    expect(
      screen.getByText(messages.conclusion.stampLabel),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(messages.conclusion.sync.pending),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(messages.conclusion.sync.rejected),
    ).not.toBeInTheDocument();
  });

  it("says nothing once the completion is recorded", () => {
    writePlayRecord(concluded());

    render(
      <ConclusionView
        game="binairo"
        date={DATE}
        copy={messages.games.binairo.conclusion}
      />,
    );

    expect(
      screen.queryByText(messages.conclusion.sync.pending),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(messages.conclusion.sync.rejected),
    ).not.toBeInTheDocument();
  });
});

describe("no record for the server's day (T-WEB-20)", () => {
  it("explains the bookmark rather than redirecting it away", () => {
    render(
      <ConclusionView
        game="binairo"
        date={DATE}
        copy={messages.games.binairo.conclusion}
      />,
    );

    expect(
      screen.getByText(messages.games.binairo.conclusion.notYet.title),
    ).toBeInTheDocument();
    expect(
      screen.getByText(messages.conclusion.notYet.body),
    ).toBeInTheDocument();
    expect(
      screen
        .getByText(messages.games.binairo.conclusion.notYet.cta)
        .closest("a"),
    ).toHaveAttribute("href", routes.binairo);
  });

  it("paints a skeleton before the record is read, never the notYet card", () => {
    writePlayRecord(concluded());

    const markup = renderToStaticMarkup(
      <ConclusionView
        game="binairo"
        date={DATE}
        copy={messages.games.binairo.conclusion}
      />,
    );

    expect(markup).toContain('data-conclusion-state="skeleton"');
    expect(markup).not.toContain(
      messages.games.binairo.conclusion.notYet.title,
    );
    expect(markup).not.toContain(messages.conclusion.stampLabel);
    expect(markup).not.toContain(ELAPSED);
  });
});

describe("the picture reveal (T-WEB-S50)", () => {
  const PICTURE: ConclusionPicture = {
    size: 5,
    // prettier-ignore
    cells: [
      0, 1, 1, 1, 0,
      1, 0, 0, 0, 1,
      1, 1, 1, 1, 1,
      1, 0, 0, 0, 1,
      1, 0, 0, 0, 0,
    ],
    label: messages.games.nonogram.reveal.aria,
  };

  const FILLED = PICTURE.cells.filter((cell) => cell === 1).length;

  function subpathsOf(figure: HTMLElement): string[] {
    const path = figure.querySelector("path");
    if (path === null) {
      throw new Error("the reveal renders no <path>");
    }
    return path.getAttribute("d")?.match(/M-?\d+ -?\d+h1v1h-1z/g) ?? [];
  }

  function nonogramRecord(): NonogramPlayRecord {
    return {
      v: 1,
      game: "nonogram",
      date: DATE,
      size: 5,
      entries: PICTURE.cells.map((cell) => (cell === 1 ? 1 : null)),
      grid: [...PICTURE.cells],
      elapsedMs: ELAPSED_MS,
      hintsUsed: 0,
      concluded: true,
      pendingSync: false,
      syncOutcome: "recorded",
    };
  }

  it("draws one subpath per filled cell, under the caller's own name", () => {
    writePlayRecord(nonogramRecord());

    const { container } = render(
      <ConclusionView
        game="nonogram"
        date={DATE}
        copy={messages.games.nonogram.conclusion}
        picture={PICTURE}
      />,
    );

    const figure = screen.getByRole("img", { name: PICTURE.label });
    expect(figure.tagName.toLowerCase()).toBe("svg");
    expect(figure).toHaveAttribute("viewBox", "0 0 5 5");

    expect(subpathsOf(figure).length).toBeGreaterThan(0);
    expect(subpathsOf(figure)).toHaveLength(FILLED);

    expect(subpathsOf(figure)[0]).toBe("M1 0h1v1h-1z");

    expect(container.querySelectorAll("path")).toHaveLength(1);
    expect(container.querySelectorAll("rect")).toHaveLength(0);
  });

  it("renders no figure at all when the caller supplies none", () => {
    writePlayRecord(nonogramRecord());

    const { container } = render(
      <ConclusionView
        game="nonogram"
        date={DATE}
        copy={messages.games.nonogram.conclusion}
      />,
    );

    expect(
      screen.getByRole("img", {
        name: messages.conclusion.stampAria(
          messages.games.nonogram.conclusion.title,
          ELAPSED,
          0,
        ),
      }),
    ).toBeInTheDocument();
    expect(container.querySelector("svg")).toBeNull();
    expect(
      screen.queryByRole("img", { name: PICTURE.label }),
    ).not.toBeInTheDocument();
  });

  it("renders the caption it is HANDED, and none when it is handed none (#64)", () => {
    writePlayRecord(nonogramRecord());
    const NAME = "Âncora";

    const { container, rerender } = render(
      <ConclusionView
        game="nonogram"
        date={DATE}
        copy={messages.games.nonogram.conclusion}
        picture={{
          ...PICTURE,
          name: NAME,
          lead: messages.games.nonogram.reveal.lead,
          label: messages.games.nonogram.reveal.namedAria(NAME),
        }}
      />,
    );

    expect(screen.getByText(NAME)).toBeInTheDocument();
    expect(
      screen.getByText(messages.games.nonogram.reveal.lead),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("img", {
        name: messages.games.nonogram.reveal.namedAria(NAME),
      }),
    ).toBeInTheDocument();

    expect(screen.getByText(NAME).tagName).toBe("P");
    expect(container.querySelector("[role='heading']")).toBeNull();
    expect(screen.queryAllByRole("heading", { name: NAME })).toHaveLength(0);

    rerender(
      <ConclusionView
        game="nonogram"
        date={DATE}
        copy={messages.games.nonogram.conclusion}
        picture={PICTURE}
      />,
    );
    expect(screen.queryByText(NAME)).not.toBeInTheDocument();
    expect(
      screen.queryByText(messages.games.nonogram.reveal.lead),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: PICTURE.label }),
    ).toBeInTheDocument();
  });

  it("leaves binairo's and sudoku's conclusions exactly as they were", () => {
    writePlayRecord(concluded());
    writePlayRecord(concludedSudoku());

    for (const game of ["binairo", "sudoku"] as const) {
      const { container, unmount } = render(
        <ConclusionView
          game={game}
          date={DATE}
          copy={messages.games[game].conclusion}
        />,
      );

      expect(container.querySelector("svg")).toBeNull();
      expect(container.querySelector("path")).toBeNull();
      expect(screen.getAllByRole("img")).toHaveLength(1);
      unmount();
    }
  });
});

describe("the conclusion's layout (tripwires)", () => {
  const CSS = stylesheet("src/play/conclusion-view.module.css");

  it("keeps the grid's block-axis alignment off the shared top-bar rule", () => {
    expect(decl(bodyOf(CSS, ".topBar"), "align-self")).toBeUndefined();
    expect(decl(bodyOf(CSS, ".pageResult .topBar"), "align-self")).toBe(
      "start",
    );
  });

  it("settles the stamp once on mount, on the system's own tokens", () => {
    const animation = decl(bodyOf(CSS, ".stamp"), "animation");
    expect(animation).toContain("stamp-settle");
    expect(animation).not.toMatch(/bounce|elastic|wobble|jiggle|spring/i);
    expect(animation).not.toMatch(/infinite|alternate/);
    expect(animation).toContain("var(--duration-slow)");
    expect(animation).toContain("var(--ease-settle)");
  });

  it("stands both settles down at the keyframe's END state, never its start", () => {
    expect(
      CSS.match(/@media[^{]*prefers-reduced-motion[^{]*\{/g),
      "the sheet declares exactly one reduced-motion block — the one this reads",
    ).toHaveLength(1);
    const reduced = bodyOf(CSS, "@media (prefers-reduced-motion: reduce)");
    for (const [selector, keyframes] of [
      [".stamp", "@keyframes stamp-settle"],
      [".picture", "@keyframes picture-settle"],
    ] as const) {
      const end = decl(bodyOf(bodyOf(CSS, keyframes), "to"), "transform");
      const endRotation = /rotate\([^)]*\)/.exec(end ?? "")?.[0];
      expect(endRotation, `${keyframes} to`).toBeDefined();
      const body = bodyOf(reduced, selector);
      expect(decl(body, "animation"), selector).toBe("none");

      const leftover = (decl(body, "transform") ?? "")
        .replace(endRotation ?? "", "")
        .replace(/scale\(\s*1\s*\)/, "")
        .replace("!important", "")
        .trim();
      expect(decl(body, "transform"), selector).toContain(endRotation);
      expect(
        leftover,
        `${selector} transform carries more than the rotation`,
      ).toBe("");
    }

    expect(decl(bodyOf(reduced, ".picture"), "opacity")).toBe("1");

    //

    const preludes = [...reduced.matchAll(/(?:^|\})\s*([^{}]+?)\s*\{/g)].map(
      (match) => (match[1] ?? "").replaceAll(/\s+/g, " ").trim(),
    );
    expect(
      [...preludes].sort(),
      "the reduced-motion block's selectors",
    ).toEqual([".cta, .emptyCta", ".picture", ".stamp"]);
    for (const [selector, allowed] of [
      [".stamp", ["animation", "transform"]],
      [".picture", ["animation", "transform", "opacity"]],
    ] as const) {
      const declared = preludes
        .filter((prelude) => prelude.includes(selector))
        .flatMap((prelude) => [
          ...`;${bodyOf(reduced, prelude)}`.matchAll(
            /[{;]\s*([a-zA-Z-]+)\s*:/g,
          ),
        ])
        .map((match) => (match[1] ?? "").toLowerCase());
      expect([...new Set(declared)].sort(), selector).toEqual(
        [...allowed].sort(),
      );
    }

    expect(
      decl(bodyOf(bodyOf(CSS, "@keyframes stamp-settle"), "from"), "opacity"),
    ).toBe("0.6");
    expect(
      decl(bodyOf(bodyOf(CSS, "@keyframes picture-settle"), "from"), "opacity"),
    ).toBe("0");
  });

  it("packs the stacked result rows to the start instead of stretching them", () => {
    const stacked = bodyOf(
      bodyOf(CSS, "@media (max-width: 1140px)"),
      ".pageResult",
    );

    expect(decl(stacked, "grid-template-rows")).toBe("auto auto auto");
    expect(decl(stacked, "align-content")).toBe("start");
  });

  it("keeps every solid CTA's label off its own background on hover", () => {
    //

    const HOVER: Readonly<Record<string, string>> = {
      cta: "var(--paper-desk)",
      emptyCta: "var(--ink-on-accent, var(--paper-desk))",
    };
    for (const [cta, color] of Object.entries(HOVER)) {
      expect(decl(bodyOf(CSS, `.page .${cta}:hover`), "color")).toBe(color);

      expect(CSS).not.toMatch(new RegExp(`^\\s*\\.${cta}:hover`, "m"));
    }
  });

  it("insets the concluded card's CTA on BOTH axes (T-WEB-S65a)", () => {
    const padding = decl(bodyOf(CSS, ".cta"), "padding");
    expect(padding, ".cta declares no padding").toBeDefined();
    const [block, inline] = (padding ?? "").split(/\s+/);
    expect(Number.parseFloat(block ?? "0"), "block padding").toBeGreaterThan(0);
    expect(
      inline,
      "inline padding — a zero here is the cramped-padding red",
    ).toBeDefined();
    expect(inline).not.toBe("0");
    expect(inline).not.toBe("0px");
  });

  it("insets the day-card chips on BOTH axes, at both bands (T-WEB-S65b)", () => {
    //

    for (const [scope, body] of [
      ["top level", bodyOf(CSS, ".chip")],
      [
        "the mobile band",
        bodyOf(bodyOf(CSS, "@media (max-width: 768px)"), ".chip"),
      ],
    ] as const) {
      const padding = decl(body, "padding");
      expect(padding, `${scope}: .chip declares no padding`).toBeDefined();
      const [block, inline] = (padding ?? "").split(/\s+/);
      expect(
        Number.parseFloat(block ?? "0"),
        `${scope}: block padding`,
      ).toBeGreaterThanOrEqual(8);
      expect(
        Number.parseFloat(inline ?? "0"),
        `${scope}: inline padding — a zero here is the cramped-padding red`,
      ).toBeGreaterThanOrEqual(6);
    }
  });
});

describe("the day card's third verb (T-WEB-S80)", () => {
  function chipFor(game: "termo" | "sudoku"): HTMLElement {
    const chip = within(dayCard())
      .getByText(messages.conclusion.dayCard.games[game])
      .closest("div");
    if (chip === null) {
      throw new Error(`the ${game} chip is not inside a <div>`);
    }
    return chip;
  }

  it("renders a LOST termo as `jogado`, never `falta` and never a duration", () => {
    writePlayRecord(lostTermo());
    writePlayRecord(concluded());

    render(
      <ConclusionView
        game="binairo"
        date={DATE}
        copy={messages.games.binairo.conclusion}
      />,
    );

    const chip = chipFor("termo");
    expect(chip).toHaveTextContent(messages.conclusion.dayCard.played);
    expect(chip).not.toHaveTextContent(messages.conclusion.dayCard.missing);
    expect(chip.textContent).not.toContain(TERMO_ELAPSED);

    expect(chip.className).toContain("chipPlayed");
    expect(chip.className).not.toContain("chipMissing");
    expect(chip.className).not.toContain("chipDone");
  });

  it("renders a WON termo as `feito` — the case the un-split guard failed", () => {
    writePlayRecord(wonTermo());
    writePlayRecord(concluded());

    render(
      <ConclusionView
        game="binairo"
        date={DATE}
        copy={messages.games.binairo.conclusion}
      />,
    );

    const chip = chipFor("termo");
    expect(chip).toHaveTextContent(messages.conclusion.dayCard.done);
    expect(chip).not.toHaveTextContent(messages.conclusion.dayCard.missing);
    expect(chip.textContent).not.toContain(TERMO_ELAPSED);
    expect(chip.className).toContain("chipDone");
  });

  it("leaves a grid game's chip reading its own duration, unchanged", () => {
    writePlayRecord(concluded());
    writePlayRecord(concludedSudoku());

    render(
      <ConclusionView
        game="binairo"
        date={DATE}
        copy={messages.games.binairo.conclusion}
      />,
    );

    const chip = chipFor("sudoku");
    expect(chip).toHaveTextContent(SUDOKU_ELAPSED);
    expect(chip.className).toContain("chipDone");
  });

  it("gives `played` a SOLID border, distinct from `missing`'s dashed one", () => {
    const CSS = stylesheet("src/play/conclusion-view.module.css");
    const played = decl(bodyOf(CSS, ".chipPlayed"), "border");
    const missing = decl(bodyOf(CSS, ".chipMissing"), "border");

    expect(played).toBe("1.5px solid var(--line)");
    expect(missing).toBe("1.5px dashed var(--line)");
    expect(played).not.toBe(missing);
  });
});

describe("the celebrated game's own chip, on a loss (T-WEB-S80)", () => {
  it("marks it PLAYED with no duration, never completed with the stamp's time", () => {
    render(
      <ConclusionView
        game="termo"
        date={DATE}
        copy={messages.games.termo.conclusion}
        result={{ elapsedMs: TERMO_ELAPSED_MS, hintsUsed: 0 }}
        outcome={{
          state: "lost",
          label: "Jogado",
          detail: "X/6",
          aria: "Termo jogado: as 6 tentativas acabaram sem acerto.",
        }}
      />,
    );

    const card = dayCard();
    const chip = within(card)
      .getByText(messages.conclusion.dayCard.games.termo)
      .closest("div");
    expect(chip).toHaveTextContent(messages.conclusion.dayCard.played);

    expect(chip?.textContent).not.toContain(TERMO_ELAPSED);
    expect(chip?.className).toContain("chipPlayed");
  });

  it("still never chains the CTA back into the game just spent", () => {
    //

    //

    render(
      <ConclusionView
        game="termo"
        date={DATE}
        copy={messages.games.termo.conclusion}
        result={{ elapsedMs: TERMO_ELAPSED_MS, hintsUsed: 0 }}
        outcome={{
          state: "lost",
          label: "Jogado",
          detail: "X/6",
          aria: "Termo jogado: as 6 tentativas acabaram sem acerto.",
        }}
      />,
    );

    const cta = screen
      .getByText(messages.conclusion.ctaNext(messages.games.sudoku.name))
      .closest("a");
    expect(cta).toHaveAttribute("href", routes.sudoku);
    expect(
      screen.queryByText(
        messages.conclusion.ctaNext(messages.games.termo.name),
      ),
    ).not.toBeInTheDocument();
  });

  it("marks a WON termo completed, so the CTA still moves on", () => {
    render(
      <ConclusionView
        game="termo"
        date={DATE}
        copy={messages.games.termo.conclusion}
        result={{ elapsedMs: TERMO_ELAPSED_MS, hintsUsed: 0 }}
        outcome={{
          state: "result",
          label: "Concluído",
          detail: "2/6",
          aria: "Termo concluído em 2 de 6 tentativas.",
        }}
      />,
    );

    const chip = within(dayCard())
      .getByText(messages.conclusion.dayCard.games.termo)
      .closest("div");
    expect(chip).toHaveTextContent(messages.conclusion.dayCard.done);
    expect(chip?.className).toContain("chipDone");
  });

  it("leaves the three shipped games' overrides exactly as they were", () => {
    writePlayRecord(concluded({ concluded: false, grid: undefined }));

    render(
      <ConclusionView
        game="binairo"
        date={DATE}
        copy={messages.games.binairo.conclusion}
        result={{ elapsedMs: ELAPSED_MS, hintsUsed: 0 }}
      />,
    );

    const chips = within(dayCard());
    expect(chips.getByText(ELAPSED)).toBeInTheDocument();
    expect(
      chips.getAllByText(messages.conclusion.dayCard.missing),
    ).toHaveLength(3);
  });
});

describe("the streak card's state machine (T-WEB-S128)", () => {
  function streakCardIn(container: HTMLElement): HTMLElement | null {
    return container.querySelector("[data-streak-state]");
  }

  it("stays absent while the day is not on the server, and the fetch never fires", async () => {
    for (const syncOutcome of ["pending", "rejected"] as const) {
      window.localStorage.clear();
      writePlayRecord(concluded({ syncOutcome, pendingSync: true }));

      const { container, unmount } = render(
        <ConclusionView
          game="binairo"
          date={DATE}
          copy={messages.games.binairo.conclusion}
        />,
      );

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(streakCardIn(container), syncOutcome).toBeNull();

      for (const call of fetchMock.mock.calls) {
        expect(String(call[0]), syncOutcome).not.toContain("/streak");
      }
      unmount();
    }
  });

  it("on recorded: the skeleton mounts at final dimensions, then the value settles in", async () => {
    let resolveFetch: (response: Response) => void = () => undefined;
    const deferred = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    fetchMock = vi.fn(() => deferred.then((response) => response.clone()));
    vi.stubGlobal("fetch", fetchMock);
    writePlayRecord(concluded());

    const { container } = render(
      <ConclusionView
        game="binairo"
        date={DATE}
        copy={messages.games.binairo.conclusion}
      />,
    );

    //

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.example.test/streak",
        {
          credentials: "include",
        },
      );
    });

    const skeleton = streakCardIn(container);
    expect(skeleton).not.toBeNull();
    expect(skeleton).toHaveAttribute("data-streak-state", "skeleton");
    expect(skeleton).toHaveAttribute("aria-hidden", "true");

    resolveFetch(streakResponse(5, true));
    const card = await screen.findByLabelText(
      messages.conclusion.streak.aria(5),
    );
    expect(card).toHaveAttribute("data-streak-state", "value");
    expect(card).toHaveTextContent(messages.conclusion.streak.value(5));
  });

  it("renders a fetched zero honestly and never unmounts on it", async () => {
    fetchMock = vi.fn(() => Promise.resolve(streakResponse(0, false)));
    vi.stubGlobal("fetch", fetchMock);
    writePlayRecord(concluded());

    render(
      <ConclusionView
        game="binairo"
        date={DATE}
        copy={messages.games.binairo.conclusion}
      />,
    );

    const card = await screen.findByLabelText(
      messages.conclusion.streak.aria(0),
    );
    expect(card).toHaveAttribute("data-streak-state", "value");
    expect(card).toHaveTextContent(messages.conclusion.streak.value(0));
  });

  it("unmounts back to absence when the fetch fails", async () => {
    writePlayRecord(concluded());

    const { container } = render(
      <ConclusionView
        game="binairo"
        date={DATE}
        copy={messages.games.binairo.conclusion}
      />,
    );

    expect(streakCardIn(container)).not.toBeNull();
    await waitFor(() => {
      expect(streakCardIn(container)).toBeNull();
    });
  });
});

describe("the streak card's copy honesty (T-WEB-S129)", () => {
  it("renders the maintained tail only when today itself counts", async () => {
    fetchMock = vi.fn(() => Promise.resolve(streakResponse(12, true)));
    vi.stubGlobal("fetch", fetchMock);
    writePlayRecord(concluded());

    render(
      <ConclusionView
        game="binairo"
        date={DATE}
        copy={messages.games.binairo.conclusion}
      />,
    );

    const card = await screen.findByLabelText(
      messages.conclusion.streak.aria(12),
    );
    expect(card).toHaveTextContent(messages.conclusion.streak.value(12));
    expect(card).toHaveTextContent(messages.conclusion.streak.maintained);
  });

  it("renders the bare value on a lost-Termo day — alive is not maintained", async () => {
    fetchMock = vi.fn(() => Promise.resolve(streakResponse(3, false)));
    vi.stubGlobal("fetch", fetchMock);
    writePlayRecord(lostTermo());

    render(<TermoConclusion date={DATE} />);

    const card = await screen.findByLabelText(
      messages.conclusion.streak.aria(3),
    );
    expect(card).toHaveTextContent(messages.conclusion.streak.value(3));
    expect(card).not.toHaveTextContent(messages.conclusion.streak.maintained);
  });

  it("renders the fetched-zero card with the bare value and no tail", async () => {
    fetchMock = vi.fn(() => Promise.resolve(streakResponse(0, false)));
    vi.stubGlobal("fetch", fetchMock);
    writePlayRecord(concluded());

    const { container } = render(
      <ConclusionView
        game="binairo"
        date={DATE}
        copy={messages.games.binairo.conclusion}
      />,
    );

    const card = await screen.findByLabelText(
      messages.conclusion.streak.aria(0),
    );
    expect(card).toHaveTextContent(messages.conclusion.streak.value(0));
    expect(card).not.toHaveTextContent(messages.conclusion.streak.maintained);

    expect(container.textContent).not.toContain("dias seguidos");
  });
});

describe("the share button's treatment (T-WEB-S205)", () => {
  const CSS = stylesheet("src/play/share-button.module.css");

  const CONCLUSION = stylesheet("src/play/conclusion-view.module.css");
  const SHARE = bodyOf(CSS, ".share");
  const MOBILE = bodyOf(CSS, "@media (max-width: 768px)");

  it("is paper with a hard offset shadow, on the system's own radius", () => {
    expect(decl(SHARE, "background")).toBe("var(--paper-card)");
    expect(decl(SHARE, "border")).toBe("1px solid var(--line)");
    expect(decl(SHARE, "border-radius")).toBe("var(--radius)");

    expect(decl(SHARE, "box-shadow")).toBe("var(--shadow-sm) var(--line)");
    expect(decl(bodyOf(CONCLUSION, ".cta"), "box-shadow")).toBe(
      decl(SHARE, "box-shadow"),
    );
  });

  it("declares the three states no `<a>` on either screen supplies", () => {
    expect(decl(SHARE, "cursor")).toBe("pointer");
    expect(decl(bodyOf(CSS, ".share:disabled"), "opacity")).toBe("0.55");
    expect(decl(bodyOf(CSS, ".share:disabled"), "cursor")).toBe("default");

    expect(decl(bodyOf(CSS, ".share:focus-visible"), "outline")).toBe(
      "2px solid var(--ink)",
    );
    expect(
      decl(bodyOf(CSS, ".share:focus-visible"), "outline-offset"),
    ).toBeDefined();
  });

  it("clears the 44px target at BOTH viewports, and F6's 52px at mobile", () => {
    expect(decl(SHARE, "box-sizing")).toBe("border-box");
    expect(decl(SHARE, "min-height")).toBe("var(--touch-target-min)");
    expect(token("--touch-target-min")).toBeGreaterThanOrEqual(44);
    expect(pixels(decl(bodyOf(MOBILE, ".share"), "min-height"))).toBe(52);
  });

  it("insets the label on BOTH axes at the desktop rule", () => {
    const padding = decl(SHARE, "padding");
    expect(padding, ".share declares no padding").toBeDefined();
    const [block, inline] = (padding ?? "").split(/\s+/);
    expect(Number.parseFloat(block ?? "0"), "block padding").toBeGreaterThan(0);
    expect(
      inline,
      "inline padding — a zero here is the cramped red",
    ).toBeDefined();
    expect(inline).not.toBe("0");
    expect(inline).not.toBe("0px");
    expect(decl(bodyOf(MOBILE, ".share"), "padding")).toBeUndefined();
  });

  it("reserves the announcement's box so a successful share never reflows the column", () => {
    const status = bodyOf(CSS, ".shareStatus");
    expect(pixels(decl(status, "min-height"))).toBe(21);
    expect(decl(status, "font")).toBe("var(--text-body)");
  });

  it("carries no animation name from the banned family", () => {
    for (const body of [SHARE, bodyOf(CSS, ".share:active")]) {
      expect(decl(body, "animation")).toBeUndefined();
      expect(body).not.toMatch(/bounce|elastic|wobble|jiggle|spring/i);
    }

    const active = bodyOf(CSS, ".share:active");
    expect(decl(active, "transform")).toBe("translate(1px, 1px)");
    expect(decl(active, "box-shadow")).toBe("2px 2px 0 var(--line)");
  });
});
