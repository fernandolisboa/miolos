import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { GAMES, type Game } from "@miolos/core";
import { evaluateGuess, isValidGuess } from "@miolos/games/termo";
import { TERMO_ANSWERS } from "@miolos/games/termo-answers";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { GameThumbnail } from "../src/hub/game-thumbnail";
import {
  THUMBNAILS,
  type CellKind,
  type ThumbnailCell,
} from "../src/hub/thumbnails";
import { messages } from "../src/i18n";
import { accentVars } from "../src/play/accent";
import { contrast, mixHex } from "./contrast";
import { colorTokens, stylesheet } from "./css-source";
import { closureOf, REPO_ROOT } from "./module-graph";

const SHEET = stylesheet("src/hub/game-thumbnail.module.css");
const HUB = "apps/web/src/hub/";
const THUMBNAIL_MODULES = [`${HUB}game-thumbnail.tsx`, `${HUB}thumbnails.ts`];

function declarationsOf(selector: string): ReadonlyMap<string, string> {
  const found = new Map<string, string>();
  for (const rule of SHEET.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = (rule[1] ?? "").split(",").map((part) => part.trim());
    if (!selectors.includes(selector)) {
      continue;
    }
    for (const declaration of (rule[2] ?? "").split(";")) {
      const at = declaration.indexOf(":");
      if (at > 0) {
        found.set(
          declaration.slice(0, at).trim(),
          declaration.slice(at + 1).trim(),
        );
      }
    }
  }
  return found;
}

function resolver(theme: "light" | "dark", game: Game) {
  const tokens = colorTokens(theme);
  const local: Readonly<Record<string, string>> = {
    "--accent": String(accentVars(game)["--accent"]),
    "--ink-on-accent": String(accentVars(game)["--ink-on-accent"]),
  };
  const resolve = (value: string): string => {
    const mix =
      /^color-mix\(in srgb, (.+) (\d+)%, (var\([^)]+\)|transparent)\)$/.exec(
        value,
      );
    if (mix) {
      const [, top = "", share = "0", bottom = ""] = mix;
      return mixHex(resolve(top), resolve(bottom), Number(share) / 100);
    }
    const variable = /^var\((--[\w-]+)\)$/.exec(value)?.[1];
    if (variable === undefined) {
      throw new Error(`cannot resolve \`${value}\``);
    }
    const next = local[variable] ?? tokens.get(variable);
    if (next === undefined) {
      throw new Error(`${variable} is not a ${theme} colour token`);
    }
    return next.startsWith("#") ? next : resolve(next);
  };
  return resolve;
}

function fillOf(kind: CellKind): string {
  return declarationsOf(`.${kind}`).get("--thumb-fill") ?? "var(--paper-desk)";
}

function glyphOf(kind: CellKind): string {
  return declarationsOf(`.${kind}`).get("--thumb-glyph") ?? "var(--ink)";
}

function sourceFiles(directory: string): readonly string[] {
  return readdirSync(join(REPO_ROOT, directory), {
    recursive: true,
    withFileTypes: true,
  })
    .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name))
    .map((entry) =>
      join(entry.parentPath, entry.name)
        .slice(REPO_ROOT.length + 1)
        .replaceAll("\\", "/"),
    );
}

describe("every game has a well-formed thumbnail (T-WEB-S1090)", () => {
  it.each(GAMES)("%s", (game) => {
    const { columns, tilt, cells } = THUMBNAILS[game];

    expect(cells.length).toBeGreaterThan(0);
    expect(cells.length % columns).toBe(0);
    expect(Math.abs(tilt)).toBeLessThanOrEqual(2.4);
    for (const cell of cells) {
      expect(declarationsOf(`.${cell.kind}`).size, cell.kind).toBeGreaterThan(
        0,
      );
      if (cell.glyph !== undefined) {
        expect([...cell.glyph]).toHaveLength(1);
      }
    }
  });
});

