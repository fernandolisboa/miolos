/**
 * Strips `//` and block comments from TypeScript source so a source-scan
 * assertion can look at code rather than at the doc block above it.
 *
 * Every scan in this suite that greps a `.ts`/`.tsx` file for a forbidden
 * token is red on a clean tree without this: the doc blocks quote the very
 * tokens the scans forbid. This is the TS counterpart of `css-source.ts`'s
 * `stripComments`, which is a one-line regex only because CSS has no `//`
 * form at all.
 *
 * Deliberately a character scanner and not a parser — it does not understand
 * strings, template literals or regex literals, so a `/*` inside one is
 * treated as a comment opener. That has been sufficient for every scan here,
 * and the day it is not, the fix lands once instead of three times.
 */
export function withoutComments(source: string): string {
  let out = "";
  let inBlock = false;
  for (const line of source.split("\n")) {
    let kept = "";
    for (let i = 0; i < line.length; i += 1) {
      if (inBlock) {
        if (line.startsWith("*/", i)) {
          inBlock = false;
          i += 1;
        }
        continue;
      }
      if (line.startsWith("//", i)) {
        break;
      }
      if (line.startsWith("/*", i)) {
        inBlock = true;
        i += 1;
        continue;
      }
      kept += line[i];
    }
    out += `${kept}\n`;
  }
  return out;
}
