import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";

import { TERMO_MAX_GUESSES } from "@miolos/core";
import { TERMO_ANSWERS } from "@miolos/games/termo";
import { describe, expect, it } from "vitest";

import { formatElapsed, formatShortDate, messages } from "../src/i18n";
import {
  binairoPlayRecordSchema,
  nonogramPlayRecordSchema,
  sudokuPlayRecordSchema,
  termoPlayRecordSchema,
  type BinairoPlayRecord,
  type NonogramPlayRecord,
  type SudokuPlayRecord,
  type TermoPlayRecord,
} from "../src/play/play-record";
import { buildShareText } from "../src/play/share-text";

const DATE = "2026-08-14";
const SHORT_DATE = formatShortDate(DATE);
const URL = "https://miolos.app/arquivo/2026-08-14/termo";
const ELAPSED_MS = 432_000;

const SRC = join(import.meta.dirname, "..", "src");
const SHARE_TEXT = join(SRC, "play", "share-text.ts");

const SOURCE = readFileSync(SHARE_TEXT, "utf8");

function code(source: string): string {
  return source
    .replaceAll(/\/\*[\s\S]*?\*\//g, "")
    .replaceAll(/(^|[^:])\/\/.*$/gm, "$1");
}

function composerBody(): string {
  const stripped = code(SOURCE);
  const start = stripped.indexOf("export function buildShareText");
  expect(
    start,
    "buildShareText is not declared in share-text.ts",
  ).toBeGreaterThan(-1);
  return stripped.slice(start);
}

function binairo(
  overrides: Partial<BinairoPlayRecord> = {},
): BinairoPlayRecord {
  return {
    v: 1,
    game: "binairo",
    date: DATE,
    entries: Array.from({ length: 64 }, () => null),
    grid: Array.from({ length: 64 }, (_unused, index) => (index % 2) as 0 | 1),
    elapsedMs: ELAPSED_MS,
    hintsUsed: 0,
    concluded: true,
    pendingSync: false,
    syncOutcome: "recorded",
    ...overrides,
  };
}

function sudoku(overrides: Partial<SudokuPlayRecord> = {}): SudokuPlayRecord {
  return {
    v: 1,
    game: "sudoku",
    date: DATE,
    entries: Array.from({ length: 81 }, () => null),
    grid: Array.from(
      { length: 9 },
      () => [1, 2, 3, 4, 5, 6, 7, 8, 9] as const,
    ).flat(),
    elapsedMs: ELAPSED_MS,
    hintsUsed: 0,
    concluded: true,
    pendingSync: false,
    syncOutcome: "recorded",
    ...overrides,
  };
}

function nonogram(
  overrides: Partial<NonogramPlayRecord> = {},
): NonogramPlayRecord {
  const size = overrides.size ?? 10;
  return {
    v: 1,
    game: "nonogram",
    date: DATE,
    size,
    entries: Array.from({ length: size ** 2 }, () => null),
    grid: Array.from(
      { length: size ** 2 },
      (_unused, index) => (index % 2) as 0 | 1,
    ),
    elapsedMs: ELAPSED_MS,
    hintsUsed: 0,
    concluded: true,
    pendingSync: false,
    syncOutcome: "recorded",
    ...overrides,
  };
}

type JudgedGuess = TermoPlayRecord["guesses"][number];

const CORRECT_ROW: JudgedGuess = {
  guess: "sonho",
  tiles: ["correct", "correct", "correct", "correct", "correct"],
};
const MIXED_ROW: JudgedGuess = {
  guess: "carta",
  tiles: ["absent", "present", "absent", "absent", "absent"],
};
const NEAR_ROW: JudgedGuess = {
  guess: "manto",
  tiles: ["absent", "absent", "correct", "present", "absent"],
};

function termoWon(overrides: Partial<TermoPlayRecord> = {}): TermoPlayRecord {
  return {
    v: 1,
    game: "termo",
    date: DATE,
    guesses: [MIXED_ROW, NEAR_ROW, MIXED_ROW, CORRECT_ROW],
    answer: "sonho",
    outcome: "won",
    elapsedMs: ELAPSED_MS,
    hintsUsed: 0,
    concluded: true,
    pendingSync: false,
    syncOutcome: "recorded",
    ...overrides,
  };
}

function termoLost(overrides: Partial<TermoPlayRecord> = {}): TermoPlayRecord {
  return {
    v: 1,
    game: "termo",
    date: DATE,
    guesses: [MIXED_ROW, NEAR_ROW, MIXED_ROW, NEAR_ROW, MIXED_ROW, NEAR_ROW],
    answer: "sonho",
    outcome: "lost",
    elapsedMs: ELAPSED_MS,
    hintsUsed: 0,
    concluded: true,
    pendingSync: false,
    syncOutcome: "recorded",
    ...overrides,
  };
}

describe("Termo's share carries the grid and the genre's own score line (T-WEB-S189)", () => {
  const GREEN = "\u{1F7E9}";
  const YELLOW = "\u{1F7E8}";
  const WHITE = "\u{2B1C}";

  it("maps correct/present/absent onto the three squares, one row per judged guess", () => {
    expect(messages.share.tiles).toEqual({
      correct: GREEN,
      present: YELLOW,
      absent: WHITE,
    });

    const lines = buildShareText(termoWon(), { url: URL }).split("\n");

    expect(lines).toEqual([
      `${messages.brand.wordmark} · ${messages.games.termo.name} · ${SHORT_DATE}`,
      `4/${String(TERMO_MAX_GUESSES)}`,
      "",
      `${WHITE}${YELLOW}${WHITE}${WHITE}${WHITE}`,
      `${WHITE}${WHITE}${GREEN}${YELLOW}${WHITE}`,
      `${WHITE}${YELLOW}${WHITE}${WHITE}${WHITE}`,
      `${GREEN}${GREEN}${GREEN}${GREEN}${GREEN}`,
      "",
      URL,
    ]);
  });

  it("a loss is X/6 over six rows, and the row count follows the record", () => {
    const lines = buildShareText(termoLost(), { url: URL }).split("\n");

    expect(lines[1]).toBe(`X/${String(TERMO_MAX_GUESSES)}`);
    const grid = lines.slice(3, -2);
    expect(grid).toHaveLength(6);
    for (const row of grid) {
      expect([...row]).toHaveLength(5);
    }

    const three = buildShareText(
      termoWon({ guesses: [MIXED_ROW, NEAR_ROW, CORRECT_ROW] }),
      { url: URL },
    ).split("\n");
    expect(three[1]).toBe(`3/${String(TERMO_MAX_GUESSES)}`);
    expect(three.slice(3, -2)).toHaveLength(3);
  });
});

describe("the day's answer never reaches the share (T-WEB-S190)", () => {
  it("no canonical answer appears in the composed text, over all 400 of them", () => {
    expect(TERMO_ANSWERS.length).toBe(400);

    const offenders: string[] = [];
    let swept = 0;

    for (const { canonical } of TERMO_ANSWERS) {
      for (const record of [
        termoWon({ answer: canonical }),
        termoLost({ answer: canonical }),
      ]) {
        expect(termoPlayRecordSchema.safeParse(record).success).toBe(true);
        expect(record.answer).toBe(canonical);
        expect(canonical).toHaveLength(5);

        const output = buildShareText(record, { url: URL });
        const lines = output.split("\n");

        expect(lines.at(-1)).toBe(URL);

        const body = lines.slice(0, -1).join("\n");
        if (body.includes(canonical)) {
          offenders.push(canonical);
        }
        swept += 1;
      }
    }

    expect(swept).toBe(800);
    expect(offenders).toEqual([]);
  });

  it("two records differing ONLY in the answer compose byte-identical text", () => {
    for (const build of [termoWon, termoLost]) {
      const sonho = build({ answer: "sonho" });
      const casal = build({ answer: "casal" });
      expect(termoPlayRecordSchema.safeParse(sonho).success).toBe(true);
      expect(termoPlayRecordSchema.safeParse(casal).success).toBe(true);
      expect(sonho.answer).not.toBe(casal.answer);

      expect(buildShareText(sonho, { url: URL })).toBe(
        buildShareText(casal, { url: URL }),
      );
    }
  });
});

function moduleGraph(entry: string): string[] {
  const seen = new Set<string>();
  const queue = [entry];
  while (queue.length > 0) {
    const current = queue.pop();
    if (current === undefined || seen.has(current)) {
      continue;
    }
    seen.add(current);
    const source = readFileSync(current, "utf8");
    for (const match of source.matchAll(
      /(?:from|import)\s*\(?\s*"(\.[^"]*)"/g,
    )) {
      const resolved = resolveRelative(current, match[1] ?? "");
      if (resolved !== undefined) {
        queue.push(resolved);
      }
    }
  }
  return [...seen];
}