describe("the crown and the flag are the real boards' shapes (T-WEB-S1090)", () => {
  const thumbnail = readFileSync(
    join(REPO_ROOT, `${HUB}game-thumbnail.tsx`),
    "utf8",
  );

  it.each([
    ["apps/web/src/queens/board.tsx", "QueenGlyph"],
    ["apps/web/src/minesweeper/glyphs.tsx", "FlagGlyph"],
  ])("%s", (file, glyph) => {
    const source = readFileSync(join(REPO_ROOT, file), "utf8");
    const body = source.slice(source.indexOf(`function ${glyph}`));
    const shapes = [...body.matchAll(/\sd="([^"]+)"|<rect ([^/]+)\/>/g)]
      .slice(0, 2)
      .map((match) => match[1] ?? match[2] ?? "");

    expect(shapes).toHaveLength(2);
    for (const shape of shapes) {
      expect(thumbnail).toContain(shape);
    }
  });
});

describe("the Termo thumbnail plays by the rules and spoils no daily (T-WEB-S1091)", () => {
  const { columns, cells } = THUMBNAILS.termo;
  const rows = Array.from({ length: cells.length / columns }, (_, row) =>
    cells.slice(row * columns, (row + 1) * columns),
  );
  const words = rows.map((row) => row.map((cell) => cell.glyph).join(""));
  const answer = words.at(-1) ?? "";

  it("each row is judged against the last word as the game judges it", () => {
    expect(rows.map((row) => row.map((cell) => cell.kind))).toEqual(
      words.map((word) => [...evaluateGuess(word, answer)]),
    );
    expect(rows.at(-1)?.every((cell) => cell.kind === "correct")).toBe(true);
  });

  it("every word is an accepted guess and none is a daily answer", () => {
    const answers = new Set(TERMO_ANSWERS.map((entry) => entry.normalized));
    for (const word of words) {
      expect(isValidGuess(word), word).toBe(true);
      expect(answers.has(word.toLowerCase()), word).toBe(false);
    }
  });
});

function rowsOf(game: Game): readonly (readonly ThumbnailCell[])[] {
  const { columns, cells } = THUMBNAILS[game];
  return Array.from({ length: cells.length / columns }, (_, row) =>
    cells.slice(row * columns, (row + 1) * columns),
  );
}

function neighbours(row: number, column: number, size: number) {
  return [-1, 0, 1]
    .flatMap((dr) => [-1, 0, 1].map((dc) => [row + dr, column + dc] as const))
    .filter(
      ([r, c]) =>
        (r !== row || c !== column) && r >= 0 && c >= 0 && r < size && c < size,
    );
}

