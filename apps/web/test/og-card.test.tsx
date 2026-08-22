import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { isValidElement, type ReactElement } from "react";
import { describe, expect, it } from "vitest";

import { formatDayAndMonth, formatMonth, messages } from "../src/i18n";
import { archiveCard, gameCard, siteCard } from "../src/og/card";
import { ogCopy } from "../src/og/copy";
import { ACCENT_APP_SHADOW, ACCENT_APP_TAPE } from "../src/og/tokens";

/**
 * The OG card's element tree, asserted WITHOUT a rasteriser (#34, ADR-0054).
 * `card.tsx` returns plain elements and constructs no `ImageResponse`, which
 * is what lets everything except the three genuinely pixel-level claims live
 * in this jsdom file rather than in `og-image.node.test.ts`.
 */

const repoRoot = join(import.meta.dirname, "../../..");
const cardSource = readFileSync(
  join(import.meta.dirname, "../src/og/card.tsx"),
  "utf8",
);

/**
 * The file with its comments removed, so a literal assertion counts CODE and
 * not the doc block that explains the derivation at length. The same stripper
 * `eslint-db-wall.test.ts` and `archive-routes.test.ts` use.
 */
function code(source: string): string {
  return source
    .replaceAll(/\/\*[\s\S]*?\*\//g, "")
    .replaceAll(/(^|[^:])\/\/.*$/gm, "$1");
}

/** Every element in the tree, depth-first, the root included. */
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

/** Every declared value in the tree, per CSS property. */
function valuesOf(tree: ReactElement, property: string): string[] {
  return elements(tree)
    .map((element) => styleOf(element)[property])
    .filter((value): value is string => typeof value === "string");
}

/** The six accent tokens, in the 7-character form `tokens.css` spells. */
const ACCENTS = [
  "#8D6212", // --accent-termo (deep mustard since ADR-0067)
  "#2E4E7E", // --accent-sudoku
  "#B5563C", // --accent-nonogram
  "#4E6B52", // --accent-binairo
  "#9E3B2F", // --accent-app
];

function mentionsAnAccent(value: string): boolean {
  return ACCENTS.some((accent) =>
    value.toUpperCase().includes(accent.toUpperCase()),
  );
}

describe("the OG card paints the accent on the tape and the shadow only (T-WEB-S200)", () => {
  it("no word on any card is accent-coloured, and the accent IS found twice", () => {
    // ADR-0041 decision 1, obeyed without invoking its exception. The
    // reference frames' accent-coloured kickers predate the ADR and are
    // deliberately not copied: `DESIGN.md`'s colour section says outright
    // that "the kicker is no longer among" the sanctioned accent surfaces.
    const trees: [string, ReactElement][] = [
      ["site", siteCard()],
      // #104's three archive cards walk the same absence: one builder, three
      // call shapes, and no accent-coloured word on any of them.
      [
        "archive index",
        archiveCard({
          display: messages.archive.title,
          caption: ogCopy.archiveTagline,
        }),
      ],
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
      // THE ABSENCE.
      expect
        .soft(valuesOf(tree, "color").filter(mentionsAnAccent), name)
        .toEqual([]);

      // THE COUNTED FLOOR, which is what makes the line above a real absence
      // rather than an empty scan: this tree does carry the accent, exactly
      // twice, on exactly the two surfaces `DESIGN.md` sanctions.
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
      // And there is real text to have got wrong.
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
    // No CSS custom property can reach a PNG, so the card holds literals —
    // and a literal with no token behind it is a palette fork. The tie-back
    // is a SUBSTRING match on the leading seven characters, which is why the
    // alpha values are 8-digit hex (`#2E4E7E38`) rather than `rgba()`:
    // `rgba(46,78,126,0.22)` is a substring of nothing in `tokens.css`.
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

    // Counted floor: an empty literal set would pass the loop below.
    expect(literals.length).toBeGreaterThanOrEqual(11);
    for (const literal of literals) {
      expect.soft(tokensCss, literal).toContain(literal.slice(0, 7));
    }
  });

  it("the desk texture is 153 dots at 1200x630, DERIVED from the size", () => {
    // `ceil(1200/72) x ceil(630/72)` = 17 x 9, emitted ROW-MAJOR, so a
    // hand-written count below 153 truncates from the bottom-right. The
    // figure is computed and not eyeballed (step-6 finding Q5): at 120 the
    // last dot is index 119 — row 7, column 0, at (0, 504) — leaving row 7
    // from x = 72 and the whole of row 8 unpainted, the bottom 126px of the
    // card. Asserted below rather than only described.
    const dots = elements(
      gameCard({ game: "binairo", longDate: "1 de maio de 2026" }),
    ).filter((element) => styleOf(element)["backgroundColor"] === "#211D190F");
    expect(dots).toHaveLength(153);

    // The comment's arithmetic, as an assertion: the lattice really is
    // row-major on a 72px pitch, so "index 119 sits at (0, 504)" is a fact
    // about the shipped tree and not a story about it.
    const at = (index: number) => {
      const style = styleOf(dots[index] as ReactElement);
      return [style["left"], style["top"]];
    };
    expect(at(0)).toEqual([0, 0]);
    expect(at(1)).toEqual([72, 0]);
    expect(at(17)).toEqual([0, 72]);
    expect(at(119)).toEqual([0, 504]);
    expect(at(152)).toEqual([16 * 72, 8 * 72]);

    // And the count is a derivation, not a literal anyone can drift.
    expect(cardSource).toContain("Math.ceil(CARD_WIDTH / DOT_TILE)");
    expect(cardSource).toContain("Math.ceil(CARD_HEIGHT / DOT_TILE)");
    expect(code(cardSource)).not.toMatch(/\b153\b/);
  });
});

describe("no emoji on a rendered surface (T-WEB-S208)", () => {
  /**
   * ADR-0054 decision 2's other half, as a gate. The three squares in
   * `messages.share.tiles` are CONTENT in a channel with no CSS — a share
   * text has no fonts and no tokens, so the square is the only available
   * encoding of a per-cell verdict. `DESIGN.md:58` bans emoji that decorate
   * a RENDERED PAGE, where the design system could set a word instead, and
   * this scan is that ban: every `.tsx` and `.css` under `src` and `app`.
   *
   * `messages.ts` is a `.ts` file and therefore outside the scope by
   * EXTENSION, which is the same scoping `medals-content.test.ts:129` uses
   * for its own emoji regex — not an exemption written for #34.
   *
   * WHAT THIS DOES NOT CATCH, stated because plan 040 :135 claimed it did
   * (step-6 finding G6). The plan justified this gate as closing "a later
   * ticket could render a preview of the share text on a page". It does not:
   * `<pre>{buildShareText(...)}</pre>` carries no literal emoji and passes
   * green. What the scan catches is an emoji AUTHORED INTO a rendered
   * surface, which is the realistic regression. An import-graph arm was
   * considered and is impossible as stated — `conclusion-view.tsx` is itself
   * a rendered `.tsx` that legitimately imports `share-text.ts`, so "no
   * rendered surface reaches the share composer" is red on the shipped tree.
   * The runtime path is held by ADR-0054 decision 2 and by design review.
   */
  const EMOJI = /\p{Extended_Pictographic}/u;
  const RENDERED = /\.(?:tsx|css)$/;
  const SKIP = new Set(["node_modules", ".next", ".turbo"]);

  /**
   * ESCAPE-ENCODED EMOJI ARE DECODED BEFORE THE SCAN (step-6 finding Q2).
   * `{"✅ " + args.longDate}` renders exactly the character a literal
   * `✅` renders, and the raw regex sees only backslashes and hex — so the
   * gate was blind to the one spelling an author reaches for when a literal
   * feels awkward. It is not a hypothetical spelling either:
   * `share-text.test.ts:186-190` writes the three squares that way IN A
   * COMMENT SAYING codepoint escapes keep a file "outside every emoji scan
   * in the repo". The file explaining the evasion sits next to the gate.
   *
   * Both TS/JSX forms are decoded — `\uXXXX` and `\u{XXXXX}` — plus, IN
   * `.css` FILES ONLY, the `content: "\1F7E9"` form, which is the same
   * evasion one file extension over. The bare-backslash form is scoped that
   * way on purpose: outside CSS it would decode `\face` inside a regex
   * literal, and a scanner with false positives is a scanner someone
   * eventually deletes. Out-of-range points are left as written rather than
   * throwing.
   */
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
    // ONE NAMED FILE PER ROOT, not one file total: a typo in either root
    // string would leave half the walk dead with a single-file twin still
    // green. Each named file is paired with a token that must be found IN
    // it, so a walk that returns paths but reads nothing reds too.
    const scanned = renderedSurfaces();
    const expected: [string, string][] = [
      ["src/play/conclusion-view.tsx", "ConclusionView"],
      ["app/sudoku/page.tsx", "export const dynamic"],
      // #34's own new rendered surfaces, one per root. The `app` entry is a
      // dated card route: B1 turned the ROOT card into `opengraph-image.png`
      // plus `opengraph-image.alt.txt`, neither of which the walk's `.tsx|.css`
      // filter can see, so naming it here would leave this half dead.
      ["src/og/card.tsx", "gameCard"],
      ["app/sudoku/opengraph-image.tsx", "export const alt"],
    ];
    for (const [relative, token] of expected) {
      const path = join(import.meta.dirname, "..", relative);
      expect.soft(scanned, relative).toContain(path);
      expect.soft(readFileSync(path, "utf8"), relative).toContain(token);
    }
    // And the regex itself sees what it is aimed at — in BOTH spellings,
    // because the escaped one is the spelling that shipped past this gate.
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
    // And the decoder invents nothing out of ordinary hex prose or a regex
    // literal — `\face` is four hex digits and decodes to no pictograph.
    expect(
      EMOJI.test(decodeEscapes(String.raw`#211D190F /\bfaceA/ \2b1c`, false)),
    ).toBe(false);
  });
});

