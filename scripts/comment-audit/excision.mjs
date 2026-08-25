import { recordsRe, parseArgs } from "./records.mjs";
import { baseCorpus, blocks } from "./verbatim.mjs";

// The claim a PR body declares from: strip records-genre citations from BOTH
// sides, and every surviving sentence must still be verbatim. What it flags
// changed by more than a citation.
const norm = (s) =>
  s
    .replace(/^\s*(\/\*+|\*+\/|\/\/|\*)\s?/gm, " ")
    .replace(recordsRe(), " ")
    .replace(/\s+/g, " ")
    // A strip leaves a space before the punctuation that followed it, on the
    // base side only; normalise both so the comparison is about words.
    .replace(/\s+([.,;:)])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

const sentences = (text) =>
  norm(text)
    .split(/(?<=[.!?])\s+(?=[A-Z`*_[(#"'-]|\*\*)/)
    .map((x) => x.trim())
    .filter((x) => x.length > 25);

const { base, files } = parseArgs(process.argv, "excision.mjs");

let bad = 0;
for (const f of files) {
  let baseText;
  try {
    baseText = norm(baseCorpus(f, base));
  } catch {
    console.log(`SKIP ${f} (absent on ${base} or from the working tree)`);
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
console.log(
  bad === 0
    ? `\nEvery surviving sentence is verbatim from ${base} once records-genre citations are stripped from both sides.`
    : `\n${bad} sentence(s) changed by more than a citation excision.`,
);
process.exit(bad === 0 ? 0 : 1);
