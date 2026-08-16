import { render, screen, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GAMES, type Game } from "@miolos/core";

import { ArchiveDayView } from "../app/arquivo/day-view";
import { archiveCardStatus } from "../src/archive/card-status";
import { bodyOf, decl, pixels, stylesheet, token } from "./css-source";
import { archiveGameRoute, formatLongDate, messages } from "../src/i18n";
import { readDayState } from "../src/play/day-state";
import {
  readPlayRecord,
  writePlayRecord,
  type BinairoPlayRecord,
  type NonogramPlayRecord,
  type PlayRecord,
  type SudokuPlayRecord,
  type TermoPlayRecord,
} from "../src/play/play-record";

/**
 * The archive day page's per-game done chip (#96, plan 043, ADR-0056).
 *
 * `readDayState` is imported HERE and nowhere in the archive's own module
 * graph: `T-WEB-S183`'s walker seeds from the `app/arquivo/**` page entries
 * and follows relative imports only, so no test file is ever in it
 * (`eslint.config.mjs:529` records the same for `apps/web/test/**`). That is
 * what makes the drift instrument below legal at all.
 */

const DATE = "2026-08-01";

type Tiles = TermoPlayRecord["guesses"][number]["tiles"];
const MISS: Tiles = ["absent", "present", "absent", "absent", "present"];
const WIN: Tiles = ["correct", "correct", "correct", "correct", "correct"];

const BINAIRO_MS = 407_000;
const SUDOKU_MS = 512_000;
const NONOGRAM_MS = 301_000;
const TERMO_MS = 188_000;

function binairoRecord(
  overrides: Partial<BinairoPlayRecord> = {},
): BinairoPlayRecord {
  return {
    v: 1,
    game: "binairo",
    date: DATE,
    entries: Array.from({ length: 64 }, () => null),
    elapsedMs: BINAIRO_MS,
    hintsUsed: 0,
    concluded: true,
    pendingSync: false,
    syncOutcome: "recorded",
    ...overrides,
  };
}

function sudokuRecord(
  overrides: Partial<SudokuPlayRecord> = {},
): SudokuPlayRecord {
  return {
    v: 1,
    game: "sudoku",
    date: DATE,
    entries: Array.from({ length: 81 }, () => null),
    elapsedMs: SUDOKU_MS,
    hintsUsed: 0,
    concluded: true,
    pendingSync: false,
    syncOutcome: "recorded",
    ...overrides,
  };
}

function nonogramRecord(
  overrides: Partial<NonogramPlayRecord> = {},
): NonogramPlayRecord {
  return {
    v: 1,
    game: "nonogram",
    date: DATE,
    size: 5,
    entries: Array.from({ length: 25 }, () => null),
    elapsedMs: NONOGRAM_MS,
    hintsUsed: 0,
    concluded: true,
    pendingSync: false,
    syncOutcome: "recorded",
    ...overrides,
  };
}

/** A won Termo: a miss and a winning row last. */
function wonTermoRecord(
  overrides: Partial<TermoPlayRecord> = {},
): TermoPlayRecord {
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
    elapsedMs: TERMO_MS,
    hintsUsed: 0,
    concluded: true,
    pendingSync: false,
    syncOutcome: "recorded",
    ...overrides,
  };
}

/** A lost Termo: six judged rows, none of them a win. */
function lostTermoRecord(
  overrides: Partial<TermoPlayRecord> = {},
): TermoPlayRecord {
  return wonTermoRecord({
    guesses: "abcdef".split("").map((letter) => ({
      guess: letter.repeat(5),
      tiles: [...MISS],
    })),
    outcome: "lost",
    ...overrides,
  });
}

/**
 * An UNCONCLUDED record per game. Termo's `superRefine` makes `answer` and
 * `outcome` present exactly when the board closes, so an open Termo must drop
 * both or `writePlayRecord` stores a record `readPlayRecord` then discards —
 * which would make the `unconcluded` row of the matrix below vacuous rather
 * than false.
 */
function openRecord(game: Game): PlayRecord {
  switch (game) {
    case "binairo":
      return binairoRecord({ concluded: false });
    case "sudoku":
      return sudokuRecord({ concluded: false });
    case "nonogram":
      return nonogramRecord({ concluded: false });
    case "termo":
      return {
        ...wonTermoRecord(),
        concluded: false,
        answer: undefined,
        outcome: undefined,
      };
  }
}

