import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import HojePage from "../app/page";
import { messages } from "../src/i18n";
import { DAY_GAMES } from "../src/play/day-games";
import { bodyOf, decl, stylesheet } from "./css-source";

const css = stylesheet("app/page.module.css");
const wide = bodyOf(css, "@media (min-width: 1280px)");
const phone = bodyOf(css, "@media (max-width: 768px)");
const ODD_LAST = ".card:last-child:nth-child(odd)";

function rowsOf(count: number, max: number): number[] {
  const rows = Math.ceil(count / max);
  const perRow = Math.ceil(count / rows);
  return Array.from({ length: rows }, (_, row) =>
    Math.min(perRow, count - row * perRow),
  );
}

describe("the hub's cards wrap into balanced, centred rows of at most seven (T-WEB-S1096)", () => {
  it("derives the row length from the card count alone", () => {
    const games = bodyOf(css, ".games");
    expect(decl(games, "--max-per-row")).toBe("4");
    expect(decl(games, "--rows")).toBe(
      "round(up, var(--card-count) / var(--max-per-row), 1)",
    );
    expect(decl(games, "--per-row")).toBe(
      "round(up, var(--card-count) / var(--rows), 1)",
    );
    expect(decl(bodyOf(wide, ".games"), "--max-per-row")).toBe("7");
  });

  it("wraps and centres the rows, capped so a short row stays a row of cards", () => {
    const games = bodyOf(css, ".games");
    expect(decl(games, "display")).toBe("flex");
    expect(decl(games, "flex-wrap")).toBe("wrap");
    expect(decl(games, "justify-content")).toBe("center");
    expect(decl(games, "inline-size")).toBe("100%");
    expect(decl(games, "max-inline-size")?.replace(/\s+/g, " ")).toBe(
      "calc( var(--per-row) * 230px + (var(--per-row) - 1) * var(--card-gap) )",
    );
  });

  it("gives each card exactly its share of the row, whatever its content", () => {
    const card = bodyOf(css, ".card");
    expect(decl(card, "box-sizing")).toBe("border-box");
    expect(decl(card, "min-inline-size")).toBe("0");
    expect(decl(card, "flex")?.replace(/\s+/g, " ")).toBe(
      "0 0 calc( (100% - (var(--per-row) - 1) * var(--card-gap)) / var(--per-row) - 0.1px )",
    );
  });

  it.each([4, 7])(
    "never leaves a card alone on a row from 2 to 12 cards (max %i)",
    (max) => {
      for (let count = 2; count <= 12; count += 1) {
        const rows = rowsOf(count, max);
        expect(rows.length, `${String(count)} cards`).toBe(
          Math.ceil(count / max),
        );
        expect(Math.max(...rows), `${String(count)} cards`).toBeLessThanOrEqual(
          max,
        );
        expect(rows.at(-1), `${String(count)} cards`).toBeGreaterThan(1);
      }
    },
  );

  it("holds every card count up to seven on one row at the wide breakpoint", () => {
    for (let count = 1; count <= 7; count += 1) {
      expect(rowsOf(count, 7)).toEqual([count]);
    }
  });

  it("lays a phone out in two columns, an odd last card across both as a row with its tagline", () => {
    expect(decl(bodyOf(phone, ".games"), "display")).toBe("grid");
    expect(decl(bodyOf(phone, ".games"), "grid-template-columns")).toBe(
      "repeat(2, minmax(0, 1fr))",
    );
    expect(decl(bodyOf(phone, ODD_LAST), "grid-column")).toBe("1 / -1");
    expect(decl(bodyOf(phone, ODD_LAST), "flex-direction")).toBe("row");
    expect(decl(bodyOf(phone, ".cardDescription"), "display")).toBe("none");
    expect(decl(bodyOf(phone, `${ODD_LAST} .cardDescription`), "display")).toBe(
      "block",
    );
  });

  it("keeps the button and the done stamp in one box on one line", () => {
    expect(decl(bodyOf(css, ".cta"), "box-sizing")).toBe("border-box");
    expect(decl(bodyOf(css, ".done"), "white-space")).toBe("nowrap");
  });
});

describe("the hub renders one taped card per daily, each with its thumbnail (T-WEB-S1097)", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.example.test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("tells the grid how many cards it holds, in the lineup's order", () => {
    const page = new DOMParser().parseFromString(
      renderToStaticMarkup(<HojePage />),
      "text/html",
    );
    const cards = [...page.querySelectorAll("article")];
    const grid = cards[0]?.parentElement;

    expect(grid?.getAttribute("style")).toBe(
      `--card-count:${String(DAY_GAMES.length)}`,
    );
    expect(cards.map((card) => card.querySelector("h2")?.textContent)).toEqual(
      DAY_GAMES.map((game) => messages.games[game].name),
    );
    for (const card of cards) {
      const thumbnails = card.querySelectorAll('[aria-hidden="true"] > svg');
      expect(thumbnails).toHaveLength(1);
    }
  });
});
