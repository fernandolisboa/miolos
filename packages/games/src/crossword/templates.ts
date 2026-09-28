export const CROSSWORD_SIZE = 5;

export const CROSSWORD_TEMPLATES: ReadonlyArray<ReadonlyArray<string>> = [
  ["##...", "#....", ".....", "....#", "...##"],
  ["...##", "....#", ".....", "#....", "##..."],
  ["#....", ".....", ".....", ".....", "....#"],
  ["#...#", ".....", ".....", ".....", "#...#"],
];

export function toBlocks(
  rows: ReadonlyArray<string>,
): ReadonlyArray<ReadonlyArray<boolean>> {
  return rows.map((row) => [...row].map((cell) => cell === "#"));
}
