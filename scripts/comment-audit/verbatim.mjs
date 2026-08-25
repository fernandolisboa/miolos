import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { commentRanges } from "./count.mjs";

// Rule F, mechanically: every surviving SENTENCE must appear verbatim in the
// same file's comment text on `main`. Consecutive `//` lines are merged into
// one block first, so a sentence wrapped across them is not split in half.
const norm = (s) =>
  s
    .replace(/^\s*(\/\*+|\*+\/|\/\/|\*)\s?/gm, " ")
    .replace(/\s+/g, " ")
    .trim();

const sentences = (text) =>
  norm(text)
    .split(/(?<=[.!?])\s+(?=[A-Z`*_[(#"'-]|\*\*)/)
    .map((x) => x.trim())
    .filter((x) => x.length > 25);

function blocks(file) {
  const { text, ranges } = commentRanges(file);
  const merged = [];
  for (const [a, b] of ranges) {
    const prev = merged.at(-1);
    // adjacent `//` lines: nothing but whitespace between the two ranges
    if (prev && text.slice(prev[1], a).trim() === "") prev[1] = b;
    else merged.push([a, b]);
  }
  return { text, merged };
}

let bad = 0;
for (const f of process.argv.slice(2)) {
  const before = execFileSync("git", ["show", `main:${f}`], {
    encoding: "utf8",
  });
  fs.writeFileSync("/tmp/verbatim-base.ts", before);
  const baseText = norm(
    commentRanges("/tmp/verbatim-base.ts")
      .ranges.map(([a, b]) => before.slice(a, b))
      .join("\n"),
  );
  const { text, merged } = blocks(f);
  for (const [a, b] of merged) {
    for (const s of sentences(text.slice(a, b))) {
      if (baseText.includes(s)) continue;
      bad++;
      const line = text.slice(0, a).split("\n").length;
      console.log(`\n[${bad}] ${f}:${line}\n  ${s}`);
    }
  }
}
console.log(`\n${bad} sentence(s) not byte-identical to main.`);
