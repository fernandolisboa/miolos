import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { FreePlayLevel } from "../src/free-play/catalog";
import {
  useFreeGeneration,
  type FreeGame,
  type FreePhase,
} from "../src/free-play/use-free-generation";

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
  it("starts generating, then settles ready at run 0 with the build's puzzle", () => {
    const pickSeed = seedCounter();
    const { phases, result } = renderLogged("leve", { pickSeed });

    expect(phases[0]).toEqual({ kind: "generating" });
    expect(result.current.phase).toEqual({
      kind: "ready",
      run: 0,
      puzzle: { seed: 1, level: "leve" },
    });
    expect(pickSeed).toHaveBeenCalledTimes(1);
  });

  it("reports failed when the build throws, and regenerate retries it at run 1", () => {
    const pickSeed = seedCounter();
    let throws = true;
    const generate: StubGenerate = (seed, level) => {
      if (throws) throw new Error("boom");
      return { seed, level };
    };
    const { result } = renderLogged("leve", { pickSeed, generate });

    expect(result.current.phase).toEqual({ kind: "failed" });

    throws = false;
    act(() => result.current.regenerate());

    expect(result.current.phase).toEqual({
      kind: "ready",
      run: 1,
      puzzle: { seed: 2, level: "leve" },
    });
  });

  it("never shows the previous puzzle after regenerate or a level change", () => {
    const pickSeed = seedCounter();
    const { phases, result, rerender } = renderLogged("leve", { pickSeed });
    const first = result.current.phase;

    const beforeRegenerate = phases.length;
    act(() => result.current.regenerate());
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

  it("keeps regenerate's identity and does not rebuild on a plain rerender", () => {
    const pickSeed = seedCounter();
    const { result, rerender } = renderLogged("leve", { pickSeed });
    const regenerate = result.current.regenerate;

    rerender({ level: "leve" });
    rerender({ level: "leve" });

    expect(result.current.regenerate).toBe(regenerate);
    expect(pickSeed).toHaveBeenCalledTimes(1);
  });
});

describe("an inline game object cannot loop the build (T-WEB-S416)", () => {
  it("freezes the game at mount, so a fresh descriptor each render buys one build", () => {
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

    expect(pickSeed).toHaveBeenCalledTimes(1);
  });
});
