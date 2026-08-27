import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { count, commentRanges } from "./count.mjs";
import { countCss } from "./css-count.mjs";
import {
  allowance,
  density,
  DIRECTIVES as BUDGET_DIRECTIVES,
  isGenerated,
  trackedFiles,
} from "./density.mjs";
import { DIRECTIVES, recordsRe } from "./records.mjs";
import { ragged } from "./wrap.mjs";
import { pathToFileURL } from "node:url";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
process.chdir(repoRoot);

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "comment-audit-"));
const temps = [dir];
process.on("exit", () => {
  for (const t of temps) fs.rmSync(t, { recursive: true, force: true });
});
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
  "markers sees a .css line anchor",
  (
    "as `nonogram-board.module.css:398-402` shows".match(
      (await import("./records.mjs")).markersRe(),
    ) ?? []
  ).length,
  1,
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

const run = (args, cwd) => {
  try {
    return {
      code: 0,
      out: execFileSync("node", args, { encoding: "utf8", stdio: "pipe", cwd }),
    };
  } catch (e) {
    return { code: e.status, out: (e.stdout ?? "") + (e.stderr ?? "") };
  }
};
const tool = (n) => path.join(import.meta.dirname, n);

{
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "comment-audit-git-"));
  temps.push(repo);
  const git = (...a) =>
    execFileSync("git", ["-C", repo, ...a], { stdio: "pipe" });
  git("init", "-q");
  git("config", "user.email", "t@t");
  git("config", "user.name", "t");
  const pure = 'export const W = /*#__PURE__*/ f("a");\n';
  fs.writeFileSync(path.join(repo, "w.ts"), pure);
  git("add", "-A");
  git("commit", "-qm", "base");
  git("branch", "-M", "main");

  fs.writeFileSync(path.join(repo, "w.ts"), pure.replace("/*#__PURE__*/ ", ""));
  const gone = run([tool("hash.mjs"), "w.ts"], repo);
  check(
    "hash.mjs reports DIFFERS when a /*#__PURE__*/ is deleted",
    [gone.code, /DIFFERS/.test(gone.out), /pure: 1 -> 0/.test(gone.out)],
    [1, true, true],
  );

  fs.writeFileSync(path.join(repo, "w.ts"), pure + "// a new comment\n");
  const same = run([tool("hash.mjs"), "w.ts"], repo);
  check(
    "hash.mjs reports SAME when only a comment is added",
    [same.code, /SAME/.test(same.out)],
    [0, true],
  );

  fs.writeFileSync(path.join(repo, "w.ts"), pure.replace('"a"', '"b"'));
  const code = run([tool("hash.mjs"), "w.ts"], repo);
  check(
    "hash.mjs reports DIFFERS when a string literal changes",
    [code.code, /DIFFERS/.test(code.out)],
    [1, true],
  );
}

{
  const out = run([
    tool("excision.mjs"),
    "--base",
    "HEAD",
    "scripts/comment-audit/records.mjs",
  ]).out;
  check(
    "excision.mjs does not print verbatim.mjs's summary",
    /not byte-identical/.test(out),
    false,
  );
}

{
  const re = (await import("./records.mjs")).recordsRe;
  const cases = [
    ["(ADR-0032, plan 020 §9.3)", 1],
    ["(#31 step-6 F15)", 1],
    ["(ADR-0004, §9.2)", 1],
    ["(D8)", 1],
    [
      "(the chip carries no duration and no result figure at all, plan 043 D4)",
      0,
    ],
    ["(it also requires the uppercase transform, pinned in T-WEB-S311)", 0],
    ['("run it twice, get the same account" — the crash recovery, D7)', 0],
    ["(finding 2 of them is enough)", 0],
  ];
  check(
    "a lead-in of citation tokens counts; one of prose does not",
    cases.map(([t]) => (t.match(re()) ?? []).length),
    cases.map(([, w]) => w),
  );

  check(
    "the repo's own prose lead-ins do not count",
    [
      "(no cookie rides the confirm, D3)",
      "(a lost Termo colours no day, plan 033 D6)",
      "(one free hint per puzzle, plan 017 D21)",
      "(121 ms mean / 346 ms max locally, plan 018 §19.6)",
      "(D8's never-send-in-tests requirement)",
      "(D7: null → 0 → 1)",
    ].map((t) => (t.match(re()) ?? []).length),
    [0, 0, 0, 0, 0, 0],
  );

  const code =
    "const x = foo(\n  // see (plan 017 D3)\n  a,\n  // and (plan 018 D4)\n  b,\n);";
  const comments = "// see (plan 017 D3)\n// and (plan 018 D4)";
  check(
    "raw text and the comment corpus disagree, and the corpus is right",
    [(code.match(re()) ?? []).length, (comments.match(re()) ?? []).length],
    [2, 2],
  );
}