describe("nothing but a game and a date reaches the card builder (T-WEB-S201)", () => {
  // A SOURCE SCAN, and it is aimed at the argument rather than at the result.
  // "Hand the builder a complete daily response" could not fail: `gameCard`'s
  // signature has no parameter such a response can enter through, which is
  // the property — the scan's job is to keep the CALL SITES honest, and to
  // keep the signature from quietly growing a third member.
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
    // COUNTED FLOOR, both halves: a wrong root or a typo'd glob would
    // otherwise let every assertion below pass over an empty set.
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

    // The route files are table entries: they hold a game token and a
    // delegation, and never touch the builder or a reader themselves.
    for (const path of routeFiles) {
      const source = code(readFileSync(path, "utf8"));
      expect.soft(source, path).not.toContain("gameCard");
      expect.soft(source, path).not.toContain("getDb");
    }
  });

  it("the ONLY properties read off a reader's return value are .date and .length", () => {
    // THE READER-BOUND IDENTIFIERS ARE DISCOVERED, NEVER HARDCODED. Until
    // #104 this scan was `/\bdaily\.(\w+)/g`, bound to the local variable name
    // the two shipped handlers happen to use — so the two new archive handlers,
    // which bind `days`, would have been INVISIBLE to it and `toEqual(["date"])`
    // would have stayed green whatever they read. A scan that cannot see new
    // code is not a gate. So: find every `<name> = await <reader>(` instead.
    const bindings = [
      ...handlerSource.matchAll(
        /(\w+)\s*=\s*await\s+(getPublishedDaily|getTodayDaily|listArchivedDays)\(/g,
      ),
    ];
    // COUNTED FLOOR FIRST, which is the failure this row exists to close: a
    // renamed reader or a reshaped call must not make the scan pass over an
    // empty set. Four reads, in four handlers.
    expect(bindings).toHaveLength(4);

    const byIdentifier = new Map<string, Set<string>>();
    for (const binding of bindings) {
      const identifier = binding[1] ?? "";
      if (!byIdentifier.has(identifier)) {
        byIdentifier.set(identifier, new Set());
      }
      for (const read of handlerSource.matchAll(
        new RegExp(String.raw`\b${identifier}\.(\w+)`, "g"),
      )) {
        byIdentifier.get(identifier)?.add(read[1] ?? "");
      }
    }

    expect([...byIdentifier.keys()].sort()).toEqual(["daily", "days"]);
    // `daily` supplies the ONE non-content value the game card names.
    expect([...(byIdentifier.get("daily") ?? [])]).toEqual(["date"]);
    // `days` supplies nothing at all: the archive read is an EXISTENCE proof,
    // so its return is read only for its length. `ArchivedDay` is
    // `{date, game}` and `days[0].game` is one property access away — this is
    // what stops that access being written, and `archiveCard`'s signature is
    // what makes it useless if it ever were.
    expect([...(byIdentifier.get("days") ?? [])]).toEqual(["length"]);
  });

  it("archiveCard's declared parameter type admits no Game and no ArchivedDay", () => {
    // #104's structural guarantee, in the same terms as `gameCard`'s below:
    // two already-formatted strings, neither optional, and no parameter a
    // `Game` or an `ArchivedDay` can enter through. This is what makes "the
    // archive card names no game" a type-level property rather than a
    // convention — `limit: 1` bounds the read, it does not hide a game.
    const declaration = code(cardSource).match(
      /export function archiveCard\(args: \{([\s\S]*?)\}\): ReactElement/,
    );
    expect(declaration).not.toBeNull();
    const members = [
      ...(declaration?.[1] ?? "").matchAll(/readonly\s+(\w+)(\??): (\w+);/g),
    ];
    expect(members.map((member) => member[1])).toEqual(["display", "caption"]);
    expect(members.map((member) => member[2])).toEqual(["", ""]);
    // And both are plain `string`s — not `Game`, not `ArchivedDay`.
    expect(members.map((member) => member[3])).toEqual(["string", "string"]);
  });

  it("gameCard's declared parameter type admits no other member", () => {
    // The type-level half. `longDate` is REQUIRED, so there is no dateless
    // variant to fall back to, and no optional member a response can fill.
    const declaration = code(cardSource).match(
      /export function gameCard\(args: \{([\s\S]*?)\}\): ReactElement/,
    );
    expect(declaration).not.toBeNull();
    const members = [
      ...(declaration?.[1] ?? "").matchAll(/readonly\s+(\w+)(\??):/g),
    ];
    expect(members.map((member) => member[1])).toEqual(["game", "longDate"]);
    // Neither is optional.
    expect(members.map((member) => member[2])).toEqual(["", ""]);
  });
});

