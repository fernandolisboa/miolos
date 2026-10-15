import type { DailyTermoResponse } from "@miolos/core";
import { isValidGuess, MAX_GUESSES, WORD_LENGTH } from "@miolos/games/termo";
import { describe, expect, it } from "vitest";

import { messages } from "../src/i18n";
import type { PlayRecord, TermoPlayRecord } from "../src/play/play-record";
import { initTermoPlayState, termoPlayReducer } from "../src/termo/state";
import type { TermoPlayAction, TermoPlayState } from "../src/termo/types";

const copy = messages.games.termo.play;

const DATE = "2026-07-30";
const DAILY: DailyTermoResponse = { game: "termo", date: DATE };

type Tiles = TermoPlayRecord["guesses"][number]["tiles"];
const MISS: Tiles = ["absent", "present", "absent", "absent", "present"];
const WIN: Tiles = ["correct", "correct", "correct", "correct", "correct"];

const ANSWER = "praga";

const SIX_REAL_GUESSES = [
  "abaco",
  "banho",
  "cerca",
  "dorme",
  "festa",
  "gente",
] as const;

function hydrated(): TermoPlayState {
  return termoPlayReducer(initTermoPlayState(DAILY.date), {
    type: "restore",
    record: undefined,
    now: 1_000,
  });
}

function typed(word: string, from = hydrated()): TermoPlayState {
  return word
    .split("")
    .reduce(
      (state, letter) => termoPlayReducer(state, { type: "type", letter }),
      from,
    );
}

function selected(slot: number, from: TermoPlayState): TermoPlayState {
  return termoPlayReducer(from, { type: "select", slot });
}

function gapped(head: string, tail: string): TermoPlayState {
  return typed(tail, selected(WORD_LENGTH - tail.length, typed(head)));
}

function record(overrides: Partial<TermoPlayRecord> = {}): TermoPlayRecord {
  return {
    v: 1,
    game: "termo",
    date: DATE,
    guesses: [
      { guess: "cafes", tiles: [...MISS] },
      { guess: ANSWER, tiles: [...WIN] },
    ],
    answer: ANSWER,
    outcome: "won",
    elapsedMs: 188_000,
    hintsUsed: 0,
    concluded: true,
    pendingSync: false,
    syncOutcome: "recorded",
    ...overrides,
  };
}

describe("the fixtures the reducer actually accepts", () => {
  it("uses six guesses the local word list really carries", () => {
    expect(new Set(SIX_REAL_GUESSES).size).toBe(MAX_GUESSES);
    for (const guess of [...SIX_REAL_GUESSES, ANSWER]) {
      expect(isValidGuess(guess), guess).toBe(true);
    }
    expect(isValidGuess("zzzzz")).toBe(false);
  });
});

describe("restore (T-WEB-S81)", () => {
  it("accepts a record whose stored outcome agrees with the tiles", () => {
    const state = termoPlayReducer(initTermoPlayState(DAILY.date), {
      type: "restore",
      record: record(),
      now: 5_000,
    });

    expect(state.hydrated).toBe(true);
    expect(state.guesses).toHaveLength(2);
    expect(state.status).toBe("solved");
    expect(state.answer).toBe(ANSWER);
    expect(state.timer).toEqual({ accumulatedMs: 188_000, runningSince: null });
  });

  it("DISCARDS a record whose stored outcome disagrees with the tiles", () => {
    const forged = record({
      guesses: "abcdef".split("").map((letter) => ({
        guess: letter.repeat(WORD_LENGTH),
        tiles: [...MISS],
      })),
      outcome: "won",
    });

    const state = termoPlayReducer(initTermoPlayState(DAILY.date), {
      type: "restore",
      record: forged,
      now: 5_000,
    });

    expect(state.hydrated).toBe(true);
    expect(state.guesses).toHaveLength(0);
    expect(state.status).toBe("playing");
    expect(state.answer).toBeUndefined();
  });

  it("DISCARDS a mid-play record that claims an outcome, and one that hides it", () => {
    const claimsTooMuch = record({
      guesses: [{ guess: "cafes", tiles: [...MISS] }],
      answer: ANSWER,
      outcome: "lost",
      concluded: true,
    });
    const claimsTooLittle = record({
      answer: undefined,
      outcome: undefined,
      concluded: false,
    });

    for (const forged of [claimsTooMuch, claimsTooLittle]) {
      const state = termoPlayReducer(initTermoPlayState(DAILY.date), {
        type: "restore",
        record: forged,
        now: 5_000,
      });
      expect(state.guesses).toHaveLength(0);
      expect(state.status).toBe("playing");
    }
  });

  it("DISCARDS another game's record and hydrates on nothing at all", () => {
    const foreign: PlayRecord = {
      v: 1,
      game: "binairo",
      date: DATE,
      entries: Array.from({ length: 64 }, () => null),
      elapsedMs: 1_000,
      hintsUsed: 0,
      concluded: false,
      pendingSync: false,
      syncOutcome: "pending",
    };

    for (const input of [foreign, undefined]) {
      const state = termoPlayReducer(initTermoPlayState(DAILY.date), {
        type: "restore",
        record: input,
        now: 5_000,
      });
      expect(state.hydrated).toBe(true);
      expect(state.guesses).toHaveLength(0);
      expect(state.status).toBe("playing");
    }
  });
});

