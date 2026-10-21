import { coloredRuns } from "./clues";
import { coloredLines } from "./solve";
import type { ColoredNonogramClues, ColoredRun } from "./types";

type Mark = number | null;

function closedRunsFromStart(
  marks: readonly Mark[],
  runs: readonly ColoredRun[],
): number {
  let placed = 0;
  let k = 0;
  while (k < marks.length && marks[k] !== null) {
    const tone = marks[k];
    if (tone === 0) {
      k += 1;
      continue;
    }
    let end = k;
    while (marks[end] === tone) {
      end += 1;
    }
    const run = runs[placed];
    const closed = end === marks.length || marks[end] !== null;
    if (
      !closed ||
      run === undefined ||
      run.tone !== tone ||
      end - k !== run.length
    ) {
      break;
    }
    placed += 1;
    k = end;
  }
  return placed;
}

function contradicted(
  marks: readonly Mark[],
  runs: readonly ColoredRun[],
): boolean {
  const room = new Map<number, number>();
  const longest = new Map<number, number>();
  for (const { tone, length } of runs) {
    room.set(tone, (room.get(tone) ?? 0) + length);
    longest.set(tone, Math.max(longest.get(tone) ?? 0, length));
  }
  let groups = 0;
  let last = 0;
  let block = 0;
  for (const [k, mark] of marks.entries()) {
    if (mark === null) {
      continue;
    }
    if (mark === 0) {
      last = 0;
      continue;
    }
    if (mark !== last) {
      groups += 1;
      last = mark;
    }
    block = marks[k - 1] === mark ? block + 1 : 1;
    room.set(mark, (room.get(mark) ?? 0) - 1);
    if (block > (longest.get(mark) ?? 0) || (room.get(mark) ?? 0) < 0) {
      return true;
    }
  }
  return groups > runs.length;
}

export function formsColoredClue(
  marks: readonly Mark[],
  runs: readonly ColoredRun[],
): boolean {
  const blocks = coloredRuns(marks.map((mark) => mark ?? 0));
  return (
    blocks.length === runs.length &&
    blocks.every(
      ({ tone, length }, at) =>
        tone === runs[at]?.tone && length === runs[at].length,
    )
  );
}

export function placedColoredRuns(
  marks: readonly Mark[],
  runs: readonly ColoredRun[],
): readonly boolean[] {
  if (formsColoredClue(marks, runs)) {
    return runs.map(() => true);
  }
  if (!marks.includes(null) || contradicted(marks, runs)) {
    return runs.map(() => false);
  }
  const fromStart = closedRunsFromStart(marks, runs);
  const fromEnd = closedRunsFromStart(
    [...marks].reverse(),
    [...runs].reverse(),
  );
  return runs.map((_, i) => i < fromStart || i >= runs.length - fromEnd);
}

export function placedColoredClues(
  clues: ColoredNonogramClues,
  marks: readonly Mark[],
): {
  readonly rows: readonly (readonly boolean[])[];
  readonly cols: readonly (readonly boolean[])[];
} {
  const placed = coloredLines(clues).map(({ cells, runs }) =>
    placedColoredRuns(
      cells.map((cell) => marks[cell] ?? null),
      runs,
    ),
  );
  return { rows: placed.slice(0, clues.size), cols: placed.slice(clues.size) };
}
