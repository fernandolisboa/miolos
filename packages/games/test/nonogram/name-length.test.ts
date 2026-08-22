import { describe, expect, it } from "vitest";

import { MOTIFS } from "../../src/nonogram/motifs";

/**
 * Every curated motif name fits the daily conclusion's uppercase caption
 * (#64, ADR-0070), pinned on THIS side of the wall.
 *
 * WHY IT IS HERE AND NOT IN apps/web — the same reason as
 * `bundle-markers.test.ts` beside it. `apps/web` deliberately never imports
 * `MOTIFS`: no motif name may reach a daily-scope chunk, which is exactly
 * what makes the string grep in `apps/web/scripts/route-client-js.mjs` a
 * real check on the engine barrel's tree-shaking. #64 ships a motif NAME to
 * users and kept that grep fully armed by delivering it over an
 * authenticated wire instead of from the bundle — so enumerating the names
 * for a length check has to happen inside this package.
 *
 * THE CONSUMER, BY NAME. `apps/web`'s `T-WEB-S330`
 * (`test/nonogram-motif-name.test.tsx`) owns the other half: that
 * `.pictureName` and `.pictureLead` really are `text-transform: uppercase`,
 * and that the fixed lead string fits. It restates `ALL_CAPS_BODY_MAX = 30`
 * as a literal, because it cannot import anything from here either. When the
 * threshold moves, both files move.
 *
 * WHAT IT GUARDS, and why a unit test rather than the design gate.
 * `impeccable`'s `all-caps-body` rule fires on **more than 30 characters of
 * DIRECT text** under `text-transform: uppercase`, with no interactive or
 * `nav` exemption. The caption renders CONTENT from a library that grows, on
 * the one screen a URL-mode impeccable scan can never reach: it needs a
 * SOLVED day, and a clean profile's `GET /day` answers 401 (ADR-0065
 * consequence (c) records the same unreachability). #31 met this rule twice
 * from the other direction — a label template that only got too long in four
 * months of twelve — and both breaks were invisible to CI and to any commit.
 * Measuring the worst case here makes a 31-character motif red at commit
 * time instead of at a preview scan nobody can run.
 *
 * `packages/games` carries no test ids by convention, and this file keeps it
 * that way.
 */
const ALL_CAPS_BODY_MAX = 30;

describe("curated motif names fit the conclusion caption", () => {
  it("every name is at most 30 characters — the `all-caps-body` threshold", () => {
    // Anti-vacuity: a scan over an empty library would pass trivially, which
    // is the same defect `bundle-markers.test.ts` exists to prevent for the
    // grep markers.
    expect(MOTIFS.length).toBeGreaterThan(100);

    const tooLong = MOTIFS.filter(
      (motif) => motif.name.length > ALL_CAPS_BODY_MAX,
    ).map((motif) => `${motif.name} (${String(motif.name.length)})`);
    expect(tooLong).toEqual([]);
  });

  it("no name is blank — the wall read would drop it, and the conclusion would silently lose its payoff", () => {
    // `nonogramRevealSchema` has no `.min(1)`, and the daily read normalises
    // a blank name to `undefined` rather than 500ing the whole day payload
    // (ADR-0070 decision 5). That is a SAFETY NET for a row the generator
    // should never have written; this is the check that keeps it a net.
    // `validateNonogram`'s `reveal-name-empty` rejection covers generated
    // output — this covers the library the generator draws from.
    expect(MOTIFS.filter((motif) => motif.name.trim() === "")).toEqual([]);
  });
});
