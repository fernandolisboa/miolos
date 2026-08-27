import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { count, commentRanges } from "./count.mjs";
import { countCss } from "./css-count.mjs";
import { DIRECTIVES, recordsRe } from "./records.mjs";
import { ragged } from "./wrap.mjs";
import { pathToFileURL } from "node:url";

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

// Rule AA: with `step-\d+` hyphen-only, the space form was invisible to BOTH
// the citation grammar and the marker scan, so `markers.mjs 0` was reported
// for three files that each carried one.
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
  // The widening must not reach prose: a lead-in of words still ends the match.
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

// Every file skipped is zero comparisons, and printing the toolkit's most
// reassuring sentence after zero comparisons is Rule I's shape.
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
  // Silent truncation is the dangerous direction for a scan that authorises a
  // deletion, and the 3-line index window means one citing file can occupy
  // three slots — so a fourth citing file used to fall off unannounced.
  const many = run([tool("shingle.mjs"), "apps/web/src/termo/board.tsx"]).out;
  check(
    "shingle.mjs says how many candidates it did not print",
    /…and \d+ more location\(s\)/.test(many),
    true,
  );
  check(
    "shingle.mjs prints repo-relative paths",
    /\n {4}\s*\d+x {2}[\w.-]+\//.test(many) && !/ {2}\/home\//.test(many),
    true,
  );
  // `git ls-files` is cwd-relative: from a game directory this indexed ONE
  // file and answered "nothing cites these comments" for the whole repo.
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

// An index of zero files answers "nothing cites this" for every comment in
// the repo — the false green Rule A cannot afford, since it authorises
// deleting the only copy of a rule.
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
    // The real blind spot: a citation-excision sweep removes the citation as
    // well, and then BOTH tools are silent on an inverted product claim.
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

  // Anti-vacuity first: unchanged files must be green, or the flag below
  // would prove nothing.
  check(
    "excision.mjs is green when nothing was reworded",
    run([tool("excision.mjs"), ...files], repo).code,
    0,
  );
  put(1);
  // PER FILE, not one exit code over all four. Two of the four reword text
  // OUTSIDE the parenthetical and flag under any definition of a citation, so
  // an aggregate assertion is dominated by them and never exercises the
  // grammar — it stayed green with two earlier regex bugs reintroduced.
  // `excision.mjs` is deliberately expected not to flag r3: stripped of its
  // citation the REWORDED sentence is 25 characters, and both tools skip 25
  // or fewer. `verbatim.mjs` does flag it — it filters before the strip.
  // That blind spot is documented in the README; asserting it here keeps it
  // documented rather than discovered. The aggregate assertion this replaced
  // hid it behind the three files that do flag.
  // The two tools measure at different moments — excision after the citation
  // is stripped, verbatim before — so the <=25-character skip does not bite
  // them at the same time. Asserted PER TOOL and PER FILE, because an
  // aggregate is what let the README describe this wrongly.
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
  // A parallel array to `rewordings`: a sixth pair added without a row here
  // would be silently untested, which is how the aggregate defect started.
  check(
    "every rewording fixture is asserted",
    expected.length,
    rewordings.length,
  );
  // r4 is the only case asserting SILENCE, so it cannot tell "both tools are
  // blind to this reword" from "no reword happened".
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

// ---------------------------------------------------------------------------
// `wrap.mjs` — the ragged-wrap check. Every fixture below was MUTATION-TESTED:
// the guard it names was removed and this file re-run. Three earlier fixtures
// stayed green with their guard deleted and were replaced by the ones here.
// Widths are built from four-letter words so the arithmetic is legible:
// `words(n)` is 5n - 1 characters, and a `// ` or `/* ` gutter adds three.
const words = (n, seed = "a") =>
  Array.from({ length: n }, (_, i) =>
    (seed + String.fromCharCode(98 + (i % 24))).padEnd(4, "x"),
  ).join(" ");

check("words(14) plus a gutter is 72 columns", ("// " + words(14)).length, 72);