{
  const re = (await import("./records.mjs")).recordsRe;
  const markers = (await import("./records.mjs")).markersRe;
  check(
    "the space form of `step N` is a citation, like the hyphen form",
    ["(#142 step 7)", "(#142 step-7)"].map((t) => (t.match(re()) ?? []).length),
    [1, 1],
  );
  check(
    "markers.mjs sees the space form too",
    ("a rule (#142 step 7) and another (#31 step-6 F15)".match(markers()) ?? [])
      .length,
    2,
  );

  check(
    "a prose lead-in before the space form still does not count",
    ("(work through it step 3 at a time)".match(re()) ?? []).length,
    0,
  );
}

check(
  "markers sees the bare decision-citation class",
  (
    "the guard (D7) and the mode (S23)".match(
      (await import("./records.mjs")).markersRe(),
    ) ?? []
  ).length,
  2,
);

for (const t of ["excision", "verbatim", "citations", "hash", "wrap"]) {
  check(
    `${t}.mjs exits 2 when every file is skipped`,
    run([
      tool(`${t}.mjs`),
      "--base",
      "no-such-ref",
      "scripts/comment-audit/records.mjs",
    ]).code,
    2,
  );
}

// The echo fixtures are a SYNTHETIC repo, not files in this one. Pointing
// them at real prose made them erode as #205 deleted it: the app sources
// went first, then this directory's own comments, and each time the checks
// went green by attrition rather than by the tool working.
{
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "comment-audit-echo-"));
  temps.push(repo);
  const git = (...a) =>
    execFileSync("git", ["-C", repo, ...a], { stdio: "pipe" });
  git("init", "-q");
  git("config", "user.email", "t@t");
  git("config", "user.name", "t");

  const claim =
    "the reader's SQL wall is the only authority on which days exist";
  fs.writeFileSync(
    path.join(repo, "subject.ts"),
    `// ${claim}\nexport const a = 1;\n`,
  );
  // More echoing locations than the 12 shingle prints, so the truncation
  // notice has to fire. Silent truncation is the dangerous direction for a
  // scan that authorises a deletion.
  for (let i = 0; i < 14; i += 1) {
    fs.mkdirSync(path.join(repo, `pkg${i}`), { recursive: true });
    fs.writeFileSync(
      path.join(repo, `pkg${i}`, "echo.ts"),
      `// ${claim}\n// ${claim}\n// ${claim}\nexport const b = ${i};\n`,
    );
  }
  // The index must be big enough that "N tracked files indexed" is a real
  // three-digit count — the shape a zero-file index would fail.
  for (let i = 0; i < 100; i += 1) {
    fs.writeFileSync(
      path.join(repo, `filler${i}.ts`),
      `export const f${i} = ${i};\n`,
    );
  }
  git("add", "-A");
  git("commit", "-qm", "base");

  const out = run([tool("shingle.mjs"), "subject.ts"], repo).out;
  check(
    "shingle.mjs indexes the tracked corpus",
    /[1-9]\d{2,} tracked files indexed/.test(out),
    true,
  );
  check("shingle.mjs finds a known echo", /is echoed by:/.test(out), true);
  check(
    "shingle.mjs says how many candidates it did not print",
    /…and \d+ more location\(s\)/.test(out),
    true,
  );
  check(
    "shingle.mjs prints repo-relative paths",
    /\n {4}\s*\d+x {2}[\w.-]+\//.test(out) && !/ {2}\/home\//.test(out),
    true,
  );

  const sub = run(
    [tool("shingle.mjs"), "board.tsx"],
    path.join(repoRoot, "apps/web/src/termo"),
  ).out;
  check(
    "shingle.mjs indexes from the repo root whatever the cwd",
    /[1-9]\d{2,} tracked files indexed/.test(sub),
    true,
  );
}

