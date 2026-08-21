import { render } from "@testing-library/react";
import { useReducer } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { writePlayRecord, type PlayRecord } from "../src/play/play-record";
import { applyTimerAction } from "../src/play/timer";
import type { LifecycleAction, PlayCore } from "../src/play/types";
import { usePlayLifecycle } from "../src/play/use-play-lifecycle";

/**
 * The `puzzle_started` seam inside `usePlayLifecycle` (#33, ADR-0069
 * decision 2), pinned on the shared hook rather than through any one game's
 * screen — the T-WEB-S33 discipline, and for the same reason: all four
 * games and both archive shells reach the event through this one call, so a
 * per-screen test would pin one of six copies of nothing.
 *
 * The RELAY CLIENT is mocked (its own wire behaviour is T-WEB-S315–S318);
 * what these cases decide is WHETHER the hook calls it. The SERVER CLAIM is
 * an INPUT to the hook rather than something it reads — `play/day-state.ts`
 * reaches `src/day/**`, which no archive page's module graph may contain
 * (ADR-0053 decision 10's "Why no endpoint", pinned by
 * `archive-day.test.tsx`) — so the probe passes it the
 * way the four daily screen roots do.
 */
const telemetry = vi.hoisted(() => ({ postPuzzleStarted: vi.fn() }));
vi.mock("../src/telemetry/client", () => telemetry);

// The queue is stubbed: a real flush would reach `fetch`, and nothing here
// is about the completion path.
vi.mock("../src/play/sync", () => ({
  startCompletionSync: vi.fn(() => () => undefined),
  flushPendingCompletions: vi.fn(() => Promise.resolve()),
}));

const DATE = "2026-07-30";

interface ProbeState extends PlayCore {
  readonly entries: readonly (0 | 1 | null)[];
  readonly status: "playing" | "solved";
}

const INITIAL: ProbeState = {
  date: DATE,
  timer: { accumulatedMs: 0, runningSince: null },
  status: "playing",
  pendingSync: false,
  now: 0,
  hydrated: false,
  entries: Array.from({ length: 64 }, () => null),
};

function probeReducer(state: ProbeState, action: LifecycleAction): ProbeState {
  if (action.type === "restore") {
    return { ...state, now: action.now, hydrated: true };
  }
  return {
    ...state,
    timer: applyTimerAction(state.timer, action),
    now: action.now,
  };
}

function buildRecord(
  state: ProbeState,
  now: number,
  closed: boolean,
): PlayRecord {
  return {
    v: 1,
    game: "binairo",
    date: state.date,
    entries: [...state.entries],
    elapsedMs: now,
    hintsUsed: 0,
    concluded: closed,
    pendingSync: closed,
    syncOutcome: "pending",
  };
}

function Probe({
  date = DATE,
  remotelyClaimed,
}: {
  readonly date?: string;
  readonly remotelyClaimed?: boolean;
}) {
  const [state, dispatch] = useReducer(probeReducer, { ...INITIAL, date });
  usePlayLifecycle({
    game: "binairo",
    state,
    reduce: probeReducer,
    dispatch,
    buildRecord,
    persistDeps: [state.entries],
    remotelyClaimed,
  });
  return <output>{state.now}</output>;
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("usePlayLifecycle's puzzle_started seam", () => {
  it("T-WEB-S319: a fresh mount with no stored record reports the start exactly once, with the SERVER's date", () => {
    render(<Probe />);

    expect(telemetry.postPuzzleStarted).toHaveBeenCalledTimes(1);
    expect(telemetry.postPuzzleStarted).toHaveBeenCalledWith("binairo", DATE);

    // The archive is the same seam and the same call — the server decides
    // `archive` against its own São Paulo today, so the hook says nothing
    // about which it is (ADR-0069 decision 4).
    telemetry.postPuzzleStarted.mockClear();
    render(<Probe date="2026-07-01" />);
    expect(telemetry.postPuzzleStarted).toHaveBeenCalledWith(
      "binairo",
      "2026-07-01",
    );
  });

  it("T-WEB-S320: a restored in-progress board and a concluded day both report nothing — a record is not a start", () => {
    // Resuming a board is the middle of an attempt, not the beginning of
    // one; a concluded day is neither.
    writePlayRecord(buildRecord(INITIAL, 42_000, false));
    render(<Probe />);
    expect(telemetry.postPuzzleStarted).not.toHaveBeenCalled();

    window.localStorage.clear();
    writePlayRecord(buildRecord(INITIAL, 91_000, true));
    render(<Probe />);
    expect(telemetry.postPuzzleStarted).not.toHaveBeenCalled();
  });

  it("T-WEB-S321: a day the SERVER claims reports nothing — the remote completed view is not a start; an unclaimed day and the archive's omitted flag both report normally", () => {
    // #142/ADR-0065: the screen root's swap to the remote view is
    // render-time only, so this hook mounts behind it with no local record.
    // Without the gate the cross-device case would count a finished day as a
    // new attempt on every device that opens it — and the hub's done tile
    // links to the BOARD route, so that navigation is the common path, not a
    // corner.
    render(<Probe remotelyClaimed />);
    expect(telemetry.postPuzzleStarted).not.toHaveBeenCalled();

    // Cleared between arms because the mount above PERSISTED an in-progress
    // record for the same (game, date) — the persist effect's own doing —
    // and a stored record is itself a reason not to fire (T-WEB-S320).
    window.localStorage.clear();

    // The server makes no claim: the board is playable and the start is
    // real.
    render(<Probe remotelyClaimed={false} />);
    expect(telemetry.postPuzzleStarted).toHaveBeenCalledTimes(1);

    // THE ARCHIVE's SHAPE, and the reason the field is optional: the archive
    // shells omit it entirely, because an archived date's claim is
    // `undefined` by the payload's own date gate anyway. Omitted must read
    // as "unclaimed" and not as "unknown, so stay silent".
    telemetry.postPuzzleStarted.mockClear();
    window.localStorage.clear();
    render(<Probe date="2026-07-01" />);
    expect(telemetry.postPuzzleStarted).toHaveBeenCalledWith(
      "binairo",
      "2026-07-01",
    );
  });
});
