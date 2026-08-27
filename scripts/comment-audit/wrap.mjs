import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { commentRanges } from "./count.mjs";
import { DIRECTIVES, parseArgs } from "./records.mjs";

//

//

const WIDTH = 80;

const DIRECTIVE_RES = DIRECTIVES.map(([, re]) => new RegExp(re.source));

const GUTTER_RE = /^([ \t]*(?:\/\/+|\/\*+|\*)[ \t]?)/;

const FENCE_RE = /^(?:```|~~~)/;

const RULE = "[-—─=·]";
const BLOCKISH_RE = new RegExp(
  `^(?:#{1,6}\\s|\\||>|<|\\[[^\\]]+\\]:|[-—─=·*_]{3,}\\s*$|${RULE}{3,}.*${RULE}{3,}\\s*$)`,
);
const COLUMNS_RE = /\S[ \t]{3,}\S/;
const MARKER_RE = /^(?:[-*+]|\d+[.)])[ \t]+/;

function proseLines(file, text) {
  const raw = text.split("\n");
  const md = file.endsWith(".md");
  const inComment = md ? null : commentMask(file, text);
  const out = [];
  let fenced = false;
  let pos = 0;
  for (const line of raw) {
    const start = pos;
    pos += line.length + 1;
    let gutter = "";
    let body = line;
    if (!md) {
      let hasComment = false;
      let hasCode = false;
      for (let j = start; j < start + line.length; j++) {
        if (text[j].trim() === "") continue;
        if (inComment[j]) hasComment = true;
        else hasCode = true;
      }

      //

      if (!hasComment || hasCode || line.includes("*/")) {
        out.push(null);
        continue;
      }

      gutter = (GUTTER_RE.exec(line) ?? /^[ \t]*/.exec(line))[0];
      body = line.slice(gutter.length);
    }

    if (FENCE_RE.test(body.trim())) {
      fenced = !fenced;
      out.push(null);
      continue;
    }
    const trimmed = body.trimEnd();
    if (
      fenced ||
      trimmed.trim() === "" ||
      BLOCKISH_RE.test(trimmed.trimStart()) ||
      COLUMNS_RE.test(trimmed) ||
      DIRECTIVE_RES.some((re) => re.test(line)) ||
      (md && /[ \t]{2}$/.test(body))
    ) {
      out.push(null);
      continue;
    }
    out.push({ gutter, body: trimmed, width: (gutter + trimmed).length });
  }
  return out;
}

function commentMask(file, text) {
  const mask = new Uint8Array(text.length);
  const { ranges } = commentRanges(file, text);
  for (const [a, b] of ranges) for (let i = a; i < b; i++) mask[i] = 1;
  return mask;
}

const indentOf = (s) => s.length - s.trimStart().length;

export function ragged(file, text) {
  const lines = proseLines(file, text);
  const hits = [];
  let i = 0;
  while (i < lines.length) {
    if (!lines[i]) {
      i++;
      continue;
    }

    const head = lines[i];
    const marker = MARKER_RE.exec(head.body.trimStart());
    const contIndent = indentOf(head.body) + (marker ? marker[0].length : 0);
    let end = i + 1;
    while (
      end < lines.length &&
      lines[end] &&
      lines[end].gutter.length === head.gutter.length &&
      !MARKER_RE.test(lines[end].body.trimStart()) &&
      indentOf(lines[end].body) === contIndent
    ) {
      end++;
    }

    //

    const fills = lines.slice(i, end - 1).filter((l) => l.width <= WIDTH);
    const col =
      fills.length === 0 ? WIDTH : Math.max(...fills.map((l) => l.width));
    for (let k = i; k < end - 1; k++) {
      const next = lines[k + 1].body.trim();
      const word = next.split(/\s+/)[0];
      const would = lines[k].width + 1 + word.length;

      const orphan = k + 1 === end - 1 && next === word;
      if (would > (orphan ? WIDTH : col)) continue;
      hits.push({
        line: k + 1,
        text: lines[k].gutter + lines[k].body,
        word,
        would,
        kind: orphan ? "orphan" : "ragged",
        key: `${lines[k].body.trim()} ${word}`,
      });
    }
    i = end;
  }
  return hits;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const { base, files } = parseArgs(process.argv, "wrap.mjs");

  try {
    execFileSync(
      "git",
      ["rev-parse", "--verify", "--quiet", `${base}^{commit}`],
      {
        stdio: "pipe",
      },
    );
  } catch {
    console.error(`wrap.mjs: --base ${base} does not resolve to a commit`);
    process.exit(2);
  }

  let added = 0;
  let compared = 0;
  let missing = 0;
  for (const f of files) {
    let text;
    try {
      text = fs.readFileSync(f, "utf8");
    } catch {
      missing++;
      console.log(`   -  (absent from the working tree)  ${f}`);
      continue;
    }
    const hits = ragged(f, text);
    const before = new Map();
    let fresh = false;
    try {
      const baseText = execFileSync("git", ["show", `${base}:${f}`], {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      });
      for (const h of ragged(f, baseText))
        before.set(h.key, (before.get(h.key) ?? 0) + 1);
    } catch {
      fresh = true;
    }
    compared++;
    const isNew = [];
    for (const h of hits) {
      const left = before.get(h.key) ?? 0;
      if (left > 0) before.set(h.key, left - 1);
      else isNew.push(h);
    }
    added += isNew.length;
    console.log(
      `${String(isNew.length).padStart(3)} new  ${String(hits.length).padStart(3)} total  ${f}` +
        (fresh ? `  (absent on ${base}; every hit reads as new)` : ""),
    );
    for (const h of isNew) {
      console.log(
        `      ${f}:${h.line}  ${h.kind}\n        ${h.text}\n        ↳ "${h.word}" would have fit (${h.would} ≤ ${WIDTH})`,
      );
    }
  }
  if (compared > 0) {
    console.log(
      added === 0
        ? `\nNo line this diff wrote can take the first word below it within ${WIDTH} columns.`
        : `\n${added} ragged line(s) this diff added.`,
    );
  }
  if (missing) console.log(`${missing} of ${files.length} file(s) SKIPPED.`);
  process.exit(compared === 0 ? 2 : added === 0 ? 0 : 1);
}
