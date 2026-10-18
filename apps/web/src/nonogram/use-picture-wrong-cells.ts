import { useMemo } from "react";

import type { MistakeState } from "../play/mistakes";
import { useWrongCells } from "../play/use-wrong-cells";
import { useSettings } from "../settings/settings";
import { formedWrongCells, type Formed, type LineClues } from "./line-cross";

export function usePictureWrongCells<M extends number, Run>(
  clues: LineClues<Run>,
  solution: readonly M[] | null,
  entries: readonly (M | null)[],
  mistakes: MistakeState,
  formed: Formed<M, Run>,
): ReadonlySet<number> {
  const wrong = useWrongCells("nonogram", solution, null, entries, mistakes);
  const flag = useSettings().games.nonogram.lineCross === "flag";
  return useMemo(() => {
    if (!flag) {
      return wrong;
    }
    const flagged = formedWrongCells(clues, solution, entries, formed);
    return flagged.size === 0 ? wrong : new Set([...wrong, ...flagged]);
  }, [flag, wrong, clues, solution, entries, formed]);
}