describe("the ordering contract (T-WEB-S82)", () => {
  it("writes guesses, answer and status in ONE transition", () => {
    const before = typed(ANSWER);
    const submitted = termoPlayReducer(before, { type: "submit" });
    const after = termoPlayReducer(submitted, {
      type: "judged",
      guess: ANSWER,
      tiles: [...WIN],
      status: "won",
      answer: ANSWER,
    });

    expect(after.status).toBe("solved");
    expect(after.answer).toBe(ANSWER);
    expect(after.guesses).toEqual([{ guess: ANSWER, tiles: [...WIN] }]);
    expect(after.pending).toBeNull();

    expect(submitted.status).toBe("playing");
    expect(submitted.answer).toBeUndefined();
  });

  it("leaves no reachable state with a terminal status and no answer", () => {
    const closed = closedStates();
    const seeds: readonly TermoPlayState[] = [
      hydrated(),
      typed("caf"),
      typed(ANSWER),
      termoPlayReducer(typed(ANSWER), { type: "submit" }),
      termoPlayReducer(termoPlayReducer(typed(ANSWER), { type: "submit" }), {
        type: "held",
        reason: "offline",
      }),
      ...closed,
    ];

    expect(closed).toHaveLength(2);

    for (const seed of seeds) {
      for (const action of EVERY_ACTION) {
        const next = termoPlayReducer(seed, action);
        expect(
          next.status === "playing" || next.answer !== undefined,
          `${action.type} produced ${next.status} with no answer`,
        ).toBe(true);
      }
    }
  });

  it("maps the engine's `won` to PlayCore's `solved`, and passes `lost` through", () => {
    const won = termoPlayReducer(
      termoPlayReducer(typed(ANSWER), { type: "submit" }),
      {
        type: "judged",
        guess: ANSWER,
        tiles: [...WIN],
        status: "won",
        answer: ANSWER,
      },
    );
    expect(won.status).toBe("solved");

    const lost = closedStates()[1];
    expect(lost?.status).toBe("lost");
  });

  it("carries NO `outcome` field, so there is one terminal predicate", () => {
    for (const state of [hydrated(), ...closedStates()]) {
      expect(Object.keys(state)).not.toContain("outcome");
    }
  });

  it("marks the completion pending exactly when the board closes", () => {
    expect(hydrated().pendingSync).toBe(false);
    for (const state of closedStates()) {
      expect(state.pendingSync).toBe(true);
    }
  });
});

function closedStates(): readonly TermoPlayState[] {
  const won = termoPlayReducer(
    termoPlayReducer(typed(ANSWER), { type: "submit" }),
    {
      type: "judged",
      guess: ANSWER,
      tiles: [...WIN],
      status: "won",
      answer: ANSWER,
    },
  );

  let lost = hydrated();
  for (let turn = 0; turn < MAX_GUESSES; turn += 1) {
    const guess = SIX_REAL_GUESSES[turn] ?? "";
    lost = termoPlayReducer(typed(guess, lost), { type: "submit" });
    lost = termoPlayReducer(lost, {
      type: "judged",
      guess,
      tiles: [...MISS],
      status: turn === MAX_GUESSES - 1 ? "lost" : "playing",
      answer: turn === MAX_GUESSES - 1 ? ANSWER : undefined,
    });
  }

  return [won, lost];
}

const EVERY_ACTION: readonly TermoPlayAction[] = [
  { type: "restore", record: undefined, now: 9_000 },
  { type: "tick", now: 9_000 },
  { type: "pause", now: 9_000 },
  { type: "resume", now: 9_000 },
  { type: "type", letter: "a" },
  { type: "erase" },
  { type: "select", slot: 0 },
  { type: "select", slot: 3 },
  { type: "submit" },
  { type: "retry" },
  { type: "held", reason: "offline" },
  { type: "held", reason: "server" },
  { type: "gone" },
  { type: "rejected", reason: "not-in-list" },
  { type: "rejected", reason: "refused" },
  {
    type: "judged",
    guess: "cafes",
    tiles: [...MISS],
    status: "playing",
    answer: undefined,
  },
  {
    type: "judged",
    guess: ANSWER,
    tiles: [...WIN],
    status: "won",
    answer: ANSWER,
  },
];

