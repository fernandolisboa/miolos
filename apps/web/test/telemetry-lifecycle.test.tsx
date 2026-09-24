import { render } from "@testing-library/react";
import { useReducer } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { writePlayRecord, type PlayRecord } from "../src/play/play-record";
import { startCompletionSync } from "../src/play/sync";
import { applyTimerAction } from "../src/play/timer";
import type { LifecycleAction, PlayCore } from "../src/play/types";
import { usePlayLifecycle } from "../src/play/use-play-lifecycle";

const telemetry = vi.hoisted(() => ({ postPuzzleStarted: vi.fn() }));
vi.mock("../src/telemetry/client", () => telemetry);

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

    telemetry.postPuzzleStarted.mockClear();
    render(<Probe date="2026-07-01" />);
    expect(telemetry.postPuzzleStarted).toHaveBeenCalledWith(
      "binairo",
      "2026-07-01",
    );
  });

  it("T-WEB-S320: a restored in-progress board and a concluded day both report nothing — a record is not a start", () => {
    writePlayRecord(buildRecord(INITIAL, 42_000, false));
    render(<Probe />);
    expect(telemetry.postPuzzleStarted).not.toHaveBeenCalled();

    window.localStorage.clear();
    writePlayRecord(buildRecord(INITIAL, 91_000, true));
    render(<Probe />);
    expect(telemetry.postPuzzleStarted).not.toHaveBeenCalled();
  });

  it("T-WEB-S321: a day the SERVER claims reports nothing — the remote completed view is not a start; an unclaimed day and the archive's omitted flag both report normally", () => {
    render(<Probe remotelyClaimed />);
    expect(telemetry.postPuzzleStarted).not.toHaveBeenCalled();

    window.localStorage.clear();

    render(<Probe remotelyClaimed={false} />);
    expect(telemetry.postPuzzleStarted).toHaveBeenCalledTimes(1);

    telemetry.postPuzzleStarted.mockClear();
    window.localStorage.clear();
    render(<Probe date="2026-07-01" />);
    expect(telemetry.postPuzzleStarted).toHaveBeenCalledWith(
      "binairo",
      "2026-07-01",
    );
  });

  it("T-WEB-S321a: a claim arriving after mount does not re-run the mount effect", () => {
    const { rerender } = render(<Probe remotelyClaimed={false} />);
    expect(startCompletionSync).toHaveBeenCalledTimes(1);
    expect(telemetry.postPuzzleStarted).toHaveBeenCalledTimes(1);

    rerender(<Probe remotelyClaimed />);

    expect(startCompletionSync).toHaveBeenCalledTimes(1);
    expect(telemetry.postPuzzleStarted).toHaveBeenCalledTimes(1);
  });
});