describe("the other boards are positions their games allow, and no daily picture (T-WEB-S1095)", () => {
  it("the Nonogram picture is no 5×5 motif, nor a mirrored one", () => {
    const library = readFileSync(
      join(REPO_ROOT, "packages/games/src/nonogram/motifs-5.ts"),
      "utf8",
    );
    const motifs = [...library.matchAll(/rows: \[([^\]]+)\]/g)].map((match) =>
      [...(match[1] ?? "").matchAll(/"([.#]+)"/g)].map((row) => row[1] ?? ""),
    );
    const picture = rowsOf("nonogram").map((row) =>
      row.map((cell) => (cell.kind === "filled" ? "#" : ".")).join(""),
    );

    expect(motifs.length).toBeGreaterThan(30);
    for (const motif of motifs) {
      expect(picture).not.toEqual(motif);
      expect(picture).not.toEqual(
        motif.map((row) => [...row].reverse().join("")),
      );
    }
  });

  it("the Binairo rows and columns can still balance, with no three alike in a line", () => {
    const grid = rowsOf("binairo").map((row) =>
      row.map((cell) =>
        cell.kind === "one" ? "1" : cell.kind === "zero" ? "0" : ".",
      ),
    );
    const lines = [
      ...grid,
      ...grid.map((_, c) => grid.map((row) => row[c] ?? "")),
    ].map((line) => line.join(""));

    for (const line of lines) {
      expect(line, line).not.toMatch(/000|111/);
      for (const digit of ["0", "1"]) {
        expect(line.split(digit).length - 1, line).toBeLessThanOrEqual(
          line.length / 2,
        );
      }
    }
  });

  it("the Rainhas crowns take one row, column and region each, and never touch", () => {
    const crowns = rowsOf("queens").flatMap((row, r) =>
      row.flatMap((cell, c) =>
        cell.mark === "crown" ? [{ r, c, region: cell.kind }] : [],
      ),
    );

    expect(new Set(crowns.map(({ r }) => r)).size).toBe(5);
    expect(new Set(crowns.map(({ c }) => c)).size).toBe(5);
    expect(new Set(crowns.map(({ region }) => region)).size).toBe(5);
    for (const a of crowns) {
      for (const b of crowns) {
        if (a !== b) {
          expect(
            Math.max(Math.abs(a.r - b.r), Math.abs(a.c - b.c)),
          ).toBeGreaterThan(1);
        }
      }
    }
  });

  it("the Rainhas edges are drawn exactly between cells of different regions", () => {
    const rows = rowsOf("queens");
    const changes = rows.flatMap((row, r) =>
      row.flatMap((cell, c) =>
        [rows[r]?.[c + 1], rows[r + 1]?.[c]].filter(
          (next) => next !== undefined && next.kind !== cell.kind,
        ),
      ),
    ).length;
    const html = renderToStaticMarkup(<GameThumbnail game="queens" />);
    const edges =
      /<path class="[^"]*boundary[^"]*" d="([^"]+)"/.exec(html)?.[1] ?? "";
    const inside = rows.flatMap((row, r) =>
      row
        .slice(1)
        .flatMap((cell, c) =>
          row[c]?.kind === cell.kind
            ? [`M${String(c * 12 + 11)} ${String(r * 12 - 1)}`]
            : [],
        ),
    );

    expect(changes).toBeGreaterThan(0);
    expect(edges.match(/M/g)).toHaveLength(changes);
    for (const segment of inside) {
      expect(edges).not.toContain(`${segment}v`);
    }
  });

  it("the Campo Minado counts fit some placement of mines under the covered cells, and no open zero touches one", () => {
    const rows = rowsOf("minesweeper");
    const size = rows.length;
    const covered = rows.flatMap((row, r) =>
      row.flatMap((cell, c) =>
        cell.kind === "cover" ? [{ r, c, flag: cell.mark === "flag" }] : [],
      ),
    );
    const fits = (mines: ReadonlySet<string>) =>
      rows.every((row, r) =>
        row.every((cell, c) =>
          cell.kind === "cover"
            ? true
            : neighbours(r, c, size).filter(([nr, nc]) =>
                mines.has(`${String(nr)},${String(nc)}`),
              ).length === Number(cell.glyph ?? "0"),
        ),
      );
    const placements = Array.from(
      { length: 2 ** covered.length },
      (_, bits) =>
        new Set(
          covered
            .filter((_, at) => (bits >> at) & 1)
            .map(({ r, c }) => `${String(r)},${String(c)}`),
        ),
    ).filter((mines) =>
      covered.every(
        ({ r, c, flag }) => !flag || mines.has(`${String(r)},${String(c)}`),
      ),
    );

    expect(placements.some(fits)).toBe(true);
    rows.forEach((row, r) => {
      row.forEach((cell, c) => {
        if (cell.kind === "open") {
          for (const [nr, nc] of neighbours(r, c, size)) {
            expect(
              rows[nr]?.[nc]?.kind,
              `${String(nr)},${String(nc)}`,
            ).not.toBe("cover");
          }
        }
      });
    });
  });
});

