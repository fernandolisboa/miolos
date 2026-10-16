import { useMemo } from "react";

import { useSettings, type SettingsGame } from "../settings/settings";
import { wrongCells } from "./grid-hint";

const NONE: ReadonlySet<number> = new Set();

export function useWrongCells<T>(
  game: Exclude<SettingsGame, "minesweeper">,
  solution: readonly (T | null)[] | null,
  givens: readonly unknown[] | null,
  entries: readonly (T | null)[],
): ReadonlySet<number> {
  const show = useSettings().games[game].showErrors;
  return useMemo(
    () =>
      show && solution !== null ? wrongCells(solution, givens, entries) : NONE,
    [show, solution, givens, entries],
  );
}
