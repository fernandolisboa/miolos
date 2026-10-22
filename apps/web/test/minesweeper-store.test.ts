import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  bestTimeAfter,
  readBestTime,
  readCustomSize,
  saveBestTime,
  saveCustomSize,
} from "../src/free-play/minesweeper-store";

const KEY = "miolos-minesweeper";

function stored(): unknown {
  return JSON.parse(window.localStorage.getItem(KEY) ?? "null");
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("the Campo Minado store keeps a best time per level and the last custom size on the device (T-WEB-S1040)", () => {
  it("reads no best time and Iniciante's size when nothing is stored", () => {
    expect(readBestTime("beginner")).toBeNull();
    expect(readBestTime("expert")).toBeNull();
    expect(readCustomSize()).toEqual({ rows: 9, columns: 9, mines: 10 });
  });

  it("writes a first best time, then only a strictly faster one", () => {
    saveBestTime("beginner", 42);
    expect(readBestTime("beginner")).toBe(42);

    saveBestTime("beginner", 42);
    saveBestTime("beginner", 50);
    expect(readBestTime("beginner")).toBe(42);

    saveBestTime("beginner", 41);
    expect(readBestTime("beginner")).toBe(41);
    expect(stored()).toEqual({ best: { beginner: 41 } });
  });

  it("re-reads the key before each write, so a write from another tab is never undone", () => {
    saveBestTime("beginner", 60);
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ best: { beginner: 30 } }),
    );

    saveBestTime("beginner", 45);
    expect(readBestTime("beginner")).toBe(30);
  });

  it("keeps the last custom size, clamped to the limits on read", () => {
    saveCustomSize({ rows: 20, columns: 25, mines: 120 });
    expect(readCustomSize()).toEqual({ rows: 20, columns: 25, mines: 120 });

    window.localStorage.setItem(
      KEY,
      JSON.stringify({ custom: { rows: 99, columns: 3, mines: 5 } }),
    );
    expect(readCustomSize()).toEqual({ rows: 24, columns: 9, mines: 10 });
  });

  it("falls back field by field on corrupt data", () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({
        best: { beginner: "fast", intermediate: -3, expert: 99.5 },
        custom: { rows: 12, columns: 12, mines: 20 },
      }),
    );
    expect(readBestTime("beginner")).toBeNull();
    expect(readBestTime("intermediate")).toBeNull();
    expect(readBestTime("expert")).toBeNull();
    expect(readCustomSize()).toEqual({ rows: 12, columns: 12, mines: 20 });

    window.localStorage.setItem(
      KEY,
      JSON.stringify({ best: { expert: 200 }, custom: "big" }),
    );
    expect(readBestTime("expert")).toBe(200);
    expect(readCustomSize()).toEqual({ rows: 9, columns: 9, mines: 10 });

    window.localStorage.setItem(KEY, "{not json");
    expect(readBestTime("expert")).toBeNull();
    saveBestTime("expert", 300);
    expect(stored()).toEqual({ best: { expert: 300 } });
  });

  it("reads defaults and writes nothing when storage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("denied");
    });

    expect(readBestTime("beginner")).toBeNull();
    expect(readCustomSize()).toEqual({ rows: 9, columns: 9, mines: 10 });
    expect(() => {
      saveBestTime("beginner", 10);
      saveCustomSize({ rows: 10, columns: 10, mines: 10 });
    }).not.toThrow();
  });
});

describe("each write changes one field and keeps the others (T-WEB-S1041)", () => {
  it("a best time keeps the custom size and the other levels, and a custom size keeps every best time", () => {
    saveBestTime("beginner", 20);
    saveCustomSize({ rows: 10, columns: 11, mines: 12 });
    saveBestTime("expert", 300);
    saveBestTime("intermediate", 90);
    saveCustomSize({ rows: 16, columns: 16, mines: 50 });

    expect(stored()).toEqual({
      best: { beginner: 20, intermediate: 90, expert: 300 },
      custom: { rows: 16, columns: 16, mines: 50 },
    });
  });
});

describe("bestTimeAfter works out the card's best-time line (T-WEB-S1042)", () => {
  it("a first win or a strictly faster one is a new best", () => {
    expect(bestTimeAfter(null, 80)).toEqual({ best: 80, isNew: true });
    expect(bestTimeAfter(81, 80)).toEqual({ best: 80, isNew: true });
    expect(bestTimeAfter(null, 0)).toEqual({ best: 0, isNew: true });
  });

  it("a tie or a slower win keeps the old best", () => {
    expect(bestTimeAfter(80, 80)).toEqual({ best: 80, isNew: false });
    expect(bestTimeAfter(80, 95)).toEqual({ best: 80, isNew: false });
  });

  it("a loss keeps the old best, or none", () => {
    expect(bestTimeAfter(80, null)).toEqual({ best: 80, isNew: false });
    expect(bestTimeAfter(null, null)).toEqual({ best: null, isNew: false });
  });
});
