import { execFileSync } from "node:child_process";
import { commentText } from "./count.mjs";
import { recordsRe, parseArgs } from "./records.mjs";

//

const strip = (t) => t.replace(/^\s*(\/\*+|\*+\/|\/\/|\*)\s?/gm, " ");
const corpus = (file, raw) => strip(commentText(file, raw).text);

const { base, files } = parseArgs(process.argv, "citations.mjs");

let total = 0;
let skipped = 0;
for (const f of files) {
  let before;
  try {
    before = corpus(
      f,
      execFileSync("git", ["show", `${base}:${f}`], { encoding: "utf8" }),
    );
  } catch {
    skipped++;
    console.log("  -  " + f + "  (absent on " + base + ")");
    continue;
  }
  let after;
  try {
    after = corpus(f);
  } catch {
    skipped++;
    console.log("  -  " + f + "  (absent from the working tree)");
    continue;
  }
  const n =
    (before.match(recordsRe()) ?? []).length -
    (after.match(recordsRe()) ?? []).length;
  total += n;
  console.log(String(n).padStart(3) + "  " + f);
}
console.log(
  String(total).padStart(3) +
    "  TOTAL records-citation matches removed" +
    (skipped ? `; ${skipped} of ${files.length} file(s) SKIPPED` : ""),
);
if (skipped === files.length) process.exit(2);
