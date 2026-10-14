import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { fireEvent, render, screen as dom } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BinairoFreeScreen } from "../src/free-play/binairo-free-screen";
import { CrosswordFreeScreen } from "../src/free-play/crossword-free-screen";
import { NonogramFreeScreen } from "../src/free-play/nonogram-free-screen";
import { QueensFreeScreen } from "../src/free-play/queens-free-screen";
import { SudokuFreeScreen } from "../src/free-play/sudoku-free-screen";
import { messages } from "../src/i18n";
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
  crossword: stylesheet("src/crossword/crossword-board.module.css"),
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

function clampAt(value: string | undefined, viewport: number): number {
  const match = /^clamp\(\s*(\d+)px,\s*([\d.]+)vw,\s*(\d+)px\s*\)$/.exec(
    value ?? "",
  );
  if (match === null) {
    throw new Error(`\`${String(value)}\` is not clamp(Npx, Nvw, Npx)`);
  }
  const [, low, vw, high] = match.map(Number);
  return Math.min(high ?? 0, Math.max(low ?? 0, ((vw ?? 0) * viewport) / 100));
}

describe("the board well sizes every board from the space it has (T-WEB-S596)", () => {
  const well = bodyOf(SHARED_CSS, ".boardWell");

  it("is a size container, so the cq units resolve against the space the section leaves", () => {
    expect(decl(well, "container-type")).toBe("size");
  });

  it("takes the width first and never exceeds the game's ceiling", () => {
    const side = (decl(well, "--board-side") ?? "").replace(/\s+/g, " ");

    expect(side).toMatch(/^min\( 100cqi,/);
    expect(side).toMatch(/var\(--board-max\) \)$/);
  });

  it("measures the page against the small viewport, so a collapsing URL bar never resizes a board", () => {
    expect(decl(bodyOf(SHARED_CSS, ".page"), "min-height")).toBe("100svh");
    expect(SHARED_CSS).not.toContain("dvh");
  });
});