function resolveRelative(from: string, specifier: string): string | undefined {
  const base = join(dirname(from), specifier);
  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    join(base, "index.ts"),
    join(base, "index.tsx"),
  ]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) {
      return candidate;
    }
  }
  return undefined;
}

describe("the three grid games, and the exclusion list (T-WEB-S191)", () => {
  it("composes header, elapsed, a blank line and the URL — and nothing else", () => {
    for (const record of [binairo(), sudoku(), nonogram()]) {
      expect(buildShareText(record, { url: URL }).split("\n")).toEqual([
        `${messages.brand.wordmark} · ${messages.games[record.game].name} · ${SHORT_DATE}`,
        formatElapsed(ELAPSED_MS),
        "",
        URL,
      ]);
    }
  });

  it("(a) nothing under medals, streak, stats or day-state is reachable from the composer", () => {
    const graph = moduleGraph(SHARE_TEXT);

    for (const forbidden of [
      join("src", "medals"),
      join("src", "streak"),
      join("src", "stats"),
      join("src", "play", "day-state"),
    ]) {
      expect(
        graph.filter((path) => path.includes(forbidden)),
        forbidden,
      ).toEqual([]);
    }

    expect(graph).toContain(join(SRC, "i18n", "messages.ts"));
    expect(graph).toContain(join(SRC, "i18n", "format.ts"));
  });

  it("(b) every excluded field that IS on the record is proved out by a differential", () => {
    const pairs: [string, () => [unknown, unknown]][] = [
      ...(
        [
          ["binairo", binairo],
          ["sudoku", sudoku],
          ["nonogram", nonogram],
          ["termo/won", termoWon],
          ["termo/lost", termoLost],
        ] as const
      ).flatMap(([name, build]): [string, () => [unknown, unknown]][] => [
        [
          `${name}: hintsUsed`,
          () => [build({ hintsUsed: 0 }), build({ hintsUsed: 1 })],
        ],
        [
          `${name}: syncOutcome pending/recorded`,
          () => [
            build({ syncOutcome: "pending" }),
            build({ syncOutcome: "recorded" }),
          ],
        ],
        [
          `${name}: syncOutcome recorded/rejected`,
          () => [
            build({ syncOutcome: "recorded" }),
            build({ syncOutcome: "rejected" }),
          ],
        ],
      ]),

      ...(
        [
          ["binairo", binairo],
          ["sudoku", sudoku],
          ["nonogram", nonogram],
        ] as const
      ).map(([name, build]): [string, () => [unknown, unknown]] => [
        `${name}: solved grid present/absent`,
        () => [build({}), build({ grid: undefined })],
      ]),

      [
        "nonogram: size 5 vs 15",
        () => [nonogram({ size: 5 }), nonogram({ size: 15 })],
      ],

      [
        "binairo: entries empty vs filled",
        () => [
          binairo({}),
          binairo({ entries: Array.from({ length: 64 }, () => 0 as const) }),
        ],
      ],
      [
        "sudoku: entries empty vs filled",
        () => [
          sudoku({}),
          sudoku({ entries: Array.from({ length: 81 }, () => 5 as const) }),
        ],
      ],
      [
        "nonogram: entries empty vs filled",
        () => [
          nonogram({}),
          nonogram({ entries: Array.from({ length: 100 }, () => 1 as const) }),
        ],
      ],

      ...(
        [
          ["binairo", binairo],
          ["sudoku", sudoku],
          ["nonogram", nonogram],
          ["termo/won", termoWon],
          ["termo/lost", termoLost],
        ] as const
      ).map(([name, build]): [string, () => [unknown, unknown]] => [
        `${name}: pendingSync`,
        () => [build({ pendingSync: false }), build({ pendingSync: true })],
      ]),
    ];

    for (const [name, build] of pairs) {
      const [left, right] = build();

      for (const record of [left, right]) {
        expect(
          playRecordParses(record),
          `${name}: fixture does not parse`,
        ).toBe(true);
      }
      expect(JSON.stringify(left), name).not.toBe(JSON.stringify(right));
      expect(
        buildShareText(left as BinairoPlayRecord, { url: URL }),
        name,
      ).toBe(buildShareText(right as BinairoPlayRecord, { url: URL }));
    }
  });

  it("(c) each record member's key set is written down, so a new field is a decision", () => {
    const SHAPES: Readonly<Record<string, readonly string[]>> = {
      binairo: [
        "v",
        "game",
        "date",
        "entries",
        "grid",
        "elapsedMs",
        "hintsUsed",
        "concluded",
        "pendingSync",
        "syncOutcome",
      ],
      sudoku: [
        "v",
        "game",
        "date",
        "entries",
        "grid",
        "elapsedMs",
        "hintsUsed",
        "concluded",
        "pendingSync",
        "syncOutcome",
      ],
      nonogram: [
        "v",
        "game",
        "date",
        "size",
        "entries",
        "grid",
        "elapsedMs",
        "hintsUsed",
        "concluded",
        "pendingSync",
        "syncOutcome",
      ],
      termo: [
        "v",
        "game",
        "date",
        "guesses",
        "answer",
        "outcome",
        "elapsedMs",
        "hintsUsed",
        "concluded",
        "pendingSync",
        "syncOutcome",
      ],
    };

    const shapes: Readonly<Record<string, object>> = {
      binairo: binairoPlayRecordSchema.shape,
      sudoku: sudokuPlayRecordSchema.shape,

      nonogram: nonogramPlayRecordSchema.shape,
      termo: termoPlayRecordSchema.shape,
    };

    for (const [game, expected] of Object.entries(SHAPES)) {
      const shape = shapes[game];
      expect(shape, `${game}: no .shape`).toBeDefined();
      expect(Object.keys(shape ?? {}), game).toEqual([...expected]);
      expect(Object.keys(shape ?? {}), `${game}: tier`).not.toContain("tier");
    }
  });

  it("(d) the composer's second parameter declares exactly one member, url", () => {
    const body = composerBody();
    const signature = body.slice(0, body.indexOf("): string"));

    expect(signature).toContain("buildShareText");
    expect(signature).toContain("subject");

    const objectTypes = [...signature.matchAll(/\{([^{}]*)\}/g)].map(
      (match) => match[1] ?? "",
    );
    expect(
      objectTypes,
      "exactly one inline object type in the signature",
    ).toHaveLength(1);

    const members = (objectTypes[0] ?? "")
      .split(/[;,]/)
      .map((member) => member.trim())
      .filter((member) => member.length > 0)
      .map((member) =>
        member
          .replace(/^readonly\s+/, "")
          .split(/[?:]/)[0]
          ?.trim(),
      );
    expect(members).toEqual(["url"]);
  });
});

