export function hasHintLeft(used: number, allowance: number | null): boolean {
  return allowance !== null && used < allowance;
}
