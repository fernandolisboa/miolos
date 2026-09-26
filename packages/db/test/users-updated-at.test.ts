import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const ROOTS = [
  new URL("../src", import.meta.url),
  new URL("../../../apps/api/src", import.meta.url),
];

function balanced(text: string, open: number): string {
  let depth = 0;
  let quote: string | undefined;
  for (let i = open; i < text.length; i += 1) {
    const ch = text[i];
    if (quote !== undefined) {
      if (ch === "\\") i += 1;
      else if (ch === quote) quote = undefined;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      continue;
    }
    if (ch === "(" || ch === "{") depth += 1;
    if (ch === ")" || ch === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(open, i + 1);
    }
  }
  return text.slice(open);
}

// The chain, not a fixed window: a truncated scan reports no offender, and a
// scan running to EOF grades the next statement's conflict clause as this one's.
function statement(text: string, start: number): string {
  let depth = 0;
  let quote: string | undefined;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (quote !== undefined) {
      if (ch === "\\") i += 1;
      else if (ch === quote) quote = undefined;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      continue;
    }
    if (ch === "(" || ch === "{" || ch === "[") depth += 1;
    if (ch === ")" || ch === "}" || ch === "]") depth -= 1;
    if (ch === ";" && depth <= 0) return text.slice(start, i);
  }
  return text.slice(start);
}

async function sources(): Promise<{ path: string; text: string }[]> {
  const found: { path: string; text: string }[] = [];
  const walk = async (dir: string): Promise<void> => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(path);
      } else if (entry.name.endsWith(".ts")) {
        found.push({ path, text: await readFile(path, "utf8") });
      }
    }
  };
  for (const root of ROOTS) {
    await walk(fileURLToPath(root));
  }
  return found;
}

describe("every writer of a users row sets updated_at (ADR-0050)", () => {
  it("finds the writers at all, so the scan cannot pass by finding none", async () => {
    const files = await sources();
    expect(files.length).toBeGreaterThan(20);
    const builders = files.flatMap(({ text }) => [
      ...text.matchAll(/\.update\(users\)/g),
    ]);
    const raw = files.flatMap(({ text }) => [
      ...text.matchAll(/update\s+users\b/gi),
    ]);
    expect(builders.length).toBeGreaterThanOrEqual(4);
    expect(raw.length).toBeGreaterThanOrEqual(5);

    const setSites = files.flatMap(({ text }) => [
      ...text.matchAll(/\.update\(users\)\s*\.set\(/g),
    ]);
    expect(setSites.length).toBe(builders.length);
  });

  it("every `.update(users)` sets updatedAt in the same call", async () => {
    const offenders: string[] = [];
    for (const { path, text } of await sources()) {
      for (const match of text.matchAll(/\.update\(users\)\s*\.set\(/g)) {
        const body = balanced(text, match.index + match[0].length - 1);
        if (!body.includes("updatedAt")) {
          offenders.push(`${path} @ ${String(match.index)}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("an upsert onto users sets updatedAt in its DO UPDATE branch", async () => {
    const offenders: string[] = [];
    for (const { path, text } of await sources()) {
      for (const match of text.matchAll(/\.insert\(users\)/g)) {
        const chain = statement(text, match.index);
        const conflict = chain.indexOf("onConflictDoUpdate");
        if (conflict < 0) {
          continue;
        }
        const body = balanced(chain, chain.indexOf("(", conflict));
        if (!body.includes("updatedAt")) {
          offenders.push(`${path} @ ${String(match.index)}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("every raw `update users` statement sets updated_at", async () => {
    const offenders: string[] = [];
    for (const { path, text } of await sources()) {
      for (const match of text.matchAll(/update\s+users\b/gi)) {
        // The assignment, not the mention — see ADR-0050.
        if (!/updated_at\s*=/.test(statement(text, match.index))) {
          offenders.push(`${path} @ ${String(match.index)}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
