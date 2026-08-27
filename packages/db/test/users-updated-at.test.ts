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
    expect(builders.length).toBeGreaterThanOrEqual(5);
    expect(raw.length).toBeGreaterThanOrEqual(1);

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
      const inserts = [...text.matchAll(/\.insert\(users\)/g)];
      for (const [i, match] of inserts.entries()) {
        const chain = text.slice(
          match.index,
          inserts[i + 1]?.index ?? text.length,
        );
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
        const end = text.slice(match.index).search(/[;`]/);
        const statement = text.slice(
          match.index,
          end < 0 ? text.length : match.index + end,
        );
        // The assignment, not the mention — see ADR-0050.
        if (!/updated_at\s*=/.test(statement)) {
          offenders.push(`${path} @ ${String(match.index)}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
