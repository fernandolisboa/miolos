import {
  nonogramSizeSchema,
  TERMO_MAX_GUESSES,
  TERMO_WORD_LENGTH,
  type Game,
} from "@miolos/core";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LateResult } from "../src/archive/late-result";
import { messages } from "../src/i18n";
import { ConclusionView } from "../src/play/conclusion-view";
import {
  ELAPSED_CAP_MS,
  playRecordKey,
  playRecordSchema,
  prunePlayRecords,
  readPlayRecord,
  WRITE_PROBE_BYTES,
  WRITE_PROBE_KEY,
} from "../src/play/play-record";

vi.mock("../src/play/sync", () => ({
  startCompletionSync: () => () => undefined,
  flushPendingCompletions: () => Promise.resolve(),
}));
vi.mock("../src/streak/use-streak", () => ({ useStreak: () => null }));
vi.mock("../src/stats/use-stats", () => ({ useStats: () => null }));

const DATE = "2026-08-14";
const GAMES: readonly Game[] = ["binairo", "sudoku", "nonogram", "termo"];

const LARGEST_SIZE = nonogramSizeSchema.options
  .map((option) => option.value)
  .reduce((widest, size) => (size > widest ? size : widest));

const HEAVIEST = {
  elapsedMs: ELAPSED_CAP_MS,
  hintsUsed: 1,
  concluded: true,
  pendingSync: true,
  syncOutcome: "rejected",
} as const;

const cells = (count: number) => ({
  entries: Array.from({ length: count }, () => null),
  grid: Array.from({ length: count }, (_unused, cell) => cell % 2),
});

const MAXIMAL_RECORDS = [
  { v: 1, game: "binairo", date: DATE, ...cells(64), ...HEAVIEST },
  {
    v: 1,
    game: "sudoku",
    date: DATE,
    entries: Array.from({ length: 81 }, () => null),
    grid: Array.from({ length: 81 }, () => 9),
    ...HEAVIEST,
  },
  {
    v: 1,
    game: "nonogram",
    date: DATE,
    size: LARGEST_SIZE,
    ...cells(LARGEST_SIZE ** 2),
    ...HEAVIEST,
  },
  {
    v: 1,
    game: "termo",
    date: DATE,
    guesses: Array.from({ length: TERMO_MAX_GUESSES }, () => ({
      guess: "sonho",
      tiles: Array.from({ length: TERMO_WORD_LENGTH }, () => "present"),
    })),
    answer: "carta",
    outcome: "lost",
    ...HEAVIEST,
  },
].map((shape) => playRecordSchema.parse(shape));

const LARGEST_RECORD_BYTES = MAXIMAL_RECORDS.map(
  (record) =>
    playRecordKey(record.game, record.date).length +
    JSON.stringify(record).length,
).reduce((widest, bytes) => (bytes > widest ? bytes : widest));

