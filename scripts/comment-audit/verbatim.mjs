import { execFileSync } from "node:child_process";
import { commentRangesOf, commentRanges } from "./count.mjs";
import { pathToFileURL } from "node:url";
import { parseArgs } from "./records.mjs";

// Rule F, mechanically: every surviving SENTENCE must appear verbatim in the
// same file's comment text on the base ref. Its green is NARROWER than
// "nothing was reworded" — see the README — so declare from `excision.mjs`.
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

// Behind an entry-point guard: `excision.mjs` imports `baseCorpus` and
// `blocks` from here, and a module-level CLI would run this whole comparison
// on that import and print it above excision's own output.
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const { base, files } = parseArgs(process.argv, "verbatim.mjs");
  let bad = 0;
  let skipped = 0;
  for (const f of files) {
    let baseText;
    let text;
    let merged;
    try {
      baseText = norm(baseCorpus(f, base));
      ({ text, merged } = blocks(f));
    } catch {
      skipped++;
      console.log(`SKIP ${f} (absent on ${base} or from the working tree)`);
      continue;
    }
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
    `\n${bad} sentence(s) not byte-identical to ${base}.` +
      (skipped ? ` ${skipped} of ${files.length} file(s) SKIPPED.` : ""),
  );
  process.exit(skipped === files.length ? 2 : bad === 0 ? 0 : 1);
}
