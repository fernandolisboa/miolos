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
// Run from the repo root whatever the caller's cwd is: one fixture shells out
// to `git show HEAD:scripts/…`, and off-root it would SKIP and pass vacuously.
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

// BEHAVIOURAL, not a re-run of the regex table: the directive check lives in
// `hash.mjs`'s `same()`, and a fixture that only exercises `DIRECTIVES` passes
// with that clause deleted. Two files differing ONLY by a `/*#__PURE__*/` must
// come back DIFFERS.
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

// `excision.mjs` imports from `verbatim.mjs`; without an entry-point guard the
// import runs verbatim's whole CLI and prints it above excision's own output.
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

// The unbounded citation prefix stripped the PROSE in front of a citation from
// both sides, and let a match start at a CODE parenthesis and swallow lines.
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
  // The lead-ins the repo ACTUALLY has are 27-36 characters. The strawmen
  // above are 55-62, so they passed every length window that was ever
  // proposed — including the buggy ones. These are the real lines.
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
  // Over RAW text a match can begin at a code `(` and swallow the lines
  // between it and a citation, which made `citations.mjs` undercount. The fix
  // is that the tools scan the comment corpus; this pins the difference.
  const code =
    "const x = foo(\n  // see (plan 017 D3)\n  a,\n  // and (plan 018 D4)\n  b,\n);";
  const comments = "// see (plan 017 D3)\n// and (plan 018 D4)";
  check(
    "raw text and the comment corpus disagree, and the corpus is right",
    [(code.match(re()) ?? []).length, (comments.match(re()) ?? []).length],
    [2, 2],
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

// Every file skipped is zero comparisons, and printing the toolkit's most
// reassuring sentence after zero comparisons is Rule I's shape.
for (const t of ["excision", "verbatim", "citations", "hash"]) {
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
// `shingle.mjs` must find a real echo and must index something — a scan that
// indexes zero files reports "no citations" for every comment in the repo.
{
  const out = run([tool("shingle.mjs"), "apps/web/src/og/copy.ts"]).out;
  check(
    "shingle.mjs indexes the tracked corpus",
    /[1-9]\d{2,} tracked files indexed/.test(out),
    true,
  );
  check("shingle.mjs finds a known echo", /is echoed by:/.test(out), true);
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

// Round 4: only the LEAD-IN was bounded, so prose AFTER the citation token
// inside the same parenthesis was still excised from both sides — the same
// false green on the other side of the token.
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
  // A tail of prose is not a citation AT ANY LENGTH — a 22-character tail
  // slipped through the last length window.
  check(
    "a short prose tail does not count either",
    [
      "(plan 037 D6a, which is still binding)",
      "(plan 037 D6a, which was fully reversed)",
    ].map((t) => (t.match(re()) ?? []).length),
    [0, 0],
  );
}

// `markers.mjs` scanned RAW text while three artifacts claimed every tool
// scans the comment corpus. A `data-testid` string literal is live code.
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

// A path deleted from the working tree — which every `git diff --name-only`
// list contains after a deletion — must SKIP, not crash mid-report.
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

// THE CENTRAL CLAIM, end to end: reword a comment beside a citation and
// `excision.mjs` must FLAG it. Nothing tested this before — the other
// excision fixtures cover its import guard, its skip path and its exit code.
// Three of the four lines are real; the first inverts a security claim.
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

  // Anti-vacuity first: unchanged files must be green, or the flag below
  // would prove nothing.
  check(
    "excision.mjs is green when nothing was reworded",
    run([tool("excision.mjs"), ...files], repo).code,
    0,
  );
  put(1);
  check(
    "excision.mjs FLAGS a reworded claim beside a citation",
    run([tool("excision.mjs"), ...files], repo).code,
    1,
  );
  check(
    "verbatim.mjs flags it too",
    run([tool("verbatim.mjs"), ...files], repo).code,
    1,
  );
}

// Every tool must refuse an empty file list rather than print its most
// reassuring output — #205's Rule I, applied to this toolkit. Flags are not
// files: `--base main` alone left the list empty and printed a green.
for (const t of [
  "count",
  "hash",
  "citations",
  "markers",
  "verbatim",
  "excision",
  "css-count",
  "shingle",
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
