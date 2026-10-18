export type AutoCrosses = ReadonlyMap<number, ReadonlySet<number>>;

export interface Claim {
  readonly owner: number;
  readonly cells: Iterable<number>;
}

export const NO_AUTO_CROSSES: AutoCrosses = new Map();

export function released(
  claims: AutoCrosses,
  entries: (number | null)[],
  stands: (owner: number) => boolean,
): Map<number, Set<number>> {
  const owners = new Map<number, Set<number>>();
  for (const [cell, by] of claims) {
    if (entries[cell] !== 0) {
      continue;
    }
    const kept = new Set([...by].filter(stands));
    if (kept.size > 0) {
      owners.set(cell, kept);
    } else {
      entries[cell] = null;
    }
  }
  return owners;
}

export function claim(
  claims: Iterable<Claim>,
  entries: (number | null)[],
  owners: Map<number, Set<number>>,
): void {
  for (const { owner, cells } of claims) {
    for (const cell of cells) {
      const claimed = owners.get(cell);
      if (claimed !== undefined) {
        claimed.add(owner);
      } else if (entries[cell] === null) {
        entries[cell] = 0;
        owners.set(cell, new Set([owner]));
      }
    }
  }
}
