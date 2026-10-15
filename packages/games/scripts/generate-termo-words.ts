import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { renderTermoFreePoolModule } from "./render-termo-free-pool.ts";
import {
  renderTermoAnswersModule,
  renderTermoValidationModule,
} from "./render-termo-words.ts";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(scriptsDir, "..", "..", "..");
const srcDir = join(scriptsDir, "..", "src");
const read = (...path: string[]) =>
  readFileSync(join(repoRoot, "content", ...path), "utf8");

const answersCsv = read("termo", "answers.csv");
const validationTxt = read("termo", "validation.txt");
const reserveTxt = read("termo", "reserve.txt");
const lexiconTsv = read("crossword", "lexicon.tsv");

const outputs: readonly (readonly [string, string])[] = [
  [
    join(srcDir, "termo", "words.generated.ts"),
    renderTermoValidationModule(validationTxt),
  ],
  [
    join(srcDir, "termo-answers", "answers.generated.ts"),
    renderTermoAnswersModule(answersCsv),
  ],
  [
    join(srcDir, "termo-free", "pool.generated.ts"),
    renderTermoFreePoolModule(
      lexiconTsv,
      validationTxt,
      answersCsv,
      reserveTxt,
    ),
  ],
];

for (const [path, module] of outputs) {
  writeFileSync(path, module);
  console.log(`wrote ${path}`);
}
