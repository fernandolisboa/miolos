/**
 * Test fixtures for the db suites. The content fixture satisfies
 * binairoDailyContentSchema STRUCTURALLY (that is all the wall parses —
 * binairo rule validity is the engine's concern, proven in
 * packages/games); no @miolos/games dependency here.
 */

export function binairoContentFixture(): Record<string, unknown> {
  const solution = Array.from(
    { length: 64 },
    (_, i) => ((i + Math.floor(i / 8)) % 2) as 0 | 1,
  );
  const givens = solution.map((value, i) => (i % 3 === 0 ? value : null));
  return {
    size: 8,
    seed: 123456,
    weekday: 6,
    givens,
    solution,
    givensCount: givens.filter((value) => value !== null).length,
    requiredTier: 2,
  };
}