{
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "comment-audit-lonely-"));
  temps.push(repo);
  const git = (...a) =>
    execFileSync("git", ["-C", repo, ...a], { stdio: "pipe" });
  git("init", "-q");
  git("config", "user.email", "t@t");
  git("config", "user.name", "t");
  fs.writeFileSync(
    path.join(repo, "a.ts"),
    "// (plan 017 D3)\nexport const a = 1;\n",
  );
  git("add", "-A");
  git("commit", "-qm", "base");
  check(
    "shingle.mjs exits 2 rather than reporting no citations from an empty index",
    run([tool("shingle.mjs"), "a.ts"], repo).code,
    2,
  );
}

for (const t of ["count", "markers", "css-count", "shingle"]) {
  check(
    `${t}.mjs exits 2 when every file is absent`,
    run([tool(`${t}.mjs`), "does-not-exist.ts"]).code,
    2,
  );
  check(
    `${t}.mjs rejects --base rather than silently reading the working tree`,
    run([tool(`${t}.mjs`), "--base", "main", "package.json"]).code,
    2,
  );
}

{
  const re = (await import("./records.mjs")).recordsRe;
  const after =
    "(#103 step-6 blocker B1: every other fixture in this file is concluded, so the claim was unasserted)";
  check(
    "prose AFTER the citation token is not stripped",
    (after.match(re()) ?? []).length,
    0,
  );
  check(
    "a citation with a real tail still counts",
    [
      "(plan 020 §9.3)",
      "(step-6 finding K2)",
      "(#31, ADR-0053 decision 1; plan 037 D6a)",
      "(issue #20, ADR-0009/ADR-0026, plan 029 §6)",
    ].map((t) => (t.match(re()) ?? []).length),
    [1, 1, 1, 1],
  );

  check(
    "a short prose tail does not count either",
    [
      "(plan 037 D6a, which is still binding)",
      "(plan 037 D6a, which was fully reversed)",
    ].map((t) => (t.match(re()) ?? []).length),
    [0, 0],
  );
}

{
  const f = write(
    "m.tsx",
    'const a = <b data-testid="T-WEB-S99" />;\n// see plan 017 D3\n',
  );
  const out = run([tool("markers.mjs"), f]).out;
  check(
    "markers ignores a marker inside a string literal",
    /^\s*1\s/m.test(out),
    true,
  );
}

{
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "comment-audit-del-"));
  temps.push(repo);
  const git = (...a) =>
    execFileSync("git", ["-C", repo, ...a], { stdio: "pipe" });
  git("init", "-q");
  git("config", "user.email", "t@t");
  git("config", "user.name", "t");
  fs.writeFileSync(
    path.join(repo, "f.ts"),
    "// (plan 017 D3)\nexport const a = 1;\n",
  );
  fs.writeFileSync(
    path.join(repo, "g.ts"),
    "// (plan 018 D4)\nexport const b = 2;\n",
  );
  git("add", "-A");
  git("commit", "-qm", "base");
  git("branch", "-M", "main");
  fs.unlinkSync(path.join(repo, "g.ts"));
  for (const t of ["excision", "verbatim", "hash", "citations"]) {
    const r = run([tool(`${t}.mjs`), "f.ts", "g.ts"], repo);
    check(
      `${t}.mjs skips a working-tree deletion instead of crashing`,
      /ENOENT|at commentRanges/.test(r.out),
      false,
    );
  }
  check(
    "hash.mjs exits 2 when every file is absent",
    run([tool("hash.mjs"), "g.ts"], repo).code,
    2,
  );
}

