# comment-audit

The tools #205's comment tranches are measured with. Committed rather than
re-derived per tranche, because several of them exist to catch mistakes the
campaign already shipped: a counter that under-counted by 21%, a PR body whose
figures were restated three times before they reproduced, and two per-file rows
whose errors cancelled inside a total that still reconciled.

Run from the repo root. Every tool refuses an **empty file list** with exit 2,
flags included — `--base main` alone is not a file list. When **every** file
was skipped they still print a summary, but they mark it (`0 of N`,
`N of N SKIPPED`) and **exit 2**, because zero comparisons is not a green —
and an exit code is invisible once the output is pasted into a PR body. A wrong glob would
otherwise print the most reassuring output in the toolkit, which is #205's
Rule I applied to this directory. `verbatim.mjs`, `excision.mjs` and
`hash.mjs` also exit non-zero when they flag something.

| tool | answers | needs a baseline |
|---|---|---|
| `count.mjs` | how many **comment-only lines** a `.ts`/`.tsx` file has — the campaign's one metric | no |
| `css-count.mjs` | the same for `.css`, for tranche 7c | no |
| `hash.mjs` | did the sweep change any **code**? Prints `SAME`/`DIFFERS` per file | yes |
| `citations.mjs` | how many **records-genre citations** the sweep removed | yes |
| `markers.mjs` | which files are **heaviest in records markers**, and at what rate — how the next tranche is scoped | no |
| `verbatim.mjs` | which surviving sentences are **not byte-identical** to the baseline | yes |
| `excision.mjs` | which of those changed by **more than a citation excision** — the ones a PR body must declare | yes |
| `shingle.mjs` | **Rule A** — what echoes a comment's prose, before you delete it | no |
| `wrap.mjs` | which lines the diff left **ragged** — under-filled, or an orphan | yes |
| `density.mjs` | is a file within the **3% comment budget**? The gate | no |
| `selftest.mjs` | do the tools still do what this README says? | no |

Baseline defaults to `main`; pass `--base <ref>` to change it. A path absent
from the baseline — or from the working tree, which a `git diff --name-only`
list contains after a deletion — is reported and skipped, never silently
counted as verified. `wrap.mjs` is the one exception on the baseline side, and
says so in its output: a file the base ref does not hold has every hit read as
new, because a new ADR is where two of the four wrap defects were found. A base
**ref** that does not resolve is a different condition and exits 2 — a typo
there compared nothing, and would otherwise print that same reassuring row for
every file.

```sh
node scripts/comment-audit/count.mjs apps/web/src/termo/state.ts
node scripts/comment-audit/hash.mjs $(git diff main --name-only -- '*.ts' '*.tsx')
node scripts/comment-audit/wrap.mjs $(git diff main --name-only -- '*.ts' '*.tsx' '*.mjs' '*.css' '*.md')
node scripts/comment-audit/density.mjs $(git ls-files '*.ts' '*.tsx')
node scripts/comment-audit/selftest.mjs
```

## The budget

`density.mjs` is the only tool here that states a target rather than a
measurement: no `.ts`/`.tsx` file may spend more than **3%** of its lines on
comment-only prose. Directive lines — `eslint-disable`, `@ts-expect-error`,
`/*#__PURE__*/`, `/// <reference`, `prettier-ignore` — are exempt, because a
budget that counted them would push a sweep into deleting the four
`/*#__PURE__*/` markers that keep the Termo answer pool out of the client
bundle.

It exits 1 when any file is over, so it is the campaign's finish line and,
after that, its ratchet. Pass `--max` to measure against a different number;
the default is the one CLAUDE.md sets.

## What `markers.mjs` cannot see