describe("typing, erasing and submitting", () => {
  it("accepts letters accent-insensitively, and a full row overwrites its last cell", () => {
    const state = typed("caf");
    expect(state.draft.join("")).toBe("caf");
    expect(
      termoPlayReducer(state, { type: "type", letter: "É" }).draft.join(""),
    ).toBe("cafe");
    expect(
      termoPlayReducer(state, { type: "type", letter: "Ç" }).draft.join(""),
    ).toBe("cafc");

    expect(termoPlayReducer(state, { type: "type", letter: "1" })).toBe(state);
    expect(termoPlayReducer(state, { type: "type", letter: "Enter" })).toBe(
      state,
    );

    const full = typed(ANSWER);
    expect(full.cursor).toBe(WORD_LENGTH - 1);
    expect(
      termoPlayReducer(full, { type: "type", letter: "s" }).draft.join(""),
    ).toBe(`${ANSWER.slice(0, -1)}s`);
  });

  it("erases one letter, and no-ops on an empty row", () => {
    const state = typed("caf");
    expect(termoPlayReducer(state, { type: "erase" }).draft.join("")).toBe(
      "ca",
    );
    const empty = hydrated();
    expect(termoPlayReducer(empty, { type: "erase" })).toBe(empty);
  });

  it("refuses a short row and a word the local list does not carry", () => {
    const short = termoPlayReducer(typed("caf"), { type: "submit" });
    expect(short.pending).toBeNull();

    const junk = termoPlayReducer(typed("zzzzz"), { type: "submit" });
    expect(junk.pending).toBeNull();
    expect(junk.draft.join("")).toBe("zzzzz");
    expect(junk.notice).not.toBeNull();
  });

  it("bumps the nonce on a SECOND identical rejection", () => {
    const first = termoPlayReducer(typed("zzzzz"), { type: "submit" });
    const second = termoPlayReducer(first, { type: "submit" });

    expect(second.notice).toBe(first.notice);
    expect(second.noticeNonce).toBe(first.noticeNonce + 1);
  });

  it("holds the turn on `held` and hands it back on `retry`", () => {
    const submitted = termoPlayReducer(typed(ANSWER), { type: "submit" });
    expect(submitted.pending).toBe(ANSWER);

    const held = termoPlayReducer(submitted, {
      type: "held",
      reason: "offline",
    });
    expect(held.held).toBe(true);
    expect(held.pending).toBe(ANSWER);
    expect(held.notice).not.toBeNull();

    const retried = termoPlayReducer(held, { type: "retry" });
    expect(retried.held).toBe(false);
    expect(retried.pending).toBe(ANSWER);
    expect(retried.notice).toBeNull();
  });

  it("picks the held line from the REASON, never one string for all four causes (T-WEB-S106)", () => {
    const submitted = termoPlayReducer(typed(ANSWER), { type: "submit" });

    const offline = termoPlayReducer(submitted, {
      type: "held",
      reason: "offline",
    });
    const server = termoPlayReducer(submitted, {
      type: "held",
      reason: "server",
    });

    expect(offline.notice).toBe(copy.offline);
    expect(server.notice).toBe(copy.failed);

    expect(offline.held).toBe(true);
    expect(server.held).toBe(true);
    expect(server.pending).toBe(ANSWER);

    expect(copy.offline).not.toBe(copy.failed);
  });

  it("carries `gone` in the REDUCER, not in a second state authority beside it (T-WEB-S107)", () => {
    const playing = hydrated();
    expect(playing.gone).toBe(false);

    expect(termoPlayReducer(playing, { type: "gone" }).gone).toBe(true);

    const submitted = termoPlayReducer(typed(ANSWER), { type: "submit" });
    const gone = termoPlayReducer(submitted, { type: "gone" });
    expect(gone.gone).toBe(true);

    expect(gone.pending).toBe(ANSWER);
    expect(gone.notice).toBe(submitted.notice);
    expect(gone.announcement).toBe(submitted.announcement);
  });

  it("returns a server-rejected guess to the row it came from", () => {
    const submitted = termoPlayReducer(typed(ANSWER), { type: "submit" });
    const rejected = termoPlayReducer(submitted, {
      type: "rejected",
      reason: "not-in-list",
    });

    expect(rejected.pending).toBeNull();
    expect(rejected.draft.join("")).toBe(ANSWER);
    expect(rejected.guesses).toHaveLength(0);
    expect(rejected.held).toBe(false);
    expect(rejected.notice).not.toBeNull();
  });

  it("never writes the notice and the announcer in the same transition", () => {
    const submitted = termoPlayReducer(typed(ANSWER), { type: "submit" });
    const seeds: readonly TermoPlayState[] = [
      hydrated(),
      typed("caf"),
      gapped("c", "f"),
      typed(ANSWER),
      submitted,
      termoPlayReducer(submitted, { type: "held", reason: "offline" }),
      termoPlayReducer(typed("zzzzz"), { type: "submit" }),
    ];

    for (const seed of seeds) {
      for (const action of EVERY_ACTION) {
        const next = termoPlayReducer(seed, action);
        const moved =
          Number(next.notice !== seed.notice) +
          Number(next.announcement !== seed.announcement);
        expect(
          moved,
          `${action.type} moved both live regions at once`,
        ).toBeLessThanOrEqual(1);
      }
    }
  });

  it("ignores every input once the board is closed", () => {
    for (const closed of closedStates()) {
      for (const action of [
        { type: "type", letter: "a" },
        { type: "erase" },
        { type: "submit" },
      ] satisfies TermoPlayAction[]) {
        const next = termoPlayReducer(closed, action);
        expect(next.draft).toBe(closed.draft);
        expect(next.pending).toBeNull();
        expect(next.guesses).toHaveLength(closed.guesses.length);
      }
    }
  });
});

