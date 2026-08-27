import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const ROOTS = [
  new URL("../src", import.meta.url),
  new URL("../../../apps/api/src", import.meta.url),
];

// Brace-matched: a conditional spread inside `.set({...})` closes a brace of
// its own, so the first `})` is not the end of the call.
function balanced(text: string, open: number): string {
  let depth = 0;
  for (let i = open; i < text.length; i += 1) {
    const ch = text[i];
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
    await walk(root.pathname);
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
      ...text.matchAll(/update\s+users\b/g),
    ]);
    expect(builders.length).toBeGreaterThanOrEqual(5);
    expect(raw.length).toBeGreaterThanOrEqual(1);
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

  it("every raw `update users` statement sets updated_at", async () => {
    const offenders: string[] = [];
    for (const { path, text } of await sources()) {
      for (const match of text.matchAll(/update\s+users\b/g)) {
        const statement = text.slice(match.index, match.index + 900);
        if (!statement.includes("updated_at")) {
          offenders.push(`${path} @ ${String(match.index)}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
