import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

export function stylesheet(relativePath: string): string {
  return stripComments(
    readFileSync(path.join(here, "..", relativePath), "utf8"),
  );
}

export function bodyOf(css: string, prelude: string): string {
  const opener = new RegExp(`^[ \\t]*${escape(prelude)}[ \\t]*\\{`, "m");
  const match = opener.exec(css);
  if (match === null) {
    throw new Error(`no block for \`${prelude}\``);
  }
  const open = match.index + match[0].length - 1;
  let depth = 0;
  for (let index = open; index < css.length; index += 1) {
    if (css[index] === "{") {
      depth += 1;
    } else if (css[index] === "}") {
      depth -= 1;
      if (depth === 0) {
        return css.slice(open + 1, index);
      }
    }
  }
  throw new Error(`unterminated block for \`${prelude}\``);
}

export function decl(body: string, property: string): string | undefined {
  const match = new RegExp(
    `(?:^|;)\\s*${escape(property)}\\s*:\\s*([^;}]+)`,
    "m",
  ).exec(body);
  const value = match?.[1];
  return value === undefined ? undefined : value.trim();
}

export function pixels(value: string | undefined): number {
  const match = /^(-?[\d.]+)px$/.exec(value?.trim() ?? "");
  if (match === null) {
    throw new Error(`\`${String(value)}\` is not a px length`);
  }
  return Number(match[1]);
}

export function token(name: string): number {
  const tokens = readFileSync(
    path.join(here, "..", "..", "..", "packages", "ui", "tokens.css"),
    "utf8",
  );
  const match = new RegExp(`${escape(name)}\\s*:\\s*([^;]+)`).exec(tokens);
  return pixels(match?.[1]);
}

export function colorTokens(
  theme: "light" | "dark",
): ReadonlyMap<string, string> {
  const css = stylesheet("../../packages/ui/tokens.css");
  const body =
    theme === "light"
      ? bodyOf(css, ":root")
      : bodyOf(css, ':root[data-theme="dark"]');
  const map = new Map<string, string>();
  for (const match of body.matchAll(
    /(--[\w-]+)\s*:\s*(#[0-9A-Fa-f]{6})\s*;/g,
  )) {
    const name = match[1];
    const hex = match[2];
    if (name !== undefined && hex !== undefined) {
      map.set(name, hex.toUpperCase());
    }
  }
  if (map.size === 0) {
    throw new Error(`no colour tokens resolved for the ${theme} block`);
  }
  return map;
}

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

function escape(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
