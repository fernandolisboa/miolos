import ts from "typescript";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "./records.mjs";

// THE metric: comment-only lines — a source line carrying at least one
// non-whitespace comment character and no code character.
//
// Ranges come from the PARSER: a raw `ts.createScanner` loop needs
// `reScanTemplateToken` to walk a template literal's spans and stops early
// without it. See the README.
export function commentRanges(file, text = fs.readFileSync(file, "utf8")) {
  const sf = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const seen = new Map();
  const add = (r) => {
    if (r) for (const c of r) seen.set(c.pos + ":" + c.end, [c.pos, c.end]);
  };
  const visit = (node) => {
    add(ts.getLeadingCommentRanges(text, node.getFullStart()));
    add(ts.getTrailingCommentRanges(text, node.getEnd()));
    node.getChildren(sf).forEach(visit);
  };
  visit(sf);
  return { text, ranges: [...seen.values()].sort((a, b) => a[0] - b[0]) };
}

/** The same ranges, read out of a `main` blob rather than the working tree. */
export function commentRangesOf(file, text) {
  return commentRanges(path.join("/virtual", path.basename(file)), text);
}

/**
 * The file's comment text. `commentOnly` is the line count on the working-tree
 * path and `undefined` on the baseline-blob path, where lines are meaningless
 * — read it only when you passed no `raw`.
 */
export function commentText(file, raw) {
  if (raw !== undefined) {
    const { ranges } = commentRangesOf(file, raw);
    return { text: ranges.map(([a, b]) => raw.slice(a, b)).join("\n") };
  }
  const { text, ranges } = commentRanges(file);
  return {
    text: ranges.map(([a, b]) => text.slice(a, b)).join("\n"),
    commentOnly: countLines(text, ranges).commentOnly,
  };
}

export function count(file) {
  const { text, ranges } = commentRanges(file);
  return countLines(text, ranges);
}

function countLines(text, ranges) {
  const lines = text.split("\n");
  const starts = [];
  let p = 0;
  for (const l of lines) {
    starts.push(p);
    p += l.length + 1;
  }
  const mask = new Uint8Array(text.length);
  for (const [a, b] of ranges) for (let i = a; i < b; i++) mask[i] = 1;
  let commentOnly = 0;
  let touched = 0;
  const onlyLines = [];
  for (let i = 0; i < lines.length; i++) {
    const s = starts[i];
    const e = s + lines[i].length;
    let hasComment = false;
    let hasCode = false;
    for (let j = s; j < e; j++) {
      if (text[j].trim() === "") continue;
      if (mask[j]) hasComment = true;
      else hasCode = true;
    }
    if (hasComment) {
      touched++;
      if (!hasCode) {
        commentOnly++;
        onlyLines.push(i + 1);
      }
    }
  }
  // A trailing newline is a terminator, not a line — `wc -l`'s convention.
  const total = lines.length - (lines.at(-1) === "" ? 1 : 0);
  return { commentOnly, touched, blocks: ranges.length, onlyLines, total };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const { files } = parseArgs(process.argv, "count.mjs", false);
  let tot = 0;
  let totT = 0;
  let totB = 0;
  let skipped = 0;
  for (const f of files) {
    let r;
    try {
      r = count(f);
    } catch {
      skipped++;
      console.log("   -  (absent from the working tree)  " + f);
      continue;
    }
    tot += r.commentOnly;
    totT += r.touched;
    totB += r.blocks;
    console.log(
      `${String(r.commentOnly).padStart(4)} only  ${String(r.touched).padStart(4)} touched  ${String(r.blocks).padStart(4)} ranges  of ${String(r.total).padStart(4)}  ${f}`,
    );
  }
  console.log(
    `${String(tot).padStart(4)} only  ${String(totT).padStart(4)} touched  ${String(totB).padStart(4)} ranges  TOTAL` +
      (skipped ? `; ${skipped} of ${files.length} SKIPPED` : ""),
  );
  if (skipped === files.length) process.exit(2);
}
