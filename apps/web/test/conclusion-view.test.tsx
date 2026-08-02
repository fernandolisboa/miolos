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
  type TermoPlayRecord,
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
// A third distinct duration, for the same reason: once Nonogram is playable
// its chip is rendered beside the other two, and a value shared with either
// would make an ambiguous match possible in any test that grows an
// assertion on a duration later (T-WEB-S55).
const NONOGRAM_ELAPSED_MS = 623_000;
// A fourth, for #27's chips. A won Termo publishes NO duration (ADR-0045
// decision 4, plan 022 §15.3), so this value's job is to be looked for and
// not found — which needs it to be distinct from the other three.
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

/**
 * Nonogram's counterpart, needed from #25 onward: with `playRoutes.nonogram`
 * live, "every playable daily is done" is a three-record state, not a
 * two-record one (T-WEB-S55, plan 020 §17).
 */
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
 * Termo's two closed shapes (#27, ADR-0044), at module scope because they are
 * needed by two suites now. With `playRoutes.termo` live and Termo FIRST in
 * `DAY_GAMES`, "every playable daily is done" is a four-record state and every
 * chaining assertion whose subject is another game has to close Termo out of
 * the way first (T-WEB-S101, plan 022 §17.2) — the same growth `concludedNonogram`
 * above records for #25.
 *
 * NEITHER publishes a duration: a lost Termo is *played*, and a won one's
 * elapsed time is mostly per-guess round trips, so ADR-0045 decision 4 keeps
 * the number off both projections.
 */
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
    // §12.3's CTA row and its deviation 9). The set grows with `playRoutes`:
    // #25 made Nonogram playable and #27 Termo, so all FOUR records are the
    // state this test is about — and with Termo routed the set is complete,
    // so this seed stops growing (T-WEB-S101, plan 022 §17.2).
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
    // Two records since #27 routed Termo, and the second is what keeps this
    // test about the ORDER: Termo is `DAY_GAMES[0]`, so with it pending the
    // answer is Termo and the walk never has to step over anything
    // (T-WEB-S101 asserts that state on purpose). Closing Termo out restores
    // the subject and sharpens it — the scan now skips TWO done games,
    // Termo and Binairo, to reach Sudoku.
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
    // "A per-game accent IS that game's identity" (DESIGN.md), so a button
    // that goes to Sudoku wears Sudoku's ink-blue even on Binairo's screen —
    // F5:66's own treatment for a game-destination button.
    //
    // Termo is closed out for the same reason as the case above, and this one
    // deliberately keeps SUDOKU as its destination: T-WEB-S101 covers the
    // mustard pair, and ink-blue is the one that would silently keep passing
    // if `accentVars` were ever reduced to the celebrated game's accent.
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
    // The in-place swap again: the record in storage is the last PLAYING one,
    // so a CTA read off the records alone would send the player straight back
    // into the grid they just closed.
    //
    // The DESTINATION moves as `playRoutes` grows and is not this test's
    // subject: the scan runs Termo → Sudoku (celebrated, and overridden as
    // concluded) → Nonogram → Binairo, so #25 made it stop one game earlier
    // than it did. #27 routed Termo, which now sits FIRST and would answer
    // the scan before it ever reaches the celebrated game — so Termo is
    // closed out here too, and what is asserted either way is that Sudoku is
    // excluded (T-WEB-S55, plan 020 §17; T-WEB-S101, plan 022 §17.2).
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
    // FOUR records since #27, for the same reason as the T-WEB-18 case above,
    // and the fourth is the last one this seed will ever grow: every game is
    // routed (T-WEB-S101, plan 022 §17.2).
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
    // Solid ink, not an accent: this one goes to Hoje, which is no game's
    // identity.
    expect(cta?.style.getPropertyValue("--accent")).toBe("");
  });
});

