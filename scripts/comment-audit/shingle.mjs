import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { commentText } from "./count.mjs";
import { parseArgs } from "./records.mjs";

// Rule A, mechanically: what CITES a comment before you delete it. Builds an
// index of 7-word shingles over every tracked file except the ones being
// swept, then looks up each target comment's prose in it.
//
// Shingles, not `grep`, because a citation wraps across lines and is often a
// paraphrase. It reports candidates for a human to read — a hit is not proof
// of a citation, and the hit COUNT is the ranking, not the verdict.
const N = 7;

const norm = (s) =>
  s
    .replace(/^\s*(\/\*+|\*+\/|\/\/|\*)\s?/gm, " ")
    .replace(/[`*_"'‘’“”]/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();

function shingles(text) {
  const w = norm(text).split(" ").filter(Boolean);
  const out = [];
  for (let i = 0; i + N <= w.length; i++) out.push(w.slice(i, i + N).join(" "));
  return out;
}

const { files: targets } = parseArgs(process.argv, "shingle.mjs", false);
const skip = new Set(targets.map((f) => path.resolve(f)));

const tracked = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter((f) => /\.(ts|tsx|mjs|js|md|css|json|ya?ml)$/.test(f))
  .filter((f) => !skip.has(path.resolve(f)));

const index = new Map();
for (const f of tracked) {
  let lines;
  try {
    lines = fs.readFileSync(f, "utf8").split("\n");
  } catch {
    continue;
  }
  for (let i = 0; i < lines.length; i++) {
    // A 3-line window, so a shingle that wraps across lines still indexes.
    const win = lines.slice(i, i + 3).join(" ");
    for (const s of shingles(win)) {
      if (!index.has(s)) index.set(s, new Set());
      index.get(s).add(`${f}:${i + 1}`);
    }
  }
}

let found = 0;
let skipped = 0;
for (const f of targets) {
  let text;
  try {
    ({ text } = commentText(f));
  } catch {
    skipped++;
    console.log(`   -  (absent from the working tree)  ${f}`);
    continue;
  }
  const hits = new Map();
  for (const s of shingles(text)) {
    for (const w of index.get(s) ?? []) hits.set(w, (hits.get(w) ?? 0) + 1);
  }
  if (hits.size === 0) continue;
  found++;
  console.log(`\n--- ${f} is echoed by:`);
  for (const [w, c] of [...hits].sort((a, b) => b[1] - a[1]).slice(0, 8)) {
    console.log(`    ${String(c).padStart(3)}x  ${w}`);
  }
}
console.log(
  `\n${found} of ${targets.length} file(s) have prose echoed elsewhere; ` +
    `${tracked.length} tracked files indexed. Read the hits — a hit is a candidate, not a verdict.` +
    (skipped ? ` ${skipped} of ${targets.length} SKIPPED.` : ""),
);
if (skipped === targets.length) process.exit(2);
