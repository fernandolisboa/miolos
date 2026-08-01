import { MOTIFS_5 } from "./motifs-5";
import { MOTIFS_8 } from "./motifs-8";
import { MOTIFS_10 } from "./motifs-10";
import { MOTIFS_15 } from "./motifs-15";
import type { NonogramSolution } from "./types";

/**
 * The curated Nonogram picture library (ADR-0021).
 *
 * Every entry is AI-authored pixel art under these curation constraints:
 *
 * Judged (recorded in ADR-0021):
 * - The subject is a concrete, everyday object/animal/plant/food/tool/
 *   nature/Brazilian-iconography item nameable by a common pt-BR noun.
 * - No letters/digits/text, no brands, no people/faces of real persons,
 *   no offensive, violent, religious or political shapes.
 * - `mirrorable` only when the horizontally mirrored form is still
 *   recognizable as the same subject.
 *
 * Mechanical (enforced by test/nonogram/motifs.test.ts, the content harness):
 * - Exact size×size shape over the alphabet {#, .}; unique ids; non-empty
 *   pt-BR names; `mirrorable` implies the mirrored bitmap differs.
 * - Line-solvable: solveNonogram(deriveClues(bitmap)) is "solved" and
 *   reproduces the bitmap exactly — for the motif AND its mirrored variant.
 * - Class floors and per-weekday pool minimums (plan §4).
 * - Density guideline 30–65% is a warning-level diagnostic, not a gate.
 */
export interface Motif {
  /**
   * Unique kebab-case English id: "anchor". Ids are globally unique across
   * size classes, so when a subject recurs in a larger class the larger
   * entry takes a `-big` suffix (e.g. "owl" 8×8 vs "owl-big" 15×15) —
   * never numeric suffixes or reordered words.
   */
  readonly id: string;
  /** pt-BR display name: "Âncora". */
  readonly name: string;
  readonly size: 5 | 8 | 10 | 15;
  /** Asymmetric AND recognizable when horizontally mirrored. */
  readonly mirrorable: boolean;
  /** "#" = filled, "." = empty; rows.length === size === each row's length. */
  readonly rows: ReadonlyArray<string>;
}

export const MOTIFS: ReadonlyArray<Motif> = [
  ...MOTIFS_5,
  ...MOTIFS_8,
  ...MOTIFS_10,
  ...MOTIFS_15,
];

/** Parse a motif's row strings into the boolean solution bitmap. */
export function motifBitmap(motif: Motif): NonogramSolution {
  return motif.rows.map((row) => [...row].map((ch) => ch === "#"));
}
