import { describe, expect, it } from "vitest";

import { WEEKDAYS } from "../../src/weekday";
import { deriveClues } from "../../src/nonogram/clues";
import {
  MIN_POOL,
  NONOGRAM_WEEKDAY_CRITERIA,
  mirrorH,
  weekdayPool,
} from "../../src/nonogram/difficulty";
import { MOTIFS, motifBitmap } from "../../src/nonogram/motifs";
import { solveNonogram } from "../../src/nonogram/solve";

// The content harness — a mechanical gate (ADR-0021, plan §4). Every motif
// (and every mirrored variant) must pass every check here before the
// generator may ever pick it. Growing the library is adding entries that
// pass this file; weakening a check is never a content fix.

/** Test-enforced floors per size class (plan §4). */
const CLASS_FLOORS: ReadonlyArray<readonly [number, number]> = [
  [5, 28],
  [8, 40],
  [10, 40],
  [15, 32],
];

const DENSITY_MIN = 0.3;
const DENSITY_MAX = 0.65;

describe("motif library shape", () => {
  it("has unique kebab-case ids and non-empty pt-BR names", () => {
    const seen = new Set<string>();
    for (const motif of MOTIFS) {
      expect(motif.id, `duplicate id ${motif.id}`).not.toSatisfy((id: string) =>
        seen.has(id),
      );
      seen.add(motif.id);
      expect(motif.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(motif.name.trim().length).toBeGreaterThan(0);
    }
  });

  it("has exactly size×size rows over the {#, .} alphabet", () => {
    for (const motif of MOTIFS) {
      expect(motif.rows, motif.id).toHaveLength(motif.size);
      for (const row of motif.rows) {
        expect(row, motif.id).toHaveLength(motif.size);
        expect(row, motif.id).toMatch(/^[#.]+$/);
      }
    }
  });

  it("only marks mirrorable when the mirrored bitmap differs", () => {
    for (const motif of MOTIFS) {
      if (!motif.mirrorable) {
        continue;
      }
      const bitmap = motifBitmap(motif);
      expect(mirrorH(bitmap), motif.id).not.toEqual(bitmap);
    }
  });

  it("stays roughly inside the 30–65% density guideline (ratcheted)", () => {
    // Deliberately not a hard per-motif gate (plan §4): solvability is the
    // gate, density is a diagnostic. Ratcheted so the outlier set can only
    // shrink silently — growing it is a visible, consciously-bumped change.
    const DENSITY_OUTLIER_RATCHET = 34;
    const outliers: string[] = [];
    for (const motif of MOTIFS) {
      const filled = motifBitmap(motif).flat().filter(Boolean).length;
      const density = filled / (motif.size * motif.size);
      if (density < DENSITY_MIN || density > DENSITY_MAX) {
        outliers.push(`${motif.id} ${(density * 100).toFixed(0)}%`);
      }
    }
    if (outliers.length > 0) {
      console.warn(
        `density guideline outliers (diagnostic): ${outliers.join(", ")}`,
      );
    }
    expect(outliers.length).toBeLessThanOrEqual(DENSITY_OUTLIER_RATCHET);
  });
});

describe("motif line-solvability (the central content invariant)", () => {
  it("every motif and every mirrored variant is line-solvable to its exact bitmap", () => {
    for (const motif of MOTIFS) {
      const base = motifBitmap(motif);
      const variants = motif.mirrorable
        ? [
            { label: motif.id, bitmap: base },
            { label: `${motif.id} (mirrored)`, bitmap: mirrorH(base) },
          ]
        : [{ label: motif.id, bitmap: base }];
      for (const { label, bitmap } of variants) {
        const result = solveNonogram(deriveClues(bitmap));
        expect(result.status, label).toBe("solved");
        const asBooleans = result.grid.map((row) =>
          row.map((cell) => cell === "filled"),
        );
        expect(asBooleans, label).toEqual(bitmap);
      }
    }
  });
});

describe("class floors and weekday pools", () => {
  it("meets the per-class motif floors", () => {
    for (const [size, floor] of CLASS_FLOORS) {
      const count = MOTIFS.filter((motif) => motif.size === size).length;
      expect(count, `size ${String(size)} class`).toBeGreaterThanOrEqual(floor);
    }
  });

  it("gives every weekday a pool of at least MIN_POOL effective entries", () => {
    for (const weekday of WEEKDAYS) {
      expect(
        weekdayPool(weekday).length,
        `weekday ${String(weekday)}`,
      ).toBeGreaterThanOrEqual(MIN_POOL);
    }
  });
});

describe("weekday criteria structure", () => {
  it("is monotone Mon→Sun: size never decreases, band rank orders shared classes", () => {
    for (let index = 1; index < WEEKDAYS.length; index += 1) {
      const previous = NONOGRAM_WEEKDAY_CRITERIA[WEEKDAYS[index - 1] ?? 1];
      const current = NONOGRAM_WEEKDAY_CRITERIA[WEEKDAYS[index] ?? 1];
      expect(current.size).toBeGreaterThanOrEqual(previous.size);
      if (current.size === previous.size) {
        // Same class: the later weekday is the hard band.
        expect(current.minEffort).toBeGreaterThan(previous.minEffort);
      }
    }
  });

  it("partitions each shared class into half-open bands with no gap or overlap", () => {
    const pairs: ReadonlyArray<readonly [1 | 2 | 4 | 6, 3 | 5 | 7]> = [
      [2, 3],
      [4, 5],
      [6, 7],
    ];
    for (const [easyDay, hardDay] of pairs) {
      const easy = NONOGRAM_WEEKDAY_CRITERIA[easyDay];
      const hard = NONOGRAM_WEEKDAY_CRITERIA[hardDay];
      expect(easy.size).toBe(hard.size);
      expect(easy.minEffort).toBe(0);
      expect(easy.maxEffort).toBe(hard.minEffort);
      expect(hard.maxEffort).toBe(Number.POSITIVE_INFINITY);
    }
    // Monday covers its whole class.
    const monday = NONOGRAM_WEEKDAY_CRITERIA[1];
    expect(monday.size).toBe(5);
    expect(monday.minEffort).toBe(0);
    expect(monday.maxEffort).toBe(Number.POSITIVE_INFINITY);
  });
});