function concludedRecord(game: Game): PlayRecord {
  switch (game) {
    case "binairo":
      return binairoRecord();
    case "sudoku":
      return sudokuRecord();
    case "nonogram":
      return nonogramRecord();
    case "termo":
      return wonTermoRecord();
  }
}

/**
 * A concluded record carrying a sync disposition. Written per game rather
 * than as a spread over the union, so no cast is needed and the four members
 * stay exhaustively checked.
 */
function withSync(
  game: Game,
  sync: {
    readonly pendingSync: boolean;
    readonly syncOutcome: PlayRecord["syncOutcome"];
  },
): PlayRecord {
  switch (game) {
    case "binairo":
      return binairoRecord(sync);
    case "sudoku":
      return sudokuRecord(sync);
    case "nonogram":
      return nonogramRecord(sync);
    case "termo":
      return wonTermoRecord(sync);
  }
}

/**
 * The seven record shapes an archive day card can meet, per game.
 *
 * TWELVE of the twenty-eight cells are duplicates and the matrix says so
 * rather than implying twenty-eight independent facts: `won-termo` and
 * `lost-termo` are meaningless for the three grid games, so for those they
 * are the plain `concluded` record again. The rows that carry information for
 * all four games are `absent`, `unconcluded`, `concluded`, `pendingSync` and
 * `rejected`; the two Termo rows carry information for Termo alone, and the
 * lost one is the whole reason this projection is not `concluded === true`.
 */
const SHAPES: readonly {
  readonly name: string;
  readonly seed: (game: Game) => void;
}[] = [
  { name: "absent", seed: () => undefined },
  {
    name: "unconcluded",
    seed: (game) => {
      writePlayRecord(openRecord(game));
    },
  },
  {
    name: "concluded",
    seed: (game) => {
      writePlayRecord(concludedRecord(game));
    },
  },
  {
    name: "won-termo",
    seed: (game) => {
      writePlayRecord(
        game === "termo" ? wonTermoRecord() : concludedRecord(game),
      );
    },
  },
  {
    name: "lost-termo",
    seed: (game) => {
      // Built from the CONCLUDED factory in both branches: a `lost` arm on an
      // unconcluded record would be vacuous, since `concluded === false` short
      // circuits both projections before the outcome is ever read.
      writePlayRecord(
        game === "termo" ? lostTermoRecord() : concludedRecord(game),
      );
    },
  },
  {
    name: "pendingSync: true",
    seed: (game) => {
      writePlayRecord(
        withSync(game, { pendingSync: true, syncOutcome: "pending" }),
      );
    },
  },
  {
    name: 'syncOutcome: "rejected"',
    seed: (game) => {
      writePlayRecord(
        withSync(game, { pendingSync: true, syncOutcome: "rejected" }),
      );
    },
  },
];

beforeEach(() => {
  window.localStorage.clear();
});

/**
 * T-WEB-S215 (plan 043 §4 seam 3, ADR-0056 consequence (f)). The standing
 * anti-drift instrument between the archive's projection and the hub's.
 *
 * Its claim is narrow by design — *the two read the same record the same way*
 * — and explicitly NOT that the two surfaces' states mean the same thing,
 * which `day-state.ts:26-30` says they do not.
 *
 * The agreement arm cannot hold the sync cases on its own, because agreement
 * is invariant under both sides moving together: if a later edit made the hub
 * answer `pending` on a rejected record, this test would simply force the
 * archive to follow and stay green. Hence the ABSOLUTE arms, asserted by
 * value.
 */
describe("archiveCardStatus reads the record the hub's way (T-WEB-S215)", () => {
  for (const shape of SHAPES) {
    for (const game of GAMES) {
      it(`agrees with the hub on ${game} × ${shape.name}`, () => {
        shape.seed(game);

        expect(archiveCardStatus(readPlayRecord(game, DATE))).toBe(
          readDayState(DATE)[game].status,
        );
      });
    }
  }

  it("answers completed on a record the server has not stored", () => {
    // ADR-0031 decision 6 and ADR-0053 decision 10: the chip is device state
    // about THIS DEVICE'S board. `concluded: true` means this device finished
    // it, which is true whether or not the server kept a row. Branching on
    // `syncOutcome` would make the chip an authority on server state.
    expect(archiveCardStatus(sudokuRecord({ pendingSync: true }))).toBe(
      "completed",
    );
    expect(
      archiveCardStatus(
        sudokuRecord({ pendingSync: true, syncOutcome: "rejected" }),
      ),
    ).toBe("completed");
  });

  it("answers played for a lost Termo and completed for a won one", () => {
    expect(archiveCardStatus(lostTermoRecord())).toBe("played");
    expect(archiveCardStatus(wonTermoRecord())).toBe("completed");
  });

  it("answers pending for absence and for an open board", () => {
    expect(archiveCardStatus(undefined)).toBe("pending");
    expect(archiveCardStatus(sudokuRecord({ concluded: false }))).toBe(
      "pending",
    );
  });
});

