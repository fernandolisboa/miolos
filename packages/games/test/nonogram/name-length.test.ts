import { describe, expect, it } from "vitest";

import { MOTIFS } from "../../src/nonogram/motifs";

const ALL_CAPS_BODY_MAX = 30;

describe("curated motif names fit the conclusion caption", () => {
  it("every name is at most 30 characters — the `all-caps-body` threshold", () => {
    expect(MOTIFS.length).toBeGreaterThan(100);

    const tooLong = MOTIFS.filter(
      (motif) => motif.name.length > ALL_CAPS_BODY_MAX,
    ).map((motif) => `${motif.name} (${String(motif.name.length)})`);
    expect(tooLong).toEqual([]);
  });

  it("no name is blank — the wall read would drop it, and the conclusion would silently lose its payoff", () => {
    expect(MOTIFS.filter((motif) => motif.name.trim() === "")).toEqual([]);
  });
});