A `0` from `markers.mjs` is **not** a clean file. The scan only sees what
`records.mjs` spells, and a genre written a hair differently is invisible:
`step-\d+` was hyphen-only until this tool set gained `wrap.mjs`, so
`(#142 step 7)` — live in all four daily `use-*-play.ts` hooks — counted
nowhere, and a tranche reported `markers.mjs 0` for three files that each
carried one (#205 Rule AA). It now matches `step[- ]\d+`.

The class is not closed and cannot be: the scan is a list of spellings. Read
the file before calling it swept.

## What `hash.mjs` cannot see

It re-prints each module from its AST with `removeComments` and hashes that, so
**comment trivia that is really a directive is invisible to it**. A file can
lose a `/*#__PURE__*/` and every field will match. CLAUDE.md: deleting the four
in `packages/games/src/termo/word-list.ts` ships the whole Termo answer pool to
every client.

So `hash.mjs` **counts** each directive class separately and prints them beside
the hashes — but the real gates are elsewhere, and a sweep that touches them
should cite the gate, not this tool:

| directive | gated by |
|---|---|
| `/*#__PURE__*/` | `packages/games/test/termo/bundle-markers.test.ts` |
| `eslint-disable` | `pnpm lint` |
| `@ts-ignore`, `@ts-expect-error` | `pnpm typecheck` |
| `prettier-ignore` | `pnpm format` / lint-staged |
| `@vitest-environment`, `/// <reference>` | `pnpm test` |

## Why the counters are shaped this way

`count.mjs` takes comment ranges from the **parser**. A bare `ts.createScanner`
loop needs `reScanTemplateToken` to walk a template literal's spans and stops
early without it, so every file holding a `` `${}` `` loses the comments after
its first template — that bug reported 866 lines where the true figure was
1,093.

A line counts when **at least one non-whitespace character** falls inside a
comment range. The other reading — *every* non-whitespace character does —
additionally counts blank lines inside JSX `{/* … */}` blocks, which is where a
three-line disagreement between two internally-consistent counters came from.
`total` follows `wc -l`: a trailing newline terminates a line rather than
starting one.

`records.mjs` holds the **one** definition of a records-genre citation, so the
tool that counts and the tool that strips cannot disagree. It is narrow on both
edges — `plan` needs a number, `finding` needs a label — because **stripping
ordinary prose is the dangerous direction**: it hides a real rewrite behind a
green.

Both sides of the citation are matched by a **token grammar**, not by a length
window: the lead-in and the tail may hold citation-shaped tokens and separators
and nothing else, so a run of lowercase prose ends the match. Four attempts to
pick a length oscillated between the two failure directions, which are **not
symmetric** — missing a citation only makes `excision.mjs` flag an ordinary
excision, which is noise, while stripping prose deletes a claim from both sides
of the comparison and lets a reworded, or inverted, sentence pass green. The
grammar is tuned to miss rather than over-match.

Over raw text a match can also begin at a *code* parenthesis and swallow the
lines between, which is why every tool scans the **comment corpus**, never the
whole file. `markers.mjs` builds that corpus with the TypeScript parser, so its
`.css` figures share `count.mjs`'s limitation — a `url(http://…)` would read as
a `//` comment. No tracked sheet contains one; use `css-count.mjs` for CSS
line counts.

`css-count.mjs` exists for tranche 7c. It is not strictly required — `count.mjs`
returns the identical figure on every tracked sheet today — but a `url(http://…)`
would make the TypeScript parser see a `//` comment, and 7c is the tranche where
that would matter.

**Two conventions produce two right answers**, and a PR body must say which it
used. The four game sheets are **911** lines under `css-count.mjs`. #205's
figure of **1,097** is also correct: it counts every line from the one holding
`/*` through the one holding `*/`, over all non-`play` CSS — which adds
`archive/late-result`, `archive/play-note`, `components/daily-unavailable` and
`free-play/free-play`.

## Reading `shingle.mjs`

Rule A asks what cites a comment before it is deleted. `shingle.mjs` indexes
7-word shingles over every tracked file except the ones being swept, then looks
each target comment's prose up in it — shingles rather than `grep`, because a
citation wraps across lines and is often a paraphrase.

**A hit is a candidate, not a verdict.** The output ranks locations by how much
prose they share and names how many it did not print; read them. It indexes
from the repo root whatever the cwd, and **exits 2 if it indexed nothing** —
a zero-file index would answer "nothing cites this" for every comment in the
repo, which is the one false green Rule A cannot afford, because it authorises
deleting the only copy of a rule.

## Reading `verbatim.mjs` and `excision.mjs`

They are a pair. A citation-excision tranche makes almost every touched
sentence non-verbatim, so `verbatim.mjs` alone flags nearly all of them and
says nothing useful; `excision.mjs` strips citations from **both** sides and
flags only what changed by more than one. Declare from `excision.mjs`.

Both are narrower than "nothing was reworded":

- sentences of **25 characters or fewer are not compared**. The two tools
  measure at different moments — `excision.mjs` after the citation is
  stripped, `verbatim.mjs` before — so a reworded `one free hint per puzzle`
  is invisible to `excision.mjs` and still flagged by `verbatim.mjs`. **Both
  go silent when the sweep removes the citation as well**, which is the shape
  an excision tranche actually produces; `selftest.mjs` pins all three cases;
- the match is a substring test over the whole file's comment corpus, so a
  sentence that **moved** is not flagged;
- they merge whitespace-adjacent comment ranges into **blocks**, while
  `count.mjs` reports raw `ranges`. Two numbers, two conventions — say which
  one a PR body is quoting.

## Reading `wrap.mjs`

An excision shortens a sentence and does not move the wrap, so what it leaves
behind is a line that could have taken the whole line below it — or, at the end
of a paragraph, a one-word orphan. Three PRs published this check inline before
it was a tool; it found four defects and **every one was introduced by a fix
commit**, which is the class reviewers word-diff least.

It is **delta-only**. Prose here was never greedily wrapped — the 761 tracked
`.ts`/`.tsx`/`.mjs`/`.md`/`.css` files score 1,588 hits as of `main`, 146 of
them orphans — so the absolute total is context, and the figure a PR body
declares is the `N new` column. Hits are keyed by their own text plus the word
below, so a line that merely *moved* is not new; a line that was **re-wrapped**
is, which is the point.

The three corpus figures above — **761 files, 1,588 hits, 146 orphans** — are
this command against `REF=49e5e7e`, the commit `main` held when they were
taken. It reads the corpus out of the ref rather than the working tree, so it
reproduces on any later checkout:

```sh
REF=49e5e7e node --input-type=module -e '
  import { execFileSync } from "node:child_process";
  const { ragged } = await import("./scripts/comment-audit/wrap.mjs");
  const ref = process.env.REF ?? "HEAD";
  const show = (a) => execFileSync("git", a, { encoding: "utf8", maxBuffer: 1 << 28 });
  const files = show(["ls-tree", "-r", "--name-only", ref])
    .trim().split("\n").filter((f) => /\.(ts|tsx|mjs|md|css)$/.test(f));
  const hits = files.flatMap((f) => ragged(f, show(["show", `${ref}:${f}`])));
  console.log(files.length, hits.length, hits.filter((h) => h.kind === "orphan").length);'
```

The `apps/web/src` pair below is the same command with `.filter((f) =>
f.startsWith("apps/web/src/"))` added, the `.css` pair with
`.endsWith(".css")`, and ADR-0053's pair is `ragged()` against that one file,
once as shipped and once with the interior threshold replaced by `WIDTH`.

Two thresholds, because they answer different questions:

- an **interior** line is judged against its own paragraph's widest line,
  ignoring any line already over 80. A greedily wrapped paragraph scores zero
  against that by construction, whatever column the author actually used —
  ADR-0053 scores **53** here against **464** at a fixed 80, and at 464 nobody
  reads the output. Excluding the over-long lines matters: one unbreakable URL
  would otherwise hand its whole paragraph back to the fixed-80 regime;
- an **orphan** — a last line holding one word — is judged against 80, because
  a two-line paragraph has no interior to take a column from. This is where the
  tool knowingly over-reports: a paragraph deliberately wrapped at 72 that ends
  in a short word is flagged. Across `apps/web/src` that is 17 of 203 hits.

Line selectors: comments for `.ts`/`.tsx`/`.mjs`/`.css`, and markdown prose.
Two of the four founding defects were orphans inside Accepted ADRs, which is
why the second selector exists; `selftest.mjs` pins the shape with a real
orphan copied verbatim out of `docs/adr/0037-…` rather than with a synthetic
one.

Not prose, and never candidates: markdown tables, **space-aligned tables inside
a comment**, headings, fenced blocks, sibling and nested bullets, **a section
divider drawn as a rule line or as a rule–title–rule banner**, a trailing
comment beside code, any line holding `*/`, a markdown hard break, and every
directive class. The two in bold were false positives the CSS line-selector
introduced — three dividers and one numeric table, 4 of the 60 CSS hits — and
closing them took the `.css` corpus to **56** across 25 sheets.

### What `wrap.mjs` cannot see

- **A block comment's closing line.** Any line holding `*/` is skipped whole,
  which in CSS is usually the line carrying the paragraph's last sentence. The
  alternative — letting a comment-line regex match `*/` — is what ate a
  terminator during this campaign, so the miss is deliberate.
- **A banner whose rule run does not close the line.** The divider rule wants
  a rule LINE or a rule–title–rule banner, because a rule run at the start
  alone is markdown emphasis — `***bold***` — and an unanchored class dropped
  four real `docs/adr/**` paragraphs out of the prose set. The price is that
  `--- Title --- (a trailing note)` reads as prose: three lines under
  `.claude/**`, worth two hits.
- **`url(http://…)` in a stylesheet**, the blind spot `css-count.mjs` exists
  for. `.css` is read through the same TypeScript parser as `count.mjs`; no
  tracked sheet holds one today, and on a sheet that did, the `//` the parser
  invents sits on a line that also holds code, which is not prose either way.
- **A line whose neighbours are already over 80.** When every interior line of
  a paragraph is wider than 80 the column falls back to 80, and nothing in that
  paragraph can score — the alternative is a column read off an unbreakable
  URL, which would flag every line under it.
- **Prose that quotes spacing.** `\S[ \t]{3,}\S` reads three interior spaces as
  a table column, which is right 43 times in the tracked corpus and wrong about
  six, all of them sentences quoting an indent literal.
- **Whether a re-wrap was CORRECT.** A greedily re-wrapped paragraph scores
  zero, and so does a paragraph whose sentences were reworded and then wrapped
  greedily. That is `excision.mjs`'s question, not this one.
- **A paragraph whose own fill is wrong.** The column is read off the paragraph
  rather than imposed on it, so a block wrapped short throughout is consistent
  with itself and scores zero. Only a line that is short *relative to its own
  neighbours* is a hit.

## Not a gate

Nothing here is wired into CI or pre-commit. These generate the numbers a PR
body states, so that those numbers are re-runnable instead of typed — #205's
Rule P. `selftest.mjs` is Rule M's second method for the counters themselves;
run it after touching anything in this directory. It is **131 assertions**, and
every one is a case this campaign already got wrong or a review round already
caught.
