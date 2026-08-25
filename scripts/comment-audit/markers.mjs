import fs from "node:fs";

// The marker scan behind this tranche's advice to #205 about what is left.
// Published because the ranking it produces is the input to the next tranche's
// scoping, and a different regex gives a different order.
const MARKERS =
  /\bplan \d+\b|§\d|\bstep-\d\b|\bround-\d\b|\bfinding\b|\bT-WEB-S\d+|\bT-LINT-S\d+|[\w/-]+\.tsx?:\d/g;

const rows = process.argv
  .slice(2)
  .map((f) => [(fs.readFileSync(f, "utf8").match(MARKERS) ?? []).length, f]);
rows.sort((a, b) => b[0] - a[0]);
let total = 0;
for (const [n, f] of rows) {
  total += n;
  console.log(String(n).padStart(3) + "  " + f);
}
console.log(String(total).padStart(3) + "  TOTAL");
