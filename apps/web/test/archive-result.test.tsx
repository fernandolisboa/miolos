import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LateResult } from "../src/archive/late-result";
import { formatLongDate, formatMonth, messages, routes } from "../src/i18n";
import {
  playRecordKey,
  prunePlayRecords,
  writePlayRecord,
  type PlayRecord,
} from "../src/play/play-record";

// The late-result panel (#31, ADR-0053 decision 9). It renders IN PLACE on
// the archive play URL: there is no `/concluido` sibling, and the archive
// never enters `ConclusionView`'s tree.
//
// This is the state CI's `impeccable detect` can NEVER reach — a clean
// profile has no record, which is ADR-0043 consequence (d)'s exact situation
// — so the jsdom assertions here are the evidence for it.

const DATE = "2026-03-02";

function settledRecord(overrides: Partial<PlayRecord> = {}): PlayRecord {
  return {
    v: 1,
    game: "sudoku",
    date: DATE,
    entries: Array.from({ length: 81 }, () => null),
    elapsedMs: 412_000,
    hintsUsed: 0,
    concluded: true,
    pendingSync: false,
    syncOutcome: "recorded",
    ...overrides,
  } as PlayRecord;
}

beforeEach(() => {
  window.localStorage.clear();
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
  window.localStorage.clear();
});

describe("the late-result panel (T-WEB-S177)", () => {
  it("T-WEB-S177: renders the outcome in words, with the accent on the stamp SHAPE only", () => {
    writePlayRecord(settledRecord());
    const { container } = render(
      <LateResult
        game="sudoku"
        date={DATE}
        outcome="won"
        alreadyConcluded={false}
      />,
    );

    expect(screen.getByText(messages.archive.result.wonTitle)).toBeVisible();
    expect(screen.getByText(messages.archive.result.late)).toBeVisible();
    // The accent rides `--accent` on the root, read by the stamp's BORDER.
    // No word on this panel is ever accent-coloured (ADR-0041 decision 1),
    // which `ink-on-accent.test.ts` scans the sheet for.
    const root = container.querySelector("main");
    expect(root?.getAttribute("style")).toContain("--accent");
  });

  it("T-WEB-S177: no time, no streak, no day chips, no chaining CTA and no link to today's dailies — asserted as ABSENCES", () => {
    writePlayRecord(settledRecord());
    const { container } = render(
      <LateResult
        game="sudoku"
        date={DATE}
        outcome="won"
        alreadyConcluded={false}
      />,
    );

    // A published result time is the comparison-shaped artefact ADR-0008
    // rule 2 keeps apart, and a number no aggregate on this branch contains.
    expect(container.textContent).not.toMatch(/\d+:\d\d/);
    expect(screen.queryByText(messages.conclusion.dayCard.title)).toBeNull();
    // No chaining CTA and no statistics link — the archive's job is to keep
    // you in the archive. (`conclusion.stampLabel` is deliberately NOT
    // asserted absent: it is the word "Concluído", which the archive's own
    // won title also uses, so the assertion would be about copy collision
    // rather than about the conclusion's machinery.)
    expect(screen.queryByText(messages.conclusion.stats)).toBeNull();

    // The two links out are the day and its month — never today's dailies.
    const hrefs = [...container.querySelectorAll("a")].map((a) =>
      a.getAttribute("href"),
    );
    expect(hrefs).toEqual([`/arquivo/${DATE}`, "/arquivo/mes/2026-03"]);
    for (const daily of [
      routes.home,
      routes.binairo,
      routes.sudoku,
      routes.nonogram,
      routes.termo,
      routes.stats,
    ]) {
      expect(hrefs).not.toContain(daily);
    }
  });

  it("T-WEB-S177: a pendingSync record renders the archive's OWN pending line", () => {
    writePlayRecord(
      settledRecord({ pendingSync: true, syncOutcome: "pending" }),
    );
    render(
      <LateResult
        game="sudoku"
        date={DATE}
        outcome="won"
        alreadyConcluded={false}
      />,
    );

    expect(screen.getByText(messages.archive.result.pending)).toBeVisible();
    // NOT the conclusion's string: that one names connectivity, and the
    // archive's own cause is the late-write ceiling answering 429.
    expect(screen.queryByText(messages.conclusion.sync.pending)).toBeNull();
    expect(screen.queryByText(messages.archive.result.late)).toBeNull();
  });
});

