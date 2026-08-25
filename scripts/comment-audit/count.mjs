import ts from "typescript";
import fs from "node:fs";

// THE metric: comment-only lines — a source line whose entire content, ignoring
// whitespace, is comment trivia. Reconciles to `git diff --numstat` when no
// code line changes.
//
// Comment ranges come from the PARSER (leading/trailing trivia at every node
// and token), not from a raw `createScanner` loop: a bare scanner needs
// `reScanTemplateToken` to walk a template literal's spans and silently stops
// early without it, which under-counted every file holding a `${}`.
export function commentRanges(file) {
  const text = fs.readFileSync(file, "utf8");
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
  add(ts.getLeadingCommentRanges(text, 0));
  return { text, ranges: [...seen.values()].sort((a, b) => a[0] - b[0]) };
}

export function count(file) {
  const { text, ranges } = commentRanges(file);
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
      if (mask[j]) hasComment = true;
      else if (text[j].trim() !== "") hasCode = true;
    }
    if (hasComment) {
      touched++;
      if (!hasCode) {
        commentOnly++;
        onlyLines.push(i + 1);
      }
    }
  }
  return {
    commentOnly,
    touched,
    blocks: ranges.length,
    onlyLines,
    total: lines.length,
  };
}

if (process.argv[2]) {
  let tot = 0;
  let totT = 0;
  let totB = 0;
  for (const f of process.argv.slice(2)) {
    const r = count(f);
    tot += r.commentOnly;
    totT += r.touched;
    totB += r.blocks;
    console.log(
      `${String(r.commentOnly).padStart(4)} only  ${String(r.touched).padStart(4)} touched  ${String(r.blocks).padStart(4)} ranges  of ${String(r.total).padStart(4)}  ${f}`,
    );
  }
  console.log(
    `${String(tot).padStart(4)} only  ${String(totT).padStart(4)} touched  ${String(totB).padStart(4)} ranges  TOTAL`,
  );
}
