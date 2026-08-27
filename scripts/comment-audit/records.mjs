//

//

const TOKEN = [
  String.raw`#\d+`,
  String.raw`ADR-\d{4}`,
  String.raw`§[\d.]+`,
  String.raw`plan \d+`,
  String.raw`issue #\d+`,
  String.raw`decision \d+[a-z]?`,
  String.raw`step-\d+`,
  String.raw`round-\d+`,
  String.raw`\x60[^\x60()]*\x60`,
  String.raw`[A-Z][\w.-]*`,
  String.raw`\d+`,
].join("|");

const NEAR = String.raw`(?:(?:${TOKEN})|[\s,;:/])*`;

const INNER = [
  String.raw`plan \d+`,
  String.raw`step[- ]\d+`,
  String.raw`round-\d+`,
  String.raw`finding (?:\x60[^\x60)]+\x60|[A-Z][\w.-]*)`,
  String.raw`§[\d.]+`,
  String.raw`CLI-\d+`,

  String.raw`(?<![-\w])[PSND]\d+(?:\/[PSND]\d+)?(?![-\w])`,
].join("|");

const ANCHOR = String.raw`[\w/-]+\.(?:tsx?|mjs|css):\d[\d-]*`;

export const RECORDS = [
  String.raw`\(${NEAR}(?:${INNER})${NEAR}\)`,
  "`" + ANCHOR + "`",
].join("|");

export const recordsRe = (flags = "g") => new RegExp(RECORDS, flags);

export const MARKERS = [
  String.raw`\bplan \d+\b`,
  String.raw`§\d`,
  String.raw`\bstep[- ]\d\b`,
  String.raw`\bround-\d\b`,
  String.raw`\bfinding\b`,
  String.raw`\bT-(?:WEB|LINT|API|CORE|DB)-S\d+`,

  String.raw`\([PSND]\d+(?:\/[PSND]\d+)?\)`,
  ANCHOR,
].join("|");

export const markersRe = (flags = "g") => new RegExp(MARKERS, flags);

export const DIRECTIVES = [
  ["pure", /\/\*#__PURE__\*\//g],
  ["eslint", /\/[/*]\s*eslint-(?:disable|enable)/g],
  ["ts-directive", /\/[/*]\s*@ts-(?:ignore|expect-error|nocheck)/g],
  ["prettier-ignore", /\/[/*]\s*prettier-ignore/g],
  ["vitest-environment", /@vitest-environment/g],
  ["triple-slash", /^\/\/\/\s*<reference/gm],
];

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
