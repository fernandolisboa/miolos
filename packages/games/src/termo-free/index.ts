import { createSeededRandom } from "../random";
import { FREE_POOL_CANONICALS } from "./pool.generated";

export function drawFreeTermoWord(seed: number): string {
  const pool = FREE_POOL_CANONICALS.split("\n");
  return pool[createSeededRandom(seed).nextInt(pool.length)]!;
}
