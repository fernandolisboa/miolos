import { execFileSync } from "node:child_process";
import fs from "node:fs";

// The literal convention behind this tranche's "citation occurrences removed":
// matches of RECORDS present in the file's full text on `main` and absent on
// HEAD. Published so the number is re-runnable rather than asserted.
const RECORDS =
  /\((?:[^)]*\b(?:plan \d+|step-\d+|round-\d+|finding)\b[^)]*|§[^)]*|CLI-\d+|[PSND]\d+(?:\/[PSND]\d+)?)\)|`[^`]*\.tsx?:[\d-]+`/g;

let total = 0;
for (const f of process.argv.slice(2)) {
  const before = execFileSync("git", ["show", `main:${f}`], {
    encoding: "utf8",
  });
  const after = fs.readFileSync(f, "utf8");
  const n =
    (before.match(RECORDS) ?? []).length - (after.match(RECORDS) ?? []).length;
  total += n;
  console.log(String(n).padStart(3) + "  " + f);
}
console.log(
  String(total).padStart(3) + "  TOTAL records-citation matches removed",
);
