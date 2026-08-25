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
| `selftest.mjs` | do the tools still do what this README says? | no |

Baseline defaults to `main`; pass `--base <ref>` to change it. A path absent
from the baseline — or from the working tree, which a `git diff --name-only`
list contains after a deletion — is reported and skipped, never silently
counted as verified.

```sh
node scripts/comment-audit/count.mjs apps/web/src/termo/state.ts
node scripts/comment-audit/hash.mjs $(git diff main --name-only -- '*.ts' '*.tsx')
node scripts/comment-audit/selftest.mjs
```

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

- sentences of **25 characters or fewer are not compared** — `selftest.mjs` pins one real example, a reworded `one free hint per puzzle` that neither tool sees;
- the match is a substring test over the whole file's comment corpus, so a
  sentence that **moved** is not flagged;
- they merge whitespace-adjacent comment ranges into **blocks**, while
  `count.mjs` reports raw `ranges`. Two numbers, two conventions — say which
  one a PR body is quoting.

## Not a gate

Nothing here is wired into CI or pre-commit. These generate the numbers a PR
body states, so that those numbers are re-runnable instead of typed — #205's
Rule P. `selftest.mjs` is Rule M's second method for the counters themselves;
run it after touching anything in this directory.