describe("each game sheet sets its ceiling and keeps its cells fluid (T-WEB-S597)", () => {
  it("declares --board-max at or above the floor, and a font that never drops below 14px", () => {
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
      crossword: [GAME_SHEETS.crossword, ".cell"],
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
      [GAME_SHEETS.crossword, [".grid"]],
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

  it("counts the Rainhas affordance, margin and line, in --board-below", () => {
    const below = /^calc\((.+) \+ (\d+px)\)$/.exec(
      decl(bodyOf(GAME_SHEETS.queens, ".pageQueens"), "--board-below") ?? "",
    );
    const affordance = bodyOf(GAME_SHEETS.queens, ".affordance");

    expect(decl(affordance, "margin")).toBe(`${below?.[1] ?? ""} 0 0`);
    expect(pixels(below?.[2])).toBeGreaterThanOrEqual(
      1.5 * pixels(decl(affordance, "font-size")),
    );
  });
});

describe("every board keeps a usable cell at the floor (T-WEB-S598)", () => {
  const inner = boardFloor() - 2 * mobilePadding() - 2 * CARD_BORDER;

  it("fits the narrowest phone, so nothing overflows sideways at 320px", () => {
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

  it("keeps Cruzadinha cells at 24px or more at its own, lower floor", () => {
    const floor = pixels(
      decl(bodyOf(GAME_SHEETS.crossword, ".pageCrossword"), "--board-min"),
    );
    const gap = pixels(
      decl(
        bodyOf(
          bodyOf(GAME_SHEETS.crossword, "@media (max-width: 768px)"),
          ".grid",
        ),
        "gap",
      ),
    );
    const cells = (floor - 2 * mobilePadding() - 2 * CARD_BORDER - 4 * gap) / 5;

    expect(floor).toBeLessThanOrEqual(boardFloor());
    expect(cells).toBeGreaterThanOrEqual(WCAG_TARGET_FLOOR);
  });
});

describe("every gridCard sits inside a boardWell (T-WEB-S599)", () => {
  it("is rendered only by BoardCard", () => {
    const users = sourcesUnder(SRC, ".tsx")
      .filter((file) => readFileSync(file, "utf8").includes("gridCard"))
      .map((file) => path.relative(SRC, file));

    expect(users).toEqual(["play/board-card.tsx"]);
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

  it("keeps an overlay inside the well and outside the hidden placeholder card", () => {
    const { container } = render(
      <BoardCard placeholder overlay={<p data-testid="over">over</p>}>
        <span>board</span>
      </BoardCard>,
    );

    const well = container.querySelector(`.${shared.boardWell ?? ""}`);
    const card = well?.querySelector(`.${shared.gridCard ?? ""}`);
    expect(well?.contains(dom.getByTestId("over"))).toBe(true);
    expect(card?.contains(dom.getByTestId("over"))).toBe(false);
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

describe("the reset confirm opens over the hint and never moves the page (T-WEB-S600)", () => {
  it("takes what it covers, Ajustes and the hint, out of the tab order and the accessibility tree", () => {
    const covered = bodyOf(
      SHARED_CSS,
      '.reset:has([role="group"]) > :not(:has([role="group"])),\n.reset:has([role="group"]) + .hint',
    );
    expect(decl(covered, "visibility")).toBe("hidden");
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
    const resolve = (value: string | undefined) =>
      pixels(value?.replace("var(--touch-target-min)", `${String(minimum)}px`));

    expect(
      resolve(decl(bodyOf(RESET_CSS, ".control"), "min-height")),
    ).toBeGreaterThanOrEqual(minimum);
    expect(
      pixels(
        decl(
          bodyOf(bodyOf(SHARED_CSS, "@media (max-width: 1023px)"), ".hint"),
          "min-height",
        ),
      ),
    ).toBeGreaterThanOrEqual(minimum);
    expect(
      resolve(
        decl(
          bodyOf(
            stylesheet("src/components/confirm-action.module.css"),
            ".cancel",
          ),
          "min-height",
        ),
      ),
    ).toBeGreaterThanOrEqual(minimum);

    const keyboard = bodyOf(GAME_SHEETS.termo, ".keyboard");
    const rows = /repeat\(\d+,\s*(\d+px)\)/.exec(
      decl(keyboard, "grid-template-rows") ?? "",
    );
    expect(pixels(rows?.[1])).toBeGreaterThanOrEqual(minimum);
  });
});

describe("one fold at 1023px, one two-column band above it (T-WEB-S601)", () => {
  const page = bodyOf(SHARED_CSS, ".page");
  const [sidebar = ""] = (decl(page, "grid-template-columns") ?? "").split(
    " minmax",
  );
  const gap = decl(page, "column-gap");
  const gutter = (decl(page, "padding") ?? "").split(" ").slice(1).join(" ");

  it("resolves to the 330px sidebar, 72px gap and 80px gutters of the 1440px design at 1440px", () => {
    expect(clampAt(sidebar, 1440)).toBe(330);
    expect(clampAt(gap, 1440)).toBe(72);
    expect(clampAt(gutter, 1440)).toBe(80);
  });

  it("leaves the first two-column viewport a board column at or above the floor", () => {
    const column =
      1024 -
      clampAt(sidebar, 1024) -
      clampAt(gap, 1024) -
      2 * clampAt(gutter, 1024);

    expect(column).toBeGreaterThanOrEqual(boardFloor());
  });

  it("collapses to one column at 1023px", () => {
    const column = bodyOf(
      bodyOf(SHARED_CSS, "@media (max-width: 1023px)"),
      ".page",
    );

    expect(decl(column, "grid-template-columns")).toBe("1fr");
  });
});

describe("the hint explanation keeps a reserved slot where the height allows (T-WEB-S602)", () => {
  const slot = bodyOf(SHARED_CSS, ".hintSlot");
  const line = pixels(decl(slot, "--hint-line"));

  function reservedLines(media: string): number {
    const minHeight = decl(
      bodyOf(bodyOf(SHARED_CSS, media), ".hintSlot"),
      "min-height",
    );
    const match =
      /^calc\(var\(--space-3\) \+ (\d+) \* var\(--hint-line\)\)$/.exec(
        minHeight ?? "",
      );
    if (match === null) {
      throw new Error(`\`${String(minHeight)}\` is not margin plus N lines`);
    }
    return Number(match[1]);
  }

  it("counts the slot in the line height the explanation is set in", () => {
    const explain = bodyOf(SHARED_CSS, ".hintExplain");

    expect(decl(explain, "line-height")).toBe("var(--hint-line)");
    expect(decl(explain, "margin")).toMatch(/^var\(--space-3\) 0 0$/);
    expect(line).toBeGreaterThan(pixels(decl(explain, "font-size")));
  });

  it("reserves two lines in the two-column band and three on a tall single column", () => {
    expect(reservedLines("@media (min-width: 1024px)")).toBe(2);
    expect(
      reservedLines("@media (max-width: 1023px) and (min-height: 800px)"),
    ).toBe(3);
  });
});

describe("free play's generating note sits on the well, outside the hidden card (T-WEB-S603)", () => {
  const screens = {
    sudoku: <SudokuFreeScreen />,
    binairo: <BinairoFreeScreen />,
    nonogram: <NonogramFreeScreen />,
    queens: <QueensFreeScreen />,
    crossword: <CrosswordFreeScreen />,
  };

  it.each(Object.entries(screens))("%s", (_, element) => {
    const host = document.createElement("div");
    host.innerHTML = renderToStaticMarkup(element);
    const note = [...host.querySelectorAll("p")].find(
      (p) => p.textContent === messages.freePlay.generating,
    );

    expect(note?.closest(`.${shared.boardWell ?? ""}`)).not.toBeNull();
    expect(note?.closest(`.${shared.gridCard ?? ""}`)).toBeNull();
    expect(note?.closest("[aria-hidden]")).toBeNull();
  });
});