describe("the archive card is a dated nameplate (T-WEB-S333)", () => {
  /**
   * #104, ADR-0071. One builder, three call shapes, and the rule the
   * composition rests on: THE DISPLAY SLOT HOLDS THE MOST SPECIFIC THING THE
   * URL NAMES. The alternative — the constant word "Arquivo" at 96px on all
   * three — would make ~1,096 day cards visually interchangeable with the
   * index card, which is the ticket's own stated failure.
   */
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

  /** Every element whose child is a string: display, caption, wordmark. */
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

  it("each card's three lines are display, caption, wordmark — in that order", () => {
    for (const [name, args] of Object.entries(cards)) {
      const found = lines(archiveCard(args));
      // Exactly three text lines: one display, ONE caption, and the wordmark
      // LAST. No kicker line, and no second caption.
      expect
        .soft(
          found.map((line) => line.text),
          name,
        )
        .toEqual([args.display, args.caption, messages.brand.wordmark]);
      // The display slot is the 96px one and the other two are 39px — the
      // hierarchy is what the rule above is about, not merely the order.
      expect
        .soft(
          found.map((line) => line.size),
          name,
        )
        .toEqual([96, 39, 39]);
    }
  });

  it("the display slot holds the most specific thing the URL names", () => {
    // Stated as three DIFFERENCES rather than three equalities, because the
    // failure this guards is all three cards showing the same word.
    const displays = Object.values(cards).map((args) => args.display);
    expect(new Set(displays).size).toBe(3);
    // The month card names its month, the day card names its day — and the
    // DAY card's display line is NOT "Arquivo".
    expect(cards.month.display).toBe(MONTH);
    expect(cards.day.display).toBe(DAY);
    expect(cards.day.display).not.toBe(messages.archive.title);
    expect(cards.month.display).not.toBe(messages.archive.title);
    // Only the index card, which has no date, puts the section name up top.
    expect(cards.index.display).toBe(messages.archive.title);
  });

  it("the day card takes RUNG 2: the year is on the caption, not the display line", () => {
    // MEASURED, not chosen (plan 068 §12.2). The full `formatLongDate` output
    // at 96px Fraunces runs to 1111px against 890px of card and satori
    // overflows silently, so the year moved down a line. If a later ticket
    // puts it back, this reds.
    expect(cards.day.display).not.toMatch(/\d{4}/);
    expect(cards.day.caption).toContain("2026");
    expect(cards.day.caption).toContain(messages.archive.title);
    // And the month card did NOT split: it fits at 96px (843px worst case).
    expect(cards.month.display).toMatch(/\d{4}/);
  });

  it("no kicker on any archive card, and the accent is the APP accent only", () => {
    // `DESIGN.md:29` — kickers are a game-category system, not a generic
    // section eyebrow, so "ARQUIVO" as a 33px uppercase line is the banned
    // use. `siteCard` is the precedent: a non-game card has no kicker. The
    // two properties below are the kicker's own signature in this module.
    for (const [name, args] of Object.entries(cards)) {
      const tree = archiveCard(args);
      expect.soft(valuesOf(tree, "textTransform"), name).toEqual([]);
      expect.soft(valuesOf(tree, "letterSpacing"), name).toEqual([]);
      // And the kicker's own 33px level is absent too — `fontSize` is a
      // NUMBER here, so it is collected numerically rather than through
      // `valuesOf`, which filters to strings and would pass vacuously.
      const sizes = elements(tree)
        .map((element) => styleOf(element)["fontSize"])
        .filter((size): size is number => typeof size === "number");
      expect.soft(sizes, `${name} sizes`).not.toContain(33);
      expect
        .soft([...new Set(sizes)].sort(), `${name} sizes`)
        .toEqual([39, 96]);

      // The card is not any one game's, so it takes `--accent-app` on the
      // tape and the shadow — and no OTHER accent reaches it at all.
      const tape = valuesOf(tree, "backgroundColor").filter(mentionsAnAccent);
      const shadow = valuesOf(tree, "boxShadow").filter(mentionsAnAccent);
      expect.soft(tape, `${name} tape`).toEqual([ACCENT_APP_TAPE]);
      expect
        .soft(shadow, `${name} shadow`)
        .toEqual([`15px 15px 0 ${ACCENT_APP_SHADOW}`]);
      // And no word is accent-coloured — `DESIGN.md:19`, which is also the
      // reason a row of four game names could never have worked.
      expect
        .soft(valuesOf(tree, "color").filter(mentionsAnAccent), `${name} words`)
        .toEqual([]);
    }
  });

  it("every multi-child node declares display:flex — satori THROWS otherwise", () => {
    // Landmine 1 of `card.tsx`'s four, and jsdom does not catch it: a plain
    // `<div>` with two children throws at RASTERISATION, which is a 500 on a
    // crawler-facing route. Asserted on the tree so it reds in jsdom instead.
    for (const [name, args] of Object.entries(cards)) {
      const offenders = elements(archiveCard(args)).filter((element) => {
        const children = (element.props as { readonly children?: unknown })
          .children;
        const count = Array.isArray(children) ? children.flat().length : 1;
        return count > 1 && styleOf(element)["display"] !== "flex";
      });
      expect.soft(offenders.map(styleOf), name).toEqual([]);
    }
    // Counted floor: the tree really does have multi-child nodes to get
    // wrong — the desk (dots + card), the card box (tape + column) and the
    // column itself (four children).
    const multi = elements(archiveCard(cards.day)).filter((element) => {
      const children = (element.props as { readonly children?: unknown })
        .children;
      return Array.isArray(children) && children.flat().length > 1;
    });
    expect(multi.length).toBeGreaterThanOrEqual(3);
  });

  it("the archive card's own module graph reaches no reader", () => {
    // The builder takes two strings, so it cannot import a reader — asserted
    // on the shipped source rather than argued, in `T-WEB-S204`'s terms.
    expect(code(cardSource)).not.toContain("@miolos/db");
    expect(code(cardSource)).not.toContain("getDb");
    expect(code(cardSource)).not.toContain("listArchivedDays");
    // Anti-vacuity: the file really was read and really does build the card.
    expect(code(cardSource)).toContain("export function archiveCard");
  });
});
