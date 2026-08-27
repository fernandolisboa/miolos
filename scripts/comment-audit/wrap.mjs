import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { commentRanges } from "./count.mjs";
import { DIRECTIVES, parseArgs } from "./records.mjs";

// The ragged-wrap check #205 published inline in three PR bodies before it was
// a tool. It caught four defects and every one of them was introduced by a FIX
// commit — the class #227 rejected on twice, and the one nobody word-diffs.
//
// A greedily wrapped paragraph has exactly one property: no line can take the
// first word of the line below it. An excision breaks that property in place,
// because the sentence shortens and the wrap does not move — so the leftover
// reads as an under-filled line, or as an orphan when it lands at the end of a
// paragraph. Both are the same defect, and this reports them as one check.
//
// It carries a MARKDOWN line-selector as well as a comment one: two of the
// four defects were orphans inside Accepted ADRs, invisible to a `.ts` scan.
//
// Baseline-relative by construction. This repo is full of prose that was never
// greedily wrapped and never will be, so an absolute count is unreadable; what
// a PR body declares is that its own diff added none.
const WIDTH = 80;

// `DIRECTIVES` carries the `g` flag, and `RegExp.test` with `g` is stateful —
// alternate calls would return false on the same line. Copy the source only.
const DIRECTIVE_RES = DIRECTIVES.map(([, re]) => new RegExp(re.source));

// `\*(?!/)` is not decoration: a comment-line regex that matches `*/` reads a
// block terminator as prose with content `/`, and an earlier reflow ate one.
const GUTTER_RE = /^(\s*(?:\/\/+|\/\*+|\*(?!\/))[ \t]?)/;