const BINAIRO_RECORD = playRecordSchema.parse({
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

interface FakeStore extends Storage {
  readonly keys: () => string[];
}

function store({
  seed = {},
  headroom = 0,
}: {
  readonly seed?: Record<string, string>;
  readonly headroom?: number;
} = {}): FakeStore {
  const cells = new Map<string, string>(Object.entries(seed));
  return {
    get length() {
      return cells.size;
    },
    keys: () => [...cells.keys()],
    key: (index: number) => [...cells.keys()][index] ?? null,
    getItem: (key: string) => cells.get(key) ?? null,
    removeItem: (key: string) => {
      cells.delete(key);
    },
    clear: () => {
      cells.clear();
    },
    setItem: (key: string, value: string) => {
      if (key.length + value.length > headroom) {
        throw new DOMException("quota", "QuotaExceededError");
      }
      cells.set(key, value);
    },
  };
}

let realStore: PropertyDescriptor | undefined;

function installStore(fake: Storage): void {
  realStore ??= Object.getOwnPropertyDescriptor(window, "localStorage");
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    get: () => fake,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
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

function conclusion(game: Game, lost = false) {
  return (
    <ConclusionView
      game={game}
      date={DATE}
      copy={messages.games[game].conclusion}
      result={{ elapsedMs: 407_000, hintsUsed: 0 }}
      {...(lost
        ? {
            outcome: {
              state: "lost" as const,
              label: "Jogado",
              detail: "X/6",
              aria: "Termo jogado, as 6 tentativas acabaram.",
            },
          }
        : {})}
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

describe("a store that reads but cannot hold a record renders no share control (T-WEB-S358)", () => {
  it("TERMO's daily conclusion withholds the button rather than disabling it forever, won and lost alike", () => {
    installStore(
      store({
        seed: {
          [playRecordKey("binairo", DATE)]: JSON.stringify(BINAIRO_RECORD),
        },
      }),
    );

    expect(readPlayRecord("binairo", DATE), "reads work").toEqual(
      BINAIRO_RECORD,
    );
    expect(readPlayRecord("termo", DATE)).toBeUndefined();

    for (const lost of [false, true]) {
      const { unmount } = render(conclusion("termo", lost));
      expect(shareButton(), lost ? "lost" : "won").toBeNull();
      unmount();
    }
  });

  it("the ARCHIVE late-result panel withholds it on all four games", () => {
    installStore(store());

    for (const game of GAMES) {
      const { unmount } = render(late(game));
      expect(shareButton(), game).toBeNull();
      unmount();
    }
  });

  it("a store with room for a bare key but not for a record is still no store at all", () => {
    const narrow = store({ headroom: LARGEST_RECORD_BYTES - 1 });
    installStore(narrow);

    const { unmount } = render(conclusion("termo"));
    expect(shareButton(), "termo conclusion").toBeNull();
    unmount();

    const panel = render(late("nonogram"));
    expect(shareButton(), "late-result").toBeNull();
    panel.unmount();

    expect(narrow.keys(), "the failed probe leaves nothing behind").toEqual([]);
  });

  it("the same store, given room for a record, renders the button on every one of those five surfaces and leaves no probe behind", () => {
    const roomy = store({ headroom: Number.MAX_SAFE_INTEGER });
    installStore(roomy);

    const { unmount } = render(conclusion("termo"));
    expect(shareButton(), "termo conclusion").not.toBeNull();
    unmount();

    for (const game of GAMES) {
      const panel = render(late(game));
      expect(shareButton(), game).not.toBeNull();
      panel.unmount();
    }

    expect(roomy.keys(), "the probe cleans up after itself").toEqual([]);
  });

  it("a store that accepts the write but refuses the cleanup is writable, orphan and all", () => {
    const sticky = store({ headroom: Number.MAX_SAFE_INTEGER });
    installStore(
      Object.create(sticky, {
        removeItem: {
          value: () => {
            throw new DOMException("blocked", "SecurityError");
          },
        },
      }) as Storage,
    );

    const { unmount } = render(conclusion("termo"));
    expect(shareButton()).not.toBeNull();
    unmount();

    render(conclusion("termo"));
    expect(sticky.keys(), "one orphan, and it never multiplies").toEqual([
      WRITE_PROBE_KEY,
    ]);
  });

  it("the next play mount reclaims an orphaned probe key, and leaves every other key alone", () => {
    const stray = "unrelated-key";
    const kept = playRecordKey("binairo", DATE);
    const orphaned = store({
      headroom: Number.MAX_SAFE_INTEGER,
      seed: {
        [WRITE_PROBE_KEY]: "x",
        [kept]: JSON.stringify(BINAIRO_RECORD),
        [stray]: "left alone",
      },
    });
    installStore(orphaned);

    prunePlayRecords(DATE);

    expect(orphaned.keys()).toEqual([kept, stray]);
  });

  it("the probe is sized to the largest record any of the four schemas admits, and no larger than twice it", () => {
    expect(WRITE_PROBE_BYTES).toBeGreaterThanOrEqual(LARGEST_RECORD_BYTES);
    expect(WRITE_PROBE_BYTES).toBeLessThan(LARGEST_RECORD_BYTES * 2);
  });

  it("the three GRID games never reach the gate — their stamp shares with no record at all", () => {
    installStore(store());

    for (const game of ["binairo", "sudoku", "nonogram"] as const) {
      const { unmount } = render(conclusion(game));
      expect(shareButton(), game).toBeEnabled();
      unmount();
    }
  });
});
