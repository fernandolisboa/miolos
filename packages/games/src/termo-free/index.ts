import { createSeededRandom } from "../random";
import { FREE_POOL_CANONICALS } from "./pool.generated";

export function drawFreeTermoWords(seed: number, count: number): string[] {
  const pool = FREE_POOL_CANONICALS.split("\n");
  if (!Number.isInteger(count) || count < 1 || count > pool.length) {
    throw new RangeError(
      `count must be 1 to ${String(pool.length)}, got ${String(count)}`,
    );
  }
  const random = createSeededRandom(seed);
  const words = new Set<string>();
  while (words.size < count) {
    words.add(pool[random.nextInt(pool.length)]!);
  }
  return [...words];
}
