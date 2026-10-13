import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { fireEvent, render, screen as dom } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BoardCard } from "../src/play/board-card";
import { ResetControl } from "../src/play/reset-control";
import shared from "../src/play/screen.module.css";
import resetStyles from "../src/play/reset-control.module.css";
import {
  bodyOf,
  boardFloor,
  decl,
  pixels,
  stylesheet,
  token,
} from "./css-source";

const SRC = path.join(import.meta.dirname, "..", "src");

const SHARED_CSS = stylesheet("src/play/screen.module.css");
const RESET_CSS = stylesheet("src/play/reset-control.module.css");

const PAGE_PADDING = 2 * token("--space-5");
const NARROWEST_VIEWPORT = 320;
const CARD_BORDER = 1;
const WCAG_TARGET_FLOOR = 24;

const GAME_SHEETS = {
  sudoku: stylesheet("src/sudoku/sudoku-board.module.css"),
  binairo: stylesheet("src/binairo/binairo-screen.module.css"),
  queens: stylesheet("src/queens/queens-board.module.css"),
  nonogram: stylesheet("src/nonogram/nonogram-board.module.css"),
  termo: stylesheet("src/termo/termo-board.module.css"),
} as const;

function sourcesUnder(directory: string, extension: string): string[] {
  return readdirSync(directory, { recursive: true, encoding: "utf8" })
    .filter((file) => file.endsWith(extension))
    .map((file) => path.join(directory, file));
}

function mobilePadding(): number {
  return pixels(
    decl(
      bodyOf(bodyOf(SHARED_CSS, "@media (max-width: 768px)"), ".gridCard"),
      "padding",
    ),
  );
}

describe("the board well sizes every board from the space it has (T-WEB-S580)", () => {
  const well = bodyOf(SHARED_CSS, ".boardWell");

  it("is a size container that takes the height the section leaves over", () => {
    expect(decl(well, "container-type")).toBe("size");
    expect(decl(well, "flex")).toBe("1 1 0");
    expect(decl(well, "align-self")).toBe("stretch");
  });

  it("reserves the floor plus whatever the game draws under the card", () => {
    expect(decl(well, "min-height")).toBe(
      "calc(var(--board-min, 280px) + var(--board-below, 0px))",
    );
  });

  it("derives --board-side from the width, the height left after the controls, and the ceiling", () => {
    const side = (decl(well, "--board-side") ?? "").replace(/\s+/g, " ");

    expect(side).toBe(
      "min( 100cqi, (100cqb - var(--board-below, 0px)) * var(--board-aspect, 1), var(--board-max) )",
    );
  });

  it("makes the card exactly that wide, shrink-to-fit where no well sets it", () => {
    const card = bodyOf(SHARED_CSS, ".gridCard");

    expect(decl(card, "width")).toBe("var(--board-side, auto)");
    expect(decl(card, "box-sizing")).toBe("border-box");
    expect(decl(card, "max-width")).toBeUndefined();
  });

  it("measures the page against the small viewport, so a collapsing URL bar never resizes a board", () => {
    expect(decl(bodyOf(SHARED_CSS, ".page"), "min-height")).toBe("100svh");
    expect(SHARED_CSS).not.toContain("dvh");
  });

  it("leaves no per-game mobile cap behind", () => {
    for (const file of [
      ...sourcesUnder(SRC, ".css"),
      ...sourcesUnder(SRC, ".tsx"),
    ]) {
      expect(readFileSync(file, "utf8"), file).not.toContain(
        "--board-mobile-max",
      );
    }
  });
});

