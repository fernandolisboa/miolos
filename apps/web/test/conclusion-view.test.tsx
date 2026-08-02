import type { Game } from "@miolos/core";
import { render, screen, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ConclusionView } from "../src/play/conclusion-view";
import {
  writePlayRecord,
  type BinairoPlayRecord,
  type NonogramPlayRecord,
  type SudokuPlayRecord,
} from "../src/play/play-record";
import type { ConclusionPicture } from "../src/play/types";
import { useRecordSnapshot } from "../src/play/use-record-snapshot";
import { formatElapsed, messages, routes } from "../src/i18n";
import { bodyOf, decl, stylesheet } from "./css-source";

// T-WEB-17..T-WEB-20 (plan 017 §15). The conclusion is the same component
// in two places — swapped in place on /binairo when the grid closes (D26)
// and rendered under its own server segment at /binairo/concluido (D27) —
// so these tests drive the bookmarked path: a seeded record and a date.

const sync = vi.hoisted(() => ({
  startCompletionSync: vi.fn(() => () => undefined),
  flushPendingCompletions: vi.fn(() => Promise.resolve()),
}));
vi.mock("../src/play/sync", () => sync);

const DATE = "2026-07-30";
const ELAPSED_MS = 407_000;
const ELAPSED = formatElapsed(ELAPSED_MS);
// A second, DIFFERENT duration: the day card's chips must each read their
// own game's record, which a shared value could not prove (T-WEB-S18).
const SUDOKU_ELAPSED_MS = 512_000;
const SUDOKU_ELAPSED = formatElapsed(SUDOKU_ELAPSED_MS);

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

/**
 * The "O dia até agora" card, scoped — the stamp renders the same duration
 * string in the same document, so an unscoped `getByText(ELAPSED)` would
 * pass on the wrong node.
 */
function dayCard(): HTMLElement {
  const card = screen
    .getByText(messages.conclusion.dayCard.title)
    .closest("section");
  if (card === null) {
    throw new Error("the day card is not inside a <section>");
  }
  return card;
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
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

    // The 52px h1 here would fire impeccable's hero-eyebrow-chip, and
    // `<article>` does not exempt that rule — so the wrapper is structural
    // on this screen too (§12.2).
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
    // Three `falta` chips: no other game has a play route yet, and a fake
    // result would be worse than an honest gap (§12.3).
    expect(
      screen.getAllByText(messages.conclusion.dayCard.missing),
    ).toHaveLength(3);
    // Two nonogram labels — the short one is a distinct string, never a
    // runtime truncation; the media query hides one.
    expect(
      screen.getByText(messages.conclusion.dayCard.games.nonogram),
    ).toBeInTheDocument();
    expect(
      screen.getByText(messages.conclusion.dayCard.games.nonogramShort),
    ).toBeInTheDocument();
  });

  it("points the CTA at Hoje and leaves the statistics link dead", () => {
    // Every playable daily done, which is the only state that still ends the
    // day at Hoje now that the CTA chains (plan 018 S21 supersedes plan 017
    // §12.3's CTA row and its deviation 9).
    writePlayRecord(concluded());
    writePlayRecord(concludedSudoku());

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
    // #29 owns the statistics screen; Hoje's shipped links are href-less
    // for the same reason.
    expect(
      screen.getByText(messages.conclusion.stats).closest("a"),
    ).not.toHaveAttribute("href");
  });
});

/**
 * AC 3's "conclusion chains to the next pending daily" (plan 018 S21/§11.4).
 * The destination is the first game in the day's order that is playable and
 * that this device has not finished — device-local and monotone-safe, so it
 * can only ever offer a game again, never hide one (ADR-0031).
 */
