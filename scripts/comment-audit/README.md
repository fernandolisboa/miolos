# comment-audit

The six tools #205's comment tranches are measured with. Committed rather than
re-derived per tranche, because two of them exist to catch mistakes the
campaign already shipped once: a counter that silently under-counted by 21%,
and three PR bodies whose numbers did not reproduce.

Run from the repo root, against files in the working tree; each compares to
`main` where it needs a baseline.

| tool | answers |
|---|---|
| `count.mjs` | how many **comment-only lines** a file has — the campaign's one metric |
| `hash.mjs` | did the sweep change any **code**? Prints an AST print hash plus node, identifier and string-literal counts |
| `citations.mjs` | how many **records-genre citations** the sweep removed |
| `markers.mjs` | which files are **densest in records markers** — how the next tranche is scoped |
| `verbatim.mjs` | which surviving sentences are **not byte-identical** to `main` |
| `excision.mjs` | which of those changed by **more than a citation excision** — the ones a PR body must declare |

```sh
node scripts/comment-audit/count.mjs apps/web/src/termo/state.ts
node scripts/comment-audit/hash.mjs $(git diff main --name-only -- '*.ts' '*.tsx')
```

## Why they are here

`count.mjs` takes comment ranges from the **parser**. A bare `ts.createScanner`
loop needs `reScanTemplateToken` to walk a template literal's spans and stops
early without it, so every file holding a `` `${}` `` loses its later comments —
that bug reported 866 lines where the true figure was 1,093.

`count.mjs` counts a line when **at least one** non-whitespace character falls
inside a comment range. The other reading — *all* non-whitespace characters do —
additionally counts blank lines inside JSX `{/* … */}` blocks, which is where a
3-line disagreement between two correct counters came from.

`verbatim.mjs` and `excision.mjs` are a pair. A citation-excision tranche makes
almost every touched sentence non-verbatim, so `verbatim.mjs` alone says
nothing useful; `excision.mjs` strips records citations from **both** sides and
flags only what changed by more than one.

None of these is a gate. They generate the numbers a PR body states, so that
those numbers are re-runnable instead of typed — see #205's Rule P.
