export const FORBIDDEN_DAILY_KEYS = [
  "solution",
  "seed",
  "reveal",
  "answer",
  "clueCount",
  "motifId",
  "name",
  "mirrored",

  "canonical",
  "normalized",
] as const;

export function collectKeys(
  value: unknown,
  into: Set<string> = new Set(),
): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectKeys(item, into);
    }
  } else if (value !== null && typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      into.add(key);
      collectKeys(nested, into);
    }
  }
  return into;
}
