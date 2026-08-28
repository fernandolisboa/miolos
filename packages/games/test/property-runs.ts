export const FULL_PROPERTIES = process.env.MIOLOS_FULL_PROPERTIES === "1";

export const PR_GATE_RUNS = 25;

export function propertyRuns(full: number): number {
  return FULL_PROPERTIES ? full : Math.min(full, PR_GATE_RUNS);
}
