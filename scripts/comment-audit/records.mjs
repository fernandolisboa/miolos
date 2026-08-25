// The ONE definition of a records-genre citation, shared by every tool here.
//
// `plan` needs a number and `finding` a label, so an ordinary parenthetical
// that happens to contain the word — "(plan for a second consumer)" — is NOT
// stripped: stripping prose hides a real rewrite behind a green. A citation
// may sit anywhere inside its parenthesis, so `(ADR-0032, plan 020 §9.3)`
// counts too.
const INNER = [
  String.raw`plan \d+[^)]*`,
  String.raw`step-\d+[^)]*`,
  String.raw`round-\d+[^)]*`,
  String.raw`finding (?:\x60[^\x60)]+\x60|[A-Z][\w.-]*)[^)]*`,
  String.raw`§[\d.][^)]*`,
  String.raw`CLI-\d+`,
  // Not `[PSND]\d+` bare: that also matches the `S311` inside `T-WEB-S311`.
  String.raw`(?<![-\w])[PSND]\d+(?:\/[PSND]\d+)?(?![-\w])`,
].join("|");

const ANCHOR = String.raw`[\w/-]+\.(?:tsx?|mjs|css):\d[\d-]*`;

export const RECORDS = [
  // A citation may carry a short structured lead-in — `(ADR-0032, plan 020
  // §9.3)`, `(#31 step-6 F15)` — so the prefix is not anchored at `(`. It is
  // BOUNDED instead: at most 24 characters, no sentence punctuation, no `(`.
  // An unbounded prefix strips the prose in front of a citation from BOTH
  // sides, which is the direction that hides a real rewrite behind a green,
  // and it lets a match start at a CODE parenthesis and swallow whole lines.
  String.raw`\([^()—."]{0,24}?(?:${INNER})\)`,
  "`" + ANCHOR + "`",
].join("|");

export const recordsRe = (flags = "g") => new RegExp(RECORDS, flags);

/** The marker scan that scopes a tranche: what still smells of records. */
export const MARKERS = [
  String.raw`\bplan \d+\b`,
  String.raw`§\d`,
  String.raw`\bstep-\d\b`,
  String.raw`\bround-\d\b`,
  String.raw`\bfinding\b`,
  String.raw`\bT-(?:WEB|LINT|API|CORE|DB)-S\d+`,
  // The bare decision-citation class — `(D7)`, `(S23)`, `(P11)`. It is ~12% of
  // the marker mass in the game dirs, and it is the shape `RECORDS` treats as
  // core, so a scan that scopes a tranche must see it too.
  String.raw`\((?<![-\w])[PSND]\d+(?:\/[PSND]\d+)?\)`,
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
