import ts from "typescript";
import fs from "node:fs";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { DIRECTIVES, parseArgs } from "./records.mjs";

// Did a comment sweep change any CODE? Re-print each module from its AST with
// `removeComments`, hash that, and walk the tree counting nodes, identifiers
// and string literals — at BOTH ends, so the answer is SAME or DIFFERS rather
// than a hash the reader has to compare by eye against a baseline produced by
// some undocumented second step.
//
// A comment that is really a DIRECTIVE is invisible to the hash — the printer
// drops it and the AST never held it — so each class is COUNTED separately
// instead. The README names the gate that actually covers each.
const printer = ts.createPrinter({
  removeComments: true,
  newLine: ts.NewLineKind.LineFeed,
});

const h = (s) =>
  crypto.createHash("sha256").update(s).digest("hex").slice(0, 16);

function fingerprint(file, text) {
  const sf = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  let nodes = 0;
  const idNames = [];
  const strVals = [];
  const walk = (n) => {
    nodes++;
    if (ts.isIdentifier(n)) idNames.push(n.text);
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n))
      strVals.push(n.text);
    ts.forEachChild(n, walk);
  };
  walk(sf);
  const directives = DIRECTIVES.map(([name, re]) => [
    name,
    (text.match(re) ?? []).length,
  ]);
  return {
    print: h(printer.printFile(sf)),
    nodes,
    idents: idNames.length,
    strings: strVals.length,
    ids: h(idNames.join(" ")),
    strs: h(strVals.join(" ")),
    directives,
    parseErrors: sf.parseDiagnostics?.length ?? 0,
  };
}

const same = (a, b) =>
  a.print === b.print &&
  a.nodes === b.nodes &&
  a.ids === b.ids &&
  a.strs === b.strs &&
  a.directives.every(
    ([n, c], i) => b.directives[i][0] === n && b.directives[i][1] === c,
  );

const { base, files: args } = parseArgs(process.argv, "hash.mjs");

let differs = 0;
let fresh = 0;
let missing = 0;
for (const f of args) {
  let after;
  try {
    after = fingerprint(f, fs.readFileSync(f, "utf8"));
  } catch {
    missing++;
    console.log(`GONE     (absent from the working tree)  ${f}`);
    continue;
  }
  let before;
  try {
    before = fingerprint(
      f,
      execFileSync("git", ["show", `${base}:${f}`], { encoding: "utf8" }),
    );
  } catch {
    fresh++;
    console.log(
      `NEW      ${after.print}  nodes=${after.nodes}  (absent on ${base})  ${f}`,
    );
    continue;
  }
  const verdict = same(before, after) ? "SAME   " : "DIFFERS";
  if (verdict === "DIFFERS") differs++;
  const d = after.directives
    .filter(([, c]) => c > 0)
    .map(([n, c]) => `${n}=${c}`);
  console.log(
    [
      verdict,
      after.print,
      `nodes=${after.nodes}`,
      `idents=${after.idents}`,
      `strings=${after.strings}`,
      `ids=${after.ids}`,
      `strs=${after.strs}`,
      d.length ? `directives(${d.join(",")})` : "directives(none)",
      f,
    ].join("  "),
  );
  if (verdict === "DIFFERS") {
    for (const k of ["print", "nodes", "idents", "strings", "ids", "strs"]) {
      if (before[k] !== after[k])
        console.log(`         ${k}: ${before[k]} -> ${after[k]}`);
    }
    before.directives.forEach(([n, c], i) => {
      if (after.directives[i][1] !== c)
        console.log(`         ${n}: ${c} -> ${after.directives[i][1]}`);
    });
  }
}
const compared = args.length - fresh - missing;
console.log(
  differs === 0
    ? `${compared} of ${args.length} file(s) identical to ${base} once comments are removed` +
        (fresh ? `; ${fresh} absent on ${base}` : "") +
        (missing ? `; ${missing} absent from the working tree` : "")
    : `${differs} of ${compared} compared file(s) DIFFER from ${base}` +
        (fresh ? `; ${fresh} absent on ${base}` : ""),
);
process.exit(compared === 0 ? 2 : differs === 0 ? 0 : 1);