describe("the CTA chains to the next pending daily (T-WEB-S19)", () => {
  it("offers the next playable game, in the day's order", () => {
    writePlayRecord(concluded());

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
    // "A per-game accent IS that game's identity" (DESIGN.md), so a button
    // that goes to Sudoku wears Sudoku's ink-blue even on Binairo's screen —
    // F5:66's own treatment for a game-destination button.
    writePlayRecord(concluded());

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
    // The in-place swap again: the record in storage is the last PLAYING one,
    // so a CTA read off the records alone would send the player straight back
    // into the grid they just closed.
    writePlayRecord(concludedSudoku({ concluded: false, grid: undefined }));

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
        .getByText(messages.conclusion.ctaNext(messages.games.binairo.name))
        .closest("a"),
    ).toHaveAttribute("href", routes.binairo);
  });

  it("falls back to Hoje when every playable daily is done", () => {
    writePlayRecord(concluded());
    writePlayRecord(concludedSudoku());

    render(
      <ConclusionView
        game="sudoku"
        date={DATE}
        copy={messages.games.sudoku.conclusion}
      />,
    );

    const cta = screen.getByText(messages.conclusion.ctaHome).closest("a");
    expect(cta).toHaveAttribute("href", routes.home);
    // Solid ink, not an accent: this one goes to Hoje, which is no game's
    // identity.
    expect(cta?.style.getPropertyValue("--accent")).toBe("");
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

    // Rendered from the BINAIRO conclusion: the sudoku chip's duration can
    // only come from the sudoku record, which is what makes this the
    // per-game read and not a repeat of the stamp (plan 018 §11.4).
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
    // The in-place swap on /binairo (plan 017 D26): React runs the child's
    // mount effect before the parent's, so the record still in storage is
    // the last PLAYING one — and where `localStorage` throws there will
    // never be another. The chip for the game whose stamp is on screen must
    // therefore come from the stamp, or the celebration screen would tell
    // the player the game they just solved is still missing.
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
    // ADR-0031's monotone property, at the surface that renders it. A player
    // who solved Sudoku elsewhere sees `falta` here; the opposite mistake
    // would be visible and wrong.
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

/**
 * The snapshot cache is module-level — one browser has one `localStorage` —
 * so with two conclusion routes live in one SPA session `/binairo/concluido
 * → /sudoku/concluido` on the same day is a real navigation, and a cache
 * keyed on `date` alone would hand the second route the first one's record
 * (plan 018 §19.4, landmine 4).
 */
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
    // The two records agree on every field the conclusion RENDERS, so a
    // date-only key would return the cached binairo snapshot here and no
    // rendered string would give it away. The record's own `game` is what
    // makes the miskey observable at all.
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

    // Not cosmetic: without this line the stamp would stand while the
    // server holds no completion (ADR-0004, §9.2).
    expect(
      screen.getByText(messages.conclusion.sync.rejected),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(messages.conclusion.sync.pending),
    ).not.toBeInTheDocument();
  });

  it("says nothing while the only record is the still-playing one", () => {
    // The in-place swap on /binairo: the child's mount effect runs before
    // the parent's, so the record in storage at this render is the last
    // PLAYING write — `concluded: false`, and a `syncOutcome` that predates
    // this completion entirely. Reading the offline sentence off it told a
    // perfectly online player their result was stranded on their device, on
    // the one celebration screen the product has (findings
    // `pending-sync-line-on-the-happy-path` / `sync-pending-line-on-happy-path`).
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

    // The server render IS the pre-hydration paint: `useSyncExternalStore`
    // takes the server snapshot, so this markup is exactly what the client
    // hydrates against. Flashing "ainda não concluído" and then swapping to
    // a completed stamp would be worse than a beat of nothing (D28).
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
  /**
   * A 5×5 bitmap with a shape that is NOT transpose-symmetric, so a path
   * emitted column-major rather than row-major would produce different
   * coordinates and fail the first-subpath assertion rather than passing by
   * accident.
   */
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

  /** The one `<path>`'s subpaths, as the browser would read them. */
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
    // Anti-vacuity FIRST: "one subpath per filled cell" is vacuously true at
    // zero cells, which is exactly what an `?? []` empty bitmap would render
    // — a labelled graphic with no graphic in it (CLI-5/DES-9).
    expect(subpathsOf(figure).length).toBeGreaterThan(0);
    expect(subpathsOf(figure)).toHaveLength(FILLED);
    // Row-major, and the first filled cell is (row 0, col 1) — `M{col} {row}`.
    expect(subpathsOf(figure)[0]).toBe("M1 0h1v1h-1z");
    // One node, never one `<rect>` per cell: a 15×15 daily carries 48–143
    // filled cells, and every DOM-walking impeccable rule stays O(1) here.
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

    // The stamp still lands: the reveal is additive to it, never instead of
    // it (DESIGN.md:44).
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

  it("leaves binairo's and sudoku's conclusions exactly as they were", () => {
    // The widening is ONE optional prop and ONE conditional block, so a game
    // that passes no picture renders the markup it rendered before this
    // ticket: no figure node, and the stamp is still the only `role="img"`.
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

/**
 * The two conclusion layout defects, read off the stylesheet as TEXT — see
 * the note in `./css-source` for why a layout rule cannot be asserted any
 * other way in jsdom. Both were measured in a real browser at step 6; these
 * are the tripwires that keep the fixes.
 */
describe("the conclusion's layout (tripwires)", () => {
  const CSS = stylesheet("src/play/conclusion-view.module.css");

  it("keeps the grid's block-axis alignment off the shared top-bar rule", () => {
    // finding `conclusion-topbar-collapses-in-flex-column`: `align-self` is
    // the block axis in `.pageResult`'s grid but the CROSS (horizontal) axis
    // in `.pageEmpty`'s flex column, so on the shared rule `start` collapsed
    // the "ainda não concluído" and skeleton headers to fit-content — 261.8px
    // inside a 1280px content box — while §12.3 asks for a header "identical
    // to the populated one".
    expect(decl(bodyOf(CSS, ".topBar"), "align-self")).toBeUndefined();
    expect(decl(bodyOf(CSS, ".pageResult .topBar"), "align-self")).toBe(
      "start",
    );
  });

  it("packs the stacked result rows to the start instead of stretching them", () => {
    // finding `mobile-conclusion-rows-stretch-instead-of-row-gap`: three
    // `auto` rows on a `min-height: 100dvh` page default to
    // `align-content: normal` = stretch, which spent the leftover viewport
    // height as row gaps — the declared 16px rendered as 51px on a 390×667
    // and 140px on a 390×932, so the composition changed per device.
    const stacked = bodyOf(
      bodyOf(CSS, "@media (max-width: 1140px)"),
      ".pageResult",
    );

    expect(decl(stacked, "grid-template-rows")).toBe("auto auto auto");
    expect(decl(stacked, "align-content")).toBe("start");
  });

  it("keeps every solid CTA's label off its own background on hover", () => {
    // finding `chaining-cta-label-vanishes-on-hover`: `.page a:hover`
    // (0,2,1) sets `color: var(--accent)`, and `.ctaNext` paints that same
    // `--accent` as its background — so a bare `.cta:hover` (0,2,0) loses
    // the cascade and the chaining CTA's label goes 1:1 against itself under
    // the pointer. Anchoring the hover on `.page` (0,3,0) wins it back.
    // `impeccable detect` never exercises hover, so this is the only gate.
    for (const cta of ["cta", "emptyCta"]) {
      expect(decl(bodyOf(CSS, `.page .${cta}:hover`), "color")).toBe(
        "var(--paper-desk)",
      );
      // And the losing form is gone rather than merely outranked.
      expect(CSS).not.toMatch(new RegExp(`^\\s*\\.${cta}:hover`, "m"));
    }
  });
});
