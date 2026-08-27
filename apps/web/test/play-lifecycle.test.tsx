import { act, render } from "@testing-library/react";
import { useEffect, useReducer } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { applyTimerAction } from "../src/play/timer";
import type { PlayRecord } from "../src/play/play-record";
import { usePlayLifecycle } from "../src/play/use-play-lifecycle";
import type { LifecycleAction, PlayCore } from "../src/play/types";

//

const sync = vi.hoisted(() => ({
  startCompletionSync: vi.fn(() => () => undefined),
  flushPendingCompletions: vi.fn(() => Promise.resolve()),
}));
vi.mock("../src/play/sync", () => sync);

const DATE = "2026-07-30";

interface ProbeState extends PlayCore {
  readonly entries: readonly (0 | 1 | null)[];
  readonly status: "playing" | "solved";
}

type ProbeAction = LifecycleAction | { readonly type: "write" };

const INITIAL: ProbeState = {
  date: DATE,
  timer: { accumulatedMs: 0, runningSince: null },
  status: "playing",
  pendingSync: false,
  now: 0,
  hydrated: false,
  entries: Array.from({ length: 64 }, () => null),
};

function probeReducer(state: ProbeState, action: ProbeAction): ProbeState {
  switch (action.type) {
    case "restore":
      return { ...state, now: action.now, hydrated: true };
    case "tick":
    case "pause":
    case "resume":
      return {
        ...state,
        timer: applyTimerAction(state.timer, action),
        now: action.now,
      };
    case "write":
      return {
        ...state,
        entries: state.entries.map((_unused, at) => (at === 0 ? 1 : null)),
      };
  }
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

const dispatchProbe: { current: (action: ProbeAction) => void } = {
  current: () => undefined,
};

function Probe() {
  const [state, dispatch] = useReducer(probeReducer, INITIAL);
  useEffect(() => {
    dispatchProbe.current = dispatch;
  }, [dispatch]);

  usePlayLifecycle({
    game: "binairo",
    state,
    reduce: probeReducer,
    dispatch,
    buildRecord,
    persistDeps: [state.entries],
  });

  return <output>{state.now}</output>;
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("usePlayLifecycle's persist effect (T-WEB-S33)", () => {
  it("writes nothing on a tick, and exactly once on an entry change", () => {
    render(<Probe />);

    act(() => {
      vi.advanceTimersByTime(0);
    });
    const setItem = vi.spyOn(Storage.prototype, "setItem");

    act(() => {
      for (let step = 1; step <= 10; step += 1) {
        dispatchProbe.current({ type: "tick", now: 1_000 * step });
      }
    });

    expect(setItem).not.toHaveBeenCalled();

    act(() => {
      dispatchProbe.current({ type: "write" });
    });

    expect(setItem).toHaveBeenCalledTimes(1);
    setItem.mockRestore();
  });

  it("still persists on pause and on resume, so a tab crash keeps the board", () => {
    render(<Probe />);
    act(() => {
      vi.advanceTimersByTime(0);
    });
    const setItem = vi.spyOn(Storage.prototype, "setItem");

    act(() => {
      dispatchProbe.current({ type: "pause", now: 5_000 });
    });
    expect(setItem).toHaveBeenCalledTimes(1);

    act(() => {
      dispatchProbe.current({ type: "resume", now: 6_000 });
    });
    expect(setItem).toHaveBeenCalledTimes(2);
    setItem.mockRestore();
  });
});
