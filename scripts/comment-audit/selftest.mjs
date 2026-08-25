import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { count, commentRanges } from "./count.mjs";
import { countCss } from "./css-count.mjs";
import { DIRECTIVES, recordsRe } from "./records.mjs";

// #205's Rule M: the counting tool is part of the gate and needs its own
// second method. Every case here is one this campaign already got wrong or a
// review round already caught — a fixture, and an expected number derived by
// hand rather than by the tool under test.
//
// Not wired into CI. Run it after touching anything in this directory:
//   node scripts/comment-audit/selftest.mjs
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "comment-audit-"));
const write = (name, text) => {
  const p = path.join(dir, name);
  fs.writeFileSync(p, text);
  return p;
};

let failed = 0;
const check = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(
    `${ok ? "ok  " : "FAIL"}  ${label}${ok ? "" : `  expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`}`,
  );
};

// A bare `ts.createScanner` loop stops at the first template literal and loses
// every comment after it. This under-counted a whole tranche by 21%.
check(
  "template literals do not hide later comments",
  commentRanges(
    write(
      "tpl.ts",
      "// one\nconst a = `x${1}y`;\n// two\nconst b = 1;\n// three\n",
    ),
  ).ranges.length,
  3,
);

// A line counts when it has at least one non-whitespace comment character.
// The whitespace-only line inside the block is NOT a comment line; the `*`
// line is. The other reading of this rule is where a 3-line disagreement
// between two correct counters came from.
check(
  "a whitespace-only line inside a block is not a comment line",
  count(write("ws.ts", "/*\n   \n * hi\n */\nconst a = 1;\n")).commentOnly,
  3,
);

check(
  "a zero-length line inside a block is not a comment line either",
  count(write("ws2.ts", "/*\n\n * hi\n */\nconst a = 1;\n")).commentOnly,
  3,
);

// `total` follows `wc -l`: a trailing newline terminates a line, it does not
// start one.
check("total matches wc -l", count(write("n.ts", "const a = 1;\n")).total, 1);
check("an empty file has no lines", count(write("e.ts", "")).total, 0);
check(
  "a file with no comments counts none",
  count(write("c.ts", "const a = 1;\n")).commentOnly,
  0,
);
check(
  "CRLF is handled",
  count(write("crlf.ts", "// hi\r\nconst a = 1;\r\n")).commentOnly,
  1,
);

// JSX `{/* */}` comments are only visible when the baseline keeps its `.tsx`
// extension — parsed as `.ts` they vanish, which silently truncated the
// comparison corpus for every `.tsx` file.
check(
  "a .tsx file sees its JSX comments",
  commentRanges(
    write(
      "j.tsx",
      "export const A = () => (\n  <div>\n    {/* hi */}\n  </div>\n);\n",
    ),
  ).ranges.length,
  1,
);

// Stripping ordinary prose is the DANGEROUS direction: it hides a real
// rewrite behind a green.
const stripped = (s) => (s.match(recordsRe()) ?? []).length;
check(
  'prose that merely contains "plan" is not a citation',
  stripped("runs first (plan for a second consumer is not in sight)."),
  0,
);
check(
  'prose that merely contains "finding" is not a citation',
  stripped("ignores it (finding a filled cell is the point)."),
  0,
);
check(
  "a bare section sign in prose is not a citation",
  stripped("closed (§ see the note above)."),
  0,
);
check(
  "a real plan citation is one",
  stripped("Extracted (plan 017 §9.2) here."),
  1,
);
check(
  "a real finding citation is one",
  stripped("Fixed (finding B-7) here."),
  1,
);
check("a real section citation is one", stripped("See (§8.4) above."), 1);
check(
  "a line anchor is one",
  stripped("as `binairo/state.ts:100-104` shows"),
  1,
);

// `hash.mjs` cannot see these — the printer drops them and the AST never held
// them — so it counts them separately. Deleting a `/*#__PURE__*/` ships the
// Termo answer pool to every client.
const dtext =
  'export const W = /*#__PURE__*/ f("a");\n// eslint-disable-next-line x -- why\nexport const y = 1;\n';
check(
  "directives are counted, not printed",
  DIRECTIVES.map(([n, re]) => [n, (dtext.match(re) ?? []).length]).filter(
    ([, c]) => c > 0,
  ),
  [
    ["pure", 1],
    ["eslint", 1],
  ],
);

check(
  "css counts a comment-only line",
  countCss(write("s.css", "/* hi */\n.a {\n  color: red; /* trailing */\n}\n"))
    .commentOnly,
  1,
);
check(
  "css counts a trailing comment as touched, not only",
  countCss(write("s2.css", "/* hi */\n.a {\n  color: red; /* trailing */\n}\n"))
    .touched,
  2,
);

// Every tool must refuse an empty file list rather than print its most
// reassuring output — #205's Rule I, applied to this toolkit.
for (const tool of [
  "count",
  "hash",
  "citations",
  "markers",
  "verbatim",
  "excision",
  "css-count",
]) {
  let code = 0;
  try {
    execFileSync("node", [path.join(import.meta.dirname, `${tool}.mjs`)], {
      stdio: "pipe",
    });
  } catch (e) {
    code = e.status;
  }
  check(`${tool}.mjs refuses an empty file list`, code, 2);
}

fs.rmSync(dir, { recursive: true, force: true });
console.log(
  failed === 0 ? "\nall checks passed" : `\n${failed} check(s) FAILED`,
);
process.exit(failed === 0 ? 0 : 1);
