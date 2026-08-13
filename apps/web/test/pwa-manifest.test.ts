import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it, vi } from "vitest";

// The layout calls the Next font loaders at module scope, which only the
// Next compiler can execute; the mock returns the one field the layout
// reads. Nothing here asserts on fonts.
vi.mock("next/font/google", () => ({
  Fraunces: () => ({ variable: "--font-fraunces" }),
  Instrument_Sans: () => ({ variable: "--font-instrument-sans" }),
}));

import manifest from "../app/manifest";
import { metadata, viewport } from "../app/layout";
import { locale, messages } from "../src/i18n";

// The PWA surface (#19, plan 027 §10): the manifest is a typed metadata
// route, so it is unit-tested by importing the default export — no HTTP
// needed — and the icons are committed binaries whose dimensions are read
// straight from the PNG bytes, so no image dependency enters the tests.

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const tokensCss = readFileSync(
  join(webRoot, "../../packages/ui/tokens.css"),
  "utf8",
);

/** Width and height from the IHDR chunk — bytes 16–23 of any valid PNG. */
function pngDimensions(path: string): { width: number; height: number } {
  const bytes = readFileSync(path);
  // The 8-byte signature, then IHDR's length+type (8 bytes), then width
  // and height as big-endian u32s.
  expect(bytes.subarray(12, 16).toString("latin1")).toBe("IHDR");
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
}

describe("the web app manifest (T-WEB-S130)", () => {
  const built = manifest();

  it("carries the product strings from the messages module, never a second copy", () => {
    expect(built.name).toBe(messages.brand.wordmark);
    expect(built.short_name).toBe(messages.brand.wordmark);
    expect(built.description).toBe(messages.meta.description);
    expect(built.lang).toBe(locale);
    expect(built.id).toBe("/");
    expect(built.start_url).toBe("/");
    expect(built.scope).toBe("/");
    expect(built.display).toBe("standalone");
  });

  it("ties both color literals back to the tokens file", () => {
    // A webmanifest cannot read a CSS custom property, so the hex is
    // duplicated by necessity — and this is the mechanism that stops the
    // duplicate from drifting: a token change that forgets the manifest is
    // a red test here, not a silently stale install surface.
    expect(built.background_color).toBeDefined();
    expect(built.theme_color).toBeDefined();
    for (const literal of [built.background_color, built.theme_color]) {
      expect(tokensCss).toContain(String(literal));
    }
  });

  it("declares the Chromium installability floor, each icon a real file at its declared size", () => {
    const icons = built.icons ?? [];
    expect(icons.map((icon) => icon.src)).toEqual([
      "/icons/icon-192.png",
      "/icons/icon-512.png",
      "/icons/icon-maskable-512.png",
    ]);
    for (const icon of icons) {
      expect(icon.type).toBe("image/png");
      const sizeMatch = /^(\d+)x(\d+)$/.exec(icon.sizes ?? "");
      expect(sizeMatch, icon.src).not.toBeNull();
      const declared = Number(sizeMatch?.[1]);
      expect(sizeMatch?.[2]).toBe(sizeMatch?.[1]);
      // `src` is rooted at public/ — the file must exist AND be the size
      // the manifest claims, or installability fails at runtime only.
      const onDisk = pngDimensions(
        join(webRoot, "public", ...(icon.src ?? "").split("/")),
      );
      expect(onDisk, icon.src).toEqual({ width: declared, height: declared });
    }
    // Exactly one maskable, inset to the safe zone by the render script.
    expect(
      icons.filter((icon) => icon.purpose === "maskable").map((i) => i.src),
    ).toEqual(["/icons/icon-maskable-512.png"]);
  });

  it("ships the two file-convention icons beside the manifest set", () => {
    // app/icon.svg (favicon) and app/apple-icon.png are auto-linked by
    // Next's file convention — no `icons` metadata config, so their
    // presence on disk IS the wiring.
    expect(readFileSync(join(webRoot, "app", "icon.svg"), "utf8")).toContain(
      "<svg",
    );
    expect(pngDimensions(join(webRoot, "app", "apple-icon.png"))).toEqual({
      width: 180,
      height: 180,
    });
  });
});

describe("the install metadata and the no-service-worker tripwire (T-WEB-S131)", () => {
  it("exports the themeColor viewport, tied to the tokens file", () => {
    // Narrowed through the value, not cast: Next's type admits descriptor
    // arrays, and the layout ships the plain-string form.
    const themeColor = viewport.themeColor;
    expect(typeof themeColor).toBe("string");
    if (typeof themeColor === "string") {
      expect(tokensCss).toContain(themeColor);
    }
  });

  it("declares the apple install surface from the messages module", () => {
    expect(metadata.appleWebApp).toEqual({
      capable: true,
      title: messages.brand.wordmark,
      statusBarStyle: "default",
    });
  });

  it("registers no service worker anywhere in app/ or src/ — the D13 tripwire", () => {
    // #19 ships installability WITHOUT a worker (Chromium dropped the SW
    // install requirement; iOS never had it); the worker first earns its
    // complexity with the streak-at-risk push ticket.
    const sources: { path: string; text: string }[] = [];
    for (const dir of ["app", "src"]) {
      for (const entry of readdirSync(join(webRoot, dir), {
        recursive: true,
        withFileTypes: true,
      })) {
        if (!entry.isFile() || !/\.(ts|tsx|mjs|js|css)$/.test(entry.name)) {
          continue;
        }
        const path = join(entry.parentPath, entry.name);
        sources.push({ path, text: readFileSync(path, "utf8") });
      }
    }
    // Anti-vacuity (the #28 convention): before asserting an absence, prove
    // the walk actually read the files it claims to scan — layout.tsx is in
    // scope and carries a known-present string.
    expect(
      sources.some(
        (source) =>
          source.path.endsWith(join("app", "layout.tsx")) &&
          source.text.includes("metadataBase"),
      ),
    ).toBe(true);
    const offenders = sources
      .filter((source) => source.text.includes("serviceWorker"))
      .map((source) => source.path);
    expect(offenders).toEqual([]);
  });
});
