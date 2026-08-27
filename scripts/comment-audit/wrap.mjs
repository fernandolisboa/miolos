import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { commentRanges } from "./count.mjs";
import { DIRECTIVES, parseArgs } from "./records.mjs";

// Which lines a diff left RAGGED — under-filled, or an orphan.
//
// A greedily wrapped paragraph has exactly one property: no line can take the
// first word of the line below it. An excision breaks that property in place,
// because the sentence shortens and the wrap does not move — so the leftover
// reads as an under-filled line, or as an orphan when it lands at the end of a
// paragraph. Both are the same defect, and this reports them as one check.
//
// Baseline-relative by construction. This repo is full of prose that was never
// greedily wrapped and never will be, so an absolute count is unreadable; what
// a PR body declares is that its own diff added none.
const WIDTH = 80;

// `RegExp.test` with the `g` flag advances `lastIndex`, and `DIRECTIVES`
// carries it — so a shared regex would answer `false` on every other line it
// matches. Copy the source without the flag.
const DIRECTIVE_RES = DIRECTIVES.map(([, re]) => new RegExp(re.source));

const GUTTER_RE = /^([ \t]*(?:\/\/+|\/\*+|\*)[ \t]?)/;

const FENCE_RE = /^(?:```|~~~)/;
// A divider is a rule line OR a banner — a rule run, a title, and a rule run
// again, which is how three of this repo's sheets open a section (`/* ——— day
// page ——————`) and which cost four false hits when it was glued to the prose
// beneath. A rule run at the START ALONE is not enough: `***` and `___` are
// markdown emphasis, and an unanchored class dropped four real paragraphs in
// `docs/adr/**` — the tool's own primary corpus — out of the prose set.
// `COLUMNS_RE` is the other half: three or more spaces INSIDE a line is a
// space-aligned table, which `proseLines` says never to unwrap.
const RULE = "[-—─=·]";
const BLOCKISH_RE = new RegExp(
  `^(?:#{1,6}\\s|\\||>|<|\\[[^\\]]+\\]:|[-—─=·*_]{3,}\\s*$|${RULE}{3,}.*${RULE}{3,}\\s*$)`,
);
const COLUMNS_RE = /\S[ \t]{3,}\S/;
const MARKER_RE = /^(?:[-*+]|\d+[.)])[ \t]+/;

/**
 * One entry per source line: `null` where the line is not wrappable prose, and
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
      // A line holding `*/` is never prose. Without this bail the terminator
      // reads as a word — `/` on its own, or a trailing `*/` glued to the last
      // real word — and a reflow that believed it deleted one.
      //
      // `!hasComment` cannot be bound by a fixture and is kept for the
      // definition rather than the behaviour: a line with no comment character
      // and no code character holds no non-whitespace character at all, so the
      // blank-body check below already returns `null` for it.
      if (!hasComment || hasCode || line.includes("*/")) {
        out.push(null);
        continue;
      }
      // A continuation line inside an open block comment carries no marker at
      // all: every multi-line comment in this repo's CSS is written that way,
      // so requiring `//`, `/*` or `*` here made the whole `.css` corpus score
      // zero. Its indent IS its gutter.
      gutter = (GUTTER_RE.exec(line) ?? /^[ \t]*/.exec(line))[0];
      body = line.slice(gutter.length);
    }
    // The fence toggle reads the BODY, so a fenced block written inside a
    // comment counts.
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
      COLUMNS_RE.test(trimmed) ||
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

// `.css` is read through the SAME parser, and it agrees with `css-count.mjs`
// on every tracked sheet — including one holding `url(http://…)`, because the
// `//` the parser sees there is on a line that also holds code, which is not
// prose either way. A dedicated CSS scanner was written, measured against this
// on the whole corpus, found to change nothing, and deleted. The blind spot
// `css-count.mjs` names is stated in the README rather than defended here.
function commentMask(file, text) {
  const mask = new Uint8Array(text.length);
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
    // together. Without this the scan stops dead at every bullet — 694 hits.
    const head = lines[i];
    const marker = MARKER_RE.exec(head.body.trimStart());
    const contIndent = indentOf(head.body) + (marker ? marker[0].length : 0);
    let end = i + 1;
    while (
      end < lines.length &&
      lines[end] &&
      // WIDTH, not text: a block comment's opener (`/* `) and its continuation
      // indent (`   `) are the same left margin and the same paragraph.
      lines[end].gutter.length === head.gutter.length &&
      !MARKER_RE.test(lines[end].body.trimStart()) &&
      indentOf(lines[end].body) === contIndent
    ) {
      end++;
    }
    // The paragraph's OWN fill is the column, not 80. Prose here is wrapped
    // anywhere between 68 and 80, and against a fixed 80 a correctly wrapped
    // paragraph is flagged on nearly every line — ADR-0053 scores 464 that way
    // against 53 here, which is how a check gets ignored. The widest line the
    // paragraph already has is a column it demonstrably reached, so a greedily
    // wrapped paragraph scores zero against it by construction, whatever the
    // author's real margin was. Lines OVER 80 are excluded from that maximum:
    // one unbreakable URL would otherwise hand the whole paragraph back to the
    // fixed-80 regime this rejects.
    //
    // `fills` is empty when EVERY interior line is already over 80, and the
    // fallback is what keeps that paragraph quiet: `col` must not become the
    // width of an over-long line, or every line in the paragraph could take
    // the one below it. It is a real branch, reached on this repo's corpus.
    const fills = lines.slice(i, end - 1).filter((l) => l.width <= WIDTH);
    const col =
      fills.length === 0 ? WIDTH : Math.max(...fills.map((l) => l.width));
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
    i = end;
  }
  return hits;
}

// Behind an entry-point guard: `ragged` is exported, and a module-level CLI
// would run this whole comparison on that import.
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const { base, files } = parseArgs(process.argv, "wrap.mjs");

  // Rule T: a base ref that does not resolve compared NOTHING, and the
  // per-file "absent on the base" path would otherwise read every hit as new
  // and then print a green. A typo in `--base` is not a clean diff.
  try {
    execFileSync(
      "git",
      ["rev-parse", "--verify", "--quiet", `${base}^{commit}`],
      {
        stdio: "pipe",
      },
    );
  } catch {
    console.error(`wrap.mjs: --base ${base} does not resolve to a commit`);
    process.exit(2);
  }

  let added = 0;
  let compared = 0;
  let missing = 0;
  for (const f of files) {
    // The `try` covers the READ and nothing else, so "absent from the working
    // tree" can only ever be said about a file that is. No fixture binds the
    // narrowing: `ragged` is total over any string the read returns, so a
    // wider `try` is observationally identical here and wrong only later.
    let text;
    try {
      text = fs.readFileSync(f, "utf8");
    } catch {
      missing++;
      console.log(`   -  (absent from the working tree)  ${f}`);
      continue;
    }
    const hits = ragged(f, text);
    const before = new Map();
    let fresh = false;
    try {
      const baseText = execFileSync("git", ["show", `${base}:${f}`], {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      });
      for (const h of ragged(f, baseText))
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
  if (compared > 0) {
    console.log(
      added === 0
        ? `\nNo line this diff wrote can take the first word below it within ${WIDTH} columns.`
        : `\n${added} ragged line(s) this diff added.`,
    );
  }
  if (missing) console.log(`${missing} of ${files.length} file(s) SKIPPED.`);
  process.exit(compared === 0 ? 2 : added === 0 ? 0 : 1);
}
