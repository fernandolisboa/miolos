import { useMemo } from "react";

import { useSettings, type SettingsGame } from "../settings/settings";
import { wrongCells } from "./grid-hint";
import type { MistakeState } from "./mistakes";

const NONE: ReadonlySet<number> = new Set();

export function useWrongCells<T>(
  game: Exclude<SettingsGame, "minesweeper">,
  solution: readonly (T | null)[] | null,
  givens: readonly unknown[] | null,
  entries: readonly (T | null)[],
  mistakes: MistakeState,
): ReadonlySet<number> {
  const settings = useSettings();
  const show = settings.games[game].showErrors;
  const limit = settings.mistakeLimit;
  return useMemo(() => {
    if (solution === null || (!show && !limit)) {
      return NONE;
    }
    const wrong = wrongCells(solution, givens, entries);
    if (show) {
      return wrong;
    }
    const held = mistakes.held?.index;
    return new Set(
      mistakes.cells.filter((cell) => cell !== held && wrong.has(cell)),
    );
  }, [show, limit, solution, givens, entries, mistakes]);
}