{
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "comment-audit-reword-"));
  temps.push(repo);
  const git = (...a) =>
    execFileSync("git", ["-C", repo, ...a], { stdio: "pipe" });
  git("init", "-q");
  git("config", "user.email", "t@t");
  git("config", "user.name", "t");
  const rewordings = [
    [
      "// The victim's browser clicks (no cookie rides the confirm, D3).",
      "// The victim's browser clicks (the session cookie rides the confirm, D3).",
    ],
    [
      "// a lost Termo colours no day (plan 033 D6)",
      "// a lost Termo colours the day (plan 033 D6)",
    ],
    [
      "// reads it back (plan 037 D6a, which is still binding) before the flush",
      "// reads it back (plan 037 D6a, which was fully reversed) before the flush",
    ],
    [
      "// one free hint per puzzle (plan 017 D21)",
      "// two free hints per puzzle (plan 017 D21)",
    ],

    [
      "// one free hint per puzzle (plan 017 D21)",
      "// two free hints per puzzle",
    ],
  ];
  const files = rewordings.map((_, i) => `r${i}.ts`);
  const put = (which) =>
    rewordings.forEach((pair, i) =>
      fs.writeFileSync(
        path.join(repo, files[i]),
        `${pair[which]}\nexport const a${i} = 1;\n`,
      ),
    );
  put(0);
  git("add", "-A");
  git("commit", "-qm", "base");
  git("branch", "-M", "main");

  check(
    "excision.mjs is green when nothing was reworded",
    run([tool("excision.mjs"), ...files], repo).code,
    0,
  );
  put(1);

  const expected = [
    {
      r: 0,
      excision: 1,
      verbatim: 1,
      why: "a reword INSIDE the citation's parenthesis",
    },
    { r: 1, excision: 1, verbatim: 1, why: "a reword beside a citation" },
    {
      r: 2,
      excision: 1,
      verbatim: 1,
      why: "a reword INSIDE the citation's parenthesis",
    },
    {
      r: 3,
      excision: 0,
      verbatim: 1,
      why: "a <=25-character sentence, which only excision loses",
    },
    {
      r: 4,
      excision: 0,
      verbatim: 0,
      why: "the citation excised too — THE documented blind spot",
    },
  ];

  check(
    "every rewording fixture is asserted",
    expected.length,
    rewordings.length,
  );

  check(
    "r4 really does reword something",
    rewordings[4][0] !== rewordings[4][1],
    true,
  );
  for (const { r, excision, verbatim, why } of expected) {
    check(
      `excision.mjs ${excision ? "flags" : "does NOT see"} ${why} (r${r})`,
      run([tool("excision.mjs"), files[r]], repo).code,
      excision,
    );
    check(
      `verbatim.mjs ${verbatim ? "flags" : "does NOT see"} ${why} (r${r})`,
      run([tool("verbatim.mjs"), files[r]], repo).code,
      verbatim,
    );
  }
}

const words = (n, seed = "a") =>
  Array.from({ length: n }, (_, i) =>
    (seed + String.fromCharCode(98 + (i % 24))).padEnd(4, "x"),
  ).join(" ");

check("words(14) plus a gutter is 72 columns", ("// " + words(14)).length, 72);