const copy = messages.archive.day;
const LONG_DATE = formatLongDate(DATE);
const nameOf = (game: Game) => messages.games[game].name;

/** The anchor for one game's card, found by the destination it names. */
function cardFor(container: HTMLElement, game: Game): HTMLElement {
  const anchor = container.querySelector<HTMLElement>(
    `a[href="${archiveGameRoute(DATE, game)}"]`,
  );
  if (anchor === null) throw new Error(`no card for ${game}`);
  return anchor;
}

/**
 * T-WEB-S216 (plan 043 §4 seam 4). ABSENT-FIRST: the server render of the day
 * view reads no store and no clock, and carries neither chip word — so the
 * pre-hydration paint is exactly what a cold profile, a second device and
 * `impeccable detect`'s URL scan all see, and hydration can only ever ADD.
 *
 * Seed FIRST, spy SECOND. `writePlayRecord` goes through `getItem` and
 * `setItem`, so a spy installed before the seed records the seed's own reads
 * and fails against a CORRECT implementation (the shipped idiom is
 * `hoje.smoke.test.tsx:430-433`).
 */
describe("the archive day page paints absent-first (T-WEB-S216)", () => {
  it("renders no chip on the server, reading neither storage nor the clock", () => {
    writePlayRecord(sudokuRecord());
    writePlayRecord(lostTermoRecord());
    const readStorage = vi.spyOn(Storage.prototype, "getItem");
    const clock = vi.spyOn(Date, "now");

    const markup = renderToStaticMarkup(
      <ArchiveDayView date={DATE} games={GAMES} />,
    );

    expect(readStorage).not.toHaveBeenCalled();
    expect(clock).not.toHaveBeenCalled();
    expect(markup).not.toContain(copy.done);
    expect(markup).not.toContain(copy.played);
    // Anti-vacuity: the markup really is the day page, so the two absences
    // above are about the chip and not about an empty render.
    expect(markup).toContain(nameOf("sudoku"));

    readStorage.mockRestore();
    clock.mockRestore();
  });
});

/**
 * T-WEB-S217, T-WEB-S218 and T-WEB-S220 (plan 043 §4 seam 5).
 *
 * S217 — the chip renders on the concluded game's card and on no other, it
 * publishes no duration, and it carries `aria-hidden`. The last is what D5's
 * whole client boundary turns on: an anchor's `aria-label` replaces its
 * content, so a chip that were not hidden would be swallowed and a chip
 * inside a server-rendered anchor could not change the name at all.
 *
 * S218 — a LOST archived Termo renders `Jogado` and never `Feito`.
 *
 * S220 — never a server read (ADR-0053 decision 10, #96's own negative
 * acceptance criterion): `fetch` is a throwing spy and is never called, in
 * either state.
 */
describe("the day card's done chip (T-WEB-S217)", () => {
  it("renders on the concluded game's card and on no other", () => {
    writePlayRecord(sudokuRecord());

    const { container } = render(<ArchiveDayView date={DATE} games={GAMES} />);

    expect(
      within(cardFor(container, "sudoku")).getByText(copy.done),
    ).toBeInTheDocument();
    for (const game of ["binairo", "nonogram", "termo"] as const) {
      expect(
        within(cardFor(container, game)).queryByText(copy.done),
      ).toBeNull();
      expect(
        within(cardFor(container, game)).queryByText(copy.played),
      ).toBeNull();
    }
  });

  it("publishes no duration and no result figure", () => {
    // The record holds a real `elapsedMs` and the hub's chip prints one. This
    // surface does not: `messages.archive.play.note` says the archive counts
    // for neither the streak nor your times, one route away.
    writePlayRecord(sudokuRecord());

    const { container } = render(<ArchiveDayView date={DATE} games={GAMES} />);

    expect(container.textContent).not.toMatch(/\d\d:\d\d/);
  });

  it("carries aria-hidden, so the anchor's label is the only channel", () => {
    writePlayRecord(sudokuRecord());

    const { container } = render(<ArchiveDayView date={DATE} games={GAMES} />);

    const chip = within(cardFor(container, "sudoku")).getByText(copy.done);
    expect(chip).toHaveAttribute("aria-hidden");
  });
});

