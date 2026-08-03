import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { writePlayRecord, type TermoPlayRecord } from "../src/play/play-record";
import { useRecordSnapshot } from "../src/play/use-record-snapshot";

/**
 * T-WEB-S78 (plan 022 §14.3, ADR-0044 consequence (d)). `sameToTheReader`
 * compares the CHROME fields every reader renders, and its own header states
 * the rule: *"A per-game payload field that can move INDEPENDENTLY of
 * `concluded` breaks that and must be added below, or its reader will be
 * handed a stale cached snapshot."*
 *
 * Termo's `guesses` is the first such field. It moves on every judged turn
 * while `concluded`, `pendingSync`, `syncOutcome`, `elapsedMs` and
 * `hintsUsed` all stand still — Nonogram escaped this only through the
 * `grid`/`concluded` lockstep. `answer` and `outcome` need no term: the
 * record's `superRefine` makes their lockstep with `concluded` a parse-time
 * invariant, so they cannot move independently.
 *
 * The comparator is module-private, so it is driven where its output lands:
 * on the snapshot `useRecordSnapshot` hands back. A snapshot object that
 * survives a store change IS the comparator answering "same to the reader".
 * Each case uses its own date, because the cache is one module-level slot
 * keyed `{game, date}`.
 */

type Tiles = TermoPlayRecord["guesses"][number]["tiles"];
const MISS: Tiles = ["absent", "present", "absent", "absent", "present"];

function termoRecord(
  date: string,
  guesses: readonly string[],
): TermoPlayRecord {
  return {
    v: 1,
    game: "termo",
    date,
    guesses: guesses.map((guess) => ({ guess, tiles: [...MISS] })),
    elapsedMs: 61_000,
    hintsUsed: 0,
    concluded: false,
    pendingSync: false,
    syncOutcome: "pending",
  };
}

/** What `subscribeToPlayRecords` listens for besides its 1 s poll. */
function storeChanged() {
  window.dispatchEvent(new StorageEvent("storage"));
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("sameToTheReader sees the guess count (T-WEB-S78)", () => {
  it("hands the reader a NEW snapshot when only the guess count moved", () => {
    const date = "2026-07-30";
    writePlayRecord(termoRecord(date, ["cafes"]));

    const { result } = renderHook(() => useRecordSnapshot("termo", date));
    const first = result.current;
    expect(first.hydrated).toBe(true);

    act(() => {
      // The judged turn: one more row, and NOT ONE of the five chrome fields
      // moves with it. Without the sixth term the board would keep rendering
      // five tiles after the sixth guess was judged.
      writePlayRecord(termoRecord(date, ["cafes", "praga"]));
      storeChanged();
    });

    expect(result.current).not.toBe(first);
    const record = result.current.hydrated ? result.current.record : undefined;
    expect(record?.game === "termo" ? record.guesses.length : -1).toBe(2);
  });

  it("still hands back the CACHED snapshot when nothing a reader sees moved", () => {
    // Anti-vacuity, and the half that proves the comparator is consulted at
    // all rather than replaced by a constant `false`: the record really
    // changed on disk, the count did not, and the reader keeps the object it
    // already had. `useSyncExternalStore` requires that referential
    // stability — a fresh object every read loops forever.
    const date = "2026-07-29";
    writePlayRecord(termoRecord(date, ["cafes"]));

    const { result } = renderHook(() => useRecordSnapshot("termo", date));
    const first = result.current;

    act(() => {
      writePlayRecord(termoRecord(date, ["praga"]));
      storeChanged();
    });

    expect(result.current).toBe(first);
  });

  it("keeps the five shipped chrome terms live beside the new one", () => {
    // The sixth term is additive: a chrome change with a STANDING guess
    // count must still produce a new snapshot, or a settled sync would never
    // reach the conclusion's discreet line.
    const date = "2026-07-28";
    writePlayRecord(termoRecord(date, ["cafes"]));

    const { result } = renderHook(() => useRecordSnapshot("termo", date));
    const first = result.current;

    act(() => {
      writePlayRecord({
        ...termoRecord(date, ["cafes"]),
        pendingSync: true,
        syncOutcome: "rejected",
      });
      storeChanged();
    });

    expect(result.current).not.toBe(first);
  });
});