{
  const kinds = (name, text) =>
    ragged(write(name, text), text).map((h) => [h.kind, h.line, h.word]);

  check(
    "a greedily wrapped comment paragraph is clean",
    kinds(
      "w-greedy.ts",
      `// ${words(14)}\n// ${words(14, "b")}\n// tail end\nconst a = 1;\n`,
    ),
    [],
  );

  check(
    "an under-filled interior line is flagged",
    kinds(
      "w-short.ts",
      `// ${words(14)}\n// short\n// ${words(14, "b")}\nconst a = 1;\n`,
    ),
    [["ragged", 2, "bbxx"]],
  );

  check(
    "a one-word last line that fits above is an orphan",
    kinds("w-orphan.ts", `// ${words(12)}\n// tail\nconst a = 1;\n`),
    [["orphan", 1, "tail"]],
  );
  check(
    "a one-word last line that does NOT fit above is left alone",
    kinds(
      "w-legit.ts",
      `// ${words(15)}\n// supercalifragilisticexpialidocious\nconst a = 1;\n`,
    ),
    [],
  );

  check(
    "markdown prose is scanned too — ADR-0037's real orphan",
    kinds(
      "w-adr.md",
      "- **No clue association at all.** The board would be navigable and\n" +
        "  unsolvable.\n",
    ),
    [["orphan", 1, "unsolvable."]],
  );

  check(
    "a closing */ is never prose",
    kinds(
      "w-star.css",
      `/* ${words(14)}\n   short\n   ${words(14, "b")} */\n.a { color: red; }\n`,
    ),
    [["orphan", 1, "short"]],
  );

  check(
    "two adjacent directive lines are both skipped",
    kinds(
      "w-directive.ts",
      "// eslint-disable-next-line react-hooks/rules-of-hooks\n" +
        "// eslint-disable-next-line react-hooks/exhaustive-deps\n" +
        "// tail\nconst a = 1;\n",
    ),
    [],
  );

  check(
    "a trailing comment beside code is not prose",
    kinds(
      "w-trailing.ts",
      `  // ${words(13)}\n  // short\n     x = 1; // ${words(13, "b")}\n`,
    ),
    [["orphan", 1, "short"]],
  );

  check(
    "a markdown table is not prose",
    kinds("w-table.md", `| ${words(13)} |\n| --- |\nc\n`),
    [],
  );
  check(
    "a fenced block is not prose",
    kinds("w-fence.md", "```\n" + words(13) + "\nx\n```\ntail\n"),
    [],
  );
  check(
    "a heading is not prose",
    kinds("w-head.md", `## ${words(12)}\ntail\n`),
    [],
  );

  check(
    "a list item's continuation lines are one paragraph",
    kinds("w-list.md", `- ${words(14)}\n  short\n  ${words(14, "b")}\n`),
    [["ragged", 2, "bbxx"]],
  );
  check(
    "a nested bullet at the continuation indent ends the paragraph",
    kinds("w-nested.md", `- ${words(14)}\n  short\n  - ${words(14, "b")}\n`),
    [["orphan", 1, "short"]],
  );

  check(
    "a space-indented CSS continuation is prose, and joins its opener",
    kinds(
      "w.css",
      `/* ${words(14)}\n   short\n   ${words(14, "b")}\n   more text\n */\n.a { color: red; }\n`,
    ),
    [["ragged", 2, "bbxx"]],
  );

  const boundary = (bWidth) =>
    `// ${"z".repeat(69)}\n// ${"x".repeat(bWidth - 3)}\n// ${"y".repeat(6)} tail\nconst a = 1;\n`;
  check(
    "a word that needs one column more than the fill does not fit",
    kinds("w-edge-clean.ts", boundary(66)),
    [],
  );
  check(
    "a word that exactly reaches the fill does fit",
    kinds("w-edge-hit.ts", boundary(65)),
    [["ragged", 2, "yyyyyy"]],
  );

  check(
    "a JSDoc star gutter is a gutter",
    kinds(
      "w-jsdoc.ts",
      `/**\n * ${words(14)}\n * short\n * ${words(14, "b")}\n */\nconst a = 1;\n`,
    ),
    [["ragged", 3, "bbxx"]],
  );

  check(
    "a different gutter width ends the paragraph",
    kinds("w-gutters.ts", `// ${words(14)}\n  // short\nconst a = 1;\n`),
    [],
  );

  check(
    "a different body indent ends the paragraph",
    kinds("w-indent.ts", `// ${words(14)}\n//   short\nconst a = 1;\n`),
    [],
  );

  check(
    "a trailing double space ends the line on purpose",
    kinds("w-hardbreak.md", `${words(12)}  \ntail\n`),
    [],
  );

  check(
    "an emphasis opener is prose, not a divider",
    kinds("w-emph.md", `***${words(8)}***\nshort\n`),
    [["orphan", 1, "short"]],
  );
  check(
    "a line that is only rule characters is a divider",
    kinds("w-rule.md", `***\n${words(12)}\nshort\n`),
    [["orphan", 2, "short"]],
  );

  check(
    "a divider line is not prose",
    kinds(
      "w-divider.css",
      `/* ——— a section title ——————————————\n   ${words(13)}\n   short\n   ${words(13, "b")}\n*/\n.a { color: red; }\n`,
    ),
    [["ragged", 3, "bbxx"]],
  );

  check(
    "a space-aligned table row inside a comment is not prose",
    kinds(
      "w-cols.css",
      `/* ${words(13)}\n   row     growth   margin\n   24px    +13px    0\n   20px    +9px     -2px\n*/\n.a { color: red; }\n`,
    ),
    [],
  );

  check(
    "a blockquote line is not prose",
    kinds("w-quote.md", `> ${words(13)}\nshort\n`),
    [],
  );
  check(
    "...and the same text without the marker IS",
    kinds("w-quote-control.md", `${words(13)}\nshort\n`),
    [["orphan", 1, "short"]],
  );

  check(
    "a nested numbered item at the continuation indent ends the paragraph",
    kinds(
      "w-numbered.md",
      `1. ${words(14)}\n   short\n   2. ${words(14, "b")}\n`,
    ),
    [["orphan", 1, "short"]],
  );

  check(
    "an indented heading inside a list item is not prose",
    kinds(
      "w-indented-head.md",
      `- ${words(14)}\n  short\n  ## a heading here\n`,
    ),
    [["orphan", 1, "short"]],
  );

  check(
    "a deep gutter counts toward the width",
    kinds(
      "w-deep.ts",
      `          // ${words(14)}\n          // tail\nconst a = 1;\n`,
    ),
    [],
  );
  check(
    "...and the same comment shallower is an orphan",
    kinds("w-shallow.ts", `// ${words(14)}\n// tail\nconst a = 1;\n`),
    [["orphan", 1, "tail"]],
  );

  check(
    "a paragraph whose interior is all over 80 is silent",
    kinds(
      "w-allover.ts",
      `// ${"z".repeat(88)}\n// ${"y".repeat(88)}\n// tail\nconst a = 1;\n`,
    ),
    [],
  );
  check(
    "...and the same shape inside 80 is not",
    kinds(
      "w-allunder.ts",
      `// ${"z".repeat(70)}\n// ${"y".repeat(70)}\n// tail\nconst a = 1;\n`,
    ),
    [["orphan", 2, "tail"]],
  );

  check(
    "a line over 80 columns does not set the paragraph's column",
    kinds(
      "w-long.ts",
      `// ${"z".repeat(90)}\n// short\n// ${words(14)}\n// tail end\nconst a = 1;\n`,
    ),
    [["ragged", 2, "abxx"]],
  );
}

