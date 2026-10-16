import type { LineCells } from "../nonogram/lines";
import type { PictureTone } from "../nonogram/tones";

export interface ColoredRun {
  readonly tone: number;
  readonly length: number;
}

export interface ColoredNonogramClues {
  readonly size: number;
  readonly palette: readonly PictureTone[];
  readonly rows: readonly (readonly ColoredRun[])[];
  readonly cols: readonly (readonly ColoredRun[])[];
}

export interface ColoredNonogramPuzzle {
  readonly seed: number;
  readonly size: number;
  readonly clues: ColoredNonogramClues;
  readonly solution: readonly number[];
  readonly tones: string;
}

export interface ColoredLineSpec extends LineCells {
  readonly runs: readonly ColoredRun[];
}

export interface ColoredNonogramStep extends ColoredLineSpec {
  readonly index: number;
  readonly value: number;
}
