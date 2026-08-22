import { describe, expect, it } from "vitest";

import { MOTIFS } from "../../src/nonogram/motifs";

/**
 * The motif markers `apps/web/scripts/route-client-js.mjs` greps the built
 * client chunks for, pinned on THIS side of the wall.
 *
 * WHY IT IS HERE AND NOT IN apps/web — the same reason as `clue-bounds.test.ts`
 * beside it. `apps/web` deliberately never imports `MOTIFS`: no motif name may
 * reach the client BUNDLE, which is exactly what makes a string grep over the
 * built chunks a real check on the engine barrel's tree-shaking. So the only
 * place these names can be enumerated is inside this package.
 *
 * THE RULE ABOVE SURVIVED #64 AND ITS WARRANT CHANGED (ADR-0070). ADR-0033
 * consequence (d) promised this check would die the day a motif name shipped
 * to a user, and it has not: the daily conclusion names its motif from the
 * user's own completed `/day` claim — an authenticated wire — and an API JSON
 * response is never a chunk. The grep still scans `.next/static/chunks/**`
 * only, so this file is unchanged, still non-vacuous, and still the only
 * thing standing between a careless client import and 184 curated pt-BR names
 * in the browser.
 *
 * THE CONSUMER, BY NAME. `apps/web/scripts/route-client-js.mjs`'s
 * `FORBIDDEN_DAILY_SCOPE` array hard-codes the five markers below and asserts
 * they appear in ZERO daily-scope or unattributed chunks — since #28 the scan
 * is route-scoped (ADR-0047 amends ADR-0033's bundle clause): free-play
 * chunks legitimately carry the motif library, and `EXPECTED_FREE_PLAY_SCOPE`
 * requires `Escada` THERE, so the same string is red on one side and required
 * on the other. A grep for a string that no longer exists passes trivially —
 * so if all five were renamed away, the script would keep printing `ok` while
 * asserting the absence of nothing, at precisely the place ADR-0033's
 * mechanical guarantee lives. Nothing on the web side can notice: the script
 * holds no link back to the library.
 *
 * WHEN THIS REDS, the fix is to pick a replacement marker that exists in the
 * shipped library and update BOTH this file and the script's `FORBIDDEN`
 * array — never to relax the assertion here. Prefer a name the generator
 * actually ships (one per size class, so a tree-shaking failure at any size
 * is caught).
 */
const FORBIDDEN_MARKERS: readonly string[] = [
  "Escada",
  "Borboleta",
  "Caranguejo",
  "Flamingo",
];

/** The one marker pinned by `id` rather than by `name`. */
const FORBIDDEN_ID = "sitting-cat";

describe("the client-bundle tripwire's motif markers", () => {
  it("still resolve in the shipped library, so the greps are not vacuous", () => {
    const names = new Set(MOTIFS.map((motif) => motif.name));
    const ids = new Set(MOTIFS.map((motif) => motif.id));

    for (const marker of FORBIDDEN_MARKERS) {
      expect(
        names.has(marker),
        `\`${marker}\` no longer names a motif: update this file AND \`FORBIDDEN\` in apps/web/scripts/route-client-js.mjs`,
      ).toBe(true);
    }
    expect(
      ids.has(FORBIDDEN_ID),
      `\`${FORBIDDEN_ID}\` no longer identifies a motif: update this file AND \`FORBIDDEN\` in apps/web/scripts/route-client-js.mjs`,
    ).toBe(true);
  });

  it("cover every size class, so a leak at any board size is caught", () => {
    // A marker set that all resolved to one size would let a size-15 motif
    // table ship unnoticed. One name per size, plus the id.
    const sizes = new Set(
      MOTIFS.filter(
        (motif) =>
          FORBIDDEN_MARKERS.includes(motif.name) || motif.id === FORBIDDEN_ID,
      ).map((motif) => motif.size),
    );

    expect([...sizes].sort((a, b) => a - b)).toEqual([5, 8, 10, 15]);
  });
});
