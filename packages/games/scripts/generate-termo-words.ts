import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { renderTermoWordsModule } from "./render-termo-words.ts";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(scriptsDir, "..", "..", "..");
const contentDir = join(repoRoot, "content", "termo");
const outputPath = join(scriptsDir, "..", "src", "termo", "words.generated.ts");

const answersCsv = readFileSync(join(contentDir, "answers.csv"), "utf8");
const validationTxt = readFileSync(join(contentDir, "validation.txt"), "utf8");

writeFileSync(outputPath, renderTermoWordsModule(answersCsv, validationTxt));
console.log(`wrote ${outputPath}`);
