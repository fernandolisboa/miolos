import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { Game } from "@miolos/core";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LateResult } from "../src/archive/late-result";
import { archiveGameRoute, formatShortDate, messages } from "../src/i18n";
import { ConclusionView } from "../src/play/conclusion-view";
import {
  writePlayRecord,
  type BinairoPlayRecord,
  type NonogramPlayRecord,
  type PlayRecord,
  type SudokuPlayRecord,
  type TermoPlayRecord,
} from "../src/play/play-record";
import { absoluteUrl } from "../src/site-origin";

vi.mock("../src/play/sync", () => ({
  startCompletionSync: () => () => undefined,
  flushPendingCompletions: () => Promise.resolve(),
}));
vi.mock("../src/streak/use-streak", () => ({ useStreak: () => null }));
vi.mock("../src/stats/use-stats", () => ({ useStats: () => null }));

const DATE = "2026-03-04";
const ORIGIN = "https://miolos.app";

let shareMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", ORIGIN);
  shareMock = vi.fn(() => Promise.resolve());
  Object.defineProperty(navigator, "share", {
    value: shareMock,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: vi.fn(() => Promise.resolve()) },
    configurable: true,
    writable: true,
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  Reflect.deleteProperty(navigator, "share");
  Reflect.deleteProperty(navigator, "clipboard");
});

const binairo = (): BinairoPlayRecord => ({
  v: 1,
  game: "binairo",
  date: DATE,
  entries: Array.from({ length: 64 }, () => null),
  elapsedMs: 407_000,
  hintsUsed: 0,
  concluded: true,
  pendingSync: false,
  syncOutcome: "recorded",
});

const sudoku = (): SudokuPlayRecord => ({
  v: 1,
  game: "sudoku",
  date: DATE,
  entries: Array.from({ length: 81 }, () => null),
  elapsedMs: 512_000,
  hintsUsed: 0,
  concluded: true,
  pendingSync: false,
  syncOutcome: "recorded",
});

const nonogram = (): NonogramPlayRecord => ({
  v: 1,
  game: "nonogram",
  date: DATE,
  size: 10,
  entries: Array.from({ length: 100 }, () => null),
  elapsedMs: 623_000,
  hintsUsed: 0,
  concluded: true,
  pendingSync: false,
  syncOutcome: "recorded",
});

const termo = (): TermoPlayRecord => ({
  v: 1,
  game: "termo",
  date: DATE,
  guesses: [
    {
      guess: "carta",
      tiles: ["absent", "present", "absent", "absent", "absent"],
    },
    {
      guess: "sonho",
      tiles: ["correct", "correct", "correct", "correct", "correct"],
    },
  ],
  answer: "sonho",
  outcome: "won",
  elapsedMs: 188_000,
  hintsUsed: 0,
  concluded: true,
  pendingSync: false,
  syncOutcome: "recorded",
});

const RECORDS: Readonly<Record<Game, () => PlayRecord>> = {
  binairo,
  sudoku,
  nonogram,
  termo,
};

const GAMES = ["binairo", "sudoku", "nonogram", "termo"] as const;

function shareButton(): HTMLButtonElement | null {
  return screen.queryByRole("button", { name: messages.share.label });
}

async function sharedFrom(element: React.ReactElement): Promise<string> {
  const { unmount } = render(element);
  const button = shareButton();
  expect(button).not.toBeNull();
  expect(button).toBeEnabled();
  (button as HTMLButtonElement).click();
  await waitFor(() => {
    expect(shareMock).toHaveBeenCalledTimes(1);
  });
  const text = (shareMock.mock.calls[0]?.[0] as { text: string }).text;
  unmount();
  shareMock.mockClear();
  return text;
}

function panel(game: Game, alreadyConcluded = false) {
  return (
    <LateResult
      game={game}
      date={DATE}
      outcome="won"
      alreadyConcluded={alreadyConcluded}
    />
  );
}

