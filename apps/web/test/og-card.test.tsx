import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { isValidElement, type ReactElement } from "react";
import { describe, expect, it } from "vitest";

import { formatDayAndMonth, formatMonth, messages } from "../src/i18n";
import {
  archiveCard,
  archiveIndexCard,
  gameCard,
  siteCard,
} from "../src/og/card";
import { ogCopy } from "../src/og/copy";
import { ACCENT_APP_SHADOW, ACCENT_APP_TAPE } from "../src/og/tokens";
import { stylesheet } from "./css-source";

const repoRoot = join(import.meta.dirname, "../../..");
const cardSource = readFileSync(
  join(import.meta.dirname, "../src/og/card.tsx"),
  "utf8",
);

function code(source: string): string {
  return source
    .replaceAll(/\/\*[\s\S]*?\*\//g, "")
    .replaceAll(/(^|[^:])\/\/.*$/gm, "$1");
}

function elements(node: unknown): ReactElement[] {
  if (Array.isArray(node)) {
    return node.flatMap((child) => elements(child));
  }
  if (!isValidElement(node)) {
    return [];
  }
  const props = node.props as { readonly children?: unknown };
  return [node, ...elements(props.children)];
}

function styleOf(element: ReactElement): Record<string, unknown> {
  const props = element.props as {
    readonly style?: Record<string, unknown>;
  };
  return props.style ?? {};
}

function valuesOf(tree: ReactElement, property: string): string[] {
  return elements(tree)
    .map((element) => styleOf(element)[property])
    .filter((value): value is string => typeof value === "string");
}

const ACCENTS_BY_TOKEN = {
  "--accent-termo": "#8D6212",
  "--accent-sudoku": "#2E4E7E",
  "--accent-nonogram": "#B5563C",
  "--accent-binairo": "#4E6B52",
  "--accent-app": "#9E3B2F",
} as const;

const ACCENTS = Object.values(ACCENTS_BY_TOKEN);

function mentionsAnAccent(value: string): boolean {
  return ACCENTS.some((accent) =>
    value.toUpperCase().includes(accent.toUpperCase()),
  );
}

describe("the card's accent literals", () => {
  it("are the tokens.css values, so a token edit cannot drift past this file", () => {
    const css = stylesheet("../../packages/ui/tokens.css");
    for (const [token, hex] of Object.entries(ACCENTS_BY_TOKEN)) {
      expect(css).toMatch(new RegExp(`${token}\\s*:\\s*${hex}\\s*;`, "i"));
    }
  });
});

describe("the OG card paints the accent on the tape and the shadow only (T-WEB-S200)", () => {
  it("no word on any card is accent-coloured, and the accent IS found twice", () => {
    const trees: [string, ReactElement][] = [
      ["site", siteCard()],

      ["archive index", archiveIndexCard()],
      [
        "archive month",
        archiveCard({
          display: formatMonth("2026-02-01"),
          caption: messages.archive.title,
        }),
      ],
      [
        "archive day",
        archiveCard({
          display: formatDayAndMonth("2026-02-22"),
          caption: ogCopy.archiveDayCaption("2026"),
        }),
      ],
      ["termo", gameCard({ game: "termo", longDate: "1 de maio de 2026" })],
      ["sudoku", gameCard({ game: "sudoku", longDate: "1 de maio de 2026" })],
      [
        "nonogram",
        gameCard({ game: "nonogram", longDate: "1 de maio de 2026" }),
      ],
      ["binairo", gameCard({ game: "binairo", longDate: "1 de maio de 2026" })],
    ];

    for (const [name, tree] of trees) {
      expect
        .soft(valuesOf(tree, "color").filter(mentionsAnAccent), name)
        .toEqual([]);

      expect
        .soft(
          valuesOf(tree, "backgroundColor").filter(mentionsAnAccent),
          `${name} tape`,
        )
        .toHaveLength(1);
      expect
        .soft(
          valuesOf(tree, "boxShadow").filter(mentionsAnAccent),
          `${name} shadow`,
        )
        .toHaveLength(1);

      expect
        .soft(valuesOf(tree, "color").length, `${name} words`)
        .toBeGreaterThanOrEqual(2);
    }
  });

  it("the kicker's tracking is inside DESIGN.md:29's 0.14-0.16em band", () => {
    const tracking = valuesOf(
      gameCard({ game: "sudoku", longDate: "1 de maio de 2026" }),
      "letterSpacing",
    );
    expect(tracking).toHaveLength(1);
    const em = Number(tracking[0]?.replace("em", ""));
    expect(em).toBeGreaterThanOrEqual(0.14);
    expect(em).toBeLessThanOrEqual(0.16);
  });

  it("every hex literal in src/og/tokens.ts ties back to packages/ui/tokens.css", () => {
    const tokensCss = readFileSync(
      join(repoRoot, "packages/ui/tokens.css"),
      "utf8",
    ).toUpperCase();
    const literals = [
      ...readFileSync(
        join(import.meta.dirname, "../src/og/tokens.ts"),
        "utf8",
      ).matchAll(/#[0-9A-Fa-f]{6,8}\b/g),
    ].map((match) => match[0].toUpperCase());

    expect(literals.length).toBeGreaterThanOrEqual(11);
    for (const literal of literals) {
      expect.soft(tokensCss, literal).toContain(literal.slice(0, 7));
    }
  });

  it("the desk texture is 153 dots at 1200x630, DERIVED from the size", () => {
    const dots = elements(
      gameCard({ game: "binairo", longDate: "1 de maio de 2026" }),
    ).filter((element) => styleOf(element)["backgroundColor"] === "#211D190F");
    expect(dots).toHaveLength(153);

    const at = (index: number) => {
      const style = styleOf(dots[index] as ReactElement);
      return [style["left"], style["top"]];
    };
    expect(at(0)).toEqual([0, 0]);
    expect(at(1)).toEqual([72, 0]);
    expect(at(17)).toEqual([0, 72]);
    expect(at(119)).toEqual([0, 504]);
    expect(at(152)).toEqual([16 * 72, 8 * 72]);

    expect(cardSource).toContain("Math.ceil(CARD_WIDTH / DOT_TILE)");
    expect(cardSource).toContain("Math.ceil(CARD_HEIGHT / DOT_TILE)");
    expect(code(cardSource)).not.toMatch(/\b153\b/);
  });
});

describe("no emoji on a rendered surface (T-WEB-S208)", () => {
  const EMOJI = /\p{Extended_Pictographic}/u;
  const RENDERED = /\.(?:tsx|css)$/;
  const SKIP = new Set(["node_modules", ".next", ".turbo"]);

  function decodeEscapes(source: string, css = false): string {
    const pattern = css
      ? /\\u\{([\dA-Fa-f]{1,6})\}|\\u([\dA-Fa-f]{4})|\\([\dA-Fa-f]{4,6})\b/g
      : /\\u\{([\dA-Fa-f]{1,6})\}|\\u([\dA-Fa-f]{4})()/g;
    return source.replaceAll(
      pattern,
      (whole, braced?: string, plain?: string, bare?: string) => {
        const hex = braced ?? plain ?? bare ?? "";
        const point = Number.parseInt(hex, 16);
        if (hex.length === 0 || !Number.isFinite(point) || point > 0x10_ff_ff) {
          return whole;
        }
        return String.fromCodePoint(point);
      },
    );
  }

  function renderedSurfaces(): string[] {
    const found: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (SKIP.has(entry.name)) {
          continue;
        }
        const path = join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(path);
        } else if (RENDERED.test(entry.name)) {
          found.push(path);
        }
      }
    };
    for (const root of ["app", "src"]) {
      walk(join(import.meta.dirname, "..", root));
    }
    return found;
  }

  it("no .tsx or .css under apps/web/{app,src} contains an emoji, escaped or literal", () => {
    const scanned = renderedSurfaces();
    const offenders = scanned.filter((path) =>
      EMOJI.test(
        decodeEscapes(readFileSync(path, "utf8"), path.endsWith(".css")),
      ),
    );
    expect(offenders).toEqual([]);
  });

  it("the scan is not vacuous — it reaches BOTH roots, and #34's own two surfaces", () => {
    const scanned = renderedSurfaces();
    const expected: [string, string][] = [
      ["src/play/conclusion-view.tsx", "ConclusionView"],
      ["app/sudoku/page.tsx", "export const dynamic"],

      ["src/og/card.tsx", "gameCard"],
      ["app/sudoku/opengraph-image.tsx", "export const alt"],
    ];
    for (const [relative, token] of expected) {
      const path = join(import.meta.dirname, "..", relative);
      expect.soft(scanned, relative).toContain(path);
      expect.soft(readFileSync(path, "utf8"), relative).toContain(token);
    }

    expect(EMOJI.test("🟩")).toBe(true);
    expect(EMOJI.test("⬜")).toBe(true);
    for (const [escaped, css] of [
      [String.raw`{"\u{1F7E9} " + args.longDate}`, false],
      [String.raw`const WHITE = "\u2B1C";`, false],
      [String.raw`.tile::after { content: "\1F7E8"; }`, true],
    ] as const) {
      expect.soft(EMOJI.test(escaped), escaped).toBe(false);
      expect.soft(EMOJI.test(decodeEscapes(escaped, css)), escaped).toBe(true);
    }

    expect(
      EMOJI.test(decodeEscapes(String.raw`#211D190F /\bfaceA/ \2b1c`, false)),
    ).toBe(false);
  });
});

