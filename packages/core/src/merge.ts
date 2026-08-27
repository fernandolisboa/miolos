import type { CompletionOutcome } from "./completion";
import type { Game } from "./game";

export interface MergeableCompletion {
  readonly game: Game;

  readonly date: string;
  readonly outcome: CompletionOutcome;
  readonly onTime: boolean;

  readonly completedAtOrder: string;
}

function keyOf(completion: MergeableCompletion): string {
  return `${completion.game}:${completion.date}`;
}

export function mergeCompletions(
  canonical: readonly MergeableCompletion[],
  other: readonly MergeableCompletion[],
): MergeableCompletion[] {
  const kept = new Map<string, MergeableCompletion>();

  for (const row of [...canonical, ...other]) {
    const key = keyOf(row);
    const current = kept.get(key);
    if (
      current === undefined ||
      row.completedAtOrder < current.completedAtOrder
    ) {
      kept.set(key, row);
    }
  }
  return [...kept.values()].sort((a, b) => {
    if (a.date !== b.date) {
      return a.date < b.date ? -1 : 1;
    }
    return a.game < b.game ? -1 : a.game > b.game ? 1 : 0;
  });
}
