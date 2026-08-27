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

function cardFor(container: HTMLElement, game: Game): HTMLElement {
  const anchor = container.querySelector<HTMLElement>(
    `a[href="${archiveGameRoute(DATE, game)}"]`,
  );
  if (anchor === null) throw new Error(`no card for ${game}`);
  return anchor;
}

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

    expect(markup).toContain(nameOf("sudoku"));

    readStorage.mockRestore();
    clock.mockRestore();
  });
});

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
    expect(copy.cardAriaDone("Termo", LONG_DATE)).not.toBe(
      copy.cardAriaPlayed("Termo", LONG_DATE),
    );
  });
});

describe("the chip's row reserves the chip's declared box (T-WEB-S221)", () => {
  const sheet = stylesheet("app/arquivo/arquivo.module.css");

  it("puts the kicker and the chip in one flex row of the chip's height", () => {
    const row = bodyOf(sheet, ".cardTop");

    expect(decl(row, "display")).toBe("flex");
    expect(decl(row, "justify-content")).toBe("space-between");
    expect(decl(row, "align-items")).toBe("center");
    expect(decl(row, "min-height")).toBe("var(--done-chip-box)");

    expect(decl(bodyOf(sheet, ".doneChip"), "position")).toBeUndefined();

    expect(decl(bodyOf(sheet, ".cardKicker"), "min-width")).toBe("0");
  });

  it("closes the arithmetic: the chip's OUTER box is what the row reserves", () => {
    const chip = bodyOf(sheet, ".doneChip");

    const box = pixels(decl(bodyOf(sheet, ".card"), "--done-chip-box"));
    const border = pixels(decl(chip, "border")?.split(/\s+/)[0]);
    const padY = pixels(decl(chip, "padding")?.split(/\s+/)[0]);
    const marginY = pixels(decl(chip, "margin-block"));
    const fontSize = pixels(decl(chip, "font-size"));
    const lineHeight = Number(decl(chip, "line-height"));

    expect(Number.isNaN(lineHeight)).toBe(false);

    expect(2 * border + 2 * padY + fontSize * lineHeight).toBe(24);
    expect(marginY).toBeLessThan(0);
    expect(2 * border + 2 * padY + fontSize * lineHeight + 2 * marginY).toBe(
      box,
    );
    expect(box).toBe(19);
  });

  it("keeps the mobile chip inside the same row, at the same type size", () => {
    const mobile = bodyOf(
      bodyOf(sheet, "@media (max-width: 768px)"),
      ".doneChip",
    );
    const chip = bodyOf(sheet, ".doneChip");
    const box = pixels(decl(bodyOf(sheet, ".card"), "--done-chip-box"));

    expect(decl(mobile, "border")).toBeUndefined();
    expect(decl(mobile, "font-size")).toBeUndefined();

    const padToken = /^var\((--[\w-]+)\)$/.exec(
      decl(mobile, "padding")?.split(/\s+/)[0] ?? "",
    )?.[1];
    expect(padToken).toBe("--space-1");
    const padY = token(padToken ?? "");
    const border = pixels(decl(chip, "border")?.split(/\s+/)[0]);
    const marginY = pixels(decl(chip, "margin-block"));
    const fontSize = pixels(decl(chip, "font-size"));
    const lineHeight = Number(decl(chip, "line-height"));

    expect(decl(mobile, "margin-block")).toBeUndefined();
    expect(
      2 * border + 2 * padY + fontSize * lineHeight + 2 * marginY,
    ).toBeLessThanOrEqual(box);

    expect(fontSize).toBe(11);
  });
});