describe("a lost archived Termo is played, never done (T-WEB-S218)", () => {
  it("renders Jogado for a loss and Feito for a win", () => {
    writePlayRecord(lostTermoRecord());

    const lost = render(<ArchiveDayView date={DATE} games={GAMES} />);
    const lostCard = within(cardFor(lost.container, "termo"));
    expect(lostCard.getByText(copy.played)).toBeInTheDocument();
    expect(lostCard.queryByText(copy.done)).toBeNull();
    lost.unmount();

    writePlayRecord(wonTermoRecord());

    const won = render(<ArchiveDayView date={DATE} games={GAMES} />);
    const wonCard = within(cardFor(won.container, "termo"));
    expect(wonCard.getByText(copy.done)).toBeInTheDocument();
    expect(wonCard.queryByText(copy.played)).toBeNull();
  });
});

describe("the day page never reads a server (T-WEB-S220)", () => {
  it("fires no fetch, with a record and without one", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(() => {
      throw new Error("the archive day page must not read a server");
    });

    const pending = render(<ArchiveDayView date={DATE} games={GAMES} />);
    expect(fetchSpy).not.toHaveBeenCalled();
    pending.unmount();

    writePlayRecord(sudokuRecord());
    render(<ArchiveDayView date={DATE} games={GAMES} />);
    expect(fetchSpy).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
  });
});

/**
 * T-WEB-S219 (plan 043 §4 seam 6, ADR-0056 decision 3). The card's accessible
 * name, at both ends of hydration and in both done states.
 *
 * The chip is `aria-hidden` and an anchor's `aria-label` REPLACES its
 * content, so on a done card this name is the only thing assistive tech gets.
 * That is why the done and played names are different sentences, and why this
 * test asserts they differ rather than trusting two keys to stay two.
 */
describe("the done card's accessible name (T-WEB-S219)", () => {
  it("names the destination before hydration and after it", () => {
    writePlayRecord(sudokuRecord());

    const markup = renderToStaticMarkup(
      <ArchiveDayView date={DATE} games={GAMES} />,
    );
    expect(markup).toContain(copy.cardAria(nameOf("sudoku"), LONG_DATE));
    expect(markup).not.toContain(
      copy.cardAriaDone(nameOf("sudoku"), LONG_DATE),
    );

    render(<ArchiveDayView date={DATE} games={GAMES} />);

    expect(
      screen.getByLabelText(copy.cardAriaDone(nameOf("sudoku"), LONG_DATE)),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText(copy.cardAria(nameOf("sudoku"), LONG_DATE)),
    ).toBeNull();
    // A card with no record keeps the shipped name at both ends.
    expect(
      screen.getByLabelText(copy.cardAria(nameOf("binairo"), LONG_DATE)),
    ).toBeInTheDocument();
  });

  it("gives a played card its own sentence", () => {
    writePlayRecord(lostTermoRecord());

    render(<ArchiveDayView date={DATE} games={GAMES} />);

    expect(
      screen.getByLabelText(copy.cardAriaPlayed(nameOf("termo"), LONG_DATE)),
    ).toBeInTheDocument();
  });

  it("keeps the done and played names DIFFERENT", () => {
    // Identical names would show a sighted user FEITO and JOGADO while
    // telling a screen-reader user the same thing about a won Sudoku and a
    // lost Termo — the false done ADR-0031 decision 2 forbids, in the one
    // channel the player cannot catch it in.
    expect(copy.cardAriaDone("Termo", LONG_DATE)).not.toBe(
      copy.cardAriaPlayed("Termo", LONG_DATE),
    );
  });
});

