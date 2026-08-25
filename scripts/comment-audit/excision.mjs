import { recordsRe, requireFiles } from "./records.mjs";
import { baseCorpus, blocks } from "./verbatim.mjs";

// A citation-excision sweep makes almost every touched sentence non-verbatim,
// so `verbatim.mjs` alone flags nearly all of them and says nothing useful.
// This is the precise claim a PR body declares from: strip records-genre
// citations from BOTH sides, and every surviving sentence must still be
// verbatim. What it flags changed by more than a citation.
//
// The strip is deliberately narrow — `plan` needs a number, `finding` a label —
// because stripping ordinary prose is the dangerous direction: it would hide a
// real rewrite behind a green.
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

const argv = requireFiles(process.argv, "excision.mjs [--base <ref>]");
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
console.log(
  bad === 0
    ? `\nEvery surviving sentence is verbatim from ${base} once records-genre citations are stripped from both sides.`
    : `\n${bad} sentence(s) changed by more than a citation excision.`,
);
