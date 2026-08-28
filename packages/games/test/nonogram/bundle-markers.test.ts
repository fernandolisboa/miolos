import { describe, expect, it } from "vitest";

import { MOTIFS } from "../../src/nonogram/motifs";

const FORBIDDEN_MARKERS: readonly string[] = [
  "Escada",
  "Borboleta",
  "Caranguejo",
  "Flamingo",
];

const FORBIDDEN_ID = "sitting-cat";

describe("the client-bundle tripwire's motif markers", () => {
  it("still resolve in the shipped library, so the greps are not vacuous", () => {
    const names = new Set(MOTIFS.map((motif) => motif.name));
    const ids = new Set(MOTIFS.map((motif) => motif.id));

    for (const marker of FORBIDDEN_MARKERS) {
      expect(
        names.has(marker),
        `\`${marker}\` no longer names a motif: update this file AND the FORBIDDEN_* lists in apps/web/scripts/route-client-js.mjs`,
      ).toBe(true);
    }
    expect(
      ids.has(FORBIDDEN_ID),
      `\`${FORBIDDEN_ID}\` no longer identifies a motif: update this file AND the FORBIDDEN_* lists in apps/web/scripts/route-client-js.mjs`,
    ).toBe(true);
  });

  it("cover every size class, so a leak at any board size is caught", () => {
    const sizes = new Set(
      MOTIFS.filter(
        (motif) =>
          FORBIDDEN_MARKERS.includes(motif.name) || motif.id === FORBIDDEN_ID,
      ).map((motif) => motif.size),
    );

    expect([...sizes].sort((a, b) => a - b)).toEqual([5, 8, 10, 15]);
  });
});
