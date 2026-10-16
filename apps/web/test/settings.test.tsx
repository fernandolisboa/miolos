import { act, render, screen } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  readSettings,
  useSettings,
  writeSettings,
} from "../src/settings/settings";

const KEY = "miolos-settings";

function Probe() {
  const settings = useSettings();
  return (
    <p>{`clock:${String(settings.showClock)} errors:${String(settings.games.sudoku.showErrors)}`}</p>
  );
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("the settings store keeps device-local preferences (T-WEB-S580)", () => {
  it("defaults when nothing is stored", () => {
    expect(readSettings()).toEqual({
      showClock: true,
      endAnimation: true,
      games: {
        sudoku: {
          showErrors: false,
          lockDigit: false,
          highlightSelection: true,
          cleanNotes: true,
        },
        binairo: { showErrors: false, firstValue: 1 },
        nonogram: {
          showErrors: false,
          strikePlacedRuns: true,
          straightDrag: false,
        },
        queens: {
          showErrors: false,
          highlightRegion: true,
          fadeQueenLines: true,
          autoCross: false,
        },
        crossword: { showErrors: false, skipFilled: true },
        minesweeper: { questionMarks: false },
      },
    });
  });

  it("resets only the field that is corrupt, on bad JSON, a wrong type or an unknown key", () => {
    window.localStorage.setItem(KEY, "{not json");
    expect(readSettings().showClock).toBe(true);

    window.localStorage.setItem(
      KEY,
      JSON.stringify({
        showClock: "no",
        extra: 1,
        games: {
          sudoku: {
            showErrors: true,
            lockDigit: 3,
            highlightSelection: false,
            cleanNotes: "yes",
          },
          binairo: "x",
          queens: { showErrors: true, nope: true, autoCross: "yes" },
          nonogram: { showErrors: true, strikePlacedRuns: "no" },
        },
      }),
    );
    const settings = readSettings();
    expect(settings.showClock).toBe(true);
    expect(settings.games.sudoku).toEqual({
      showErrors: true,
      lockDigit: false,
      highlightSelection: false,
      cleanNotes: true,
    });
    expect(settings.games.binairo).toEqual({
      showErrors: false,
      firstValue: 1,
    });
    expect(settings.games.queens).toEqual({
      showErrors: true,
      highlightRegion: true,
      fadeQueenLines: true,
      autoCross: false,
    });
    expect(settings.games.nonogram).toEqual({
      showErrors: true,
      strikePlacedRuns: true,
      straightDrag: false,
    });
    expect(settings).not.toHaveProperty("extra");

    for (const [stored, read] of [
      [0, 0],
      [1, 1],
      [2, 1],
      ["0", 1],
      [null, 1],
    ] as const) {
      window.localStorage.setItem(
        KEY,
        JSON.stringify({ games: { binairo: { firstValue: stored } } }),
      );
      expect(readSettings().games.binairo.firstValue).toBe(read);
    }

    window.localStorage.setItem(
      KEY,
      JSON.stringify({
        games: { binairo: { showErrors: true, firstValue: 2 } },
      }),
    );
    expect(readSettings().games.binairo).toEqual({
      showErrors: true,
      firstValue: 1,
    });

    window.localStorage.setItem(
      KEY,
      JSON.stringify({ games: { crossword: { showErrors: true } } }),
    );
    expect(readSettings().games.crossword).toEqual({
      showErrors: true,
      skipFilled: true,
    });

    window.localStorage.setItem(KEY, JSON.stringify({ games: "x" }));
    expect(readSettings().games.sudoku.highlightSelection).toBe(true);
    window.localStorage.setItem(KEY, "5");
    expect(readSettings().showClock).toBe(true);
  });

  it("falls back to the defaults when storage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(readSettings().showClock).toBe(true);
    expect(() => {
      writeSettings({ ...readSettings(), showClock: false });
    }).not.toThrow();
  });

  it("round-trips a write", () => {
    writeSettings({ ...readSettings(), showClock: false });
    expect(
      JSON.parse(window.localStorage.getItem(KEY) ?? "null"),
    ).toMatchObject({ showClock: false });
    expect(readSettings().showClock).toBe(false);
  });

  it("returns the same object until the stored string changes", () => {
    const first = readSettings();
    expect(readSettings()).toBe(first);
    writeSettings({ ...first, showClock: false });
    const second = readSettings();
    expect(second).not.toBe(first);
    expect(readSettings()).toBe(second);
  });

  it("updates a mounted reader in this tab and on a storage event from another", () => {
    render(<Probe />);
    expect(screen.getByText("clock:true errors:false")).toBeInTheDocument();

    act(() => {
      writeSettings({ ...readSettings(), showClock: false });
    });
    expect(screen.getByText("clock:false errors:false")).toBeInTheDocument();

    const stored = {
      ...readSettings(),
      games: {
        ...readSettings().games,
        sudoku: { ...readSettings().games.sudoku, showErrors: true },
      },
    };
    act(() => {
      window.localStorage.setItem(KEY, JSON.stringify(stored));
      window.dispatchEvent(new StorageEvent("storage", { key: KEY }));
    });
    expect(screen.getByText("clock:false errors:true")).toBeInTheDocument();
  });
});

describe("the settings render the defaults on the server and hydrate without a warning (T-WEB-S581)", () => {
  it("renders the defaults on the server and hydrates a stored non-default quietly", () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({
        showClock: false,
        games: { sudoku: { showErrors: true } },
      }),
    );
    const html = renderToString(<Probe />);
    expect(html).toContain("clock:true errors:false");

    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.append(container);
    const error = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    act(() => {
      hydrateRoot(container, <Probe />);
    });

    expect(error).not.toHaveBeenCalled();
    expect(container.textContent).toBe("clock:false errors:true");
    container.remove();
  });
});