function playRecordParses(record: unknown): boolean {
  for (const schema of [
    binairoPlayRecordSchema,
    sudokuPlayRecordSchema,
    nonogramPlayRecordSchema,
    termoPlayRecordSchema,
  ]) {
    if (schema.safeParse(record).success) {
      return true;
    }
  }
  return false;
}

describe("the composer holds no route knowledge (T-WEB-S192)", () => {
  it("no `/arquivo` literal appears in share-text.ts", () => {
    expect(SOURCE.length).toBeGreaterThan(0);
    expect(SOURCE).toContain("buildShareText");

    expect(/["'`]\/arquivo/.test('href="/arquivo/2026-08-14/termo"')).toBe(
      true,
    );

    expect(/["'`]\/arquivo/.test(code(SOURCE))).toBe(false);
  });
});

describe("every user-visible string comes from messages.share (T-WEB-S193)", () => {
  it("the composer's body carries no copy — only structural separators and the record's own discriminants", () => {
    const literals = [
      ...composerBody().matchAll(/(["'`])(?:(?!\1).){2,}\1/g),
    ].map((match) => match[0]);

    const ALLOWED = new Set(['"\\n"', '"termo"', '"won"']);

    expect(literals).toContain('"\\n"');

    expect(literals.filter((literal) => !ALLOWED.has(literal))).toEqual([]);
  });
});

describe("the share deck's audits (T-WEB-S206)", () => {
  it("no share string carries a FORBIDDEN_EVERYWHERE canonical", () => {
    const script = readFileSync(
      join(import.meta.dirname, "..", "scripts", "route-client-js.mjs"),
      "utf8",
    );
    const declaration = /const FORBIDDEN_EVERYWHERE = \[([^\]]*)\]/.exec(
      script,
    );
    expect(declaration, "FORBIDDEN_EVERYWHERE is not declared").not.toBeNull();
    const forbidden = [...(declaration?.[1] ?? "").matchAll(/"([^"]+)"/g)].map(
      (match) => match[1] ?? "",
    );
    expect(forbidden.length).toBeGreaterThanOrEqual(3);

    const rendered = [
      JSON.stringify(messages.share),
      messages.share.header(messages.games.termo.name, SHORT_DATE),
      messages.share.termoWon(4, TERMO_MAX_GUESSES),
      messages.share.termoLost(TERMO_MAX_GUESSES),
    ].join("\n");

    expect(rendered).toContain(messages.share.label);
    expect(rendered).toContain(messages.share.failed);

    for (const marker of forbidden) {
      expect(rendered, marker).not.toContain(marker);
    }
  });

  it("neither share-text.ts nor messages.ts imports from @miolos/games/termo", () => {
    const MESSAGES = join(SRC, "i18n", "messages.ts");
    const messagesSource = readFileSync(MESSAGES, "utf8");

    expect(SOURCE).toContain("buildShareText");
    expect(messagesSource).toContain("export const messages");

    for (const [name, source] of [
      ["share-text.ts", SOURCE],
      ["messages.ts", messagesSource],
    ] as const) {
      expect(code(source), name).not.toContain("@miolos/games/termo");
      expect(code(source), name).not.toContain("packages/games/src/termo");
    }
  });
});