describe("what a LATE share may honestly say (T-WEB-S231)", () => {
  it("is byte-identical to the on-time share of the same record, on all four games", async () => {
    for (const game of GAMES) {
      const record = RECORDS[game]();
      writePlayRecord(record);

      const late = await sharedFrom(panel(game));
      const daily = await sharedFrom(
        <ConclusionView
          game={game}
          date={DATE}
          copy={messages.games[game].conclusion}
          result={{ elapsedMs: record.elapsedMs, hintsUsed: 0 }}
          {...(game === "termo"
            ? { outcome: undefined, answer: undefined }
            : {})}
        />,
      );

      expect(late, game).toBe(daily);

      expect(late, game).toContain(messages.games[game].name);
      expect(late, game).toContain(formatShortDate(DATE));
      expect(late, game).toContain(absoluteUrl(archiveGameRoute(DATE, game)));
      window.localStorage.clear();
    }
  });

  it("says nothing about WHEN: the panel's five honesty states move its note and never its bytes", async () => {
    const copy = messages.archive.result;
    const cases = [
      { note: copy.late, already: false, over: {} },
      { note: copy.already, already: true, over: {} },
      { note: copy.pending, already: false, over: { pendingSync: true } },
      {
        note: copy.rejected,
        already: false,
        over: { syncOutcome: "rejected" as const },
      },
    ];

    const texts: string[] = [];
    const notes: string[] = [];
    for (const testCase of cases) {
      window.localStorage.clear();
      writePlayRecord({ ...sudoku(), ...testCase.over });
      const { unmount } = render(panel("sudoku", testCase.already));
      notes.push(screen.getByText(testCase.note).textContent ?? "");
      unmount();
      texts.push(await sharedFrom(panel("sudoku", testCase.already)));
    }

    expect(new Set(notes).size).toBe(4);

    expect(new Set(texts).size).toBe(1);

    for (const forbidden of ["hoje", "tardia", "atrasad", "hoy"]) {
      expect(texts[0]?.toLowerCase(), forbidden).not.toContain(forbidden);
    }
  });

  it("a locally judged outcome gets the SAME result line as a server-recorded one — there is no other kind", async () => {
    window.localStorage.clear();
    const won = termo();
    writePlayRecord(won);
    const wonText = await sharedFrom(panel("termo"));
    expect(wonText).toContain(messages.share.termoWon(won.guesses.length, 6));

    window.localStorage.clear();
    const lost: TermoPlayRecord = {
      ...won,
      guesses: Array.from({ length: 6 }, () => ({
        guess: "carta",
        tiles: [
          "absent",
          "present",
          "absent",
          "absent",
          "absent",
        ] as TermoPlayRecord["guesses"][number]["tiles"],
      })),
      outcome: "lost",
    };
    writePlayRecord(lost);

    const lostText = await sharedFrom(panel("termo"));
    expect(lostText).toContain(messages.share.termoLost(6));
  });

  it("an UNCONCLUDED record for the same key shares nothing — the gate that stops a won Termo shipping `X/6`", () => {
    window.localStorage.clear();
    const won = termo();
    const inProgress: TermoPlayRecord = {
      ...won,

      guesses: Array.from({ length: 5 }, () => ({
        guess: "carta",
        tiles: [
          "absent",
          "present",
          "absent",
          "absent",
          "absent",
        ] as TermoPlayRecord["guesses"][number]["tiles"],
      })),
      answer: undefined,
      outcome: undefined,
      concluded: false,
    };
    writePlayRecord(inProgress);

    const first = render(panel("termo"));
    const button = shareButton();

    expect(button).not.toBeNull();
    expect(button).toBeDisabled();

    (button as HTMLButtonElement).click();
    expect(shareMock).not.toHaveBeenCalled();

    first.unmount();
    window.localStorage.clear();
    writePlayRecord(won);
    const { unmount } = render(panel("termo"));
    expect(shareButton()).toBeEnabled();
    unmount();
  });

  it("carries nothing from ADR-0054 decision 3's exclusion list — including the answer that is also a guess", async () => {
    window.localStorage.clear();
    writePlayRecord(termo());
    const text = await sharedFrom(panel("termo"));

    expect(text).not.toContain("sonho");
    expect(text).not.toContain("SONHO");
    expect(text).not.toContain("carta");

    window.localStorage.clear();
    writePlayRecord(nonogram());
    const plain = await sharedFrom(panel("nonogram"));
    window.localStorage.clear();
    writePlayRecord({
      ...nonogram(),
      size: 15,
      entries: Array.from({ length: 225 }, () => null),
      hintsUsed: 1,
      syncOutcome: "rejected",
    });
    const loaded = await sharedFrom(panel("nonogram"));
    expect(loaded).toBe(plain);
  });

  it("the panel gained no prop, no elapsed time and no second URL — the deliberate absences are intact", () => {
    const source = readFileSync(
      join(import.meta.dirname, "..", "src/archive/late-result.tsx"),
      "utf8",
    );
    const stripped = source
      .replaceAll(/\/\*[\s\S]*?\*\//g, "")
      .replaceAll(/(^|[^:])\/\/.*$/gm, "$1");
    expect(stripped).toContain("stamp={undefined}");
    for (const absent of [
      "elapsedMs",
      "ConclusionResult",
      "formatElapsed",
      "useStreak",
      "useStats",
    ]) {
      expect(stripped, absent).not.toContain(absent);
    }

    expect(
      [...stripped.matchAll(/readonly (\w+)[?]?:/g)].map((m) => m[1]),
    ).toEqual(["game", "date", "outcome", "alreadyConcluded"]);

    const store = Object.getOwnPropertyDescriptor(window, "localStorage");
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new Error("site data blocked");
      },
    });
    try {
      for (const game of GAMES) {
        const { unmount } = render(panel(game));
        expect(shareButton(), game).toBeNull();

        expect(
          document.querySelector("[data-play-state]"),
          game,
        ).toHaveAttribute("data-play-state", "concluded");
        unmount();
      }
    } finally {
      if (store !== undefined) {
        Object.defineProperty(window, "localStorage", store);
      }
    }
  });
});