{
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "comment-audit-wrap-"));
  temps.push(repo);
  const git = (...a) =>
    execFileSync("git", ["-C", repo, ...a], { stdio: "pipe" });
  git("init", "-q");
  git("config", "user.email", "t@t");
  git("config", "user.name", "t");
  const base = `// ${words(12)}\n// tail\nconst a = 1;\n`;
  fs.writeFileSync(path.join(repo, "w.ts"), base);
  git("add", "-A");
  git("commit", "-qm", "base");
  git("branch", "-M", "main");

  const clean = run([tool("wrap.mjs"), "w.ts"], repo);
  check(
    "a ragged line already on the base ref is not reported",
    [clean.code, /^\s*0 new\s+1 total/m.test(clean.out)],
    [0, true],
  );

  fs.writeFileSync(
    path.join(repo, "w.ts"),
    base.replace("const a", `\n// ${words(13, "b")}\n// x2\nconst a`),
  );
  const dirty = run([tool("wrap.mjs"), "w.ts"], repo);
  check(
    "a ragged line the diff adds IS reported, and exits 1",
    [
      dirty.code,
      /orphan/.test(dirty.out),
      /1 ragged line\(s\)/.test(dirty.out),
    ],
    [1, true, true],
  );

  fs.writeFileSync(
    path.join(repo, "w.ts"),
    `// ${words(12)}\n// tale\nconst a = 1;\n`,
  );
  const reworded = run([tool("wrap.mjs"), "w.ts"], repo);
  check(
    "re-wording the word below a ragged line makes it new",
    [reworded.code, /^\s*1 new\s+1 total/m.test(reworded.out)],
    [1, true],
  );

  fs.writeFileSync(
    path.join(repo, "w.ts"),
    `// ${words(12)}\n// tail\nconst a = 1;\n\n// ${words(12)}\n// tail\nconst b = 2;\n`,
  );
  const twice = run([tool("wrap.mjs"), "w.ts"], repo);
  check(
    "a second copy of a ragged pair the base ref has once is new",
    [twice.code, /^\s*1 new\s+2 total/m.test(twice.out)],
    [1, true],
  );

  fs.writeFileSync(
    path.join(repo, "fresh.ts"),
    `// ${words(12)}\n// tail\nconst a = 1;\n`,
  );
  const brandNew = run([tool("wrap.mjs"), "fresh.ts"], repo);
  check(
    "a file absent on the base ref says so, and every hit reads as new",
    [
      brandNew.code,
      /1 new\s+1 total\s+fresh\.ts\s+\(absent on main; every hit reads as new\)/.test(
        brandNew.out,
      ),
    ],
    [1, true],
  );

  const gone = run([tool("wrap.mjs"), "nope.ts"], repo);
  check(
    "a file absent from the working tree leaves nothing compared",
    [gone.code, /No line this diff wrote/.test(gone.out)],
    [2, false],
  );
}

