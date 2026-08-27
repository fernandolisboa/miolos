import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { parseArgs } from "./records.mjs";

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
  const { files } = parseArgs(process.argv, "css-count.mjs", false);
  let tot = 0;
  let totT = 0;
  let skipped = 0;
  for (const f of files) {
    let r;
    try {
      r = countCss(f);
    } catch {
      skipped++;
      console.log("   -  (absent from the working tree)  " + f);
      continue;
    }
    tot += r.commentOnly;
    totT += r.touched;
    console.log(
      `${String(r.commentOnly).padStart(4)} only  ${String(r.touched).padStart(4)} touched  of ${String(r.total).padStart(4)}  ${f}`,
    );
  }
  console.log(
    `${String(tot).padStart(4)} only  ${String(totT).padStart(4)} touched  TOTAL` +
      (skipped ? `; ${skipped} of ${files.length} SKIPPED` : ""),
  );
  if (skipped === files.length) process.exit(2);
}
