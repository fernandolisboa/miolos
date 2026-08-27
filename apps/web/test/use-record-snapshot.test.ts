import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { writePlayRecord, type TermoPlayRecord } from "../src/play/play-record";
import { useRecordSnapshot } from "../src/play/use-record-snapshot";

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
      writePlayRecord(termoRecord(date, ["cafes", "praga"]));
      storeChanged();
    });

    expect(result.current).not.toBe(first);
    const record = result.current.hydrated ? result.current.record : undefined;
    expect(record?.game === "termo" ? record.guesses.length : -1).toBe(2);
  });

  it("still hands back the CACHED snapshot when nothing a reader sees moved", () => {
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
