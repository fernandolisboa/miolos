import { createSeededRandom } from "../random";
import { buildLexiconIndex, fillSlots } from "./fill";
import { CROSSWORD_LEXICON } from "./lexicon.generated";
import { deriveSlots, slotCells } from "./slots";
import { CROSSWORD_TEMPLATES, toBlocks } from "./templates";
import { CrosswordGenerationError } from "./types";
import type {
  CrosswordEntry,
  CrosswordLexiconEntry,
  CrosswordPuzzle,
  CrosswordSlot,
} from "./types";

export const CROSSWORD_NODE_BUDGET = 20_000;
export const CROSSWORD_MAX_GENERATION_ATTEMPTS = 8;

function assemble(
  seed: number,
  blocks: ReadonlyArray<ReadonlyArray<boolean>>,
  slots: readonly CrosswordSlot[],
  words: readonly CrosswordLexiconEntry[],
): CrosswordPuzzle {
  const grid = blocks.map((row) => row.map((): string | null => null));
  const entries = slots.map((slot, index): CrosswordEntry => {
    const { normalized, canonical, clue } = words[index]!;
    slotCells(slot, slot.length).forEach(([row, col], k) => {
      grid[row]![col] = normalized[k]!;
    });
    const { number, direction, row, col } = slot;
    return { number, direction, row, col, normalized, canonical, clue };
  });
  return { seed, grid, entries };
}

export function generateFrom(
  seed: number,
  lexicon: readonly CrosswordLexiconEntry[],
): CrosswordPuzzle {
  const normalizedSeed = seed >>> 0;
  const index = buildLexiconIndex(lexicon);
  const seedRng = createSeededRandom(normalizedSeed);

  let attempts = 0;
  while (attempts < CROSSWORD_MAX_GENERATION_ATTEMPTS) {
    attempts += 1;
    const rng = createSeededRandom(Math.floor(seedRng.next() * 0x100000000));
    const template =
      CROSSWORD_TEMPLATES[rng.nextInt(CROSSWORD_TEMPLATES.length)]!;
    const blocks = toBlocks(template);
    const slots = deriveSlots(blocks);
    const words = fillSlots(slots, index, rng, CROSSWORD_NODE_BUDGET);
    if (words !== null) {
      return assemble(normalizedSeed, blocks, slots, words);
    }
  }

  throw new CrosswordGenerationError(normalizedSeed, attempts);
}

export function generateCrossword(seed: number): CrosswordPuzzle {
  return generateFrom(seed, CROSSWORD_LEXICON);
}
