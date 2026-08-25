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

// From the repo ROOT, not the cwd: `git ls-files` is cwd-relative, so running
// this from a game directory indexed one file and answered "nothing cites
// these comments" for the whole repo.
const root = execFileSync("git", ["rev-parse", "--show-toplevel"], {
  encoding: "utf8",
}).trim();

const tracked = execFileSync("git", ["ls-files", "-z"], {
  encoding: "utf8",
  cwd: root,
})
  .split("\0")
  .filter((f) => f && !/\.(png|jpe?g|gif|svg|woff2?|ttf|ico|lock)$/.test(f))
  .map((f) => path.join(root, f))
  .filter((f) => !skip.has(path.resolve(f)));

// Zero files indexed answers "nothing cites this" for every comment in the
// repo, which is the false green Rule A cannot afford: it authorises deleting
// the only copy of a rule.
if (tracked.length === 0) {
  console.error(
    "shingle.mjs: indexed 0 files, so every answer would be a false negative.",
  );
  process.exit(2);
}

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
  const ranked = [...hits].sort((a, b) => b[1] - a[1]);
  for (const [w, c] of ranked.slice(0, 12)) {
    console.log(
      `    ${String(c).padStart(3)}x  ${path.relative(root, w.replace(/:(\d+)$/, "")) + w.match(/:(\d+)$/)[0]}`,
    );
  }
  // Hiding a candidate is the dangerous direction for a scan that authorises
  // a deletion, so say so rather than truncating silently.
  if (ranked.length > 12) {
    console.log(`    …and ${ranked.length - 12} more location(s)`);
  }
}
console.log(
  `\n${found} of ${targets.length} file(s) have prose echoed elsewhere; ` +
    `${tracked.length} tracked files indexed. Read the hits — a hit is a candidate, not a verdict.` +
    (skipped ? ` ${skipped} of ${targets.length} SKIPPED.` : ""),
);
if (skipped === targets.length) process.exit(2);
