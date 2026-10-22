import { describe, expect, it } from "vitest";

import { hintAllowed } from "../src/play/hint-allowance";
import {
  freshCore,
  hydratedAt,
  restoredFrom,
  timed,
} from "../src/play/play-core";

const RUNNING = {
  ...freshCore("2026-10-22"),
  timer: { accumulatedMs: 1000, runningSince: 5000 },
};

describe("the PlayCore lifecycle lives once, in play-core (T-WEB-S1004)", () => {
  it("freshCore is a stopped, playing, unhydrated clock for the date", () => {
    expect(freshCore("2026-10-22")).toEqual({
      date: "2026-10-22",
      timer: { accumulatedMs: 0, runningSince: null },
      status: "playing",
      now: 0,
      hydrated: false,
    });
  });

  it("hydratedAt changes only now and hydrated", () => {
    expect(hydratedAt(RUNNING, 9000)).toEqual({
      ...RUNNING,
      now: 9000,
      hydrated: true,
    });
  });

  it("restoredFrom stops the clock at the record's elapsed time", () => {
    expect(restoredFrom(RUNNING, { elapsedMs: 42_000 }, 9000)).toEqual({
      ...RUNNING,
      timer: { accumulatedMs: 42_000, runningSince: null },
      now: 9000,
      hydrated: true,
    });
  });

  it("timed pauses, resumes and ticks, and stamps now", () => {
    const paused = timed(RUNNING, { type: "pause", now: 7000 });
    expect(paused.timer).toEqual({ accumulatedMs: 3000, runningSince: null });
    expect(paused.now).toBe(7000);

    const resumed = timed(paused, { type: "resume", now: 8000 });
    expect(resumed.timer).toEqual({ accumulatedMs: 3000, runningSince: 8000 });

    const ticked = timed(resumed, { type: "tick", now: 8500 });
    expect(ticked.timer).toBe(resumed.timer);
    expect(ticked.now).toBe(8500);
  });

  it("hintAllowed refuses a null allowance, a spent allowance and a closed board", () => {
    const playing = { status: "playing", hint: { used: 1 } } as const;
    expect(hintAllowed(playing, 3)).toBe(true);
    expect(hintAllowed(playing, null)).toBe(false);
    expect(hintAllowed({ ...playing, hint: { used: 3 } }, 3)).toBe(false);
    expect(hintAllowed({ ...playing, status: "solved" }, 3)).toBe(false);
    expect(hintAllowed({ ...playing, status: "lost" }, 3)).toBe(false);
  });
});
