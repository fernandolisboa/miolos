// The ONE definition of a records-genre citation, shared by every tool here.
// It used to be two — `citations.mjs` counted with one regex while
// `excision.mjs` stripped with a looser one, so a sentence could be rewritten
// inside a parenthetical and pass the excision check silently.
//
// Deliberately narrow on both edges: `plan` must be followed by a number, and
// `finding` by a label token, so an ordinary parenthetical that happens to
// contain the word ("plan for a second consumer", "finding a filled cell") is
// NOT stripped. Stripping prose is the dangerous direction — it hides a real
// rewrite.
export const RECORDS = [
  String.raw`\((?:plan \d+[^)]*|step-\d+[^)]*|round-\d+[^)]*|[^)]*finding [A-Z0-9][\w.-]*[^)]*|§[\d.][^)]*|CLI-\d+|[PSND]\d+(?:\/[PSND]\d+)?)\)`,
  "`[^`]*\\.(?:tsx?|mjs|css):[\\d-]+`",
].join("|");

export const recordsRe = (flags = "g") => new RegExp(RECORDS, flags);

/** The marker scan that scopes a tranche: what still smells of records. */
export const MARKERS = String.raw`\bplan \d+\b|§\d|\bstep-\d\b|\bround-\d\b|\bfinding\b|\bT-WEB-S\d+|\bT-LINT-S\d+|[\w/-]+\.tsx?:\d`;

export const markersRe = (flags = "g") => new RegExp(MARKERS, flags);

/**
 * Comment trivia that is a DIRECTIVE, not prose. `hash.mjs` cannot see these —
 * the printer drops them and the AST never held them — so it counts them
 * separately. CLAUDE.md: deleting the `/*#__PURE__*\/` markers in
 * `packages/games/src/termo/word-list.ts` ships the whole answer pool to every
 * client.
 */
export const DIRECTIVES = [
  ["pure", /\/\*#__PURE__\*\//g],
  ["eslint", /\/[/*]\s*eslint-(?:disable|enable)/g],
  ["ts-directive", /\/[/*]\s*@ts-(?:ignore|expect-error|nocheck)/g],
  ["prettier-ignore", /\/[/*]\s*prettier-ignore/g],
  ["vitest-environment", /@vitest-environment/g],
  ["triple-slash", /^\/\/\/\s*<reference/gm],
];

/** Exit with a usage message rather than a vacuous green on an empty list. */
export function requireFiles(argv, name) {
  const files = argv.slice(2);
  if (files.length === 0) {
    console.error(
      `usage: node scripts/comment-audit/${name} <file>...\n` +
        "Refusing to run on an empty file list: a wrong glob would otherwise\n" +
        "print the most reassuring output in the toolkit (see #205 Rule I).",
    );
    process.exit(2);
  }
  return files;
}
