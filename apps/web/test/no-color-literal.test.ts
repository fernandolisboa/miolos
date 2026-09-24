import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { stylesheet } from "./css-source";

const webRoot = path.dirname(fileURLToPath(import.meta.url)) + "/..";

function cssFiles(): string[] {
  const files: string[] = [];
  for (const dir of ["app", "src"]) {
    for (const entry of readdirSync(path.join(webRoot, dir), {
      recursive: true,
      withFileTypes: true,
    })) {
      if (entry.isFile() && entry.name.endsWith(".css")) {
        files.push(
          path
            .relative(webRoot, path.join(entry.parentPath, entry.name))
            .split(path.sep)
            .join("/"),
        );
      }
    }
  }
  return files;
}

describe("only tokens.css may hold a colour literal (T-WEB-S392)", () => {
  it("finds no hex, rgb() or hsl() literal outside tokens.css, in any .module.css or globals.css", () => {
    const literal = /#[0-9a-fA-F]{3,8}\b|\b(?:rgb|rgba|hsl|hsla)\(/;
    const offenders: string[] = [];
    for (const file of cssFiles()) {
      const css = stylesheet(file);
      for (const [lineIndex, line] of css.split("\n").entries()) {
        if (literal.test(line)) {
          offenders.push(`${file}:${lineIndex + 1} ${line.trim()}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("keeps the scan non-vacuous", () => {
    expect(cssFiles().length).toBeGreaterThan(0);
  });
});
