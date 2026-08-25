import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { requireFiles } from "./records.mjs";

// The same metric for CSS, because tranche 7c is `.module.css` and `count.mjs`
// is TypeScript-only — without this, #205's Rule P cannot be satisfied for it.
//
// CSS has one comment form, `/* */`, and no strings that can contain it in
// practice, so a scanner is enough here where it is not for TypeScript. A line
// counts when it carries at least one non-whitespace comment character and no
// declaration character — the same rule `count.mjs` applies.
export function countCss(file) {
  const text = fs.readFileSync(file, "utf8");
  const mask = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "/" && text[i + 1] === "*") {
      const end = text.indexOf("*/", i + 2);
      const stop = end === -1 ? text.length : end + 2;
      for (let j = i; j < stop; j++) mask[j] = 1;
      i = stop - 1;
    }
  }
  const lines = text.split("\n");
  let pos = 0;
  let commentOnly = 0;
  let touched = 0;
  for (const line of lines) {
    let hasComment = false;
    let hasCode = false;
    for (let j = pos; j < pos + line.length; j++) {
      if (text[j].trim() === "") continue;
      if (mask[j]) hasComment = true;
      else hasCode = true;
    }
    if (hasComment) {
      touched++;
      if (!hasCode) commentOnly++;
    }
    pos += line.length + 1;
  }
  return {
    commentOnly,
    touched,
    total: lines.length - (lines.at(-1) === "" ? 1 : 0),
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const files = requireFiles(process.argv, "css-count.mjs");
  let tot = 0;
  let totT = 0;
  for (const f of files) {
    const r = countCss(f);
    tot += r.commentOnly;
    totT += r.touched;
    console.log(
      `${String(r.commentOnly).padStart(4)} only  ${String(r.touched).padStart(4)} touched  of ${String(r.total).padStart(4)}  ${f}`,
    );
  }
  console.log(
    `${String(tot).padStart(4)} only  ${String(totT).padStart(4)} touched  TOTAL`,
  );
}
