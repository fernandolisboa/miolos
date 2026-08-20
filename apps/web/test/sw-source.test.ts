import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

// The caching-free service worker's source shape (#145, ADR-0064; ADR-0004
// discharged by construction — plan 061 §2). These are SOURCE scans: the
// worker runs in no jsdom, so what is pinned is that the file cannot do
// the one thing ADR-0004 forbids, in the only way a static test can pin a
// capability — the tokens that reach it are absent.

const swSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "..", "public", "sw.js"),
  "utf8",
);

/**
 * Comment stripper, the `code()` helper (`eslint-db-wall.test.ts`'s, by
 * symbol — the T-LINT-S37 precedent): this repo's doc blocks quote the
 * very tokens the scans forbid, so every assertion below runs over
 * comment-free source. The URL-scheme guard keeps `https://…` intact.
 */
function code(source: string): string {
  return source
    .replaceAll(/\/\*[\s\S]*?\*\//g, "")
    .replaceAll(/(^|[^:])\/\/.*$/gm, "$1");
}

const sw = code(swSource);

describe("the service worker is caching-free (T-WEB-S261)", () => {
  it("carries no request-interception or storage token, and exactly the two handlers", () => {
    // ADR-0004 by construction: a worker that never intercepts requests
    // and never stores responses cannot hold a future-dated payload. The
    // two tokens are the ONLY doors to either capability in a service
    // worker, and neither may appear even incidentally — the sw makes no
    // network call of its own and names no cache.
    expect(sw).not.toContain("fetch");
    expect(sw).not.toContain("caches");

    // Exactly two listeners, and exactly these: `push` and
    // `notificationclick`. A third addEventListener of any kind is a new
    // capability this ADR-discharge test must see arrive.
    const listeners = [...sw.matchAll(/addEventListener\(\s*"([^"]+)"/g)].map(
      // `?? ""` is the checker's price under noUncheckedIndexedAccess,
      // not a real branch — the group is unconditional in the pattern.
      (match) => match[1] ?? "",
    );
    expect(listeners.sort()).toEqual(["notificationclick", "push"]);
    // …and the OTHER registration form is closed too (#145 step-6
    // security 7): a handler-property assignment (`self.onmessage = …`,
    // `self.onsync = …`) would add a capability without adding an
    // addEventListener match, so the "exactly two, no third" claim needs
    // both doors pinned.
    expect(sw).not.toMatch(/self\.on[a-z]+\s*=/);

    // The push handler notifies through the registration — the one thing
    // the worker exists to do — with the pt-BR fallbacks baked in (the
    // recorded i18n exception: a plain unbundled worker cannot import
    // messages.ts, and T-WEB-S270 scans messages.push.* only).
    expect(sw).toContain("self.registration.showNotification");
    expect(swSource).toContain("Sua sequência está em risco");
  });
});

describe("notificationclick deep-links to the hub (T-WEB-S262)", () => {
  it("closes the notification, focuses an existing window or opens '/'", () => {
    expect(sw).toContain("notification.close()");
    // Focus-or-open: an existing window is focused; failing that, one is
    // opened at the hub — the deep link is "/" and nothing else (no
    // per-game route rides a notification in slice A).
    expect(sw).toContain("matchAll");
    expect(sw).toMatch(/openWindow\("\/"\)/);
    // No other navigation target: every string literal that looks like a
    // path is exactly "/".
    const paths = [...sw.matchAll(/openWindow\("([^"]*)"\)/g)].map(
      (match) => match[1] ?? "",
    );
    expect(paths).toEqual(["/"]);
  });
});