{
  const imported = run([
    "--input-type=module",
    "-e",
    `await import(${JSON.stringify(pathToFileURL(tool("wrap.mjs")).href)});`,
  ]);
  check(
    "importing wrap.mjs runs no CLI",
    [imported.code, imported.out.trim()],
    [0, ""],
  );
}

const densityFixture = write(
  "density-fixture.ts",
  [
    "// a budgeted prose line",
    "// a second budgeted prose line",
    "// a third, which puts the fixture past the 2-line floor",
    "// eslint-disable-next-line no-console -- the reason is part of the directive",
    "/*#__PURE__*/",
    "// @ts-expect-error deliberate",
    "export const a = 1;",
    "export const b = 2;",
  ].join("\n") + "\n",
);
check("density counts prose only", density(densityFixture).budgeted, 3);

check("density exempts directives", density(densityFixture).directives, 3);
check("density total is wc -l", density(densityFixture).total, 8);
check(
  "density pct is prose over total",
  Number(density(densityFixture).pct.toFixed(2)),
  37.5,
);
check(
  "a file over budget exits 1",
  run([tool("density.mjs"), densityFixture]).code,
  1,
);
check(
  "the same file under a loose budget exits 0",
  run([tool("density.mjs"), "--max", "50", densityFixture]).code,
  0,
);

check(
  "a generated header is recognised (next-env.d.ts)",
  isGenerated(
    '/// <reference types="next" />\n\n// NOTE: This file should not be edited\n',
  ),
  true,
);
check(
  "a generated header is recognised (rendered word list)",
  isGenerated("// GENERATED FILE - do not edit.\nexport const A = 1;\n"),
  true,
);
check(
  "ordinary prose is not mistaken for a generated header",
  isGenerated(
    "// The worker bound lives once, at the repo root.\nexport const a = 1;\n",
  ),
  false,
);
// A SKIPPED file is never measured, and `isGenerated` is a substring test —
// so `// Generated by hand` in a header is a self-service exemption from the
// gate. Pinning the set is what makes adding a fourth a visible decision.
{
  // `density.mjs` exits 1 when a file is over budget, and `execFileSync`
  // turns that into a throw — which would take the whole selftest down
  // instead of failing one check. `run` reads the output either way.
  const skipped = run([tool("density.mjs"), ...trackedFiles()])
    .out.split("\n")
    .filter((l) => l.includes("(generated;"))
    .map((l) =>
      l
        .trim()
        .split(/\s{2,}/)
        .at(-1),
    )
    .sort();
  check("exactly these files skip the budget as generated", skipped, [
    "apps/api/next-env.d.ts",
    "apps/web/next-env.d.ts",
    "packages/games/src/termo/words.generated.ts",
  ]);
}