/**
 * The other half of the activation (T-WEB-S101, plan 022 §17.2). One line in
 * `playRoutes` changes THIS already-shipped surface too, and more sharply than
 * the hub: `DAY_GAMES[0] === "termo"`, so from the moment the key lands
 * `nextPendingDaily` returns Termo FIRST from every one of the three shipped
 * conclusions whenever Termo is pending — which is every day, before the
 * player has touched it.
 *
 * The accent assertion is the point of the test and not decoration. This is
 * #25's ISS-A2 regression class with the worst accent in the palette: mustard
 * is the one accent no paper token is legible on (desk 2.7311:1, card
 * 2.8501:1, tint 2.5457:1, against a 4.5 floor). PR A — merged as #73,
 * closing #68 — made `--ink-on-accent` for Termo `var(--ink)`, at 5.4968:1,
 * and this asserts the CTA carries the pair rather than inheriting the
 * celebrated game's ink onto Termo's fill.
 */
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
    // …and Sudoku, which was this CTA's destination until the key landed, is
    // no longer offered: Termo precedes it in the day's order.
    expect(
      screen.queryByText(
        messages.conclusion.ctaNext(messages.games.sudoku.name),
      ),
    ).not.toBeInTheDocument();
  });

  it("paints it with Termo's own ink on Termo's own fill", () => {
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
    // ADR-0041: `--ink` on mustard, 5.4968:1. `var(--paper-desk)` here would
    // be 2.7311:1 on a 14px/600 label, on three shipped screens at once.
    expect(cta?.style.getPropertyValue("--ink-on-accent")).toBe("var(--ink)");
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
    //
    // The two labels resolve differently and that is the point: `.cta` sits on
    // the `--ink` fill and keeps desk ink, while `.emptyCta` sits on the
    // accent and reads `--ink-on-accent` so terracotta gets card paper
    // (step-6 finding ISS-A2 — `ink-on-accent.test.ts` is that mechanism's
    // own gate). Both are non-accent under the pointer, which is all this
    // finding was ever about.
    const HOVER: Readonly<Record<string, string>> = {
      cta: "var(--paper-desk)",
      emptyCta: "var(--ink-on-accent, var(--paper-desk))",
    };
    for (const [cta, color] of Object.entries(HOVER)) {
      expect(decl(bodyOf(CSS, `.page .${cta}:hover`), "color")).toBe(color);
      // And the losing form is gone rather than merely outranked.
      expect(CSS).not.toMatch(new RegExp(`^\\s*\\.${cta}:hover`, "m"));
    }
  });

  it("insets the concluded card's CTA on BOTH axes (T-WEB-S65a)", () => {
    // Step-6 round-3 finding ISS-A3, the same rule and the same blind spot as
    // the chips below: `.cta` paints a filled background (`--ink`, or the
    // destination game's accent through `.ctaNext`), and at `padding: 14px 0`
    // `impeccable detect` fired `cramped-padding` on the concluded conclusion
    // at 1440x900 and 390x844 — the card AC 2 gates and no URL-mode scan can
    // reach. `--space-4` is 16px (packages/ui/tokens.css); the assertion is on
    // the DECLARATION being non-zero rather than on the token, so a future
    // retune cannot silently return to zero.
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
    // finding `chip-is-cramped-on-the-card-the-scan-cannot-see`. `.chipDone`
    // paints a background and `.chipMissing` a 1.5px dashed border, so a chip
    // with `padding: 12px 0` puts its two block children flush against a
    // VISIBLE boundary and `impeccable detect` fires `cramped-padding` five
    // times per viewport.
    //
    // This tripwire is the ONLY gate on it. The rule needs a CONCLUDED record
    // to render at all, and URL-mode `impeccable detect` launches a clean
    // browser profile (ADR-0031 (e)) — so every CI scan renders the empty
    // branch and this card is never in a scanned frame. #25's AC 2 is the
    // first acceptance criterion that depends on it being populated.
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

/**
 * T-WEB-S80 (plan 022 §15, ADR-0044). `DayEntry` gained CONTEXT.md's third
 * verb, and the two consumers this file owns had to be rewritten for it: the
 * chip's value guard, and the `dayEntry` override that marks the game being
 * celebrated done before its record is written.
 */
describe("the day card's third verb (T-WEB-S80)", () => {
  /** The chip whose name is `game`, scoped so a value never matches another. */
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
    // The third shape, not a second copy of `missing`'s.
    expect(chip.className).toContain("chipPlayed");
    expect(chip.className).not.toContain("chipMissing");
    expect(chip.className).not.toContain("chipDone");
  });

  it("renders a WON termo as `feito` — the case the un-split guard failed", () => {
    // A won Termo is COMPLETED and publishes no duration (plan 022 §15.3), so
    // it is exactly the entry the shipped single guard — `const elapsedMs =
    // entry.concluded ? entry.elapsedMs : undefined; const done = elapsedMs
    // !== undefined;` — dropped straight through to `falta`, next to a game
    // the player had just won.
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
    // Anti-regression for the three shipped games: `entryFor` returns
    // `completed` WITH the record's `elapsedMs` wherever it returned
    // `concluded: true`, so no shipped chip loses its number (ADR-0044
    // consequence (b)).
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
    // jsdom computes no cascade, so the shape carrier is read as stylesheet
    // text (see ./css-source). Reusing the dashed border would make `played`
    // and `missing` pixel-identical and the one new state invisible.
    const CSS = stylesheet("src/play/conclusion-view.module.css");
    const played = decl(bodyOf(CSS, ".chipPlayed"), "border");
    const missing = decl(bodyOf(CSS, ".chipMissing"), "border");

    expect(played).toBe("1.5px solid var(--line)");
    expect(missing).toBe("1.5px dashed var(--line)");
    expect(played).not.toBe(missing);
  });
});

