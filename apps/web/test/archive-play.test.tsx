import {
  dailyNonogramResponseSchema,
  dailySudokuResponseSchema,
  dailyTermoResponseSchema,
  type DailyBinairoResponse,
  type DailyNonogramResponse,
  type DailySudokuResponse,
  type DailyTermoResponse,
} from "@miolos/core";
import { generateBinairo } from "@miolos/games/binairo";
import { generateNonogram } from "@miolos/games/nonogram";
import { generateDailySudoku } from "@miolos/games/sudoku";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BinairoScreen } from "../src/binairo/binairo-screen";
import { ArchiveBinairoScreen } from "../src/archive/binairo-screen";
import { archiveChrome } from "../src/archive/chrome";
import { ArchiveNonogramScreen } from "../src/archive/nonogram-screen";
import { ArchiveSudokuScreen } from "../src/archive/sudoku-screen";
import { ArchiveTermoScreen } from "../src/archive/termo-screen";
import { formatLongDate, messages, routes } from "../src/i18n";
import { NonogramScreen } from "../src/nonogram/nonogram-screen";
import { playRecordKey } from "../src/play/play-record";
import { PlaySkeleton } from "../src/sudoku/play-view";
import { SudokuScreen } from "../src/sudoku/sudoku-screen";
import { TermoScreen } from "../src/termo/termo-screen";

const PUZZLE = generateDailySudoku({ seed: 20_260_814, weekday: 1 });
const ARCHIVED_DATE = "2026-03-02";
const TODAY = "2026-08-14";

function daily(date: string): DailySudokuResponse {
  return dailySudokuResponseSchema.parse({
    game: "sudoku",
    date,
    givens: PUZZLE.givens,
    tier: PUZZLE.tier,
  });
}

const BINAIRO_PUZZLE = generateBinairo({ seed: 20_260_814, weekday: 6 });
const BINAIRO: DailyBinairoResponse = {
  game: "binairo",
  date: ARCHIVED_DATE,
  size: 8,
  givens: [...BINAIRO_PUZZLE.givens],
};

const NONOGRAM_PUZZLE = generateNonogram(20_260_814, 1);
const NONOGRAM: DailyNonogramResponse = dailyNonogramResponseSchema.parse({
  game: "nonogram",
  date: ARCHIVED_DATE,
  size: NONOGRAM_PUZZLE.size,
  clues: NONOGRAM_PUZZLE.clues,
});

const TERMO: DailyTermoResponse = dailyTermoResponseSchema.parse({
  game: "termo",
  date: ARCHIVED_DATE,
});

beforeEach(() => {
  window.localStorage.clear();

  vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.test");
});

afterEach(() => {
  vi.unstubAllEnvs();
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("the archive play screen mounts at the ARCHIVED date (T-WEB-S176)", () => {
  it("today's record is untouched by an archive mount — the store is keyed (game, date)", () => {
    const todayKey = playRecordKey("sudoku", TODAY);
    window.localStorage.setItem(todayKey, "today's record, untouched");

    render(<ArchiveSudokuScreen daily={daily(ARCHIVED_DATE)} />);

    expect(window.localStorage.getItem(todayKey)).toBe(
      "today's record, untouched",
    );
    expect(playRecordKey("sudoku", ARCHIVED_DATE)).toBe(
      `miolos:play:sudoku:${ARCHIVED_DATE}`,
    );
  });

  it("the screen renders the ARCHIVED date and never today's", () => {
    render(<ArchiveSudokuScreen daily={daily(ARCHIVED_DATE)} />);
    expect(
      screen.getAllByText(formatLongDate(ARCHIVED_DATE)).length,
    ).toBeGreaterThan(0);
    expect(screen.queryByText(formatLongDate(TODAY))).toBeNull();
  });
});

describe("the archive's play chrome (T-WEB-S185)", () => {
  it("with the archive prop, the back link targets the DAY page and the note is a second rules paragraph", () => {
    const { container } = render(
      <ArchiveSudokuScreen daily={daily(ARCHIVED_DATE)} />,
    );

    const back = screen.getByRole("link", {
      name: messages.archive.backToDayAria(formatLongDate(ARCHIVED_DATE)),
    });
    expect(back).toHaveAttribute("href", `/arquivo/${ARCHIVED_DATE}`);
    expect(back).toHaveTextContent(
      messages.archive.backToDay(formatLongDate(ARCHIVED_DATE)),
    );

    const rules = [...container.querySelectorAll("p[class*='rules']")];
    expect(rules).toHaveLength(1);
    const note = screen.getByText(messages.archive.play.note);
    expect(note.className).not.toBe(rules[0]?.className);
    expect(note.className).toBe(archiveChrome(ARCHIVED_DATE).note.className);
    expect(note.className).not.toBe("");

    expect(screen.queryByText(messages.archive.title)).toBeNull();
  });

  it.each([
    [
      "binairo",
      <ArchiveBinairoScreen daily={BINAIRO} key="a" />,
      <BinairoScreen daily={BINAIRO} key="b" />,
    ],
    [
      "nonogram",
      <ArchiveNonogramScreen daily={NONOGRAM} key="a" />,
      <NonogramScreen daily={NONOGRAM} key="b" />,
    ],
    [
      "sudoku",
      <ArchiveSudokuScreen daily={daily(ARCHIVED_DATE)} key="a" />,
      <SudokuScreen daily={daily(ARCHIVED_DATE)} key="b" />,
    ],
    [
      "termo",
      <ArchiveTermoScreen daily={TERMO} key="a" />,
      <TermoScreen daily={TERMO} key="b" />,
    ],
  ])(
    "WITHOUT the prop the %s render is byte-identical to the shipped daily's",
    (_game, archiveScreen, dailyScreen) => {
      const archived = render(archiveScreen).container.innerHTML;
      const shipped = render(dailyScreen).container.innerHTML;

      const noteBlock = new RegExp(
        `<p class="[^"]*">${messages.archive.play.note}</p>`,
      );
      const normalised = archived
        .replace(noteBlock, "")
        .replace(`href="/arquivo/${ARCHIVED_DATE}"`, `href="${routes.home}"`)
        .replace(
          `aria-label="${messages.archive.backToDayAria(formatLongDate(ARCHIVED_DATE))}"`,
          `aria-label="${messages.play.backAria}"`,
        )
        .replace(
          `>${messages.archive.backToDay(formatLongDate(ARCHIVED_DATE))}<`,
          `>${messages.play.back}<`,
        );
      expect(normalised).toBe(shipped);

      expect(shipped).toContain(messages.play.back);
      expect(shipped).not.toContain(messages.archive.play.note);
    },
  );

  it("the skeleton takes the same prop, and carries the daily's chrome without it", () => {
    const bare = render(
      <PlaySkeleton date={ARCHIVED_DATE} tier={PUZZLE.tier} />,
    ).container.innerHTML;
    const withArchive = render(
      <PlaySkeleton
        date={ARCHIVED_DATE}
        tier={PUZZLE.tier}
        archive={archiveChrome(ARCHIVED_DATE)}
      />,
    ).container.innerHTML;

    expect(bare).toContain(`href="${routes.home}"`);
    expect(bare).not.toContain(messages.archive.play.note);
    expect(withArchive).toContain(`href="/arquivo/${ARCHIVED_DATE}"`);
    expect(withArchive).toContain(messages.archive.play.note);
  });
});
