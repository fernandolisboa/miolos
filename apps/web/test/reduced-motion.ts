import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const webRoot = join(import.meta.dirname, "..");
const repoRoot = join(webRoot, "..", "..");

export interface Rule {
  selectors: readonly string[];
  decls: Readonly<Record<string, string>>;
  reduced: boolean;
}

const DURATION_KEYS = [
  "transition-duration",
  "transition-delay",
  "animation-duration",
  "animation-delay",
] as const;
const NAME_KEYS = [
  "transition",
  "transition-property",
  "animation",
  "animation-name",
] as const;

export function cssFiles(): readonly { path: string; absolute: string }[] {
  const found: { path: string; absolute: string }[] = [];
  for (const base of [
    join(webRoot, "app"),
    join(webRoot, "src"),
    join(repoRoot, "packages", "ui"),
  ]) {
    for (const entry of readdirSync(base, {
      recursive: true,
      withFileTypes: true,
    })) {
      if (entry.isFile() && entry.name.endsWith(".css")) {
        const absolute = join(entry.parentPath, entry.name);
        found.push({
          path: relative(repoRoot, absolute).replaceAll("\\", "/"),
          absolute,
        });
      }
    }
  }
  return found;
}

export function parseCss(source: string): Rule[] {
  const css = source.replace(/\/\*[\s\S]*?\*\//g, "");
  const out: Rule[] = [];
  walk(css, false);
  return out;

  function walk(text: string, reduced: boolean): void {
    let i = 0;
    while (i < text.length) {
      while (i < text.length && /\s/.test(text[i] ?? "")) i += 1;
      if (i >= text.length) break;
      const open = text.indexOf("{", i);
      if (open === -1) break;
      const prelude = text.slice(i, open).trim();
      let depth = 1;
      let j = open + 1;
      while (j < text.length && depth > 0) {
        if (text[j] === "{") depth += 1;
        else if (text[j] === "}") depth -= 1;
        j += 1;
      }
      const body = text.slice(open + 1, j - 1);
      if (prelude.startsWith("@")) {
        const isReduce = /prefers-reduced-motion\s*:\s*reduce/.test(prelude);
        walk(body, reduced || isReduce);
      } else if (prelude !== "") {
        out.push({
          selectors: prelude.split(",").map(normalizeSelector),
          decls: parseDecls(body),
          reduced,
        });
      }
      i = j;
    }
  }
}

function normalizeSelector(selector: string): string {
  return selector.replace(/\s+/g, " ").trim();
}

function parseDecls(body: string): Record<string, string> {
  const decls: Record<string, string> = {};
  for (const part of body.split(";")) {
    const colon = part.indexOf(":");
    if (colon === -1) continue;
    const property = part.slice(0, colon).trim();
    const value = part.slice(colon + 1).trim();
    if (property !== "") decls[property] = value;
  }
  return decls;
}

function isZero(value: string): boolean {
  return value
    .split(",")
    .every(
      (token) => Number(/^(-?[\d.]+)(m?s)?$/.exec(token.trim())?.[1]) === 0,
    );
}

function familyOf(key: string): "transition" | "animation" {
  return key.startsWith("animation") ? "animation" : "transition";
}

/**
 * A key "runs" when its value is neither `none` (the name-family
 * shorthand/longhand) nor an all-zero duration/delay.
 */
function runs(key: string, value: string): boolean {
  if ((NAME_KEYS as readonly string[]).includes(key)) {
    return value.trim() !== "none";
  }
  if ((DURATION_KEYS as readonly string[]).includes(key)) {
    return !isZero(value);
  }
  return false;
}

export function hotFamilies(
  decls: Rule["decls"],
): Set<"transition" | "animation"> {
  const families = new Set<"transition" | "animation">();
  for (const [key, value] of Object.entries(decls)) {
    if (
      ((NAME_KEYS as readonly string[]).includes(key) ||
        (DURATION_KEYS as readonly string[]).includes(key)) &&
      runs(key, value)
    ) {
      families.add(familyOf(key));
    }
  }
  return families;
}

function familyStoodDown(
  decls: Rule["decls"],
  family: "transition" | "animation",
  hotKeys: readonly string[],
): boolean {
  if (decls[family]?.trim() === "none") return true;
  return hotKeys
    .filter((key) => familyOf(key) === family)
    .every((key) => {
      const value = decls[key];
      return value !== undefined && !runs(key, value);
    });
}

export function uncoveredSelectors(rules: readonly Rule[]): readonly string[] {
  const reduceBySelector = new Map<string, Rule["decls"][]>();
  for (const rule of rules.filter((rule) => rule.reduced)) {
    for (const selector of rule.selectors) {
      const list = reduceBySelector.get(selector) ?? [];
      list.push(rule.decls);
      reduceBySelector.set(selector, list);
    }
  }

  const violations: string[] = [];
  for (const rule of rules.filter((rule) => !rule.reduced)) {
    const families = hotFamilies(rule.decls);
    if (families.size === 0) continue;
    const hotKeys = Object.keys(rule.decls).filter((key) =>
      runs(key, rule.decls[key] ?? ""),
    );
    for (const selector of rule.selectors) {
      const candidates = reduceBySelector.get(selector) ?? [];
      for (const family of families) {
        const covered = candidates.some((decls) =>
          familyStoodDown(decls, family, hotKeys),
        );
        if (!covered) {
          violations.push(`${selector} (${family})`);
        }
      }
    }
  }
  return violations;
}

export function stylesheet(absolutePath: string): string {
  return readFileSync(absolutePath, "utf8");
}