const FENCE_RE = /^(?:```|~~~)/;
const BLOCKISH_RE =
  /^(?:#{1,6}\s|\||>|<|\[[^\]]+\]:|(?:-{3,}|\*{3,}|_{3,})\s*$)/;
const MARKER_RE = /^(?:[-*+]|\d+[.)])[ \t]+/;

/**
 * One entry per source line: `null` where the line is not wrappable prose,
 * `{ gutter, body, width }` where it is. Skipping is the safe direction — a
 * missed line costs nothing, a wrongly included one asks a reviewer to unwrap
 * a table.
 */
function proseLines(file, text) {
  const raw = text.split("\n");
  const md = file.endsWith(".md");
  const inComment = md ? null : commentMask(file, text);
  const out = [];
  let fenced = false;
  let pos = 0;
  for (const line of raw) {
    const start = pos;
    pos += line.length + 1;
    let gutter = "";
    let body = line;
    if (!md) {
      // A comment line is one whose non-whitespace characters are ALL inside a
      // comment range — the rule `count.mjs` reports as `commentOnly`.
      let hasComment = false;
      let hasCode = false;
      for (let j = start; j < start + line.length; j++) {
        if (text[j].trim() === "") continue;
        if (inComment[j]) hasComment = true;
        else hasCode = true;
      }
      const m = GUTTER_RE.exec(line);
      if (!hasComment || hasCode || line.includes("*/") || !m) {
        out.push(null);
        continue;
      }
      gutter = m[1];
      body = line.slice(gutter.length);
    }
    // The fence toggle reads the BODY, so a fenced block written inside a
    // comment counts — this campaign's tools are themselves documented that way.
    if (FENCE_RE.test(body.trim())) {
      fenced = !fenced;
      out.push(null);
      continue;
    }
    const trimmed = body.trimEnd();
    if (
      fenced ||
      trimmed.trim() === "" ||
      BLOCKISH_RE.test(trimmed.trimStart()) ||
      DIRECTIVE_RES.some((re) => re.test(line)) ||
      // A trailing double space is a markdown hard break: that wrap is a decision.
      (md && /[ \t]{2}$/.test(body))
    ) {
      out.push(null);
      continue;
    }
    out.push({ gutter, body: trimmed, width: (gutter + trimmed).length });
  }
  return out;
}

function commentMask(file, text) {
  const mask = new Uint8Array(text.length);
  if (file.endsWith(".css")) {
    for (let i = 0; i < text.length; i++) {
      if (text[i] !== "/" || text[i + 1] !== "*") continue;
      const end = text.indexOf("*/", i + 2);
      const stop = end === -1 ? text.length : end + 2;
      for (let j = i; j < stop; j++) mask[j] = 1;
      i = stop - 1;
    }
    return mask;
  }
  const { ranges } = commentRanges(file, text);
  for (const [a, b] of ranges) for (let i = a; i < b; i++) mask[i] = 1;
  return mask;
}

const indentOf = (s) => s.length - s.trimStart().length;

/**
 * Every line that could have taken the first word of the line below it. Each
 * hit is keyed by its own text plus that word, so the baseline comparison
 * survives the line moving — which in a sweep every line does.
 */
export function ragged(file, text) {
  const lines = proseLines(file, text);
  const hits = [];
  let i = 0;
  while (i < lines.length) {
    if (!lines[i]) {
      i++;
      continue;
    }
    // A list marker belongs to the first line only; the item's continuation
    // lines are indented past it, and that indent is what holds the paragraph
    // together. Without this the scan stops dead at every bullet.
    const head = lines[i];
    const marker = MARKER_RE.exec(head.body.trimStart());
    const contIndent = indentOf(head.body) + (marker ? marker[0].length : 0);
    let end = i + 1;
    while (
      end < lines.length &&
      lines[end] &&
      lines[end].gutter === head.gutter &&
      !MARKER_RE.test(lines[end].body.trimStart()) &&
      indentOf(lines[end].body) === contIndent
    ) {
      end++;
    }
    // The paragraph's OWN fill is the column, not 80. Prose here is wrapped
    // anywhere between 68 and 80, and a fixed 80 flags a correctly wrapped
    // paragraph on every line — 108 hits in one Accepted ADR, which is how a
    // check gets ignored. The widest line a paragraph already has is a column
    // it demonstrably reached, so a greedily wrapped paragraph scores zero
    // against it by construction, whatever the author's real margin was.
    const col = Math.min(
      WIDTH,
      Math.max(...lines.slice(i, end - 1).map((l) => l.width)),
    );
    for (let k = i; k < end - 1; k++) {
      const next = lines[k + 1].body.trim();
      const word = next.split(/\s+/)[0];
      const would = lines[k].width + 1 + word.length;
      // An orphan — a paragraph ending in one word that fits above — is judged
      // against the hard 80 instead. A two-line paragraph has no interior to
      // take a column from, and that is the shape an excision leaves behind.
      const orphan = k + 1 === end - 1 && next === word;
      if (would > (orphan ? WIDTH : col)) continue;
      hits.push({
        line: k + 1,
        text: lines[k].gutter + lines[k].body,
        word,
        would,
        kind: orphan ? "orphan" : "ragged",
        key: `${lines[k].body.trim()} ${word}`,
      });
    }
    i = Math.max(end, i + 1);
  }
  return hits;
}

// Behind an entry-point guard: `ragged` is exported, and a module-level CLI
// would run this whole comparison on that import — the defect `verbatim.mjs`
// carries the same guard for.
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const { base, files } = parseArgs(process.argv, "wrap.mjs");

  let added = 0;
  let compared = 0;
  let missing = 0;
  for (const f of files) {
    let hits;
    try {
      hits = ragged(f, fs.readFileSync(f, "utf8"));
    } catch {
      missing++;
      console.log(`   -  (absent from the working tree)  ${f}`);
      continue;
    }
    const before = new Map();
    let fresh = false;
    try {
      const text = execFileSync("git", ["show", `${base}:${f}`], {
        encoding: "utf8",
      });
      for (const h of ragged(f, text))
        before.set(h.key, (before.get(h.key) ?? 0) + 1);
    } catch {
      // Every ragged line in a file the base ref does not hold is one this
      // diff is answerable for — a new ADR is where two of the four were.
      fresh = true;
    }
    compared++;
    const isNew = [];
    for (const h of hits) {
      const left = before.get(h.key) ?? 0;
      if (left > 0) before.set(h.key, left - 1);
      else isNew.push(h);
    }
    added += isNew.length;
    console.log(
      `${String(isNew.length).padStart(3)} new  ${String(hits.length).padStart(3)} total  ${f}` +
        (fresh ? `  (absent on ${base}; every hit reads as new)` : ""),
    );
    for (const h of isNew) {
      console.log(
        `      ${f}:${h.line}  ${h.kind}\n        ${h.text}\n        ↳ "${h.word}" would have fit (${h.would} ≤ ${WIDTH})`,
      );
    }
  }
  console.log(
    added === 0
      ? `\nNo line this diff wrote can take the first word below it within ${WIDTH} columns.`
      : `\n${added} ragged line(s) this diff added.`,
  );
  if (missing) console.log(`${missing} of ${files.length} file(s) SKIPPED.`);
  process.exit(compared === 0 ? 2 : added === 0 ? 0 : 1);
}
