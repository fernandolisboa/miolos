import fs from "node:fs";
import { count } from "./count.mjs";
import { markersRe, requireFiles } from "./records.mjs";

// Which files still smell of records, so the next tranche is scoped by
// measurement rather than by impression. Ranks ABSOLUTE marker count; the
// per-comment-line rate is printed beside it because a long file and a dense
// one are different problems.
const files = requireFiles(process.argv, "markers.mjs");
const rows = files.map((f) => {
  const n = (fs.readFileSync(f, "utf8").match(markersRe()) ?? []).length;
  const lines = count(f).commentOnly;
  return { n, lines, f };
});
rows.sort((a, b) => b.n - a.n || b.lines - a.lines);

let total = 0;
let totalLines = 0;
for (const r of rows) {
  total += r.n;
  totalLines += r.lines;
  const rate = r.lines === 0 ? "  -  " : (r.n / r.lines).toFixed(3);
  console.log(
    String(r.n).padStart(4) +
      "  " +
      String(r.lines).padStart(5) +
      " lines  " +
      rate +
      "  " +
      r.f,
  );
}
const rate = totalLines === 0 ? "  -  " : (total / totalLines).toFixed(3);
console.log(
  String(total).padStart(4) +
    "  " +
    String(totalLines).padStart(5) +
    " lines  " +
    rate +
    "  TOTAL",
);