{
  const kinds = (name, text) =>
    ragged(write(name, text), text).map((h) => [h.kind, h.line, h.word]);

  // A greedily wrapped paragraph scores zero against its OWN widest line,
  // whatever column the author actually used. This is the property that makes
  // the check readable; against a fixed 80 one Accepted ADR scores 464.
  check(
    "a greedily wrapped comment paragraph is clean",
    kinds(
      "w-greedy.ts",
      `// ${words(14)}\n// ${words(14, "b")}\n// tail end\nconst a = 1;\n`,
    ),
    [],
  );

  // The excision shape: a sentence leaves the middle of a paragraph, the wrap
  // does not move, and the short line could take the whole line below it.
  check(
    "an under-filled interior line is flagged",
    kinds(
      "w-short.ts",
      `// ${words(14)}\n// short\n// ${words(14, "b")}\nconst a = 1;\n`,
    ),
    [["ragged", 2, "bbxx"]],
  );

  // An orphan is judged against the hard 80, not the paragraph's fill: a
  // two-line paragraph has no interior to take a column from, and that is
  // exactly the shape an excision at the end of a block leaves behind.
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

  // Two of the four defects this tool was written for were orphans inside
  // Accepted ADRs. A `.ts`-only line-selector cannot see them, which is why
  // this one has a second selector. The fixture is a real orphan in a real
  // Accepted ADR, copied verbatim from `docs/adr/0037-…` rather than built
  // from `words(n)` — the file's own text, not one of the four by provenance:
  // `git log -S` puts it in a `feat:` commit, not in a #205 fix.
  check(
    "markdown prose is scanned too — ADR-0037's real orphan",
    kinds(
      "w-adr.md",
      "- **No clue association at all.** The board would be navigable and\n" +
        "  unsolvable.\n",
    ),
    [["orphan", 1, "unsolvable."]],
  );

  // `line.includes("*/")` is what stops a block terminator reading as prose,
  // and it is the guard, not the gutter regex: with the bail removed the third
  // line joins the paragraph and the hit moves to line 2. (An earlier
  // `\*(?!/)` lookahead in `GUTTER_RE` was kept as a second layer until a
  // mutation showed it could not change any answer; it is gone.)
  check(
    "a closing */ is never prose",
    kinds(
      "w-star.css",
      `/* ${words(14)}\n   short\n   ${words(14, "b")} */\n.a { color: red; }\n`,
    ),
    [["orphan", 1, "short"]],
  );

  // A directive is not a line a wrap may move a word onto or off. TWO adjacent
  // ones, because `DIRECTIVES` carries the `g` flag: a shared regex would set
  // `lastIndex` on the first and answer `false` on the second.
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

  // A trailing comment beside code is not a wrappable line: a wrap that moved
  // a word onto it would move it onto the code. Nothing in the repo indents
  // deeply enough for the gutter widths to line up, so this fixture builds
  // the case rather than waiting for it.
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

  // A list item's continuation lines are one paragraph with it, or the scan
  // stops dead at every bullet — 694 hits across the repo. The NESTED bullet
  // is the case that binds `MARKER_RE`: it sits at the continuation indent, so
  // nothing but the marker test can end the run.
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

  // 7c is a CSS tranche, and every multi-line comment in this repo's CSS is
  // written `globals.css`-style: an opener, then space-indented continuations
  // with no marker at all. Requiring a marker scored the whole corpus zero.
  check(
    "a space-indented CSS continuation is prose, and joins its opener",
    kinds(
      "w.css",
      `/* ${words(14)}\n   short\n   ${words(14, "b")}\n   more text\n */\n.a { color: red; }\n`,
    ),
    [["ragged", 2, "bbxx"]],
  );

  // THE BOUNDARY, both sides of it. The `+ 1` in `width + 1 + word.length` is
  // the space the word would need, and every other fixture here clears the
  // threshold by several columns — so dropping it left all of them green and
  // the tracked corpus 1,840 hits heavier. These two sit ON the boundary: 66 +
  // 1 + 6 is 73 against a column of 72 and must be clean, 65 + 1 + 6 is 72 and
  // must be a hit.
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

  // The `*` leg of `GUTTER_RE` carries the whole JSDoc gutter, which is the
  // dominant multi-line style in `.ts` — 309 hits. Without it these lines fall
  // to the whitespace fallback and `MARKER_RE` reads `* text` as a bullet, so
  // every JSDoc paragraph collapses to one line and scores nothing.
  check(
    "a JSDoc star gutter is a gutter",
    kinds(
      "w-jsdoc.ts",
      `/**\n * ${words(14)}\n * short\n * ${words(14, "b")}\n */\nconst a = 1;\n`,
    ),
    [["ragged", 3, "bbxx"]],
  );

  // Two comment lines at DIFFERENT left margins are two paragraphs. Without
  // the gutter-width comparison — the headline change of this tool's fix
  // commit — they join, and the short one reads as an orphan of the long one.
  check(
    "a different gutter width ends the paragraph",
    kinds("w-gutters.ts", `// ${words(14)}\n  // short\nconst a = 1;\n`),
    [],
  );
  // And the body indent under the SAME gutter does the same job.
  check(
    "a different body indent ends the paragraph",
    kinds("w-indent.ts", `// ${words(14)}\n//   short\nconst a = 1;\n`),
    [],
  );

  // A markdown hard break is the author's wrap, not a wrap to check.
  check(
    "a trailing double space ends the line on purpose",
    kinds("w-hardbreak.md", `${words(12)}  \ntail\n`),
    [],
  );

  // A rule run at the START of a line is not a divider on its own: `***` and
  // `___` are markdown emphasis, and an unanchored class dropped four real
  // paragraphs out of `docs/adr/**` — the corpus this tool exists for.
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

  // Three of this repo's sheets open a section with a rule and then write
  // prose under it; four false hits came from reading the two as one
  // paragraph. A rule is a divider wherever it sits on the line.
  check(
    "a divider line is not prose",
    kinds(
      "w-divider.css",
      `/* ——— a section title ——————————————\n   ${words(13)}\n   short\n   ${words(13, "b")}\n*/\n.a { color: red; }\n`,
    ),
    [["ragged", 3, "bbxx"]],
  );
  // And a space-aligned table inside a comment is the thing `proseLines` says
  // never to ask a reviewer to unwrap.
  check(
    "a space-aligned table row inside a comment is not prose",
    kinds(
      "w-cols.css",
      `/* ${words(13)}\n   row     growth   margin\n   24px    +13px    0\n   20px    +9px     -2px\n*/\n.a { color: red; }\n`,
    ),
    [],
  );

  // A blockquote is not prose to re-wrap. Paired with the same text without
  // the marker, so the `[]` is not green by construction.
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

  // `MARKER_RE`'s numbered-list leg, the same job its bullet leg does.
  check(
    "a nested numbered item at the continuation indent ends the paragraph",
    kinds(
      "w-numbered.md",
      `1. ${words(14)}\n   short\n   2. ${words(14, "b")}\n`,
    ),
    [["orphan", 1, "short"]],
  );

  // `BLOCKISH_RE` is tested against the body with its indent STRIPPED: a
  // heading under a bullet is still a heading.
  check(
    "an indented heading inside a list item is not prose",
    kinds(
      "w-indented-head.md",
      `- ${words(14)}\n  short\n  ## a heading here\n`,
    ),
    [["orphan", 1, "short"]],
  );

  // `width` is the RENDERED width — gutter included. Drop the gutter and a
  // deeply indented comment reads as 13 columns narrower than it prints. The
  // pair is the point: at this indent the paragraph is over 80 and silent, and
  // ten columns shallower the same text is an orphan.
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

  // When EVERY interior line is already over 80 the fill falls back to 80, and
  // that fallback is load-bearing UPWARD: without a cap, `col` becomes the
  // over-long width and every line in the paragraph can take the one below it.
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

  // One unbreakable line must not hand the paragraph back to the fixed-80
  // regime: without the `width <= WIDTH` filter on the fill, `col` becomes 80
  // and the third line is flagged too.
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
  // The delta is the whole point: this repo's prose was never greedily
  // wrapped, so an absolute count is unreadable noise. What a PR body declares
  // is that its own diff added none.
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

  // The key is the line's own text PLUS the word below it, so re-wording the
  // line below a ragged line is a new hit even though the ragged line itself
  // is byte-identical. Drop `word` from the key and this reads `0 new`.
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

  // And the baseline is a MULTISET: the same ragged pair twice is one hit the
  // base ref already had and one it did not. Drop the decrement and this
  // reads `0 new`.
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

  // A file the base ref does not hold has every hit read as new, and SAYS so
  // — the suffix is what stops `N new` reading as a regression on a new file.
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

// `ragged` is exported, so a module-level CLI would run the whole comparison
// on import — the defect `verbatim.mjs` carries the same guard for.
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
  "wrap",
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