check(
  "a generated marker far down the file does not exempt it",
  isGenerated("\n".repeat(12) + "// @generated\n"),
  false,
);
// Every member of `DIRECTIVES` gets a probe, driven off the array itself so
// the two cannot diverge. Round 1 shipped `/// <reference` documented-exempt
// and budgeted; round 2 shipped the same hole for `@vitest-environment` and
// the coverage directives, because the probe list was a hand-kept COPY.
for (const [label, , example] of BUDGET_DIRECTIVES) {
  const probe = write(
    `exempt-${label.replaceAll(/\W/g, "")}.ts`,
    `${example}\nexport const a = 1;\n`,
  );
  check(`density exempts ${label}`, density(probe).budgeted, 0);
}
// The probes above are driven off the array, so they cannot catch a member
// being DELETED — the probe would go with it. This is the second method
// #205's Rule M asks for: the documented set, written out by hand, and the
// live file that would silently lose its exemption if one went missing.
check(
  "the exempt set is exactly what CLAUDE.md and the README enumerate",
  BUDGET_DIRECTIVES.map(([label]) => label),
  [
    "eslint-disable",
    "eslint-enable",
    "@ts-expect-error",
    "@ts-ignore",
    "@ts-nocheck",
    "#__PURE__",
    "/// <reference",
    "prettier-ignore",
    "impeccable-disable",
    "impeccable-ignore",
    "@vitest-environment",
    "c8 ignore",
    "v8 ignore",
    "istanbul ignore",
  ],
);
check(
  "a real file's `@vitest-environment` stays exempt",
  density("apps/web/test/og-image.node.test.ts").directives >= 1,
  true,
);

check(
  "prose that merely mentions a directive is NOT exempt",
  density(
    write(
      "mentions.ts",
      "// see the /*#__PURE__*/ above\nexport const a = 1;\n",
    ),
  ).budgeted,
  1,
);

// A percentage alone forbids CLAUDE.md's sanctioned comments in a small file:
// 3% of 30 lines is zero, so one `TODO(#238)` would red the gate.
check("a small file gets a floor of 2 lines", allowance(4), 2);
check("the floor does not apply once 3% exceeds it", allowance(1000), 30);
check(
  "one sanctioned TODO in a 4-line file is within budget",
  run([
    tool("density.mjs"),
    write("todo.ts", "// TODO(#238): see the issue\nexport const a = 1;\n"),
  ]).code,
  0,
);
check(
  "three prose lines in a 4-line file are not",
  run([
    tool("density.mjs"),
    write("prose.ts", "// one\n// two\n// three\nexport const a = 1;\n"),
  ]).code,
  1,
);

check(
  "a non-numeric --max exits 2",
  run([tool("density.mjs"), "--max", "lots", densityFixture]).code,
  2,
);

for (const t of [
  "count",
  "hash",
  "citations",
  "markers",
  "verbatim",
  "excision",
  "css-count",
  "shingle",
  "wrap",
  "density",
]) {
  check(`${t}.mjs refuses an empty file list`, run([tool(`${t}.mjs`)]).code, 2);
  check(
    `${t}.mjs refuses a flag-only argument list`,
    run([tool(`${t}.mjs`), "--base", "main"]).code,
    2,
  );
}
check(
  "a --base with no ref exits 2",
  run([tool("hash.mjs"), "--base"]).code,
  2,
);

console.log(
  failed === 0 ? "\nall checks passed" : `\n${failed} check(s) FAILED`,
);
process.exit(failed === 0 ? 0 : 1);