describe("a thumbnail is decorative static markup that reaches no client module (T-WEB-S1092)", () => {
  it.each(GAMES)("%s renders as one hidden element", (game) => {
    const html = renderToStaticMarkup(<GameThumbnail game={game} />);
    const root = new DOMParser().parseFromString(html, "text/html").body;

    expect(root.children).toHaveLength(1);
    expect(root.firstElementChild?.getAttribute("aria-hidden")).toBe("true");
  });

  it("the component declares no handler and calls no hook", () => {
    const source = readFileSync(
      join(REPO_ROOT, `${HUB}game-thumbnail.tsx`),
      "utf8",
    );

    expect(source).not.toMatch(/\bon[A-Z]\w*=/);
    expect(source).not.toMatch(/\buse[A-Z]\w*\(/);
  });

  it("nothing the thumbnail imports is a client module", () => {
    const closure = [...closureOf(`${HUB}game-thumbnail.tsx`)];

    expect(closure).toContain(`${HUB}thumbnails.ts`);
    for (const file of closure) {
      expect(readFileSync(join(REPO_ROOT, file), "utf8"), file).not.toMatch(
        /^["']use client["']/m,
      );
    }
  });

  it("no client module reaches the hub's thumbnails", () => {
    const clients = [
      ...sourceFiles("apps/web/src"),
      ...sourceFiles("apps/web/app"),
    ].filter((file) =>
      /^["']use client["']/m.test(readFileSync(join(REPO_ROOT, file), "utf8")),
    );

    expect(clients.length).toBeGreaterThan(20);
    expect(
      clients.filter((client) =>
        [...closureOf(client)].some((imported) =>
          THUMBNAIL_MODULES.includes(imported),
        ),
      ),
    ).toEqual([]);
  });
});

describe("every glyph, mark and region edge on a thumbnail clears the DESIGN.md floors (T-WEB-S1093)", () => {
  for (const theme of ["light", "dark"] as const) {
    it.each(GAMES)(`${theme}: %s`, (game) => {
      const resolve = resolver(theme, game);
      const marks = {
        crown: declarationsOf(".crown").get("fill") ?? "",
        pole: declarationsOf(".pole").get("stroke") ?? "",
        pennant: declarationsOf(".pennant").get("fill") ?? "",
        strike: declarationsOf(".strike").get("stroke") ?? "",
        underline: declarationsOf(".underline").get("stroke") ?? "",
        boundary: declarationsOf(".boundary").get("stroke") ?? "",
      };

      for (const cell of THUMBNAILS[game].cells) {
        const paper = resolve(fillOf(cell.kind));
        if (cell.glyph !== undefined) {
          expect(
            contrast(resolve(glyphOf(cell.kind)), paper),
            `${cell.kind} "${cell.glyph}"`,
          ).toBeGreaterThanOrEqual(4.5);
        }
        const drawn = [
          ...(cell.mark === "crown" ? [marks.crown] : []),
          ...(cell.mark === "flag" ? [marks.pole, marks.pennant] : []),
          ...(cell.kind === "absent" ? [marks.strike] : []),
          ...(cell.kind === "present" ? [marks.underline] : []),
          ...(cell.kind.startsWith("region") ? [marks.boundary] : []),
        ];
        for (const ink of drawn) {
          expect(
            contrast(resolve(ink), paper),
            `${cell.kind} ${String(cell.mark)}`,
          ).toBeGreaterThanOrEqual(3);
        }
      }
    });
  }
});

describe("every game's card line is a short pt-BR tagline (T-WEB-S1094)", () => {
  const taglines = GAMES.map((game) => messages.games[game].description);

  it("each is one sentence of at most 48 characters, and no two match", () => {
    for (const tagline of taglines) {
      expect(tagline).toMatch(/^[A-ZÀ-Ú].*\.$/u);
      expect(tagline.length, tagline).toBeLessThanOrEqual(48);
    }
    expect(new Set(taglines).size).toBe(GAMES.length);
  });
});
