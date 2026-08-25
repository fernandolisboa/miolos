import ts from "typescript";
import fs from "node:fs";
import crypto from "node:crypto";

// Proof that a comment sweep changed zero code: re-print the file from its AST
// (the printer drops all comment trivia via removeComments) and hash the result,
// alongside a full AST walk counting nodes, identifiers and string literals.
const printer = ts.createPrinter({
  removeComments: true,
  newLine: ts.NewLineKind.LineFeed,
});

for (const f of process.argv.slice(2)) {
  const text = fs.readFileSync(f, "utf8");
  const sf = ts.createSourceFile(
    f,
    text,
    ts.ScriptTarget.Latest,
    true,
    f.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  if (sf.parseDiagnostics && sf.parseDiagnostics.length) {
    console.log("PARSE ERRORS in " + f + ": " + sf.parseDiagnostics.length);
  }
  const out = printer.printFile(sf);
  let nodes = 0;
  let idents = 0;
  let strings = 0;
  const idNames = [];
  const strVals = [];
  const walk = (n) => {
    nodes++;
    if (ts.isIdentifier(n)) {
      idents++;
      idNames.push(n.text);
    }
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) {
      strings++;
      strVals.push(n.text);
    }
    ts.forEachChild(n, walk);
  };
  walk(sf);
  const h = (s) =>
    crypto.createHash("sha256").update(s).digest("hex").slice(0, 16);
  console.log(
    [
      h(out),
      "nodes=" + nodes,
      "idents=" + idents,
      "strings=" + strings,
      "ids=" + h(idNames.join(" ")),
      "strs=" + h(strVals.join(" ")),
      f,
    ].join("  "),
  );
}