describe("nothing but a game and a date reaches the card builder (T-WEB-S201)", () => {
  const appDir = join(import.meta.dirname, "..", "app");
  const games = ["binairo", "sudoku", "nonogram", "termo"];
  const routeFiles = [
    ...games.map((game) => join(appDir, game, "opengraph-image.tsx")),
    ...games.map((game) =>
      join(appDir, "arquivo", "[data]", game, "opengraph-image.tsx"),
    ),
  ];
  const handlerSource = code(
    readFileSync(join(import.meta.dirname, "../src/og/handlers.ts"), "utf8"),
  );

  it("the two call sites pass exactly { game, longDate }, and no route file builds a card", () => {
    expect(routeFiles.filter((path) => existsSync(path))).toHaveLength(8);
    const calls = [...handlerSource.matchAll(/gameCard\(\{([^}]*)\}/g)];
    expect(calls).toHaveLength(2);

    for (const call of calls) {
      const keys = (call[1] ?? "")
        .split(",")
        .map((part) => part.split(":")[0]?.trim())
        .filter((key) => key !== undefined && key.length > 0);
      expect.soft(keys, call[0]).toEqual(["game", "longDate"]);
    }

    for (const path of routeFiles) {
      const source = code(readFileSync(path, "utf8"));
      expect.soft(source, path).not.toContain("gameCard");
      expect.soft(source, path).not.toContain("getDb");
    }
  });

  it("the ONLY properties read off a reader's return value are .date and .length", () => {
    const bindings = [
      ...handlerSource.matchAll(
        /(\w+)\s*=\s*await\s+(getPublishedDaily|getTodayDaily|listArchivedDays)\(/g,
      ),
    ];

    expect(bindings).toHaveLength(4);

    const byIdentifier = new Map<string, Set<string>>();
    for (const binding of bindings) {
      const identifier = binding[1] ?? "";
      if (!byIdentifier.has(identifier)) {
        byIdentifier.set(identifier, new Set());
      }

      for (const read of handlerSource.matchAll(
        new RegExp(
          String.raw`\b${identifier}\s*(?:\[[^\]]*\])?\s*\.(\w+)`,
          "g",
        ),
      )) {
        byIdentifier.get(identifier)?.add(read[1] ?? "");
      }
    }

    expect([...byIdentifier.keys()].sort()).toEqual(["daily", "days"]);

    expect([...(byIdentifier.get("daily") ?? [])]).toEqual(["date"]);

    expect([...(byIdentifier.get("days") ?? [])]).toEqual(["length"]);

    const indexed = [...byIdentifier.keys()].filter((identifier) =>
      new RegExp(String.raw`\b${identifier}\s*\[`).test(handlerSource),
    );
    expect(indexed).toEqual([]);
  });

  it("archiveCard's declared parameter type admits no Game and no ArchivedDay", () => {
    const declaration = code(cardSource).match(
      /export function archiveCard\(args: \{([\s\S]*?)\}\): ReactElement/,
    );
    expect(declaration).not.toBeNull();
    const members = [
      ...(declaration?.[1] ?? "").matchAll(/readonly\s+(\w+)(\??): (\w+);/g),
    ];
    expect(members.map((member) => member[1])).toEqual(["display", "caption"]);
    expect(members.map((member) => member[2])).toEqual(["", ""]);

    expect(members.map((member) => member[3])).toEqual(["string", "string"]);
  });

  it("gameCard's declared parameter type admits no other member", () => {
    const declaration = code(cardSource).match(
      /export function gameCard\(args: \{([\s\S]*?)\}\): ReactElement/,
    );
    expect(declaration).not.toBeNull();
    const members = [
      ...(declaration?.[1] ?? "").matchAll(/readonly\s+(\w+)(\??):/g),
    ];
    expect(members.map((member) => member[1])).toEqual(["game", "longDate"]);

    expect(members.map((member) => member[2])).toEqual(["", ""]);
  });
});

describe("the archive card is a dated nameplate (T-WEB-S333)", () => {
  const MONTH = formatMonth("2026-11-01");
  const DAY = formatDayAndMonth("2026-11-20");

  const cards = {
    index: {
      display: messages.archive.title,
      caption: ogCopy.archiveTagline,
    },
    month: { display: MONTH, caption: messages.archive.title },
    day: { display: DAY, caption: ogCopy.archiveDayCaption("2026") },
  } as const;

  function lines(tree: ReactElement): { text: string; size: unknown }[] {
    return elements(tree)
      .filter(
        (element) =>
          typeof (element.props as { readonly children?: unknown }).children ===
          "string",
      )
      .map((element) => ({
        text: String((element.props as { readonly children: string }).children),
        size: styleOf(element)["fontSize"],
      }));
  }

  it("archiveIndexCard IS the index row of this table — one composition, one home", () => {
    expect(lines(archiveIndexCard())).toEqual(lines(archiveCard(cards.index)));
    expect(cards.index.display).toBe(messages.archive.title);
    expect(cards.index.caption).toBe(ogCopy.archiveTagline);
  });

  it("each card's three lines are display, caption, wordmark — in that order", () => {
    for (const [name, args] of Object.entries(cards)) {
      const found = lines(archiveCard(args));

      expect
        .soft(
          found.map((line) => line.text),
          name,
        )
        .toEqual([args.display, args.caption, messages.brand.wordmark]);

      expect
        .soft(
          found.map((line) => line.size),
          name,
        )
        .toEqual([96, 39, 39]);
    }
  });

  it("the display slot holds the most specific thing the URL names", () => {
    const displays = Object.values(cards).map((args) => args.display);
    expect(new Set(displays).size).toBe(3);

    //

    expect(cards.day.display).not.toBe(messages.archive.title);
    expect(cards.month.display).not.toBe(messages.archive.title);

    expect(
      Object.entries(cards)
        .filter(([, args]) => args.display === messages.archive.title)
        .map(([name]) => name),
    ).toEqual(["index"]);
  });

  it("the day card takes RUNG 2: the year is on the caption, not the display line", () => {
    //

    expect(cards.day.display).not.toMatch(/\d{4}/);
    expect(cards.day.caption).toContain("2026");
    expect(cards.day.caption).toContain(messages.archive.title);

    expect(cards.month.display).toMatch(/\d{4}/);
  });

  it("no kicker on any archive card, and the accent is the APP accent only", () => {
    for (const [name, args] of Object.entries(cards)) {
      const tree = archiveCard(args);
      expect.soft(valuesOf(tree, "textTransform"), name).toEqual([]);
      expect.soft(valuesOf(tree, "letterSpacing"), name).toEqual([]);

      const sizes = elements(tree)
        .map((element) => styleOf(element)["fontSize"])
        .filter((size): size is number => typeof size === "number");
      expect.soft(sizes, `${name} sizes`).not.toContain(33);
      expect
        .soft([...new Set(sizes)].sort(), `${name} sizes`)
        .toEqual([39, 96]);

      const tape = valuesOf(tree, "backgroundColor").filter(mentionsAnAccent);
      const shadow = valuesOf(tree, "boxShadow").filter(mentionsAnAccent);
      expect.soft(tape, `${name} tape`).toEqual([ACCENT_APP_TAPE]);
      expect
        .soft(shadow, `${name} shadow`)
        .toEqual([`15px 15px 0 ${ACCENT_APP_SHADOW}`]);

      expect
        .soft(valuesOf(tree, "color").filter(mentionsAnAccent), `${name} words`)
        .toEqual([]);
    }
  });

  it("every multi-child node declares display:flex — satori THROWS otherwise", () => {
    for (const [name, args] of Object.entries(cards)) {
      const offenders = elements(archiveCard(args)).filter((element) => {
        const children = (element.props as { readonly children?: unknown })
          .children;
        const count = Array.isArray(children) ? children.flat().length : 1;
        return count > 1 && styleOf(element)["display"] !== "flex";
      });
      expect.soft(offenders.map(styleOf), name).toEqual([]);
    }

    const multi = elements(archiveCard(cards.day)).filter((element) => {
      const children = (element.props as { readonly children?: unknown })
        .children;
      return Array.isArray(children) && children.flat().length > 1;
    });
    expect(multi.length).toBeGreaterThanOrEqual(3);
  });

  it("the archive card's own module graph reaches no reader", () => {
    expect(code(cardSource)).not.toContain("@miolos/db");
    expect(code(cardSource)).not.toContain("getDb");
    expect(code(cardSource)).not.toContain("listArchivedDays");

    expect(code(cardSource)).toContain("export function archiveCard");
  });
});
