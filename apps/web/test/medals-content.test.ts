import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { MEDAL_DEFINITIONS, MEDAL_IDS } from "@miolos/core";
import { describe, expect, it } from "vitest";

import { medalCopy } from "../src/medals/copy";

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(testDir, "..", "..", "..");
const readme = readFileSync(
  join(repoRoot, "content", "medals", "README.md"),
  "utf8",
);

interface CatalogRow {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly rule: string;
}

function readCatalogRows(): CatalogRow[] {
  return readme
    .split("\n")
    .filter((line) => /^\|\s*\d+\s*\|/.test(line))
    .map((line) => {
      const cells = line.split("|").map((cell) => cell.trim());

      return {
        id: (cells[2] ?? "").replaceAll("`", ""),
        name: cells[3] ?? "",
        description: cells[4] ?? "",
        rule: cells[5] ?? "",
      };
    });
}

function canonicalRule(
  rule: (typeof MEDAL_DEFINITIONS)[number]["rule"],
): string {
  switch (rule.kind) {
    case "totalWins":
      return `totalWins, ${rule.game ?? "all games"}, ${String(rule.count)}`;
    case "streakReached":
      return `streakReached, ${String(rule.days)}`;
    case "perfectDaysReached":
      return `perfectDaysReached, ${String(rule.count)}`;
    case "termoGuessWins":
      return `termoGuessWins, ${String(rule.guesses)} ${
        rule.guesses === 1 ? "guess" : "guesses"
      }, ${String(rule.count)}×`;
    case "eachGameWon":
      return "eachGameWon";
    case "curated":
      return "curated";
  }
}

function rejectedCandidates(): string[] {
  const section = readme.split("## Rejected candidates")[1]?.split("\n## ")[0];
  expect(section).toBeDefined();
  return (section ?? "").split("\n").filter((line) => line.startsWith("- *"));
}

const FORBIDDEN_VOCABULARY = [
  "xp",
  "níveis",
  "nível",
  "moedas",
  "moeda",
  "pontos",
  "ponto",
  "ranking",
  "ranque",
  "placar",
  "troféu",
  "dias seguidos",
  "premium",
  "wordle",
  "picross",
  "griddler",
  "hanjie",
  "paint-by-numbers",
  "dicas",
  "dica",
  "pistas",
  "pista",
  "então",
  "mamãe",
  "época",
];
const forbiddenRegex = new RegExp(
  `(?<![\\p{L}\\p{N}])(${FORBIDDEN_VOCABULARY.join("|")})(?![\\p{L}\\p{N}])`,
  "iu",
);

const PAST_TENSE_FIRST_WORDS = new Set([
  "Acertou",
  "Chegou",
  "Concluiu",
  "Estava",
  "Venceu",
]);

const EMOJI = /\p{Extended_Pictographic}/u;

describe("the medal content harness (T-WEB-S163)", () => {
  it("the README catalog table and MEDAL_IDS agree — same ids, same order, both directions", () => {
    expect(readCatalogRows().map((row) => row.id)).toEqual([...MEDAL_IDS]);
  });

  it("every medalCopy name and description is VERBATIM the README table's — parity both directions", () => {
    const rows = new Map(readCatalogRows().map((row) => [row.id, row]));
    for (const id of MEDAL_IDS) {
      const row = rows.get(id);
      expect(row, id).toBeDefined();
      expect(medalCopy[id].name, id).toBe(row?.name);
      expect(medalCopy[id].description, id).toBe(row?.description);
    }
  });

  it("T-WEB-S163a: the README table's Rule column equals the canonical rendering of each definition's rule params — the column cannot drift", () => {
    const rows = new Map(readCatalogRows().map((row) => [row.id, row]));
    for (const definition of MEDAL_DEFINITIONS) {
      expect(rows.get(definition.id)?.rule, definition.id).toBe(
        canonicalRule(definition.rule),
      );
    }
  });

  it("T-WEB-S163b: the README text carries every forbidden-vocabulary entry and every allowlist word — weakening the README fails the suite", () => {
    const lower = readme.toLowerCase();
    for (const entry of FORBIDDEN_VOCABULARY) {
      expect.soft(lower.includes(entry.toLowerCase()), entry).toBe(true);
    }
    for (const word of PAST_TENSE_FIRST_WORDS) {
      expect.soft(readme.includes(word), word).toBe(true);
    }
  });

  it("the rejected-candidates sample records at least 10 judgment calls", () => {
    expect(rejectedCandidates().length).toBeGreaterThanOrEqual(10);
  });

  it("every name passes the mechanical rules: 2–28 chars, no exclamation or question marks, no emoji, no digits, no diminutives, no forbidden vocabulary", () => {
    for (const id of MEDAL_IDS) {
      const { name } = medalCopy[id];
      expect.soft(name.length, id).toBeGreaterThanOrEqual(2);
      expect.soft(name.length, id).toBeLessThanOrEqual(28);
      expect.soft(name, id).not.toMatch(/[!?]/);
      expect.soft(name, id).not.toMatch(EMOJI);

      expect.soft(name, id).not.toMatch(/[0-9]/);
      expect.soft(name, id).not.toMatch(/inh[oa]\b/i);
      expect.soft(forbiddenRegex.test(name), `${id}: ${name}`).toBe(false);
    }
  });

  it("every description passes the mechanical rules: 20–120 chars, ends with a period, past-tense first word from the recorded allowlist, no emoji, no forbidden vocabulary", () => {
    for (const id of MEDAL_IDS) {
      const { description } = medalCopy[id];
      expect.soft(description.length, id).toBeGreaterThanOrEqual(20);
      expect.soft(description.length, id).toBeLessThanOrEqual(120);
      expect.soft(description, id).toMatch(/\.$/);
      expect.soft(description, id).not.toMatch(EMOJI);
      expect
        .soft(forbiddenRegex.test(description), `${id}: ${description}`)
        .toBe(false);
      const firstWord = description.split(" ")[0] ?? "";
      expect
        .soft(PAST_TENSE_FIRST_WORDS.has(firstWord), `${id}: ${firstWord}`)
        .toBe(true);
    }
  });

  it("threshold-digits parity: every counted rule with threshold ≥ 2 states its threshold as digits in the description", () => {
    for (const definition of MEDAL_DEFINITIONS) {
      const { rule } = definition;
      const threshold =
        rule.kind === "totalWins" ||
        rule.kind === "perfectDaysReached" ||
        rule.kind === "termoGuessWins"
          ? rule.count
          : rule.kind === "streakReached"
            ? rule.days
            : undefined;
      if (threshold === undefined || threshold < 2) {
        continue;
      }
      const { description } = medalCopy[definition.id];

      const digits = new RegExp(`(?<!\\d)${String(threshold)}(?!\\d)`);
      expect
        .soft(description, `${definition.id}: threshold ${String(threshold)}`)
        .toMatch(digits);
    }
  });
});
