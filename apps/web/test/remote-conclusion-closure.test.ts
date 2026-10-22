import { describe, expect, it } from "vitest";

import { closureOf } from "./module-graph";

const REMOTE = "apps/web/src/play/remote-conclusion-view.tsx";

function playModules(): ReadonlySet<string> {
  const modules = new Set<string>();
  for (const path of closureOf(REMOTE)) {
    const match = /\/src\/(play\/[^/]+?)\.tsx?$/.exec(path);
    if (match?.[1] !== undefined) {
      modules.add(match[1]);
    }
  }
  return modules;
}

describe("the remote conclusion carries no local-play machinery (T-WEB-S1002)", () => {
  it("never reaches sync, sharing, the push prompt, the flourish or the local conclusion", () => {
    const reached = playModules();
    const leaks = [
      "play/sync",
      "play/share-button",
      "play/share-text",
      "play/push-prompt-card",
      "play/ending-flourish",
      "play/conclusion-view",
    ].filter((module) => reached.has(module));

    expect(leaks).toEqual([]);
  });

  it("does reach the shared chrome and stats, so a green run above means something", () => {
    const reached = playModules();

    expect(reached).toContain("play/conclusion-chrome");
    expect(reached).toContain("play/conclusion-stats");
  });
});
