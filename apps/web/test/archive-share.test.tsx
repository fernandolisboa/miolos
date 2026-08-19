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

/**
 * THE HONEST LATE SHARE (#103, ADR-0054's own Rejected entry, taken up).
 *
 * The daily's control is `conclusion-share.test.tsx` and the composer's
 * contract is `share-text.test.ts`; neither is re-proved here. What this file
 * owns is the one product decision #103 makes — **what a share composed on
 * the archive's late-result panel may honestly say** — and it is asserted as
 * an identity rather than as a list, because the decision is an identity:
 *
 * 1. **A late share says exactly what an on-time share says.** Same record,
 *    same bytes, on all four games. There is no second version of the text,
 *    which is the shape ADR-0054 decision 3 rejected for the streak — *"a
 *    share whose content depends on whether a fetch resolved is a share with
 *    two versions, one of them online-only, and one version is cheaper"*.
 * 2. **It therefore says nothing about WHEN the day was solved**, and it
 *    cannot: the panel's five honesty states (queued, refused, already held
 *    here, settled, not stored) move its NOTE and never its bytes, and
 *    `onTime` is parsed and discarded client-side by `sync.ts` so no client
 *    surface holds the fact at all. The date in the header is the PUZZLE's,
 *    handed down by the page shell — decision 3's *"the date is in; the word
 *    is out"*.
 * 3. **A locally judged outcome gets the same result line as a
 *    server-recorded one**, because there is no other kind: the DAILY's share
 *    is composed from the same local record — `ConclusionView`'s own `stored`,
 *    the twin of the gate below — so "server-recorded" names nothing this app
 *    can read. `late-result.tsx`'s `outcome` prop carries the same statement
 *    in prose.
 * 4. **Termo's grid is as truthful here as on the daily.** Every tile in
 *    `guesses[].tiles` is a verdict from `POST /termo/guesses` (ADR-0038),
 *    and the archived Termo runs the SAME `useTermoPlay` hook against the
 *    SAME route — `archive/termo-screen.tsx` composes the hook, never a
 *    second judge. The identity in (1) is what carries it: an untruthful
 *    archive grid would have to differ from the daily's, and it cannot.
 *
 * The exclusion list stays where it is proved: the composer's own
 * differentials (`T-WEB-S190`/`S191`). What is asserted here is that the
 * ARCHIVE reaches that composer with a record and nothing else — no wrapper,
 * no prefix, no second option key.
 */

vi.mock("../src/play/sync", () => ({
  startCompletionSync: () => () => undefined,
  flushPendingCompletions: () => Promise.resolve(),
}));
vi.mock("../src/streak/use-streak", () => ({ useStreak: () => null }));
vi.mock("../src/stats/use-stats", () => ({ useStats: () => null }));

const DATE = "2026-03-04";
const ORIGIN = "https://miolos.app";

let shareMock: ReturnType<typeof vi.fn>;

/**
 * `navigator.share` present and resolving. One field, `text` — so the bytes
 * the sheet receives ARE the composed string and the assertions below need no
 * clipboard (`conclusion-share.test.tsx`'s T-WEB-S196 owns the two-mechanism
 * identity).
 */
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

// ── fixtures ────────────────────────────────────────────────────────────

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

/** A WON Termo whose winning guess is the answer — the sharpest spoiler
 *  fixture, since `answer` and the last `guess` are the same five letters. */
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

/** Click the panel's share button and return the bytes the sheet received. */
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

// ── T-WEB-S231 ──────────────────────────────────────────────────────────

