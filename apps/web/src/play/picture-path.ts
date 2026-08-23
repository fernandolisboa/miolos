/**
 * The bitmap as ONE `<path>`'s `d`: a unit square per filled cell, in
 * row-major order, inside a `size × size` viewBox.
 *
 * `M{col} {row}h1v1h-1z` — an absolute move to the cell's top-left corner and
 * a closed unit square, so every subpath is independent and the fill rule
 * never has to reconcile overlapping ones.
 *
 * Shared by the daily conclusion and the free-play solved card; it lives in
 * its own module because `conclusion-view` is banned by name inside the
 * free-play import wall, and this builder is pure presentation with nothing
 * the wall exists to keep out.
 */
import type { ConclusionPicture } from "./types";

export function picturePath(picture: ConclusionPicture): string {
  let path = "";
  for (const [index, cell] of picture.cells.entries()) {
    if (cell === 1) {
      const row = Math.floor(index / picture.size);
      const column = index % picture.size;
      path += `M${String(column)} ${String(row)}h1v1h-1z`;
    }
  }
  return path;
}
