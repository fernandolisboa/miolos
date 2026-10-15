import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { FreePlayLevel } from "../src/free-play/catalog";
import {
  useFreeGeneration,
  type FreeGame,
  type FreePhase,
} from "../src/free-play/use-free-generation";
import { flushGeneration } from "./free-generation";

interface StubPuzzle {
  readonly seed: number;
  readonly level: FreePlayLevel;
}

type StubGenerate = (seed: number, level: FreePlayLevel) => StubPuzzle;

const STUB_GAME: FreeGame<StubGenerate, StubPuzzle> = {
  generate: (seed, level) => ({ seed, level }),
  build: (generate, draw, level) => generate(draw(), level),
};

function renderLogged(
  initialLevel: FreePlayLevel,
  deps: { readonly pickSeed: () => number; readonly generate?: StubGenerate },
) {
  const phases: FreePhase<StubPuzzle>[] = [];
  const hook = renderHook(
    ({ level }: { level: FreePlayLevel }) => {
      const result = useFreeGeneration(level, STUB_GAME, deps);
      phases.push(result.phase);
      return result;
    },
    { initialProps: { level: initialLevel } },
  );
  return { ...hook, phases };
}

function seedCounter() {
  let next = 0;
  return vi.fn(() => {
    next += 1;
    return next;
  });
}

describe("useFreeGeneration runs one build per {level, run} and masks stale results (T-WEB-S415)", () => {
  it("starts generating, then settles ready at run 0 with the build's puzzle", async () => {
    const pickSeed = seedCounter();
    const { phases, result } = renderLogged("leve", { pickSeed });

    expect(phases[0]).toEqual({ kind: "generating" });
    await flushGeneration();
    expect(result.current.phase).toEqual({
      kind: "ready",
      run: 0,
      puzzle: { seed: 1, level: "leve" },
    });
    expect(pickSeed).toHaveBeenCalledTimes(1);
  });

  it("reports failed when the build throws, and regenerate retries it at run 1", async () => {
    const pickSeed = seedCounter();
    let throws = true;
    const generate: StubGenerate = (seed, level) => {
      if (throws) throw new Error("boom");
      return { seed, level };
    };
    const { result } = renderLogged("leve", { pickSeed, generate });
    await flushGeneration();

    expect(result.current.phase).toEqual({ kind: "failed" });

    throws = false;
    act(() => result.current.regenerate());
    await flushGeneration();

    expect(result.current.phase).toEqual({
      kind: "ready",
      run: 1,
      puzzle: { seed: 2, level: "leve" },
    });
  });

  it("never shows the previous puzzle after regenerate or a level change", async () => {
    const pickSeed = seedCounter();
    const { phases, result, rerender } = renderLogged("leve", { pickSeed });
    await flushGeneration();
    const first = result.current.phase;

    const beforeRegenerate = phases.length;
    act(() => result.current.regenerate());
    await flushGeneration();
    const afterRegenerate = phases.slice(beforeRegenerate);
    expect(afterRegenerate).not.toContainEqual(first);
    expect(afterRegenerate[0]).toEqual({ kind: "generating" });
    const second = result.current.phase;
    expect(second).toEqual({
      kind: "ready",
      run: 1,
      puzzle: { seed: 2, level: "leve" },
    });

    const beforeLevel = phases.length;
    rerender({ level: "dificil" });
    await flushGeneration();
    const afterLevel = phases.slice(beforeLevel);
    expect(afterLevel).not.toContainEqual(second);
    expect(afterLevel[0]).toEqual({ kind: "generating" });
    expect(result.current.phase).toEqual({
      kind: "ready",
      run: 1,
      puzzle: { seed: 3, level: "dificil" },
    });
    expect(pickSeed).toHaveBeenCalledTimes(3);
  });

  it("keeps regenerate's identity and does not rebuild on a plain rerender", async () => {
    const pickSeed = seedCounter();
    const { result, rerender } = renderLogged("leve", { pickSeed });
    await flushGeneration();
    const regenerate = result.current.regenerate;

    rerender({ level: "leve" });
    rerender({ level: "leve" });
    await flushGeneration();

    expect(result.current.regenerate).toBe(regenerate);
    expect(pickSeed).toHaveBeenCalledTimes(1);
  });
});

describe("an inline game object cannot loop the build (T-WEB-S416)", () => {
  it("freezes the game at mount, so a fresh descriptor each render buys one build", async () => {
    const pickSeed = seedCounter();
    const deps = { pickSeed };
    let renders = 0;
    const { rerender } = renderHook(
      ({ level }: { level: FreePlayLevel }) => {
        renders += 1;
        if (renders > 50) throw new Error("the build loops");
        return useFreeGeneration(
          level,
          {
            generate: STUB_GAME.generate,
            build: (generate, draw, lvl) => generate(draw(), lvl),
          },
          deps,
        );
      },
      { initialProps: { level: "leve" as FreePlayLevel } },
    );

    rerender({ level: "leve" });
    await flushGeneration();

    expect(pickSeed).toHaveBeenCalledTimes(1);
  });
});

describe("a switch paints generating before it builds (T-WEB-S674)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("holds every build back until a frame and a timeout after the render, and builds only the last input once", () => {
    vi.useFakeTimers();
    const pickSeed = seedCounter();
    const generate = vi.fn(STUB_GAME.generate);
    const { phases, result, rerender } = renderLogged("leve", {
      pickSeed,
      generate,
    });

    expect(result.current.phase).toEqual({ kind: "generating" });
    expect(generate).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersToNextFrame();
      vi.advanceTimersByTime(1);
    });
    expect(generate).toHaveBeenCalledTimes(1);
    expect(result.current.phase).toMatchObject({ kind: "ready" });

    const shown = phases.length;
    rerender({ level: "medio" });
    rerender({ level: "dificil" });

    expect(phases.slice(shown).every((p) => p.kind === "generating")).toBe(
      true,
    );
    expect(generate).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersToNextFrame();
      vi.advanceTimersByTime(1);
    });
    expect(generate).toHaveBeenCalledTimes(2);
    expect(generate).toHaveBeenLastCalledWith(2, "dificil");
    expect(result.current.phase).toEqual({
      kind: "ready",
      run: 0,
      puzzle: { seed: 2, level: "dificil" },
    });
  });

  it("builds nothing when the screen leaves before the frame", () => {
    vi.useFakeTimers();
    const generate = vi.fn(STUB_GAME.generate);
    const { unmount } = renderLogged("leve", {
      pickSeed: seedCounter(),
      generate,
    });

    unmount();
    vi.advanceTimersToNextFrame();
    vi.runAllTimers();

    expect(generate).not.toHaveBeenCalled();
  });
});
