import {
  dailySudokuResponseSchema,
  type DailySudokuResponse,
} from "@miolos/core";
import { generateDailySudoku } from "@miolos/games/sudoku";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { archiveChrome } from "../src/archive/chrome";
import { ArchiveSudokuScreen } from "../src/archive/sudoku-screen";
import { formatLongDate, messages, routes } from "../src/i18n";
import { playRecordKey } from "../src/play/play-record";
import { PlaySkeleton } from "../src/sudoku/play-view";
import { SudokuScreen } from "../src/sudoku/sudoku-screen";

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
  it("T-WEB-S176: today's record is untouched by an archive mount — the store is keyed (game, date)", () => {
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

  it("T-WEB-S176: the screen renders the ARCHIVED date and never today's", () => {
    render(<ArchiveSudokuScreen daily={daily(ARCHIVED_DATE)} />);
    expect(
      screen.getAllByText(formatLongDate(ARCHIVED_DATE)).length,
    ).toBeGreaterThan(0);
    expect(screen.queryByText(formatLongDate(TODAY))).toBeNull();
  });
});

describe("the archive's play chrome (T-WEB-S185)", () => {
  it("T-WEB-S185: with the archive prop, the back link targets the DAY page and the note is a second rules paragraph", () => {
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

    // The note uses NO class outside `screen.module.css`'s shipped set: it is
    // the SAME class as the game's own rules line. A sixth top-bar child (a
    // mode chip) would have needed a new class in `src/play/screen.module.
    // css`, which #31 does not edit.
    const paragraphs = [...container.querySelectorAll("p[class*='rules']")];
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[1]).toHaveTextContent(messages.archive.play.note);
    expect(paragraphs[0]?.className).toBe(paragraphs[1]?.className);

    // There is no mode chip.
    expect(screen.queryByText(messages.archive.title)).toBeNull();
  });

  it("T-WEB-S185: WITHOUT the prop the render is byte-identical to the shipped daily's", () => {
    const archived = render(
      <ArchiveSudokuScreen daily={daily(ARCHIVED_DATE)} />,
    ).container.innerHTML;
    const shipped = render(<SudokuScreen daily={daily(ARCHIVED_DATE)} />)
      .container.innerHTML;

    // The daily screen composes the same view with no prop, so the markup
    // must differ ONLY by the archive's two additions. Normalising them away
    // and asserting equality is what makes "byte-identical when absent" a
    // mechanical claim: a regression in either direction reds here.
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
  });

  it("T-WEB-S185: the skeleton takes the same prop, and carries the daily's chrome without it", () => {
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
