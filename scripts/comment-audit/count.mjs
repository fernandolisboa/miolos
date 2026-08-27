import ts from "typescript";
import fs from "node:fs";
import { pathToFileURL } from "node:url";

export function parseArgs(argv, name) {
  const files = argv.slice(2).filter((a) => a !== "");
  if (files.length === 0) {
    console.error(
      `usage: node scripts/comment-audit/${name} <file>...\n` +
        "Refusing to run on an empty file list: a wrong glob would otherwise\n" +
        "print the most reassuring output in the toolkit — zero comments found.",
    );
    process.exit(2);
  }
  return { files };
}

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

export function lineStarts(text, lines) {
  const starts = [];
  let p = 0;
  for (const l of lines) {
    starts.push(p);
    p += l.length + 1;
  }
  return starts;
}

export function maskOf(text, ranges) {
  const mask = new Uint8Array(text.length);
  for (const [a, b] of ranges) for (let i = a; i < b; i++) mask[i] = 1;
  return mask;
}

// A JSX comment line is `{/* … */}`: the braces sit OUTSIDE the comment range,
// so counting them as code would hide every line of JSX prose from the budget.
// A brace only passes when it abuts the comment, which keeps `} // trailing`
// a code line — see ADR-0075.
export function classifyLine(text, mask, s, e) {
  let hasComment = false;
  let hasCode = false;
  for (let j = s; j < e; j++) {
    const c = text[j];
    if (c.trim() === "") continue;
    if (mask[j]) {
      hasComment = true;
      continue;
    }
    if (c === "{" && mask[j + 1]) continue;
    if (c === "}" && j > s && mask[j - 1]) continue;
    hasCode = true;
  }
  return { hasComment, hasCode };
}

export function count(file) {
  const { text, ranges } = commentRanges(file);
  return countLines(text, ranges);
}

function countLines(text, ranges) {
  const lines = text.split("\n");
  const starts = lineStarts(text, lines);
  const mask = maskOf(text, ranges);
  let commentOnly = 0;
  let touched = 0;
  const onlyLines = [];
  for (let i = 0; i < lines.length; i++) {
    const s = starts[i];
    const { hasComment, hasCode } = classifyLine(
      text,
      mask,
      s,
      s + lines[i].length,
    );
    if (hasComment) {
      touched++;
      if (!hasCode) {
        commentOnly++;
        onlyLines.push(i + 1);
      }
    }
  }

  const total = lines.length - (lines.at(-1) === "" ? 1 : 0);
  return { commentOnly, touched, blocks: ranges.length, onlyLines, total };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const { files } = parseArgs(process.argv, "count.mjs");
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
