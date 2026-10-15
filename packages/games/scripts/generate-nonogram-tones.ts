import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { TONES_5 } from "../src/nonogram/colors-5.ts";
import { TONES_8 } from "../src/nonogram/colors-8.ts";
import { TONES_10 } from "../src/nonogram/colors-10.ts";
import { TONES_15 } from "../src/nonogram/colors-15.ts";
import { renderNonogramTonesModule } from "./render-nonogram-tones.ts";

const path = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "src",
  "nonogram-colors",
  "tones.generated.ts",
);
writeFileSync(
  path,
  renderNonogramTonesModule([TONES_5, TONES_8, TONES_10, TONES_15]),
);
console.log(`wrote ${path}`);
