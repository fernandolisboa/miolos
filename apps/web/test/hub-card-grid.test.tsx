import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import HojePage from "../app/page";
import { messages } from "../src/i18n";
import { DAY_GAMES } from "../src/play/day-games";
import { bodyOf, decl, stylesheet } from "./css-source";

const css = stylesheet("app/page.module.css");
const wide = bodyOf(css, "@media (min-width: 1280px)");
const phone = bodyOf(css, "@media (max-width: 768px)");
const desktop = bodyOf(css, "@media (width > 768px)");
const rounded = bodyOf(
  bodyOf(css, "@supports (inline-size: round(up, 1px, 1px))"),
  "@media (width > 768px)",
);
const wideCard = bodyOf(css, "@container (min-width: 400px)");
const ODD_LAST =
  ".card:nth-last-child(1 of :not([hidden])):nth-child(odd of :not([hidden]))";

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

  it("wraps and centres the rows across the whole content box, uncapped", () => {
    const games = bodyOf(css, ".games");
    expect(decl(games, "display")).toBe("flex");
    expect(decl(games, "flex-wrap")).toBe("wrap");
    expect(decl(games, "justify-content")).toBe("center");
    expect(decl(games, "max-inline-size")).toBeUndefined();
    expect(decl(games, "margin")).toBeUndefined();
    expect(decl(bodyOf(wide, ".games"), "max-inline-size")).toBeUndefined();
  });

  it("gives each card exactly its share of the row, whatever its content", () => {
    const card = bodyOf(css, ".card");
    expect(decl(card, "box-sizing")).toBe("border-box");
    expect(decl(card, "min-inline-size")).toBe("0");
    expect(
      decl(card, "max-inline-size"),
      "a capped card lets flex fit more cards on a line than --per-row",
    ).toBeUndefined();
    expect(decl(card, "flex")?.replace(/\s+/g, " ")).toBe(
      "0 0 calc( (100% - (var(--per-row) - 1) * var(--card-gap)) / var(--per-row) - 0.1px )",
    );
  });

  it.each([4, 7])(
    "the formula above leaves no card alone on a row from 2 to 12 cards, as ADR-0156 claims (max %i)",
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

  it("lays a phone out in two columns, an odd last card across both as a row with its tagline", () => {
    expect(decl(bodyOf(phone, ".games"), "display")).toBe("grid");
    expect(decl(bodyOf(phone, ".games"), "grid-template-columns")).toBe(
      "repeat(2, minmax(0, 1fr))",
    );
    expect(decl(bodyOf(phone, ODD_LAST), "grid-column")).toBe("1 / -1");
    expect(decl(bodyOf(phone, ODD_LAST), "flex-direction")).toBe("row");
    expect(decl(bodyOf(phone, ".cardDescription"), "display")).toBe("none");
    expect(
      decl(bodyOf(phone, `${ODD_LAST}\n    .cardDescription`), "display"),
    ).toBe("block");
  });

  it("keeps the button and the done stamp in one box on one line", () => {
    expect(decl(bodyOf(css, ".cta"), "box-sizing")).toBe("border-box");
    expect(decl(bodyOf(css, ".done"), "white-space")).toBe("nowrap");
    expect(decl(bodyOf(css, ".action"), "margin-top")).toBe("auto");
  });
});

describe("a desktop card wider than 400px lays out as a row, and its tilt eases on short rows (T-WEB-S1104)", () => {
  it("makes the card a grid whose two children span both columns, so a narrow card stays a column", () => {
    const card = bodyOf(desktop, ".card");
    expect(decl(card, "display")).toBe("grid");
    expect(decl(card, "grid-template")).toBe("auto 1fr / auto minmax(0, 1fr)");
    expect(decl(card, "justify-items")).toBe("center");
    for (const child of [".thumb", ".cardBody"]) {
      expect(decl(bodyOf(desktop, child), "grid-column"), child).toBe("1 / -1");
    }
    expect(decl(bodyOf(desktop, ".cardBody"), "justify-self")).toBe("stretch");
  });

  it("measures the card and eases its tilt only where round() exists", () => {
    const card = bodyOf(rounded, ".card");
    expect(decl(card, "container-type")).toBe("inline-size");
    expect(decl(card, "transform")).toBe(
      "rotate(calc(var(--tilt) * min(1, var(--per-row) / 4)))",
    );
    expect(decl(bodyOf(desktop, ".card"), "container-type")).toBeUndefined();
    expect(decl(bodyOf(desktop, ".card"), "transform")).toBeUndefined();
    expect(decl(bodyOf(css, ".card"), "transform")).toBe("rotate(var(--tilt))");
  });

  it("puts the thumbnail beside the body, start-aligned, the button at its own width", () => {
    expect(decl(bodyOf(wideCard, ".thumb"), "grid-area")).toBe(
      "1 / 1 / -1 / 2",
    );
    expect(decl(bodyOf(wideCard, ".cardBody"), "grid-area")).toBe(
      "1 / 2 / -1 / 3",
    );
    expect(decl(bodyOf(wideCard, ".cardBody"), "text-align")).toBe("start");
    expect(decl(bodyOf(wideCard, ".action"), "align-items")).toBe("flex-start");
    expect(decl(bodyOf(wideCard, ".cta"), "padding-inline")).toBe(
      "var(--space-6)",
    );
  });

  it("comes after every top-level card rule it overrides, and leaves the phone alone", () => {
    const at = (prelude: string) =>
      new RegExp(
        `^${prelude.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\{`,
        "m",
      ).exec(css)?.index ?? Number.NaN;
    for (const rule of [".card", ".thumb", ".cardBody", ".action", ".cta"]) {
      expect(at(rule), rule).toBeLessThan(at("@container (min-width: 400px)"));
    }
    expect(decl(bodyOf(phone, ".card"), "container-type")).toBeUndefined();
    expect(phone).not.toContain("grid-area");
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
