# Implementation plan — Issue #26: M2 Termo engine and word-list harness

Step 2 (Plan) of the eight-step flow. Base: `main` @ 204b607. Input: exploration brief `01-explore.md` (same directory), issue #26, ADR-0015, CLAUDE.md. This document is committed with the PR as `docs/plans/013-issue-26-plan-termo-engine.md` (013 reserved by the orchestrator: six parallel streams hold 008=#41, 009=#15, 010=#16, 011=#22, 012=#24, 013=#26 — do not renumber).

## 0. Orchestrator-imposed conventions (fixed, not to be revisited)

- Game code lives in `packages/games/src/termo/`; public API in `packages/games/src/termo/index.ts`.
- `packages/games/package.json` `exports` gains a `"./termo"` subpath. The root barrel (`src/index.ts`) does **not** re-export game modules; it keeps only shared substrate (`random.ts`). Convention to be recorded in the games module-boundary ADR landing with #16 (expected ADR-0019, but `docs/adr/` currently ends at 0018 and the number may shift). Cite it **in the PR body only**; code comments say "per the games module-boundary convention (ADR pending with #16)" without a number — the number goes into comments only after that ADR exists. Do not draft it here.
- No new ADRs from this stream. ADR-worthy findings become "flag for orchestrator" notes (§9).
- The generated word-data module is deterministic output of a committed codegen script living **outside** `packages/games/src/` (home decided in §3), with a staleness test such that hand-editing either the generated module or the CSVs fails CI.

## 1. Scope

