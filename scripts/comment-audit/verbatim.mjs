import { execFileSync } from "node:child_process";
import { commentRangesOf, commentRanges } from "./count.mjs";
import { requireFiles } from "./records.mjs";

// Rule F, mechanically: every surviving SENTENCE must appear verbatim in the
// same file's comment text on the base ref. Consecutive `//` lines are merged
// into one block first, so a sentence wrapped across them is not split.
//
// Its green is NARROWER than "nothing was reworded": sentences of 25
// characters or fewer are not compared, and the match is a substring test over
// the whole file's comment corpus, so a sentence that MOVED is not flagged.
// Pair it with `excision.mjs`, which is the one a PR body declares from.
export const norm = (s) =>
  s
    .replace(/^\s*(\/\*+|\*+\/|\/\/|\*)\s?/gm, " ")
    .replace(/\s+/g, " ")
    .trim();

export const sentences = (text) =>
  norm(text)
    .split(/(?<=[.!?])\s+(?=[A-Z`*_[(#"'-]|\*\*)/)
    .map((x) => x.trim())
    .filter((x) => x.length > 25);

export function blocks(file) {
  const { text, ranges } = commentRanges(file);
  const merged = [];
  for (const [a, b] of ranges) {
    const prev = merged.at(-1);
    if (prev && text.slice(prev[1], a).trim() === "") prev[1] = b;
    else merged.push([a, b]);
  }
  return { text, merged };
}

export function baseCorpus(file, base) {
  const before = execFileSync("git", ["show", `${base}:${file}`], {
    encoding: "utf8",
  });
  const { ranges } = commentRangesOf(file, before);
  return ranges.map(([a, b]) => before.slice(a, b)).join("\n");
}

const argv = requireFiles(process.argv, "verbatim.mjs [--base <ref>]");
let base = "main";
const files = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--base") base = argv[++i];
  else files.push(argv[i]);
}

let bad = 0;
for (const f of files) {
  let baseText;
  try {
    baseText = norm(baseCorpus(f, base));
  } catch {
    console.log(`SKIP ${f} (absent on ${base})`);
    continue;
  }
  const { text, merged } = blocks(f);
  for (const [a, b] of merged) {
    for (const s of sentences(text.slice(a, b))) {
      if (baseText.includes(s)) continue;
      bad++;
      console.log(
        `\n[${bad}] ${f}:${text.slice(0, a).split("\n").length}\n  ${s}`,
      );
    }
  }
}
console.log(`\n${bad} sentence(s) not byte-identical to ${base}.`);
