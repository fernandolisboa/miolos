import type { BinairoGrid, BinairoSolvedGrid } from "../../src/binairo/index";

export function grid(spec: string): BinairoGrid {
  return spec
    .split(/\s+/)
    .filter((row) => row.length > 0)
    .flatMap((row) =>
      [...row].map((ch) => {
        if (ch === "0") return 0;
        if (ch === "1") return 1;
        if (ch === ".") return null;
        throw new Error(`bad cell char: ${ch}`);
      }),
    );
}

export function solved(spec: string): BinairoSolvedGrid {
  return grid(spec).map((cell) => {
    if (cell === null) throw new Error("fixture grid is incomplete");
    return cell;
  });
}
