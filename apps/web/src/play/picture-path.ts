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
