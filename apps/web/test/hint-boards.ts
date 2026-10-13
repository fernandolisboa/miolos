import { WEEKDAYS, type Weekday } from "@miolos/games";

export function onEveryWeekday<T>(
  seeds: number,
  make: (seed: number, weekday: Weekday) => T,
): readonly T[] {
  const spread = Array.from(
    { length: seeds },
    (_unused, index) => ((index + 1) * 2_654_435_761) >>> 0,
  );
  return WEEKDAYS.flatMap((weekday) =>
    spread.map((seed) => make(seed, weekday)),
  );
}

export function correctPartial<T>(
  solution: readonly T[],
  seed: number,
): readonly (T | null)[] {
  let state = seed;
  return solution.map((value) => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state % 3 === 0 ? value : null;
  });
}