describe("what a LATE share may honestly say (T-WEB-S231)", () => {
  it("is byte-identical to the on-time share of the same record, on all four games", async () => {
    // THE DECISION, as an identity. If the archive ever grew a lateness
    // marker, a different result line, or a note that a day was solved after
    // its date, this equality is what would go red — and it goes red for the
    // right reason, naming the daily's own text as the thing it must equal.
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
      // Non-vacuous: the string really is the shipped share and not two empty
      // ones. It carries the game's name, the PUZZLE's date and the permalink
      // for the day being shared.
      expect(late, game).toContain(messages.games[game].name);
      expect(late, game).toContain(formatShortDate(DATE));
      expect(late, game).toContain(absoluteUrl(archiveGameRoute(DATE, game)));
      window.localStorage.clear();
    }
  });

  it("says nothing about WHEN: the panel's five honesty states move its note and never its bytes", async () => {
    // `late-result.tsx`'s `note()` is a five-arm refusal ladder, and the four
    // arms a record can reach are exercised here. Every one of them is a
    // statement about the SERVER's row; none of them may reach a chat
    // message, because `onTime` is parsed and discarded by `sync.ts` and the
    // client therefore cannot support a claim about when the day was solved
    // (ADR-0054 decision 3).
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

    // The notes really differ — otherwise the invariance below is vacuous.
    expect(new Set(notes).size).toBe(4);
    // And the share does not.
    expect(new Set(texts).size).toBe(1);
    // No word in the corpus claims a moment. `hoje` is the one ADR-0054
    // decision 3 names; the other three are the ones a "late share" would
    // reach for. The scan is case-insensitive and accent-exact.
    for (const forbidden of ["hoje", "tardia", "atrasad", "hoy"]) {
      expect(texts[0]?.toLowerCase(), forbidden).not.toContain(forbidden);
    }
  });

  it("a locally judged outcome gets the SAME result line as a server-recorded one — there is no other kind", async () => {
    // `sync.ts`'s `acceptResponse` parses and DISCARDS
    // `completionResponseSchema.outcome`, so no server outcome is available
    // to any client surface (`late-result.tsx`'s `outcome` prop doc block,
    // ADR-0053 decision 10 as amended at I42). The daily's share is composed from the same local
    // record. A second version of the text for archive players would
    // therefore be a version keyed on nothing the client can read — and it is
    // exactly the two-version shape decision 3 rejected for the streak.
    //
    // The Termo case is the one that can actually diverge across devices
    // (win on A, lose on B), and the honest answer is that each device shares
    // ITS OWN board: the result line follows the record's stored `outcome`
    // and the grid follows its own `guesses`, both written by the same close.
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
    // `outcome="won"` on the PANEL, `lost` on the record: the panel's title is
    // this session's locally judged board and the share is the record's own
    // close. They are allowed to disagree, and the share follows the record —
    // which is the only source that carries the grid it must be consistent
    // with.
    const lostText = await sharedFrom(panel("termo"));
    expect(lostText).toContain(messages.share.termoLost(6));
  });

  it("an UNCONCLUDED record for the same key shares nothing — the gate that stops a won Termo shipping `X/6`", () => {
    // THE MUTATION TEST FOR `late-result.tsx`'s `concluded === true` GATE
    // (#103 step-6 blocker B1: every other fixture in this file is
    // `concluded: true`, so the one line holding the ticket's own honesty
    // claim was unasserted).
    //
    // The window is not hypothetical. `use-play-lifecycle.ts` persists an
    // IN-PROGRESS record on every entry change, and the archive screens swap
    // `LateResult` in from REDUCER state during render while the closing
    // write is an effect — so on the panel's first commit a record exists for
    // this key and is not concluded. Termo is the sharpest case: the record's
    // `superRefine` writes `outcome` and `answer` exactly when `concluded`
    // flips, so an unconcluded record has NO `outcome`, and `buildShareText`
    // would fall into its `termoLost` arm. A player who had just won would
    // share `X/6`.
    window.localStorage.clear();
    const won = termo();
    const inProgress: TermoPlayRecord = {
      ...won,
      // Five judged rows, none of them winning: a board genuinely still in
      // play, which is what the panel's first commit can actually hold.
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
    // The box is RESERVED, not removed — `playRecordsAvailable()` is true
    // here, so this is decision 1a's middle state and gating the render
    // would move the layout a frame later.
    expect(button).not.toBeNull();
    expect(button).toBeDisabled();

    // And a click composes nothing. `disabled` is the visible half; the
    // handler's own `subject === undefined` early return is the half a
    // pointer-events override or a programmatic click would otherwise get
    // past.
    (button as HTMLButtonElement).click();
    expect(shareMock).not.toHaveBeenCalled();

    // The counted floor, in the same environment: flip ONLY `concluded` and
    // the control enables. So the assertion above is about the gate and not
    // about some other property of this record.
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
    // `sonho` is BOTH the record's `answer` and its winning guess, so one
    // assertion covers two entries on the list, and neither can pass by the
    // other's absence.
    expect(text).not.toContain("sonho");
    expect(text).not.toContain("SONHO");
    expect(text).not.toContain("carta");

    // The DIFFERENTIAL for the fields that are on the record and must not
    // move the bytes — the composer's own mechanism (T-WEB-S190), applied
    // here to prove the ARCHIVE reaches it with a record and nothing else.
    // The Nonogram size, the hint count and the sync outcome are three
    // separate entries on the list and one edit at this call site would leak
    // all three. `hintsUsed` is capped at 1 by the record's own schema, so 1
    // is the whole range and not a token value.
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
    // `late-result.tsx:73-76` lists what this panel does not have, and "no
    // time" is on it. The share button takes `stamp={undefined}` and the
    // panel holds no `ConclusionResult`, so nothing about the share reopened
    // an absence. Comments are stripped first: the doc blocks in this file's
    // subject name every token below, which is the napkin's standing trap.
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
    // And the props really are the four it shipped with.
    expect(
      [...stripped.matchAll(/readonly (\w+)[?]?:/g)].map((m) => m[1]),
    ).toEqual(["game", "date", "outcome", "alreadyConcluded"]);

    // THE CONSEQUENCE, stated as a behaviour rather than left in a comment:
    // with no `stamp` to fall back on, a store-less browser gets no control
    // on ANY of the four games rather than on Termo alone. Narrower than the
    // daily, never wider — nothing is shared here that a daily would not.
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
        // The panel itself still renders — this omits one control, it does
        // not blank the screen.
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
