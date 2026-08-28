import { MOTIFS_5 } from "./motifs-5";
import { MOTIFS_8 } from "./motifs-8";
import { MOTIFS_10 } from "./motifs-10";
import { MOTIFS_15 } from "./motifs-15";
import type { NonogramSolution } from "./types";

export interface Motif {
  readonly id: string;

  readonly name: string;
  readonly size: 5 | 8 | 10 | 15;

  readonly mirrorable: boolean;

  readonly rows: ReadonlyArray<string>;
}

export const MOTIFS: ReadonlyArray<Motif> = [
  ...MOTIFS_5,
  ...MOTIFS_8,
  ...MOTIFS_10,
  ...MOTIFS_15,
];

export function motifBitmap(motif: Motif): NonogramSolution {
  return motif.rows.map((row) => [...row].map((ch) => ch === "#"));
}