/**
 * T-WEB-S221 (plan 043 §4 seam 7, D6). The chip's row, asserted from
 * stylesheet text because jsdom implements no layout (`test/css-source.ts`).
 *
 * The invariant is `declared >= used`, NOT `declared === used`. Blink floors
 * a 1.5px used border width to 1px at dpr 1, 2 and 3 alike, so the declared
 * 24px box is what the row RESERVES while the chip PAINTS 23px (21px on
 * mobile, where the padding steps down). Flooring can only ever shrink the
 * second, and a test that asserted the rendered box would have to encode a
 * rendering engine's rounding rule in a CSS-source assertion. The sum of the
 * declarations is the only thing a text reader can honestly check.
 *
 * TWO PASSES, not one, because `bodyOf` matches the first line-anchored block:
 * a one-pass version is blind to the `@media` override, and bumping the mobile
 * padding to `var(--space-2)` would give a 30px box inside a 24px row with
 * every assertion still green. And `line-height` is a TERM in the arithmetic,
 * not an assumption: without it, changing `1` to `1.5` passes while the row
 * goes 5.5px short.
 */
describe("the chip's row reserves the chip's declared box (T-WEB-S221)", () => {
  const sheet = stylesheet("app/arquivo/arquivo.module.css");

  it("puts the kicker and the chip in one flex row of the chip's height", () => {
    const row = bodyOf(sheet, ".cardTop");

    expect(decl(row, "display")).toBe("flex");
    expect(decl(row, "justify-content")).toBe("space-between");
    expect(decl(row, "align-items")).toBe("center");
    expect(decl(row, "min-height")).toBe("var(--done-chip-box)");
    // In flow, and that is the whole design: nothing is positioned, so
    // nothing can overlap the kicker, the tape or the title at any width.
    expect(decl(bodyOf(sheet, ".doneChip"), "position")).toBeUndefined();
    // A long kicker shrinks rather than pushing the chip out of the card.
    expect(decl(bodyOf(sheet, ".cardKicker"), "min-width")).toBe("0");
  });

  it("closes the arithmetic: 2xborder + 2xpadding + font-size x line-height", () => {
    const chip = bodyOf(sheet, ".doneChip");
    // `--done-chip-box: 24px` on `.card` is a bare px length, so `pixels`
    // reads it directly. `border` and `padding` are SHORTHANDS whose second
    // terms are a keyword and a token, so `pixels()` throws on either whole
    // value — each is read from its first term instead.
    const box = pixels(decl(bodyOf(sheet, ".card"), "--done-chip-box"));
    const border = pixels(decl(chip, "border")?.split(/\s+/)[0]);
    const padY = pixels(decl(chip, "padding")?.split(/\s+/)[0]);
    const fontSize = pixels(decl(chip, "font-size"));
    const lineHeight = Number(decl(chip, "line-height"));

    // Unitless, or the product below is meaningless.
    expect(Number.isNaN(lineHeight)).toBe(false);
    expect(2 * border + 2 * padY + fontSize * lineHeight).toBe(box);
    expect(box).toBe(24);
  });

  it("keeps the mobile chip inside the same row, at the same type size", () => {
    const mobile = bodyOf(
      bodyOf(sheet, "@media (max-width: 768px)"),
      ".doneChip",
    );
    const chip = bodyOf(sheet, ".doneChip");
    const box = pixels(decl(bodyOf(sheet, ".card"), "--done-chip-box"));

    // The override carries PADDING ONLY, so border, font-size and
    // line-height come from the top-level block. Its vertical term is a
    // token, not a px length, so it is read with `token()`.
    expect(decl(mobile, "border")).toBeUndefined();
    expect(decl(mobile, "font-size")).toBeUndefined();
    // `var(--space-1)`, so the token NAME is what `token()` takes — the value
    // is resolved out of `packages/ui/tokens.css`, never restated here.
    const padToken = /^var\((--[\w-]+)\)$/.exec(
      decl(mobile, "padding")?.split(/\s+/)[0] ?? "",
    )?.[1];
    expect(padToken).toBe("--space-1");
    const padY = token(padToken ?? "");
    const border = pixels(decl(chip, "border")?.split(/\s+/)[0]);
    const fontSize = pixels(decl(chip, "font-size"));
    const lineHeight = Number(decl(chip, "line-height"));

    // 2 x 1.5 + 2 x 4 + 11 x 1 = 22, inside a 24px row with 2px of slack.
    // ONE constant, no breakpoint-dependent height.
    expect(2 * border + 2 * padY + fontSize * lineHeight).toBeLessThanOrEqual(
      box,
    );
    // 11px is the legibility floor for functional text, and
    // `undersized-ui-text` fires below it — so the mobile step-down takes the
    // padding and never the type.
    expect(fontSize).toBe(11);
  });
});
