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

// The archive's play screens (#31, ADR-0053 decisions 1 and 9). The shells
// compose the shipped hook and views and never the screen ROOTS —
// T-WEB-S183 in archive-day.test.tsx is the module-graph assertion that makes
// that claim mechanical rather than prose.

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

// The other three games' wall projections, on `route-ssr.test.tsx`'s
// fixtures, for the byte-identity claim that has to hold for all four
// (step-6 F14). Parsed rather than written, so each is the wall's exact key
// set and nothing wider.
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
  // The lifecycle's mount effect starts the completion sync, which reads the
  // API url and logs loudly without one. Nothing here posts: no board closes.
  vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.test");
});

afterEach(() => {
  vi.unstubAllEnvs();
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("the archive play screen mounts at the ARCHIVED date (T-WEB-S176)", () => {
  it("today's record is untouched by an archive mount — the store is keyed (game, date)", () => {
    // ADR-0029 decision 4's keying is the fact that makes archive play
    // possible at all without a second store, and the fact `prunePlayRecords`
    // needed a retention cap to stop exploiting (ADR-0053 decision 14).
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

    // The note carries the ARCHIVE'S OWN class, from the archive's own
    // stylesheet, and NOT `screen.rules` (step-6 F10b). It shipped as a
    // second `screen.rules` paragraph — same size, colour and margin as the
    // game's rules line directly above — so the one line saying "this does
    // not move your streak" was indistinguishable from "fill the grid so
    // each row has 1–9". Nothing under `src/play/` is edited for it: a
    // CSS-module class name is a string the chrome object hands over.
    const rules = [...container.querySelectorAll("p[class*='rules']")];
    expect(rules).toHaveLength(1);
    const note = screen.getByText(messages.archive.play.note);
    expect(note.className).not.toBe(rules[0]?.className);
    expect(note.className).toBe(archiveChrome(ARCHIVED_DATE).note.className);
    expect(note.className).not.toBe("");

    // There is no mode chip.
    expect(screen.queryByText(messages.archive.title)).toBeNull();
  });

  // ALL FOUR GAMES, and the widening is the finding (step-6 F14). This
  // claim — "byte-identical when the prop is absent" — is asserted as fact
  // from NINE doc blocks (the four `play-view.tsx` pairs and
  // `src/play/types.ts`) and from plan 037 §1 (iv), and it was proved for
  // sudoku alone. Termo mattered most: its `PlayView` has the most complex
  // top bar, and the `progressBar` slot's child count is what the sheet's
  // `space-between` depends on.
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

      // The daily screen composes the same view with no prop, so the markup
      // must differ ONLY by the archive's two additions. Normalising them
      // away and asserting equality is what makes "byte-identical when
      // absent" a mechanical claim: a regression in either direction reds
      // here. The note now carries its OWN class (step-6 F10b), so the
      // pattern matches any class rather than assuming the shared one.
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