describe("each game sheet sets its ceiling and keeps its cells fluid (T-WEB-S581)", () => {
  it("declares --board-max in px, and a font that never drops below 14px", () => {
    for (const [game, sheet] of Object.entries(GAME_SHEETS)) {
      const ceilings = [...sheet.matchAll(/--board-max:\s*([^;]+);/g)].map(
        (match) => pixels(match[1]),
      );

      expect(ceilings.length, game).toBeGreaterThan(0);
      for (const ceiling of ceilings) {
        expect(ceiling, game).toBeGreaterThanOrEqual(boardFloor());
      }
    }

    const fonts = {
      sudoku: [GAME_SHEETS.sudoku, ".cell"],
      binairo: [GAME_SHEETS.binairo, ".cell"],
      termo: [GAME_SHEETS.termo, ".tile"],
    } as const;
    for (const [game, [sheet, selector]] of Object.entries(fonts)) {
      const size = decl(bodyOf(sheet, selector), "font-size") ?? "";
      expect(
        pixels(/^clamp\(\s*([\d.]+px),/.exec(size)?.[1]),
        game,
      ).toBeGreaterThanOrEqual(14);
    }
  });

  it("leaves no px cell track in any board's grid template", () => {
    const boards = [
      [GAME_SHEETS.sudoku, [".grid"]],
      [GAME_SHEETS.binairo, [".grid"]],
      [GAME_SHEETS.queens, [".size7", ".size8", ".size9"]],
      [GAME_SHEETS.nonogram, [".size5", ".size8", ".size10", ".size15"]],
    ] as const;

    for (const [sheet, selectors] of boards) {
      for (const selector of selectors) {
        const body = bodyOf(sheet, selector);
        for (const property of [
          "grid-template-columns",
          "grid-template-rows",
        ]) {
          expect(
            decl(body, property) ?? "",
            `${selector} ${property}`,
          ).not.toMatch(/repeat\(\s*\d+\s*,\s*[\d.]+px\s*\)/);
        }
      }
    }
  });

  it("squares every cell from its own aspect ratio or its grid", () => {
    expect(decl(bodyOf(GAME_SHEETS.sudoku, ".grid"), "aspect-ratio")).toBe("1");
    for (const [sheet, selector] of [
      [GAME_SHEETS.binairo, ".cell"],
      [GAME_SHEETS.queens, ".cell"],
      [GAME_SHEETS.nonogram, ".cell"],
      [GAME_SHEETS.termo, ".tile"],
    ] as const) {
      expect(decl(bodyOf(sheet, selector), "aspect-ratio")).toBe("1");
    }
  });
});

describe("every board keeps a usable cell at the floor (T-WEB-S582)", () => {
  const inner = boardFloor() - 2 * mobilePadding() - 2 * CARD_BORDER;

  it("fits the narrowest phone", () => {
    expect(boardFloor()).toBeLessThanOrEqual(NARROWEST_VIEWPORT - PAGE_PADDING);
  });

  it("keeps Binairo, Rainhas and Termo cells at 24px or more", () => {
    const binairoGap = pixels(
      decl(
        bodyOf(
          bodyOf(GAME_SHEETS.binairo, "@media (max-width: 768px)"),
          ".grid",
        ),
        "gap",
      ),
    );
    expect((inner - 7 * binairoGap) / 8).toBeGreaterThanOrEqual(
      WCAG_TARGET_FLOOR,
    );

    const largestQueens = 9;
    expect(inner / largestQueens).toBeGreaterThanOrEqual(WCAG_TARGET_FLOOR);

    const termoGap = pixels(
      decl(
        bodyOf(bodyOf(GAME_SHEETS.termo, "@media (max-width: 768px)"), ".row"),
        "gap",
      ),
    );
    expect((inner - 4 * termoGap) / 5).toBeGreaterThanOrEqual(
      WCAG_TARGET_FLOOR,
    );
  });
});

describe("every gridCard sits inside a boardWell (T-WEB-S583)", () => {
  const PENDING_CRUZADINHA = ["crossword/board-view.tsx"];

  it("is rendered only by BoardCard, outside the Cruzadinha", () => {
    const users = sourcesUnder(SRC, ".tsx")
      .filter((file) => readFileSync(file, "utf8").includes("gridCard"))
      .map((file) => path.relative(SRC, file));

    expect(users.sort()).toEqual(
      ["play/board-card.tsx", ...PENDING_CRUZADINHA].sort(),
    );
  });

  it("renders the card and what sits under it inside one well", () => {
    const { container } = render(
      <BoardCard below={<p data-testid="under">under</p>}>
        <span>board</span>
      </BoardCard>,
    );

    const well = container.querySelector(`.${shared.boardWell ?? ""}`);
    const card = well?.querySelector(`.${shared.gridCard ?? ""}`);
    expect(card?.parentElement).toBe(well);
    expect(card?.getAttribute("aria-hidden")).toBeNull();
    expect(dom.getByTestId("under").parentElement).toBe(well);
    expect(card?.nextElementSibling).toBe(dom.getByTestId("under"));
  });

  it("hides a placeholder card from assistive technology", () => {
    const { container } = render(
      <BoardCard placeholder>
        <span>board</span>
      </BoardCard>,
    );

    expect(
      container
        .querySelector(`.${shared.gridCard ?? ""}`)
        ?.getAttribute("aria-hidden"),
    ).toBe("true");
  });
});

describe("the reset confirm opens over the hint and never moves the page (T-WEB-S584)", () => {
  it("reserves one touch target for the control and floats the confirm over what is below it", () => {
    expect(decl(bodyOf(RESET_CSS, ".control"), "position")).toBe("relative");
    expect(decl(bodyOf(RESET_CSS, ".control"), "min-height")).toBe(
      "var(--touch-target-min)",
    );

    const ask = bodyOf(RESET_CSS, ".ask");
    expect(decl(ask, "position")).toBe("absolute");
    expect(decl(ask, "background")).toBeUndefined();
    expect(decl(ask, "z-index")).toBeUndefined();
  });

  it("takes the covered hint out of the tab order and the accessibility tree", () => {
    expect(
      decl(
        bodyOf(SHARED_CSS, '.reset:has([role="group"]) + .hint'),
        "visibility",
      ),
    ).toBe("hidden");
  });

  it("renders the confirm inside the control, where the trigger was", () => {
    const { container } = render(<ResetControl onReset={() => undefined} />);
    const control = container.querySelector(`.${resetStyles.control ?? ""}`);

    fireEvent.click(dom.getByRole("button", { name: "Recomeçar" }));

    const group = dom.getByRole("group");
    expect(control?.contains(group)).toBe(true);
    expect(group.className).toContain(resetStyles.ask ?? "");
  });

  it("keeps the shared controls at or above the 44px touch target", () => {
    const minimum = token("--touch-target-min");

    expect(
      pixels(
        decl(
          bodyOf(bodyOf(SHARED_CSS, "@media (max-width: 1023px)"), ".hint"),
          "min-height",
        ),
      ),
    ).toBeGreaterThanOrEqual(minimum);
    expect(
      pixels(
        decl(
          bodyOf(
            stylesheet("src/components/confirm-action.module.css"),
            ".cancel",
          ),
          "min-height",
        )?.replace("var(--touch-target-min)", `${String(minimum)}px`),
      ),
    ).toBeGreaterThanOrEqual(minimum);

    const keyboard = bodyOf(GAME_SHEETS.termo, ".keyboard");
    const rows = /repeat\(\d+,\s*(\d+px)\)/.exec(
      decl(keyboard, "grid-template-rows") ?? "",
    );
    expect(pixels(rows?.[1])).toBeGreaterThanOrEqual(minimum);
  });
});

describe("one fold at 1023px, one two-column band above it (T-WEB-S585)", () => {
  it("starts the two columns at 1024px and clamps them to the viewport", () => {
    const page = bodyOf(SHARED_CSS, ".page");

    expect(decl(page, "grid-template-columns")).toBe(
      "clamp(280px, 26vw, 330px) minmax(0, 1fr)",
    );
    expect(decl(page, "column-gap")).toBe("clamp(48px, 5vw, 72px)");
    expect(decl(page, "padding")).toBe("var(--space-8) clamp(40px, 6vw, 80px)");
  });

  it("collapses to one column at 1023px and leaves no 1140px fold in the shared sheet", () => {
    expect(SHARED_CSS).toContain("@media (max-width: 1023px)");
    expect(SHARED_CSS).not.toContain("1140");

    const column = bodyOf(
      bodyOf(SHARED_CSS, "@media (max-width: 1023px)"),
      ".page",
    );
    expect(decl(column, "grid-template-columns")).toBe("1fr");
  });

  it("keeps the 280px sidebar and the 80px gutters of the 1440px design at 1440px", () => {
    const viewport = 1440;

    expect(Math.min(330, Math.max(280, 0.26 * viewport))).toBe(330);
    expect(Math.min(72, Math.max(48, 0.05 * viewport))).toBe(72);
    expect(Math.min(80, Math.max(40, 0.06 * viewport))).toBe(80);
  });
});

describe("the hint explanation keeps a reserved slot where the height allows (T-WEB-S586)", () => {
  const LINE = 13 * 1.5;

  it("sets the explanation's line height the slot is counted in", () => {
    const explain = bodyOf(SHARED_CSS, ".hintExplain");

    expect(pixels(decl(explain, "font-size"))).toBe(13);
    expect(decl(explain, "line-height")).toBe("1.5");
  });

  it("reserves two lines in the two-column band and three on a tall single column", () => {
    const wide = bodyOf(
      bodyOf(SHARED_CSS, "@media (min-width: 1024px)"),
      ".hintSlot",
    );
    const tall = bodyOf(
      bodyOf(SHARED_CSS, "@media (max-width: 1023px) and (min-height: 800px)"),
      ".hintSlot",
    );

    expect(decl(wide, "min-height")).toBe(
      `calc(var(--space-3) + 2 * ${String(LINE)}px)`,
    );
    expect(decl(tall, "min-height")).toBe(
      `calc(var(--space-3) + 3 * ${String(LINE)}px)`,
    );
    expect(decl(bodyOf(SHARED_CSS, ".hintSlot"), "display")).toBe("flow-root");
  });
});
