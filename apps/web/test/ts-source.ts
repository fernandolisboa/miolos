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
