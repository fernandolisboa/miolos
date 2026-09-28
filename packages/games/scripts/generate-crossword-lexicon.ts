import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { renderCrosswordLexiconModule } from "./render-crossword-lexicon.ts";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(scriptsDir, "..", "..", "..");
const lexiconPath = join(repoRoot, "content", "crossword", "lexicon.tsv");
const outputPath = join(
  scriptsDir,
  "..",
  "src",
  "crossword",
  "lexicon.generated.ts",
);

writeFileSync(
  outputPath,
  renderCrosswordLexiconModule(readFileSync(lexiconPath, "utf8")),
);
console.log(`wrote ${outputPath}`);
