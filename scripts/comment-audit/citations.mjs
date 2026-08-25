import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { recordsRe, requireFiles } from "./records.mjs";

// How many records-genre citations a sweep removed: matches present in the
// file on the base ref and absent in the working tree. Published so a PR
// body's figure is re-runnable rather than typed (#205 Rule P).
const argv = requireFiles(process.argv, "citations.mjs [--base <ref>]");
let base = "main";
const files = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--base") base = argv[++i];
  else files.push(argv[i]);
}

let total = 0;
for (const f of files) {
  let before;
  try {
    before = execFileSync("git", ["show", `${base}:${f}`], {
      encoding: "utf8",
    });
  } catch {
    console.log("  -  " + f + "  (absent on " + base + ")");
    continue;
  }
  const after = fs.readFileSync(f, "utf8");
  const n =
    (before.match(recordsRe()) ?? []).length -
    (after.match(recordsRe()) ?? []).length;
  total += n;
  console.log(String(n).padStart(3) + "  " + f);
}
console.log(
  String(total).padStart(3) + "  TOTAL records-citation matches removed",
);
