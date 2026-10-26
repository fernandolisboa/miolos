import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { GAMES, type Game } from "@miolos/core";
import { evaluateGuess, isValidGuess } from "@miolos/games/termo";
import { TERMO_ANSWERS } from "@miolos/games/termo-answers";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { GameThumbnail } from "../src/hub/game-thumbnail";
import { THUMBNAILS, type CellKind } from "../src/hub/thumbnails";
import { messages } from "../src/i18n";
import { accentVars } from "../src/play/accent";
import { contrast, mixHex } from "./contrast";
import { colorTokens, stylesheet } from "./css-source";
import { closureOf, REPO_ROOT } from "./module-graph";

// ADR-0055: contended local 1456 ms × 4 → 10_000.
vi.setConfig({ testTimeout: 10_000 });

const SHEET = stylesheet("src/hub/game-thumbnail.module.css");
const HUB = "apps/web/src/hub/";

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
    expect(
      evaluateGuess(answer, answer).every((state) => state === "correct"),
    ).toBe(true);
  });

  it("every word is an accepted guess and none is a daily answer", () => {
    const answers = new Set(TERMO_ANSWERS.map((entry) => entry.normalized));
    for (const word of words) {
      expect(isValidGuess(word), word).toBe(true);
      expect(answers.has(word.toLowerCase()), word).toBe(false);
    }
  });
});

describe("a thumbnail is decorative static markup that reaches no client module (T-WEB-S1092)", () => {
  it.each(GAMES)("%s renders one hidden element with no handlers", (game) => {
    const html = renderToStaticMarkup(<GameThumbnail game={game} />);
    const root = new DOMParser().parseFromString(html, "text/html").body;

    expect(root.children).toHaveLength(1);
    expect(root.firstElementChild?.getAttribute("aria-hidden")).toBe("true");
    expect(html).not.toMatch(/\son[a-z]+=/i);
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
        [...closureOf(client)].some((imported) => imported.startsWith(HUB)),
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
