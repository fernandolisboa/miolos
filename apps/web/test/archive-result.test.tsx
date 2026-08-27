import { render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LateResult } from "../src/archive/late-result";
import { usePriorConclusion } from "../src/archive/use-prior-conclusion";
import { formatLongDate, formatMonth, messages, routes } from "../src/i18n";
import {
  playRecordKey,
  prunePlayRecords,
  writePlayRecord,
  type PlayRecord,
} from "../src/play/play-record";

//

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
  it("renders the outcome in words, with the accent on the stamp SHAPE only", () => {
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

    const root = container.querySelector("main");
    expect(root?.getAttribute("style")).toContain("--accent");
  });

  it("no time, no streak, no day chips, no chaining CTA and no link to today's dailies — asserted as ABSENCES", () => {
    writePlayRecord(settledRecord());
    const { container } = render(
      <LateResult
        game="sudoku"
        date={DATE}
        outcome="won"
        alreadyConcluded={false}
      />,
    );

    expect(container.textContent).not.toMatch(/\d+:\d\d/);
    expect(screen.queryByText(messages.conclusion.dayCard.title)).toBeNull();

    expect(screen.queryByText(messages.conclusion.stats)).toBeNull();

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

  it("a pendingSync record renders the archive's OWN pending line", () => {
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

    expect(screen.queryByText(messages.conclusion.sync.pending)).toBeNull();
    expect(screen.queryByText(messages.archive.result.late)).toBeNull();
  });
});

describe("AC 4's UI half (T-WEB-S178)", () => {
  it("a result this device ALREADY held is never reported as a late completion", () => {
    writePlayRecord(settledRecord());
    render(
      <LateResult game="sudoku" date={DATE} outcome="won" alreadyConcluded />,
    );

    expect(screen.getByText(messages.archive.result.already)).toBeVisible();
    expect(screen.queryByText(messages.archive.result.late)).toBeNull();
  });

  it("a settled `recorded` record shows the recorded line, which claims no TIMING", () => {
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

    expect(messages.archive.result.late).not.toMatch(/tardi/i);
  });

  it("a REJECTED record says the server refused it — never that it was registered", () => {
    writePlayRecord(settledRecord({ syncOutcome: "rejected" }));
    render(
      <LateResult
        game="sudoku"
        date={DATE}
        outcome="won"
        alreadyConcluded={false}
      />,
    );

    expect(screen.getByText(messages.archive.result.rejected)).toBeVisible();
    expect(screen.queryByText(messages.archive.result.late)).toBeNull();
    expect(screen.queryByText(messages.archive.result.already)).toBeNull();
    expect(screen.queryByText(messages.archive.result.pending)).toBeNull();
  });

  it("a REJECTED record wins over `alreadyConcluded` — the sharper true statement", () => {
    writePlayRecord(settledRecord({ syncOutcome: "rejected" }));
    render(
      <LateResult game="sudoku" date={DATE} outcome="won" alreadyConcluded />,
    );

    expect(screen.getByText(messages.archive.result.rejected)).toBeVisible();
    expect(screen.queryByText(messages.archive.result.already)).toBeNull();
  });

  it("usePriorConclusion re-reads on a REMOUNT, and stays frozen within one", () => {
    const first = renderHook(() => usePriorConclusion("sudoku", DATE));
    expect(first.result.current).toBe(false);

    writePlayRecord(settledRecord());
    first.rerender();
    expect(first.result.current).toBe(false);
    first.unmount();

    const second = renderHook(() => usePriorConclusion("sudoku", DATE));
    expect(second.result.current).toBe(true);
    second.unmount();
  });

  it("no record on this device claims neither a registration nor a failure", () => {
    render(
      <LateResult
        game="sudoku"
        date={DATE}
        outcome="won"
        alreadyConcluded={false}
      />,
    );

    expect(screen.getByText(messages.archive.result.notStored)).toBeVisible();
    expect(screen.queryByText(messages.archive.result.late)).toBeNull();
  });

  it("a LOST archived board is a result, not an unfinished one", () => {
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
  it("a completion refused with 429 stays pending, renders the pending line, and survives every later prune", () => {
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

    prunePlayRecords("2026-08-14");
    expect(window.localStorage.getItem(playRecordKey("sudoku", DATE))).not.toBe(
      null,
    );

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

describe("the archived Termo's word (T-WEB-S177a)", () => {
  function termoRecord(overrides: Partial<PlayRecord> = {}): PlayRecord {
    return {
      v: 1,
      game: "termo",
      date: DATE,
      guesses: [
        {
          guess: "casas",
          tiles: ["absent", "absent", "absent", "absent", "absent"],
        },
      ],
      answer: "carro",
      outcome: "lost",
      elapsedMs: 90_000,
      hintsUsed: 0,
      concluded: true,
      pendingSync: false,
      syncOutcome: "recorded",
      ...overrides,
    } as PlayRecord;
  }

  it.each(["won", "lost"] as const)(
    "reveals the day's word on a %s archived Termo",
    (outcome) => {
      writePlayRecord(termoRecord({ outcome }));
      render(
        <LateResult
          game="termo"
          date={DATE}
          outcome={outcome}
          alreadyConcluded={false}
        />,
      );

      expect(screen.getByText(messages.archive.result.wordLead)).toBeVisible();
      expect(screen.getByText("carro")).toBeVisible();

      expect(screen.queryByText(messages.games.termo.dayWord.lead)).toBeNull();
    },
  );

  it("shows no word for a grid game, and none when the record is absent", () => {
    writePlayRecord(settledRecord());
    const { container } = render(
      <LateResult
        game="sudoku"
        date={DATE}
        outcome="won"
        alreadyConcluded={false}
      />,
    );
    expect(screen.queryByText(messages.archive.result.wordLead)).toBeNull();
    expect(container.textContent).not.toContain("carro");
  });
});

describe("a restored concluded record needs no replay (T-WEB-S179)", () => {
  it("the panel renders from the local record alone — no board, no fetch", () => {
    writePlayRecord(settledRecord());
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const { container } = render(
      <LateResult game="sudoku" date={DATE} outcome="won" alreadyConcluded />,
    );

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
