import type { Game } from "@miolos/core";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LateResult } from "../src/archive/late-result";
import { messages } from "../src/i18n";
import { ConclusionView } from "../src/play/conclusion-view";
import { playRecordKey, readPlayRecord } from "../src/play/play-record";

vi.mock("../src/play/sync", () => ({
  startCompletionSync: () => () => undefined,
  flushPendingCompletions: () => Promise.resolve(),
}));
vi.mock("../src/streak/use-streak", () => ({ useStreak: () => null }));
vi.mock("../src/stats/use-stats", () => ({ useStats: () => null }));

const DATE = "2026-08-14";
const GAMES: readonly Game[] = ["binairo", "sudoku", "nonogram", "termo"];

const setItem = vi.fn<(key: string, value: string) => void>();

const BINAIRO_RECORD = {
  v: 1,
  game: "binairo",
  date: DATE,
  entries: Array.from({ length: 64 }, () => null),
  elapsedMs: 407_000,
  hintsUsed: 0,
  concluded: true,
  pendingSync: false,
  syncOutcome: "recorded",
} as const;

function readOnlyStore(seed: Record<string, string> = {}): Storage {
  const cells = new Map<string, string>(Object.entries(seed));
  return {
    get length() {
      return cells.size;
    },
    key: (index: number) => [...cells.keys()][index] ?? null,
    getItem: (key: string) => cells.get(key) ?? null,
    removeItem: (key: string) => {
      cells.delete(key);
    },
    clear: () => {
      cells.clear();
    },
    setItem,
  };
}

let realStore: PropertyDescriptor | undefined;

function installStore(store: Storage): void {
  realStore = Object.getOwnPropertyDescriptor(window, "localStorage");
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    get: () => store,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  setItem.mockImplementation(() => {
    throw new DOMException("quota", "QuotaExceededError");
  });
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: vi.fn(() => Promise.resolve()) },
    configurable: true,
    writable: true,
  });
});

afterEach(() => {
  if (realStore !== undefined) {
    Object.defineProperty(window, "localStorage", realStore);
    realStore = undefined;
  }
  Reflect.deleteProperty(navigator, "clipboard");
});

function shareButton(): HTMLButtonElement | null {
  return screen.queryByRole("button", { name: messages.share.label });
}

function conclusion(game: Game) {
  return (
    <ConclusionView
      game={game}
      date={DATE}
      copy={messages.games[game].conclusion}
      result={{ elapsedMs: 407_000, hintsUsed: 0 }}
    />
  );
}

function late(game: Game) {
  return (
    <LateResult
      game={game}
      date={DATE}
      outcome="won"
      alreadyConcluded={false}
    />
  );
}

describe("a store that reads but cannot write renders no share control (T-WEB-S358)", () => {
  it("TERMO's daily conclusion withholds the button rather than disabling it forever", () => {
    installStore(
      readOnlyStore({
        [playRecordKey("binairo", DATE)]: JSON.stringify(BINAIRO_RECORD),
      }),
    );

    expect(readPlayRecord("binairo", DATE), "reads work").toEqual(
      BINAIRO_RECORD,
    );
    expect(readPlayRecord("termo", DATE)).toBeUndefined();

    render(conclusion("termo"));

    expect(shareButton()).toBeNull();
  });

  it("the ARCHIVE late-result panel withholds it on all four games", () => {
    installStore(readOnlyStore());

    for (const game of GAMES) {
      const { unmount } = render(late(game));
      expect(shareButton(), game).toBeNull();
      unmount();
    }
  });

  it("the same store, made writable, renders the button on every one of those five surfaces", () => {
    setItem.mockImplementation(() => undefined);
    installStore(readOnlyStore());

    const { unmount } = render(conclusion("termo"));
    expect(shareButton(), "termo conclusion").not.toBeNull();
    unmount();

    for (const game of GAMES) {
      const panel = render(late(game));
      expect(shareButton(), game).not.toBeNull();
      panel.unmount();
    }
  });

  it("the three GRID games still share their stamp on a write-blocked store", () => {
    installStore(readOnlyStore());

    for (const game of ["binairo", "sudoku", "nonogram"] as const) {
      const { unmount } = render(conclusion(game));
      expect(shareButton(), game).toBeEnabled();
      unmount();
    }
  });
});
