import type { Game } from "@miolos/core";

export function tileFor(game: Game): HTMLElement {
  const shown = [
    ...document.querySelectorAll<HTMLElement>(
      `[data-hub-card="${game}"], [data-hub-done="${game}"]`,
    ),
  ].filter((tile) => tile.closest("[hidden]") === null);
  const [tile] = shown;
  if (shown.length !== 1 || tile === undefined) {
    throw new Error(`${String(shown.length)} visible tiles for ${game}`);
  }
  return tile;
}

export const shownCards = (): HTMLElement[] =>
  [...document.querySelectorAll<HTMLElement>("[data-hub-card]")].filter(
    (card) => card.closest("[hidden]") === null,
  );