describe("the cursor: any cell of the current row, gaps allowed (T-WEB-S640)", () => {
  it("moves to the next empty cell after a write, wrapping to an earlier gap", () => {
    const atTwo = selected(2, hydrated());
    expect(atTwo.cursor).toBe(2);

    const one = termoPlayReducer(atTwo, { type: "type", letter: "f" });
    expect(one.draft).toEqual(["", "", "f", "", ""]);
    expect(one.cursor).toBe(3);

    const wrapped = typed("es", one);
    expect(wrapped.draft).toEqual(["", "", "f", "e", "s"]);
    expect(wrapped.cursor).toBe(0);
    expect(typed("ca", wrapped).draft.join("")).toBe("cafes");
  });

  it("with no empty cell left, advances one and stops at the last cell", () => {
    const edited = termoPlayReducer(selected(1, typed(ANSWER)), {
      type: "type",
      letter: "e",
    });
    expect(edited.draft.join("")).toBe("peaga");
    expect(edited.cursor).toBe(2);
  });

  it("announces the letter with the position it was written to", () => {
    const state = termoPlayReducer(selected(3, hydrated()), {
      type: "type",
      letter: "a",
    });
    expect(state.announcement).toBe(copy.letterTypedAria("a", 4, WORD_LENGTH));
  });

  it("erases the cursor cell, or steps left over an empty one and erases there", () => {
    const filled = selected(1, typed("caf"));
    const cleared = termoPlayReducer(filled, { type: "erase" });
    expect(cleared.draft).toEqual(["c", "", "f", "", ""]);
    expect(cleared.cursor).toBe(1);
    expect(cleared.announcement).toBe(
      copy.letterErasedAria("a", 2, WORD_LENGTH),
    );

    const stepped = termoPlayReducer(cleared, { type: "erase" });
    expect(stepped.draft).toEqual(["", "", "f", "", ""]);
    expect(stepped.cursor).toBe(0);
  });

  it("only moves left when the cell before is empty too, and no-ops at the first cell", () => {
    const gap = selected(3, typed("c"));
    const moved = termoPlayReducer(gap, { type: "erase" });
    expect(moved.draft).toBe(gap.draft);
    expect(moved.cursor).toBe(2);
    expect(moved.announcement).toBe(gap.announcement);

    const first = hydrated();
    expect(termoPlayReducer(first, { type: "erase" })).toBe(first);
  });

  it("selects only a cell of the row, only while the row takes input", () => {
    const state = typed("ca");
    for (const slot of [-1, WORD_LENGTH, 1.5, state.cursor]) {
      expect(selected(slot, state)).toBe(state);
    }
    expect(selected(WORD_LENGTH - 1, state).cursor).toBe(WORD_LENGTH - 1);

    const pending = termoPlayReducer(typed(ANSWER), { type: "submit" });
    expect(selected(0, pending)).toBe(pending);
    for (const closed of closedStates()) {
      expect(selected(0, closed)).toBe(closed);
    }
  });

  it("refuses a row with a gap, and starts the next row at its first cell", () => {
    const withGap = gapped("pra", "a");
    expect(withGap.draft.join("")).toBe("praa");
    expect(termoPlayReducer(withGap, { type: "submit" })).toBe(withGap);

    const submitted = termoPlayReducer(selected(1, typed(ANSWER)), {
      type: "submit",
    });
    expect(submitted.pending).toBe(ANSWER);
    expect(submitted.draft.join("")).toBe("");
    expect(submitted.cursor).toBe(0);
  });

  it("puts a rejected guess back with the cursor on its last cell", () => {
    const rejected = termoPlayReducer(
      termoPlayReducer(typed(ANSWER), { type: "submit" }),
      { type: "rejected", reason: "refused" },
    );
    expect(rejected.draft.join("")).toBe(ANSWER);
    expect(rejected.cursor).toBe(WORD_LENGTH - 1);
  });
});
