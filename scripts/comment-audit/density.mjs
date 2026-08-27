import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { parseArgs } from "./records.mjs";
import { commentRanges } from "./count.mjs";

const DEFAULT_MAX = 3;

// Directives that look like comments and are not: the budget must not push a
// sweep into deleting them. See CLAUDE.md § Comments.
const DIRECTIVE =
  /^(eslint-(disable|enable)|@ts-(expect-error|ignore|nocheck)|#__PURE__|\/\s*<reference|prettier-ignore|c8\s|v8\s|istanbul\s|@vitest-environment|impeccable-(disable|ignore))/;

function isDirective(line) {
  return DIRECTIVE.test(line.replace(/^\s*(\/\/+|\/\*+|\*+\/?)\s*/, ""));
}

export function density(file, text = fs.readFileSync(file, "utf8")) {
  const { ranges } = commentRanges(file, text);
  const lines = text.split("\n");
  const starts = [];
  let p = 0;
  for (const l of lines) {
    starts.push(p);
    p += l.length + 1;
  }
  const mask = new Uint8Array(text.length);
  for (const [a, b] of ranges) for (let i = a; i < b; i++) mask[i] = 1;
  let budgeted = 0;
  let directives = 0;
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
    if (!hasComment || hasCode) continue;
    if (isDirective(lines[i])) directives++;
    else budgeted++;
  }
  const total = lines.length - (lines.at(-1) === "" ? 1 : 0);
  return {
    budgeted,
    directives,
    total,
    pct: total ? (100 * budgeted) / total : 0,
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const argv = process.argv.filter((a, i) => {
    if (a === "--max") return false;
    return process.argv[i - 1] !== "--max";
  });
  const maxArg = process.argv[process.argv.indexOf("--max") + 1];
  const max = process.argv.includes("--max") ? Number(maxArg) : DEFAULT_MAX;
  if (!Number.isFinite(max)) {
    console.error("density.mjs: --max needs a number");
    process.exit(2);
  }
  const { files } = parseArgs(argv, "density.mjs", false);
  let overBudget = 0;
  let totB = 0;
  let totL = 0;
  let skipped = 0;
  const rows = [];
  for (const f of files) {
    let r;
    try {
      r = density(f);
    } catch {
      skipped++;
      console.log("   -  (absent from the working tree)  " + f);
      continue;
    }
    totB += r.budgeted;
    totL += r.total;
    const over = r.pct > max;
    if (over) overBudget++;
    rows.push({
      f,
      ...r,
      over,
      excess: r.budgeted - Math.floor((max * r.total) / 100),
    });
  }
  rows.sort((a, b) => b.excess - a.excess);
  for (const r of rows) {
    console.log(
      `${r.over ? "OVER" : "  ok"} ${String(r.budgeted).padStart(4)}/${String(r.total).padStart(4)} = ${r.pct.toFixed(1).padStart(5)}%  cut ${String(Math.max(0, r.excess)).padStart(4)}  ${r.f}`,
    );
  }
  const pct = totL ? (100 * totB) / totL : 0;
  console.log(
    `TOTAL ${totB}/${totL} = ${pct.toFixed(1)}%  budget ${max}%  ${overBudget} of ${rows.length} files OVER` +
      (skipped ? `; ${skipped} of ${files.length} SKIPPED` : ""),
  );
  if (skipped === files.length) process.exit(2);
  if (overBudget) process.exit(1);
}
