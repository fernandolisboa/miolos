import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { MEDAL_DEFINITIONS, MEDAL_IDS } from "@miolos/core";
import { describe, expect, it } from "vitest";

import { medalCopy } from "../src/medals/copy";

// The medal content harness (#30, ADR-0052; the ADR-0015 method's
// mechanical-validation half over the pt-BR copy) — the word-list.test.ts
// file-reading precedent. Homed HERE rather than packages/core because the
// copy lives web-side (ADR-0018) and `packages/core` deliberately has no
// `@types/node`. The rules enforced below are `content/medals/README.md`'s
// own "Naming & tone rules" — prose there may be tightened, rules may not
// be weakened, and this file is what makes that sentence mechanical.

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
}

/** The README's catalog table rows: `| <n> | \`id\` | name | description |
 *  rule | rationale |`. Only the catalog table numbers its first column,
 *  so the digit test selects exactly its body rows. */
function readCatalogRows(): CatalogRow[] {
  return readme
    .split("\n")
    .filter((line) => /^\|\s*\d+\s*\|/.test(line))
    .map((line) => {
      const cells = line.split("|").map((cell) => cell.trim());
      // cells[0] is the empty string before the leading pipe.
      return {
        id: (cells[2] ?? "").replaceAll("`", ""),
        name: cells[3] ?? "",
        description: cells[4] ?? "",
      };
    });
}

/** The rejected-candidates section's bullet rows (`- *Candidate* → reason`). */
function rejectedCandidates(): string[] {
  const section = readme.split("## Rejected candidates")[1]?.split("\n## ")[0];
  expect(section).toBeDefined();
  return (section ?? "").split("\n").filter((line) => line.startsWith("- *"));
}

// The README's forbidden-vocabulary list, verbatim: the vetoed concepts
// (CONTEXT.md, ADR-0006) plus the scoreboard words, the recorded copy
// rejections ("dias seguidos"; the Terms-to-avoid; dica/pista), and the
// three bundle canaries. Word-bounded via Unicode lookarounds — `\b` is
// ASCII-only and misfires beside accented letters.
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

// The recorded past-tense first-word allowlist — extending it is a
// deliberate README + harness edit (the README's own mood rule).
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
    // Catalog order IS display order, and the README's table is the
    // constraints file's own record of it: array equality pins membership
    // AND order in one assertion.
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
    // The reverse direction — a table row with no medalCopy record — is
    // the id-parity assertion above plus the `satisfies` exhaustiveness
    // typecheck (a missing or stray medalCopy key is a compile error).
  });

  it("the rejected-candidates sample records at least 10 judgment calls", () => {
    expect(rejectedCandidates().length).toBeGreaterThanOrEqual(10);
  });

  it("every name passes the mechanical rules: 2–28 chars, no exclamation or question marks, no emoji, no forbidden vocabulary", () => {
    for (const id of MEDAL_IDS) {
      const { name } = medalCopy[id];
      expect.soft(name.length, id).toBeGreaterThanOrEqual(2);
      expect.soft(name.length, id).toBeLessThanOrEqual(28);
      expect.soft(name, id).not.toMatch(/[!?]/);
      expect.soft(name, id).not.toMatch(EMOJI);
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
      // The threshold as a standalone number — "30" must not be satisfied
      // by "300".
      const digits = new RegExp(`(?<!\\d)${String(threshold)}(?!\\d)`);
      expect
        .soft(description, `${definition.id}: threshold ${String(threshold)}`)
        .toMatch(digits);
    }
  });
});
