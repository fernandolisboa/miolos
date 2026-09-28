import type { SeededRandom } from "../random";
import { slotCells } from "./slots";
import type { CrosswordLexiconEntry, CrosswordSlot } from "./types";

const ALPHABET_SIZE = 26;
const LOWERCASE_A = 97;

interface LengthBucket {
  readonly words: readonly CrosswordLexiconEntry[];
  readonly chunks: number;
  readonly all: Uint32Array;
  readonly byPositionLetter: Uint32Array;
}

export type CrosswordLexiconIndex = ReadonlyMap<number, LengthBucket>;

interface SlotState {
  readonly cells: readonly number[];
  readonly bucket: LengthBucket;
  readonly used: Uint32Array;
  readonly candidates: Uint32Array;
  entry: CrosswordLexiconEntry | undefined;
}

function letterAt(word: string, position: number): number {
  const letter = word.charCodeAt(position) - LOWERCASE_A;
  if (!(letter >= 0 && letter < ALPHABET_SIZE)) {
    throw new RangeError(`lexicon word ${JSON.stringify(word)} is not a-z`);
  }
  return letter;
}

function bucketOf(
  length: number,
  words: readonly CrosswordLexiconEntry[],
): LengthBucket {
  const chunks = Math.ceil(words.length / 32);
  const all = new Uint32Array(chunks);
  const byPositionLetter = new Uint32Array(length * ALPHABET_SIZE * chunks);
  words.forEach((entry, id) => {
    const chunk = id >>> 5;
    const bit = 1 << (id & 31);
    all[chunk]! |= bit;
    for (let position = 0; position < length; position += 1) {
      const letter = letterAt(entry.normalized, position);
      byPositionLetter[(position * ALPHABET_SIZE + letter) * chunks + chunk]! |=
        bit;
    }
  });
  return { words, chunks, all, byPositionLetter };
}

export function buildLexiconIndex(
  lexicon: readonly CrosswordLexiconEntry[],
): CrosswordLexiconIndex {
  const byLength = new Map<number, CrosswordLexiconEntry[]>();
  for (const entry of lexicon) {
    const words = byLength.get(entry.normalized.length) ?? [];
    words.push(entry);
    byLength.set(entry.normalized.length, words);
  }
  return new Map(
    [...byLength].map(([length, words]) => [length, bucketOf(length, words)]),
  );
}

function popcount(mask: Uint32Array): number {
  let count = 0;
  for (const chunk of mask) {
    let v = chunk - ((chunk >>> 1) & 0x55555555);
    v = (v & 0x33333333) + ((v >>> 2) & 0x33333333);
    count += Math.imul((v + (v >>> 4)) & 0x0f0f0f0f, 0x01010101) >>> 24;
  }
  return count;
}

function idsOf(mask: Uint32Array): number[] {
  const ids: number[] = [];
  mask.forEach((chunk, index) => {
    let rest = chunk;
    while (rest !== 0) {
      const low = rest & -rest;
      ids.push(index * 32 + 31 - Math.clz32(low));
      rest ^= low;
    }
  });
  return ids;
}

function countCandidates(state: SlotState, letters: Int8Array): number {
  const { cells, bucket, used, candidates } = state;
  const { chunks, all, byPositionLetter } = bucket;
  for (let k = 0; k < chunks; k += 1) {
    candidates[k] = all[k]! & ~used[k]!;
  }
  for (let position = 0; position < cells.length; position += 1) {
    const letter = letters[cells[position]!]!;
    if (letter >= 0) {
      const base = (position * ALPHABET_SIZE + letter) * chunks;
      for (let k = 0; k < chunks; k += 1) {
        candidates[k]! &= byPositionLetter[base + k]!;
      }
    }
  }
  return popcount(candidates);
}

// Backtracking fill: always branch on the slot with the fewest candidates (MRV),
// counted by intersecting per-(position, letter) bitsets of the lexicon.
export function fillSlots(
  slots: readonly CrosswordSlot[],
  index: CrosswordLexiconIndex,
  rng: SeededRandom,
  nodeBudget: number,
): CrosswordLexiconEntry[] | null {
  const width = Math.max(
    ...slots.map((slot) => Math.max(slot.row, slot.col) + slot.length),
  );
  const letters = new Int8Array(width * width).fill(-1);
  const used = new Map(
    [...index].map(([length, bucket]) => [
      length,
      new Uint32Array(bucket.chunks),
    ]),
  );
  const states: SlotState[] = [];
  for (const slot of slots) {
    const bucket = index.get(slot.length);
    const usedOfLength = used.get(slot.length);
    if (bucket === undefined || usedOfLength === undefined) {
      return null;
    }
    states.push({
      cells: slotCells(slot, slot.length).map(
        ([row, col]) => row * width + col,
      ),
      bucket,
      used: usedOfLength,
      candidates: new Uint32Array(bucket.chunks),
      entry: undefined,
    });
  }
  let nodes = 0;

  const search = (): boolean => {
    let best: SlotState | undefined;
    let bestCount = Number.POSITIVE_INFINITY;
    for (const state of states) {
      if (state.entry === undefined) {
        const count = countCandidates(state, letters);
        if (count < bestCount) {
          best = state;
          bestCount = count;
          if (count === 0) {
            return false;
          }
        }
      }
    }
    if (best === undefined) {
      return true;
    }
    const { cells, bucket, used: usedOfLength } = best;
    const ids = idsOf(best.candidates);
    for (let i = 0; i < ids.length; i += 1) {
      nodes += 1;
      if (nodes > nodeBudget) {
        return false;
      }
      const j = i + rng.nextInt(ids.length - i);
      const id = ids[j]!;
      ids[j] = ids[i]!;
      ids[i] = id;

      const entry = bucket.words[id]!;
      const placed = cells.filter((cell) => letters[cell] === -1);
      cells.forEach((cell, position) => {
        letters[cell] = letterAt(entry.normalized, position);
      });
      usedOfLength[id >>> 5]! |= 1 << (id & 31);
      best.entry = entry;

      if (search()) {
        return true;
      }

      best.entry = undefined;
      usedOfLength[id >>> 5]! &= ~(1 << (id & 31));
      for (const cell of placed) {
        letters[cell] = -1;
      }
    }
    return false;
  };

  return search()
    ? states.map((state) => state.entry).filter((entry) => entry !== undefined)
    : null;
}
