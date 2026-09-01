import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const webRoot = join(import.meta.dirname, "..");

export function webSources(): readonly string[] {
  const found: string[] = [];
  for (const root of ["src", "app"]) {
    for (const entry of readdirSync(join(webRoot, root), {
      recursive: true,
      withFileTypes: true,
    })) {
      if (entry.isFile() && /\.[cm]?[jt]sx?$/.test(entry.name)) {
        found.push(
          relative(webRoot, join(entry.parentPath, entry.name)).replaceAll(
            "\\",
            "/",
          ),
        );
      }
    }
  }
  if (found.length <= 50) {
    throw new Error(`the web source walk found only ${String(found.length)}`);
  }
  return found;
}

export function webCodeOf(sourcePath: string): string {
  return withoutComments(readFileSync(join(webRoot, sourcePath), "utf8"));
}

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
