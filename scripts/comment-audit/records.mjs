// The ONE definition of a records-genre citation, shared by every tool here.
//
// A citation lives inside a parenthesis and may carry structure on either side
// — `(ADR-0032, plan 020 §9.3)`, `(#31, ADR-0053 decision 1; plan 037 D6a)`.
// Both sides are matched by a TOKEN GRAMMAR, not by a length window: the
// lead-in and the tail may hold citation-shaped tokens and separators and
// nothing else, so a run of lowercase prose ends the match.
//
// A length window cannot tell prose from citation tokens, and four attempts to
// pick one oscillated between the two failure directions. They are not
// symmetric: MISSING a citation only makes `excision.mjs` flag an ordinary
// excision, which is noise. STRIPPING prose deletes a claim from both sides of
// the comparison, so a reworded — or inverted — sentence passes green. This
// grammar is deliberately tuned to miss rather than to over-match; the misses
// it accepts, like `(ADR-0031 as amended by ADR-0060, plan 018 §11.4)`, simply
// get flagged for a human to read.
const TOKEN = [
  String.raw`#\d+`,
  String.raw`ADR-\d{4}`,
  String.raw`§[\d.]+`,
  String.raw`plan \d+`,
  String.raw`issue #\d+`,
  String.raw`decision \d+[a-z]?`,
  String.raw`step[- ]\d+`,
  String.raw`round-\d+`,
  String.raw`\x60[^\x60()]*\x60`,
  String.raw`[A-Z][\w.-]*`,
  String.raw`\d+`,
].join("|");

// Separators only — no `.`, no `—`, no quote: those introduce prose.
const NEAR = String.raw`(?:(?:${TOKEN})|[\s,;:/])*`;

// `step[- ]\d+` takes the SPACE form as well as the hyphen. With the hyphen
// only, `(#142 step 7)` — live in all four daily `use-*-play.ts` hooks — was
// invisible to both `citations.mjs` and `markers.mjs`, so a tranche could
// report `markers.mjs 0` for three files that each carried one (#205 Rule AA).
const INNER = [
  String.raw`plan \d+`,
  String.raw`step[- ]\d+`,
  String.raw`round-\d+`,
  String.raw`finding (?:\x60[^\x60)]+\x60|[A-Z][\w.-]*)`,
  String.raw`§[\d.]+`,
  String.raw`CLI-\d+`,
  // Not `[PSND]\d+` bare: that also matches the `S311` inside `T-WEB-S311`.
  String.raw`(?<![-\w])[PSND]\d+(?:\/[PSND]\d+)?(?![-\w])`,
].join("|");

const ANCHOR = String.raw`[\w/-]+\.(?:tsx?|mjs|css):\d[\d-]*`;

export const RECORDS = [
  String.raw`\(${NEAR}(?:${INNER})${NEAR}\)`,
  "`" + ANCHOR + "`",
].join("|");

export const recordsRe = (flags = "g") => new RegExp(RECORDS, flags);

/** The marker scan that scopes a tranche: what still smells of records. */
export const MARKERS = [
  String.raw`\bplan \d+\b`,
  String.raw`§\d`,
  String.raw`\bstep[- ]\d\b`,
  String.raw`\bround-\d\b`,
  String.raw`\bfinding\b`,
  String.raw`\bT-(?:WEB|LINT|API|CORE|DB)-S\d+`,
  // The bare decision-citation class — `(D7)`, `(S23)`, `(P11)`. It is ~12% of
  // the marker mass in the game dirs, and it is the shape `RECORDS` treats as
  // core, so a scan that scopes a tranche must see it too.
  String.raw`\([PSND]\d+(?:\/[PSND]\d+)?\)`,
  ANCHOR,
].join("|");

export const markersRe = (flags = "g") => new RegExp(MARKERS, flags);

/**
 * Comment trivia that is a DIRECTIVE, not prose, and therefore invisible to
 * `hash.mjs` — the printer drops it and the AST never held it. Deleting the
 * `/*#__PURE__*\/` markers in `packages/games/src/termo/word-list.ts` ships the
 * whole Termo answer pool to every client.
 */
export const DIRECTIVES = [
  ["pure", /\/\*#__PURE__\*\//g],
  ["eslint", /\/[/*]\s*eslint-(?:disable|enable)/g],
  ["ts-directive", /\/[/*]\s*@ts-(?:ignore|expect-error|nocheck)/g],
  ["prettier-ignore", /\/[/*]\s*prettier-ignore/g],
  ["vitest-environment", /@vitest-environment/g],
  ["triple-slash", /^\/\/\/\s*<reference/gm],
];

/**
 * Parse `--base <ref>` and return the file list — flags FIRST, so two flag
 * tokens cannot satisfy the empty-list check and leave nothing to scan. An
 * empty list exits 2 rather than printing the most reassuring output in the
 * toolkit (#205 Rule I).
 */
export function parseArgs(argv, name, takesBase = true) {
  const rest = argv.slice(2);
  let base = "main";
  const files = [];
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] !== "--base") {
      files.push(rest[i]);
      continue;
    }
    if (!takesBase) {
      console.error(
        `${name}: reads the working tree only; --base means nothing here`,
      );
      process.exit(2);
    }
    base = rest[++i];
    if (base === undefined) {
      console.error(`${name}: --base needs a ref`);
      process.exit(2);
    }
  }
  if (files.length === 0) {
    console.error(
      `usage: node scripts/comment-audit/${name}${takesBase ? " [--base <ref>]" : ""} <file>...\n` +
        "Refusing to run on an empty file list: a wrong glob would otherwise\n" +
        "print the most reassuring output in the toolkit (see #205 Rule I).",
    );
    process.exit(2);
  }
  return { base, files };
}
