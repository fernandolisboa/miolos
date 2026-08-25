import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { commentRanges } from "./count.mjs";

// This tranche is almost entirely records-genre CITATION EXCISION, so the plain
// verbatim check flags nearly every touched sentence. The precise claim is
// narrower and this proves it: strip every records-genre citation from BOTH
// sides, and every surviving sentence must still be verbatim from `main`.
// Anything that fails here changed words, not just a citation.
const CITATION = new RegExp(
  [
    "\\s*\\((?:plan [^)]*|#\\d+, plan [^)]*|step-6[^)]*|[^)]*finding\\s[^)]*|§[^)]*|CLI-\\d+|[PSND]\\d+(?:/[PSND]\\d+)?|ADR-\\d+ Context [^)]*)\\)",
    "\\s*\\(`[^`]*\\.tsx?:[\\d-]+`\\)",
    "`[^`]*\\.tsx?:[\\d-]+`",
  ].join("|"),
  "g",
);

const norm = (s) =>
  s
    .replace(/^\s*(\/\*+|\*+\/|\/\/|\*)\s?/gm, " ")
    .replace(CITATION, " ")
    .replace(/\s+/g, " ")
    // stripping a citation leaves a space before the punctuation that followed
    // it, on the `main` side only; normalise both sides so the comparison is
    // about words rather than about where the parenthesis used to sit.
    .replace(/\s+([.,;:)])/g, "$1")
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
  fs.writeFileSync("/tmp/excision-base.ts", before);
  const baseText = norm(
    commentRanges("/tmp/excision-base.ts")
      .ranges.map(([a, b]) => before.slice(a, b))
      .join("\n"),
  );
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
console.log(
  bad === 0
    ? "\nEvery surviving sentence is verbatim from main once records-genre citations are stripped from both sides."
    : `\n${bad} sentence(s) changed by more than a citation excision.`,
);
