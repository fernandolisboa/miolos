import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { renderNonogramTonesModule } from "../../scripts/render-nonogram-tones";
import { motifTones } from "../../src/nonogram-colors";
import { TONES_5 } from "../../src/nonogram/colors-5";
import { TONES_8 } from "../../src/nonogram/colors-8";
import { TONES_10 } from "../../src/nonogram/colors-10";
import { TONES_15 } from "../../src/nonogram/colors-15";
import { MOTIFS } from "../../src/nonogram/motifs";
import { PICTURE_TONES } from "../../src/nonogram/tones";

const CLASSES = [
  [5, TONES_5],
  [8, TONES_8],
  [10, TONES_10],
  [15, TONES_15],
] as const;

const PALETTE = new Set<string>(PICTURE_TONES);

const mask = (tones: string): string => tones.replace(/[^.]/g, "#");

describe("motif tones", () => {
  it("cover each class's motifs exactly, with no orphan entry", () => {
    for (const [size, tones] of CLASSES) {
      const ids = MOTIFS.filter((motif) => motif.size === size).map(
        (motif) => motif.id,
      );
      expect(Object.keys(tones).sort()).toEqual([...ids].sort());
    }
  });

  it("paint every filled cell from the palette and leave every empty cell empty", () => {
    const offenders = MOTIFS.filter((motif) => {
      const rows = CLASSES.find(([size]) => size === motif.size)?.[1][motif.id];
      return !(
        rows?.length === motif.size &&
        rows.every((row, y) => {
          const shape = motif.rows[y] ?? "";
          return (
            row.length === shape.length &&
            [...row].every((tone, x) =>
              shape[x] === "#" ? PALETTE.has(tone) : tone === ".",
            )
          );
        })
      );
    }).map((motif) => motif.id);
    expect(offenders).toEqual([]);
  });

  it("tones.generated.ts is byte-identical to the renderer output", () => {
    expect(
      readFileSync(
        join(
          import.meta.dirname,
          "../../src/nonogram-colors/tones.generated.ts",
        ),
        "utf8",
      ),
      "stale: run `pnpm --filter @miolos/games generate:nonogram` after editing src/nonogram/colors-*.ts",
    ).toBe(renderNonogramTonesModule(CLASSES.map(([, tones]) => tones)));
  });

  it("decode to the authored rows, and mirror with the picture", () => {
    for (const motif of MOTIFS) {
      const rows =
        CLASSES.find(([size]) => size === motif.size)?.[1][motif.id] ?? [];
      expect(motifTones(motif.id, false), motif.id).toBe(rows.join(""));
      expect(motifTones(motif.id, true), motif.id).toBe(
        rows.map((row) => [...row].reverse().join("")).join(""),
      );
      expect(mask(motifTones(motif.id, true) ?? "")).toBe(
        motif.rows.map((row) => [...row].reverse().join("")).join(""),
      );
    }
  });

  it("are absent for an unknown or inherited id", () => {
    expect(motifTones("no-such-motif", false)).toBeUndefined();
    expect(motifTones("constructor", false)).toBeUndefined();
    expect(motifTones("toString", true)).toBeUndefined();
  });
});