In: pure Termo engine (normalization, guess evaluation, keyboard state, minimal board status), word data as a generated pure-TS module, codegen script, the ADR-0015 harness proving the list invariants, property tests. Out (belongs to #27/#17): daily selection, server state, Completed/Played/streak semantics beyond the board-level win/loss, React, publishing code, canonical-map runtime shipping.

## 2. Public API — `@miolos/games/termo` (exact surface)

All code below is the contract; implementer writes exactly these exports (file layout in §5).

### 2.1 `normalizeWord` — THE single normalization function

```ts
/** Lowercase → Unicode NFD → strip combining marks (category Mn). ç→c falls out
 *  of NFD (c + U+0327). Mirrors content/termo/pipeline.py:66-68 (Python filters
 *  Mn only — hence \p{Mn}, not \p{M}, for exact parity). Total over strings;
 *  shape-checking is deliberately separate (isValidGuess / evaluateGuess). */
export function normalizeWord(word: string): string;
// Implementation: word.toLowerCase().normalize("NFD").replace(/\p{Mn}/gu, "")
```

Named `normalizeWord` (not `normalize`) to avoid confusion with `String.prototype.normalize`. **No second implementation anywhere in TS**: matching calls it internally, #27 input handling imports it, the harness imports it. `pipeline.py` keeps its Python copy — it is a content-generation tool outside the runtime; the harness round-trips every canonical form in all three CSVs through `normalizeWord` (§6 tests 4 and 6), mechanically pinning the two implementations together. State this reading in the PR so a reviewer does not flag the Python as a violation of "no second implementation".

### 2.2 Guess evaluation

```ts
export type TileState = "correct" | "present" | "absent";
export type TileStates = readonly [TileState, TileState, TileState, TileState, TileState];
export const WORD_LENGTH = 5;

/** Accent-insensitive: both inputs are passed through normalizeWord internally
 *  (this is "used by matching" made literal). After normalization each must
 *  match ^[a-z]{5}$ or a RangeError is thrown (random.ts error-path prior art).
 *  Does NOT check dictionary membership — that is isValidGuess's job; keeping
 *  evaluation total over shaped strings keeps the engine testable with
 *  synthetic fixtures. */
export function evaluateGuess(guess: string, answer: string): TileStates;
```

Algorithm (standard two-pass with letter-count accounting, over normalized forms):

1. Pass 1 (exact): for each position i, if `g[i] === a[i]` mark `correct` and decrement that letter's remaining count (counts initialised from the normalized answer).
2. Pass 2 (present/absent): for each non-correct position left-to-right, if remaining count of `g[i]` > 0 mark `present` and decrement; else `absent`.

### 2.3 Keyboard state

```ts
export interface EvaluatedGuess { readonly guess: string; readonly tiles: TileStates; }
/** Partial map over the 26 keys a–z (guesses are normalized before keying). */
export type KeyboardState = Readonly<Partial<Record<string, TileState>>>;

/** Best-of per letter with precedence correct > present > absent; monotonic —
 *  a later guess never downgrades a key. */
export function deriveKeyboardState(guesses: readonly EvaluatedGuess[]): KeyboardState;
```

Derivation is pure and recomputed from the full history (no incremental state to corrupt).

### 2.4 Board status — the minimal state machine that ships here

```ts
export const MAX_GUESSES = 6;
export type TermoBoardStatus = "playing" | "won" | "lost";

/** won: some row is all-correct. lost: MAX_GUESSES rows and none all-correct.
 *  playing: otherwise. Throws RangeError if rows.length > MAX_GUESSES or if a
 *  row after an all-correct row exists (guessing past a win is a caller bug). */
export function deriveBoardStatus(rows: readonly TileStates[]): TermoBoardStatus;
```

**Scope justification:** the issue asks for "six-guess matching semantics" — six-and-terminal is board logic and belongs in the engine so #27 cannot re-derive it differently. Day-level semantics (won ⇒ Completed if on-time; lost ⇒ **Played**, fail row of the distribution, no day completion, forfeits Dia Perfeito — ADR-0008 rules 3–4) are *server* interpretations of `won`/`lost` and ship with #27. The name is `TermoBoardStatus`, not game/day status, to keep that line sharp.

### 2.5 Word data exports

```ts
export interface TermoAnswer { readonly canonical: string; readonly normalized: string; }

/** The 400 answers, in answers.csv row order. ORDER IS CONTRACTUAL: #27's
 *  server-side seeded choice (ADR-0010) indexes into this array; reordering is
 *  a breaking change and the staleness test pins it. Frozen. */
export const TERMO_ANSWERS: readonly TermoAnswer[];

/** The 5,310 accepted-guess normalized words, sorted, unique. Frozen. */
export const TERMO_VALIDATION_WORDS: readonly string[];

/** normalizeWord(word) ∈ validation set. The only guess-acceptance predicate
 *  ("não está na lista" gate); membership via a module-level Set. */
export function isValidGuess(word: string): boolean;
```

**Answer order is pinned as contractual** (explore open question 6: yes). The staleness test (§6 test 7) byte-pins it, and a dedicated named test (§6 test 8) asserts index-wise equality with the CSV so the failure message is legible.

**`canonical-map.csv` does not ship in the runtime module** (explore open question 1: confirmed no). Reveal-on-completion needs only the *answer's* canonical form, already carried in `TERMO_ANSWERS`; no spec line requires canonical display of non-answer guesses. The map is still harness *input* (§6 test 6) — proving `normalizeWord` parity across all 5,310 accented canonicals — without costing ~60 KB of bundle. Flag for orchestrator in §9.

`TermoAnswer` provides "canonical accented spelling available for reveal" (acceptance criterion 2): win or loss, the UI looks up the day's `TermoAnswer.canonical`.

## 3. Word-data pipeline (codegen + generated module)

### 3.1 Generated module — `packages/games/src/termo/words.generated.ts`

Data-only, no logic, no imports (so the purity gate has nothing to inspect beyond text):

```ts
// GENERATED FILE - do not edit.
// Produced by scripts/generate-termo-words.ts from content/termo/answers.csv
// and content/termo/validation.txt. Regenerate:
//   pnpm --filter @miolos/games generate:termo
// The test/termo/word-list.test.ts staleness test fails CI if this file and
// the CSVs disagree in either direction.

/** 400 canonical answer spellings, answers.csv row order, "\n"-joined. */
export const ANSWER_CANONICALS: string = "muito\nestou\n...";
/** 5,310 normalized validation words, validation.txt order, "\n"-joined. */
export const VALIDATION_WORDS: string = "abaco\nabade\n...";
```

Only canonicals are stored for answers — `normalized` is **derived at module init by `normalizeWord`** in `word-list.ts`, which makes the single normalization function the only path from canonical to normalized in the runtime and shrinks the data. Sizes: ~2.5 KB answers + ~32 KB validation source; ~15–20 KB gzipped. Sanctioned: the list is public (content/termo/README.md, ADR-0004 — which day's answer is a server-side seeded choice), and the client legitimately needs the validation set for the local "não está na lista" affordance.

Banner text must never contain the tokens `import(` or `require(` — purity.test.ts regex-scans raw text including comments. The banner above is clean; keep it so.

### 3.2 Runtime assembly — `packages/games/src/termo/word-list.ts`

Splits the two strings, builds `TERMO_ANSWERS` (map canonical → `{canonical, normalized: normalizeWord(canonical)}`), `TERMO_VALIDATION_WORDS`, a private `Set` for `isValidGuess`. `Object.freeze` on the arrays and each answer object.

### 3.3 Codegen script

- **Home:** `packages/games/scripts/` — outside `src/` (purity gates scan only `src/`), inside the package that owns the output (not `content/termo/`, which stays a Python content-pipeline concern; not repo-root `scripts/`, which doesn't exist and would separate the script from its output). Two files:
  - `packages/games/scripts/render-termo-words.ts` — **pure** `renderTermoWordsModule(answersCsv: string, validationTxt: string): string`: parses the CSV (header `canonical,normalized`; take column 1) and the txt, returns the complete `words.generated.ts` file content as a string. Deterministic: LF newlines, no timestamps, input order preserved. Throws on malformed input (wrong header, non-2-column row, CRLF).
  - `packages/games/scripts/generate-termo-words.ts` — thin Node runner: `node:fs` reads `content/termo/{answers.csv,validation.txt}` (path resolved from `import.meta.url`, not cwd), calls the renderer, writes `src/termo/words.generated.ts`.
- **Language/invocation:** TypeScript run directly by Node ≥ 24 native type stripping (repo Node is 24.x via nvm). Package script: `"generate:termo": "node scripts/generate-termo-words.ts"`; invoke as `pnpm --filter @miolos/games generate:termo`. Run once during implementation; re-run only when `content/termo/` changes.
- **Typechecking and linting the scripts:** `pnpm lint` runs typed eslint (`projectService: true`) over the whole repo, and the project service assigns a file by searching **ancestor** directories for a `tsconfig.json`. For `scripts/*.ts` the nearest ancestor is `packages/games/tsconfig.json` (`include: ["src"]`) — file not in project, hard parse error, `pnpm lint` fails. Adding `"../scripts"` to `test/tsconfig.json` does **not** fix this (`test/` is not an ancestor of `scripts/`). Therefore add `packages/games/scripts/tsconfig.json`, exactly:

  ```json
  {
    "extends": "../../../tsconfig.base.json",
    "compilerOptions": {
      "lib": ["ES2023"],
      "types": ["node"],
      "allowImportingTsExtensions": true
    },
    "include": ["."]
  }
  ```

  As the nearest-ancestor config it is discovered by the project service exactly as `test/tsconfig.json` is for tests today, and it brings `scripts/` under the strict gate: the package `typecheck` script is chained to run all three programs (§4), all inheriting `strict: true` from `tsconfig.base.json`. `allowImportingTsExtensions` is **mandatory, not conditional** — Node native type stripping requires the runner to import `"./render-termo-words.ts"` with the `.ts` extension, and tsc emits TS5097 on that import without the flag (legal here because `noEmit: true` is inherited from base). `"types": ["node"]` covers the runner's `node:fs`/`import.meta.url` usage. Do **not** add `"../scripts"` to `test/tsconfig.json` `include`: the runner's `.ts`-extension import would then be a root file of the test program, which lacks `allowImportingTsExtensions` → TS5097 there; and it is unnecessary — the harness's extensionless import of the renderer is followed by tsc automatically (imported files join the program regardless of `include`), so the renderer is typechecked in both programs. `test/tsconfig.json` is untouched. Never touch `packages/games/tsconfig.json` (`"types": []` is the purity backstop) and never add a `vitest.config.ts` (ADR-0017).
- **Prettier:** lint-staged runs prettier on staged files; a rewrite would break byte-equality with the renderer. Two-part mitigation: the renderer emits prettier-stable output (verify with `pnpm exec prettier --check` on the generated file during implementation), **and** append `packages/games/src/termo/words.generated.ts` to the repo-root `.prettierignore` (the file already exists — it currently ignores `docs/`, `content/`, etc.; note `docs/` being ignored means the committed plan doc is unaffected by prettier) so a future prettier version bump cannot silently reformat it. Eslint still covers it (purity rules are what matter there).

### 3.4 Staleness proof (how hand-editing either side fails CI)

`test/termo/word-list.test.ts` reads the real CSVs with `node:fs`, calls `renderTermoWordsModule` (same function the script uses — no second rendering implementation), and asserts the result is **byte-identical** to the on-disk `src/termo/words.generated.ts`. Edit the generated file → mismatch. Edit a CSV without regenerating → mismatch. Edit both "consistently" → only possible by actually changing the reviewed list, which is a visible `content/termo/` diff subject to content review and README byte-reproducibility. The test runs in `pnpm test`, which the mechanical gate requires green — this plus "the proven export is #27's sole ingestion path" is what "gates the list's use in publishing" means from this ticket (binding per CLAUDE.md "each gate binds from the ticket that introduces it").

## 4. `packages/games/package.json` changes

```json
"exports": {
  ".": "./src/index.ts",
  "./termo": "./src/termo/index.ts"
},
"scripts": {
  "generate:termo": "node scripts/generate-termo-words.ts",
  "typecheck": "tsc -p tsconfig.json && tsc -p test/tsconfig.json && tsc -p scripts/tsconfig.json",
  "test": "vitest run"
}
```

No dependency changes of any kind. `src/index.ts` is untouched (substrate only, per ADR-0019 landing with #16).

## 5. File-by-file change list

| File | Action | Contents |
|---|---|---|
| `packages/games/src/termo/normalize.ts` | add | §2.1 |
| `packages/games/src/termo/evaluate.ts` | add | §2.2 (`TileState`, `TileStates`, `WORD_LENGTH`, `evaluateGuess`) |
| `packages/games/src/termo/keyboard.ts` | add | §2.3 |
| `packages/games/src/termo/status.ts` | add | §2.4 (`MAX_GUESSES`, `TermoBoardStatus`, `deriveBoardStatus`) |
| `packages/games/src/termo/words.generated.ts` | add (generated) | §3.1 |
| `packages/games/src/termo/word-list.ts` | add | §3.2 |
| `packages/games/src/termo/index.ts` | add | re-export the entire §2 surface, nothing else |
| `packages/games/scripts/render-termo-words.ts` | add | §3.3 pure renderer |
| `packages/games/scripts/generate-termo-words.ts` | add | §3.3 Node runner |
| `packages/games/package.json` | edit | §4 hunk only (exports subpath, `generate:termo`, three-program `typecheck` chain) |
| `packages/games/scripts/tsconfig.json` | add | exact §3.3 content — scripts program under the strict gate, discovered by eslint's project service |
| `.prettierignore` | edit (exists) | append `packages/games/src/termo/words.generated.ts` |
| `packages/games/test/termo/normalize.test.ts` | add | §7.1 |
| `packages/games/test/termo/evaluate.test.ts` | add | §7.2 |
| `packages/games/test/termo/keyboard.test.ts` | add | §7.3 |
| `packages/games/test/termo/status.test.ts` | add | §7.4 |
| `packages/games/test/termo/word-list.test.ts` | add | §6 harness (incl. staleness) |
| `docs/plans/013-issue-26-plan-termo-engine.md` | add | this document, verbatim (NNN = actual next-free at merge time, §top) |

Nested `test/termo/` is covered by `test/tsconfig.json` `include: ["."]` and vitest's default glob; converges with #16's `src/<game>/` module-boundary convention without depending on its code. `purity.test.ts` is untouched and must pass over the new src files (the generated module has zero imports; the others import only `./`-relative).

## 6. Harness spec — `test/termo/word-list.test.ts` (ADR-0015 gate)

Test file reads `content/termo/{answers.csv,validation.txt,canonical-map.csv}` via `node:fs` (path from `import.meta.url`). Named tests, each an explicit invariant:

1. `every answer normalized form matches ^[a-z]{5}$` — over the CSV `normalized` column and over `TERMO_ANSWERS[i].normalized` (both, so a drift in either representation fails by name).
2. `no two answers share a normalized form` — `new Set(normalized).size === 400` (ADR-0015: sabia/sábia/sabiá is one slot).
3. `every answer normalized form is in the validation dictionary` — 400/400 ⊆ set of validation.txt lines.
4. `every answer canonical normalizes to its normalized column via normalizeWord` — the TS↔Python parity pin over the answers.
5. `validation.txt is sorted, unique, and every word matches ^[a-z]{5}$` — plus exact count 5,310.
6. `canonical-map covers exactly the validation set and every canonical normalizes to its key` — keys(map) === set(validation.txt), and `normalizeWord(canonical) === normalized` for all 5,310 rows: parity proved over the full accented corpus even though the map never ships in the runtime.
7. `words.generated.ts is byte-identical to the renderer output from content/termo` — §3.4 staleness test, via the shared `renderTermoWordsModule`.
8. `TERMO_ANSWERS preserves answers.csv row order` — index-wise `{canonical, normalized}` equality, with a comment stating the order is contractual for #27's seeded pick.
9. `exports are frozen and sized` — `Object.isFrozen`, lengths 400 / 5,310; `isValidGuess` accepts an accented spelling of a validation word (`"ábaco"` → true) and rejects a non-word.
10. `TERMO_VALIDATION_WORDS equals validation.txt line-for-line` — index-wise deep equality between the runtime export and the lines read from `validation.txt`. This is the validation-side twin of test 8: it anchors the runtime data to the reviewed content artifact **independently of the shared renderer**. Without it, a renderer parsing bug (mangled word, swapped line, off-by-one duplicate preserving count) would byte-match its own wrong output in test 7 and slip past tests 5 and 9.

## 7. Property-based test plan (fast-check 4.9.0, already a devDep)

Arbitraries: `ptbrWord = fc.string({ unit: fc.constantFrom(..."abcdefghijklmnopqrstuvwxyzáéíóúâêôãõàç"), minLength: 5, maxLength: 5 })`; `anyString = fc.string()` plus `fc.string({ unit: "grapheme" })` for broad-unicode coverage; `azWord = fc.string({ unit: fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz"), minLength: 5, maxLength: 5 })`. Default `numRuns` (100) everywhere; no ADR-0017-violating config tuning — budget: the whole `@miolos/games` suite (incl. 5,310-row harness loops) under ~10 s wall.

### 7.1 `normalize.test.ts`
- Property: idempotence — `normalizeWord(normalizeWord(s)) === normalizeWord(s)` over `anyString` and grapheme strings.
- Property: output has no combining marks — `!/\p{Mn}/u.test(out)` over `anyString` and grapheme strings. **Do not assert no-uppercase over arbitrary unicode**: several Lu code points have no lowercase mapping (`𝔄` U+1D504, `ϒ` U+03D2 survive `toLowerCase` intact), so `!/\p{Lu}/u` over `anyString`/grapheme is a false property and a fresh-seed flaky gate.
- Property: output has no uppercase — `!/\p{Lu}/u.test(out)` restricted to the domain where it is a true invariant: `ptbrWord` and `azWord` inputs and their `.toUpperCase()` variants (the pt-BR alphabet round-trips cleanly through case mapping).
- Property: length preservation over `ptbrWord` (every char maps 1→1).
- Property: determinism — two calls, same result.
- Examples (table-driven): `ç→c`, `ação→acao`, `sábia→sabia`, `então→entao`, `MUITO→muito`, already-normalized fixed point, empty string.

### 7.2 `evaluate.test.ts`
- Property: `evaluateGuess(w, w)` is all-`correct` over `azWord` and `ptbrWord`.
- Property: result is always a 5-tuple of valid `TileState` over pairs of `azWord`.
- Property: letter-count conservation — for every letter L, `#(correct|present marks at positions where guess has L) ≤ count of L in normalized answer`.
- Property: accent invariance — for `ptbrWord` pairs `(g, a)`, `evaluateGuess(g, a)` deep-equals `evaluateGuess(normalizeWord(g), normalizeWord(a))`.
- Property: determinism.
- Examples (double-letter classics — **every fixture must be a concrete hand-verified tuple before it becomes an expectation**; a plausible-looking wrong tuple becomes a wrong test): answer `cacau`, guess `aaaaa` → `[absent, correct, absent, correct, absent]` (surplus-doubles-vs-fewer-in-answer case: pass 1 consumes positions 1 and 3, count exhausted for 0/2/4); answer `caçar`, guess `carro` → `[correct, correct, present, absent, absent]` (accent-insensitive with letter-count exhaustion: only one `r` remains after normalization); answer `arara`, guess `aarrr` → `[correct, present, present, correct, absent]` (exact-beats-earlier-present: pass-1 consumption at positions 0 and 3 before pass 2 walks left-to-right); answer `arara`, guess `arara` → all correct. All three non-trivial tuples above were hand-verified against the §2.2 two-pass algorithm during plan review. Error paths: 4-letter guess, 6-letter answer, digit-containing input → `RangeError`.

### 7.3 `keyboard.test.ts`
- Property: monotonicity — appending an evaluated guess never downgrades any key (precedence `correct > present > absent`) over sequences of `azWord` guesses vs a fixed answer.
- Property: every key in the output appeared in some guess; states only from `TileState`.
- Example: correct beats later present; present beats later absent; untouched letters absent from the map.

### 7.4 `status.test.ts`
- Examples: empty → `playing`; win on rows 1 and 6 → `won`; 6 non-winning rows → `lost`; 5 non-winning → `playing`; >6 rows → `RangeError`; row after a win → `RangeError`.
- Property: status is `won` when the **last** row is all-correct — generator constrained to `deriveBoardStatus`'s own preconditions: `fc.array(nonWinningRow, { minLength: 0, maxLength: 5 })` with one all-correct row **appended last** (total ≤ `MAX_GUESSES`). An unconstrained tile-matrix generator would place the winning row mid-board or exceed 6 rows and hit the §2.4 `RangeError` by construction — do not write that form. (`nonWinningRow` = 5-tuple of `TileState` filtered to exclude all-`correct`.)
- Property: status of ≤6 rows with no all-correct row is `lost` iff exactly `MAX_GUESSES` rows, else `playing` — over `fc.array(nonWinningRow, { minLength: 0, maxLength: 6 })`.

## 8. Verification (evidence rule: paste real output, exit codes visible)

Preamble for every shell: `source ~/.nvm/nvm.sh && nvm use default`. From repo root:

| Command | Proves |
|---|---|
| `node --version` | ≥ 24 (native TS stripping for the codegen runner) |
| `pnpm --filter @miolos/games generate:termo && git diff --exit-code packages/games/src/termo/words.generated.ts` | codegen determinism/idempotence — regeneration is a no-op on a clean tree |
| `pnpm typecheck` | strict tsc green in both games programs (`types: []` src purity backstop intact) and all other workspaces |
| `pnpm lint` | eslint green, incl. the games-src purity rules over the new files and the generated module |
| `pnpm test` | full suite green: purity tests, harness tests 1–10 **by name in the output**, all property suites; paste the vitest summary showing test counts and duration |
| `pnpm exec prettier --check packages/games/src/termo/words.generated.ts` (pre-.prettierignore, once) | renderer output is prettier-stable, so the ignore entry is belt-and-braces not a cover-up |

`npx impeccable detect` is N/A (no UI touched) — say so in the PR rather than skipping silently. Pre-commit (Husky + lint-staged) must pass without `--no-verify`.

## 9. Branch, commits, PR

- Branch: `feat/26-termo-engine` off `main`.
- Commits (Conventional, English; body carries the why):
  1. `feat(games): add termo normalization, matching, keyboard and board-status engine`
  2. `feat(games): generate termo word data from content/termo via committed codegen`
  3. `test(games): termo word-list harness proving ADR-0015 invariants`
  4. `docs: commit issue-26 implementation plan as docs/plans/013` (013 reserved by the orchestrator across six parallel streams)
- PR title: `feat: M2 Termo engine and word-list harness (#26)`. Body skeleton:
  - **What changed** — one paragraph per §5 cluster (engine, word data + codegen, harness, plan doc).
  - **Evidence** — the §8 command outputs inline, one fenced block per gate.
  - **Contract notes for #27** — `@miolos/games/termo` is the sole ingestion path for the list; `TERMO_ANSWERS` order is contractual for the seeded pick; `normalizeWord` is the only normalization function and input handling must import it; board `won`/`lost` maps to Completed/Played server-side per ADR-0008.
  - **Decisions Fernando needs to make: none.** Non-blocking flags for the orchestrator, dismissible in writing per adversarial-review rules:
    - canonical-map is harness-input only, not runtime — if later UX wants canonical display of *non-answer* guesses, that is a new ticket, not silent scope growth here.
    - `pipeline.py`'s Python normalization is retained and mechanically pinned to the TS one by harness tests 4 and 6 — recorded reading of "no second implementation" (TS runtime scope).
    - `"./termo"` subpath + bare root barrel per ADR-0019, landing with #16 — if #16 lands a different shape first, converge on #16's during merge, not the reverse.
- Merge only with the mechanical gate fully green (agent-owned review→fix→merge loop per memory).

## 10. Risks and mitigations

- **Staleness-test bypass routes:** (a) hand-edit generated file → byte-compare fails; (b) edit CSVs without regenerating → fails; (c) edit both consistently → surfaces as a `content/termo/` diff, which is reviewed content (README byte-reproducibility) — acceptable residual; (d) delete/weaken the harness test → forbidden by CLAUDE.md ("no PR may remove or weaken a gate"); (e) prettier or an editor reformats the generated file → `.prettierignore` entry + renderer emits prettier-stable output; (f) a second renderer implementation drifting from the script → impossible, test and script share `renderTermoWordsModule`.
- **Double-letter matching bugs:** the classic Wordle edge cases are pinned as hand-verified fixtures (§7.2) *and* the conservation property; both must fail if pass-1 consumption is wrong.
- **Unicode parity JS↔Python:** `\p{Mn}` (not `\p{M}`) matches Python's Mn-only filter; harness tests 4 and 6 prove parity over every real word (5,710 canonicals), so the theoretical divergence outside pt-BR cannot bite the shipped lists.
- **Merge overlap with parallel engine branches (#16 etc.):** the only shared file is `packages/games/package.json` (keep the `exports` hunk minimal, subpaths alphabetical; `scripts/tsconfig.json` is new and `test/tsconfig.json` is untouched) — trivial conflicts; whoever merges second resolves by union. Do not touch `src/index.ts` or shared configs otherwise.
- **Node <24 on a contributor machine:** codegen runner fails to strip types — error is loud; nvm preamble in §8 pins the version. Fallback `node --experimental-strip-types` documented in the script's header comment only if implementation hits it.
- **Purity-scanner false positive on the generated banner:** banner contains no `import(`/`require(` tokens (§3.1); purity.test.ts run confirms.
- **ADR-0017 trap:** no `vitest.config.ts` in `packages/games`, ever — the harness loops need no tuning (milliseconds over 5,310 rows).

## 11. Exit criteria (step 8 checklist)

All §8 outputs green and pasted; harness tests 1–10 present by name in vitest output; regeneration idempotent on clean tree; PR merged via the review loop; issue #26 closed with acceptance criteria checked off against §2.1 (criterion 1), §2.5/§2.2 (criterion 2), §6 + §3.4 (criterion 3), purity tests + zero-dep manifest (criterion 4).

## Step-4 changelog

Step-3 review (`03-plan-review.md`): REJECTED, 4 blocking + 4 advisory. All eight dispositions below; every fix applied in place above.

- **B1 (lint fails on `scripts/*.ts`) — FIXED, review prescription adopted with one refinement.** §3.3 now specifies the exact `packages/games/scripts/tsconfig.json` (extends base → `strict: true`; `types: ["node"]`; `allowImportingTsExtensions: true` stated as mandatory for the runner's `.ts`-extension import, legal via inherited `noEmit`; `include: ["."]`), explains the project-service ancestor-lookup mechanism, and §4 chains `typecheck` over all three programs so `scripts/` sits under the strict gate. Refinement over the review: `test/tsconfig.json` is left **untouched** rather than gaining `"../scripts"` — including `scripts/` there would make the runner (with its `.ts`-extension import) a root file of a program lacking `allowImportingTsExtensions` (TS5097), and it is unnecessary because tsc pulls the harness's extensionless renderer import into the test program automatically. §5 and §10 updated accordingly.
- **B2 (`TERMO_VALIDATION_WORDS` not renderer-independently anchored) — FIXED as prescribed.** New §6 test 10: index-wise deep equality runtime export ↔ `validation.txt` lines, the validation-side twin of test 8. Test-count references (§8, §11) updated to 1–10.
- **B3 (no-uppercase property false over arbitrary unicode) — FIXED as prescribed.** §7.1 splits the property: `\p{Mn}`-free stays over `anyString`/grapheme; `\p{Lu}`-free is restricted to `ptbrWord`/`azWord` and their `.toUpperCase()` variants, with the `𝔄`/`ϒ` counterexamples recorded so the implementer doesn't reintroduce the flaky form.
- **B4 (won-property throws under its own generator) — FIXED as prescribed.** §7.4 property constrained to the function's preconditions: 0–5 generated non-winning rows with the all-correct row appended last (≤ `MAX_GUESSES`), the broken unconstrained form explicitly forbidden. Added a companion lost/playing property over non-winning boards (adding tests is always allowed).
- **A1 (plan-doc number 013 vs next-free) — APPLIED:** renumbered to 008 (verified next-free: docs currently use 001–007) with an explicit re-check-at-merge note; §5 and commit 4 updated.
- **A2 (ADR-0019 cited before it exists) — APPLIED:** §0 now cites the pending ADR in the PR body only; code comments name the convention without a number until #16's ADR lands.
- **A3 (double-letter fixtures were prose) — APPLIED:** §7.2 now carries three concrete hand-verified tuples (`cacau`/`aaaaa`, `caçar`/`carro`, `arara`/`aarrr` — the latter two verified by the step-3 reviewer against the §2.2 algorithm) and mandates hand-verification for any further fixture.
- **A4 (`.prettierignore` already exists) — APPLIED:** §3.3 and §5 say append, not create; noted `docs/` is already prettier-ignored so the plan doc is unaffected.
