import { describe, expect, it } from "vitest";

import { generateCrossword } from "../../src/crossword/generate";
import { CROSSWORD_LEXICON } from "../../src/crossword/lexicon.generated";
import { deriveSlots } from "../../src/crossword/slots";
import { toBlocks } from "../../src/crossword/templates";
import type {
  CrosswordEntry,
  CrosswordPuzzle,
} from "../../src/crossword/types";
import { validateCrossword } from "../../src/crossword/validate";

const puzzle = generateCrossword(42);

function allLetterA(rows: readonly string[]): CrosswordPuzzle {
  const grid = rows.map((row) =>
    [...row].map((cell) => (cell === "#" ? null : "a")),
  );
  const entries: CrosswordEntry[] = deriveSlots(toBlocks(rows)).map(
    ({ length, ...slot }) => ({
      ...slot,
      normalized: "a".repeat(length),
      canonical: "a".repeat(length),
      clue: "A",
    }),
  );
  return { seed: 0, grid, entries };
}

function withEntry(
  index: number,
  change: (entry: CrosswordEntry) => CrosswordEntry,
): CrosswordPuzzle {
  return {
    ...puzzle,
    entries: puzzle.entries.map((entry, i) =>
      i === index ? change(entry) : entry,
    ),
  };
}

function sameLengthOther(entry: CrosswordEntry, avoid: ReadonlySet<string>) {
  const other = CROSSWORD_LEXICON.find(
    (row) =>
      row.normalized.length === entry.normalized.length &&
      !avoid.has(row.normalized),
  );
  if (other === undefined) {
    throw new Error("fixture needs a second word of the same length");
  }
  return other;
}

describe("validateCrossword", () => {
  it("approves a generated puzzle", () => {
    expect(validateCrossword(puzzle)).toEqual({ ok: true, failures: [] });
  });

  it("rejects a grid of the wrong size or with a non a-z cell", () => {
    expect(
      validateCrossword({ ...puzzle, grid: puzzle.grid.slice(1) }).failures,
    ).toEqual(["grid-shape"]);
    const grid = puzzle.grid.map((row, r) =>
      row.map((cell, c) => (r === 2 && c === 2 ? "É" : cell)),
    );
    expect(validateCrossword({ ...puzzle, grid }).failures).toEqual([
      "grid-shape",
    ]);
  });

  it("rejects entries out of slot order", () => {
    const [first, second, ...rest] = puzzle.entries;
    if (first === undefined || second === undefined) {
      throw new Error("fixture needs two entries");
    }
    expect(
      validateCrossword({ ...puzzle, entries: [second, first, ...rest] })
        .failures,
    ).toContain("entries-mismatch");
  });

  it("rejects a two-letter entry, and only where one exists", () => {
    const twoLetter = allLetterA([".....", ".....", ".....", ".....", "###.."]);
    expect(validateCrossword(twoLetter).failures).toContain("entry-too-short");
    const control = allLetterA(["#...#", ".....", ".....", ".....", "#...#"]);
    expect(validateCrossword(control).failures).not.toContain(
      "entry-too-short",
    );
  });

  it("rejects an unchecked cell, and only where one exists", () => {
    const diamond = allLetterA(["##.##", "#...#", ".....", "#...#", "##.##"]);
    expect(validateCrossword(diamond).failures).toContain("unchecked-cell");
    const control = allLetterA(["#...#", ".....", ".....", ".....", "#...#"]);
    expect(validateCrossword(control).failures).not.toContain("unchecked-cell");
  });

  it("rejects a grid letter that disagrees with its entries", () => {
    const grid = puzzle.grid.map((row, r) =>
      row.map((cell, c) => {
        if (r !== 2 || c !== 2 || cell === null) {
          return cell;
        }
        return cell === "z" ? "y" : "z";
      }),
    );
    expect(validateCrossword({ ...puzzle, grid }).failures).toEqual([
      "letters-mismatch",
    ]);
  });

  it("rejects an entry that is not an exact lexicon row", () => {
    const tampered = withEntry(0, (entry) => ({
      ...entry,
      clue: `${entry.clue}!`,
    }));
    expect(validateCrossword(tampered).failures).toEqual(["not-in-lexicon"]);
  });

  it("rejects a repeated word, and not a merely wrong one", () => {
    const first = puzzle.entries[0];
    const index = puzzle.entries.findIndex(
      (entry, i) =>
        i > 0 && entry.normalized.length === first?.normalized.length,
    );
    if (first === undefined || index === -1) {
      throw new Error("fixture needs two entries of one length");
    }
    const repeated = withEntry(index, (entry) => ({
      ...entry,
      normalized: first.normalized,
      canonical: first.canonical,
      clue: first.clue,
    }));
    expect(validateCrossword(repeated).failures).toContain("duplicate-word");

    const inPuzzle = new Set(puzzle.entries.map((entry) => entry.normalized));
    const wrong = withEntry(index, (entry) => ({
      ...entry,
      ...sameLengthOther(entry, inPuzzle),
    }));
    expect(validateCrossword(wrong).failures).not.toContain("duplicate-word");
  });
});