/**
 * The `dayEntry` override, made outcome-aware (plan 022 §15.3). It exists
 * because the game being celebrated is proved done by the STAMP, which is
 * exactly what the record may not say yet — on the in-place swap the record
 * still in storage is the last PLAYING one. Both obvious simplifications
 * break, in opposite directions, and each of these two cases kills one.
 */
describe("the celebrated game's own chip, on a loss (T-WEB-S80)", () => {
  it("marks it PLAYED with no duration, never completed with the stamp's time", () => {
    // Kills the unconditional `{status:"completed", elapsedMs:
    // stamp.elapsedMs}`: that shape puts a duration next to "Jogado" on the
    // loss branch — a time on a game nobody won, the exact lie ADR-0043 and
    // ADR-0044 exist to refuse.
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
          settle: false,
        }}
      />,
    );

    const card = dayCard();
    const chip = within(card)
      .getByText(messages.conclusion.dayCard.games.termo)
      .closest("div");
    expect(chip).toHaveTextContent(messages.conclusion.dayCard.played);
    // No `formatElapsed` output anywhere in the chip, and none in the whole
    // day card for termo's row.
    expect(chip?.textContent).not.toContain(TERMO_ELAPSED);
    expect(chip?.className).toContain("chipPlayed");
  });

  it("still never chains the CTA back into the game just spent", () => {
    // Kills dropping the override on the loss branch: `dayState.termo` would
    // read `pending` (the record in storage is the last playing one), and
    // termo is FIRST in `DAY_GAMES`, so the conclusion of the very game the
    // player just spent would offer it as the default next daily.
    //
    // Asserted on the CTA's LABEL: `ctaNext` names its destination game, so
    // this is the same shape the shipped "never chains back to the game whose
    // stamp is on screen" case uses for Sudoku.
    //
    // AND IT IS LOAD-BEARING NOW, where until the activation commit it was
    // not: with `playRoutes.termo` live, the loop no longer skips termo for
    // want of a route, so the `dayEntry` override is the ONLY thing keeping
    // the player out of the game they just spent.
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
          settle: false,
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
    // The other side of the same override: `outcome.state === "result"` must
    // NOT take the played arm, or a win would enter the day card as `jogado`
    // and drop out of "X de 4 concluídos".
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
          settle: true,
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
    // A game that passes no `outcome` renders what it rendered before the
    // prop existed: its own chip carries the stamp's duration.
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