describe("AC 4's UI half (T-WEB-S178)", () => {
  it("T-WEB-S178: a result this device ALREADY held is never reported as a late completion", () => {
    writePlayRecord(settledRecord());
    render(
      <LateResult game="sudoku" date={DATE} outcome="won" alreadyConcluded />,
    );

    expect(screen.getByText(messages.archive.result.already)).toBeVisible();
    expect(screen.queryByText(messages.archive.result.late)).toBeNull();
  });

  it("T-WEB-S178: a settled `recorded` record never shows the pending line", () => {
    writePlayRecord(settledRecord());
    render(
      <LateResult
        game="sudoku"
        date={DATE}
        outcome="won"
        alreadyConcluded={false}
      />,
    );

    expect(screen.queryByText(messages.archive.result.pending)).toBeNull();
    expect(screen.getByText(messages.archive.result.late)).toBeVisible();
  });

  it("T-WEB-S178: a LOST archived board is a result, not an unfinished one", () => {
    writePlayRecord(settledRecord());
    render(
      <LateResult
        game="sudoku"
        date={DATE}
        outcome="lost"
        alreadyConcluded={false}
      />,
    );
    expect(screen.getByText(messages.archive.result.lostTitle)).toBeVisible();
    expect(screen.queryByText(messages.archive.result.wonTitle)).toBeNull();
  });
});

describe("the ceiling at the UI (T-WEB-S180)", () => {
  it("T-WEB-S180: a completion refused with 429 stays pending, renders the pending line, and survives every later prune", () => {
    // 429 is NOT in `sync.ts`'s terminal set (ADR-0053 decision 13), so the
    // record the server refused is still the only copy of a puzzle the
    // player actually solved. Three facts have to hold together for that to
    // be visible rather than merely true in the queue.
    const capped = settledRecord({
      pendingSync: true,
      syncOutcome: "pending",
    });
    writePlayRecord(capped);

    render(
      <LateResult
        game="sudoku"
        date={DATE}
        outcome="won"
        alreadyConcluded={false}
      />,
    );
    expect(screen.getByText(messages.archive.result.pending)).toBeVisible();

    // A later daily mount prunes with TODAY as the keep-date, and a pending
    // record is never a candidate at any date.
    prunePlayRecords("2026-08-14");
    expect(window.localStorage.getItem(playRecordKey("sudoku", DATE))).not.toBe(
      null,
    );

    // And again with fifty settled past records already held — the retention
    // cap counts SETTLED records only, so the pending tail is untouched.
    for (let index = 0; index < 60; index += 1) {
      writePlayRecord(
        settledRecord({
          date: `2026-06-${String((index % 28) + 1).padStart(2, "0")}`,
          game: index % 2 === 0 ? "sudoku" : "binairo",
          entries: Array.from(
            { length: index % 2 === 0 ? 81 : 64 },
            () => null,
          ),
        }),
      );
    }
    prunePlayRecords("2026-08-14");
    expect(window.localStorage.getItem(playRecordKey("sudoku", DATE))).not.toBe(
      null,
    );
  });
});

describe("a restored concluded record needs no replay (T-WEB-S179)", () => {
  it("T-WEB-S179: the panel renders from the local record alone — no board, no fetch", () => {
    writePlayRecord(settledRecord());
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const { container } = render(
      <LateResult game="sudoku" date={DATE} outcome="won" alreadyConcluded />,
    );

    // The archive play URL is itself permanent and re-renders the stored
    // result on reload — the claim ADR-0053 decision 9 rests on, and the
    // reason no `/concluido` route ships. It costs no request at all.
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(container.querySelector("[data-play-state='playing']")).toBeNull();
    expect(
      container.querySelector("[data-play-state='concluded']"),
    ).not.toBeNull();
    expect(
      screen.getByRole("link", {
        name: messages.archive.backToDayAria(formatLongDate(DATE)),
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("link", {
        name: messages.archive.backToMonthAria(formatMonth("2026-03-01")),
      }),
    ).toBeVisible();
    vi.unstubAllGlobals();
  });
});
