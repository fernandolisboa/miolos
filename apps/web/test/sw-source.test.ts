import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const swSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "..", "public", "sw.js"),
  "utf8",
);

function code(source: string): string {
  return source
    .replaceAll(/\/\*[\s\S]*?\*\//g, "")
    .replaceAll(/(^|[^:])\/\/.*$/gm, "$1");
}

const sw = code(swSource);

describe("the service worker is caching-free (T-WEB-S261)", () => {
  it("carries no request-interception or storage token, and exactly the two handlers", () => {
    expect(sw).not.toContain("fetch");
    expect(sw).not.toContain("caches");

    const listeners = [...sw.matchAll(/addEventListener\(\s*"([^"]+)"/g)].map(
      (match) => match[1] ?? "",
    );
    expect(listeners.sort()).toEqual(["notificationclick", "push"]);

    expect(sw).not.toMatch(/self\.on[a-z]+\s*=/);

    expect(sw).toContain("self.registration.showNotification");
    expect(swSource).toContain("Sua sequência está em risco");
  });
});

describe("notificationclick deep-links to the hub (T-WEB-S262)", () => {
  it("closes the notification, focuses an existing window or opens '/'", () => {
    expect(sw).toContain("notification.close()");

    expect(sw).toContain("matchAll");
    expect(sw).toMatch(/openWindow\("\/"\)/);

    const paths = [...sw.matchAll(/openWindow\("([^"]*)"\)/g)].map(
      (match) => match[1] ?? "",
    );
    expect(paths).toEqual(["/"]);
  });
});
