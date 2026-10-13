import { lineIndices } from "./internal";
import {
  applyTier1,
  applyTier2,
  isComplete,
  stateFromGrid,
} from "./techniques";
import type { Visitor } from "./techniques";
import type { BinairoGrid, BinairoRule } from "./types";

export interface BinairoLine {
  readonly kind: "row" | "column";
  readonly index: number;
}

export interface BinairoStep {
  readonly index: number;
  readonly value: 0 | 1;
  readonly rule: BinairoRule;
  readonly line: BinairoLine | null;
  readonly twin: number | null;
  readonly cells: readonly number[];
}

function witnessCells(
  n: number,
  rule: BinairoRule,
  isRow: boolean,
  witness: number,
): number[] {
  const stride = isRow ? 1 : n;
  switch (rule) {
    case "pair":
      return [witness, witness + stride];
    case "gap":
      return [witness, witness + 2 * stride];
    case "count":
    case "duplicate":
      return lineIndices(n, isRow, witness);
    case "lookahead":
      return [];
  }
}

export function nextBinairoStep(grid: BinairoGrid): BinairoStep | null {
  const state = stateFromGrid(grid);
  if (state === null || isComplete(state)) {
    return null;
  }
  const { n } = state;
  let step: BinairoStep | null = null;
  const record: Visitor = (index, value, rule, isRow, witness) => {
    step = {
      index,
      value,
      rule,
      line:
        rule === "lookahead"
          ? null
          : {
              kind: isRow ? "row" : "column",
              index: isRow ? Math.floor(index / n) : index % n,
            },
      twin: rule === "duplicate" ? witness : null,
      cells: witnessCells(n, rule, isRow, witness),
    };
    return "stop";
  };
  if (applyTier1(state, record) === "none") {
    applyTier2(state, record);
  }
  return step;
}
