import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it, vi } from "vitest";

vi.mock("next/font/google", () => ({
  Fraunces: () => ({ variable: "--font-fraunces" }),
  Instrument_Sans: () => ({ variable: "--font-instrument-sans" }),
}));

import manifest from "../app/manifest";
import { metadata, viewport } from "../app/layout";
import { locale, messages } from "../src/i18n";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const tokensCss = readFileSync(
  join(webRoot, "../../packages/ui/tokens.css"),
  "utf8",
);

function pngDimensions(path: string): { width: number; height: number } {
  const bytes = readFileSync(path);

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

      const onDisk = pngDimensions(
        join(webRoot, "public", ...(icon.src ?? "").split("/")),
      );
      expect(onDisk, icon.src).toEqual({ width: declared, height: declared });
    }

    expect(
      icons.filter((icon) => icon.purpose === "maskable").map((i) => i.src),
    ).toEqual(["/icons/icon-maskable-512.png"]);
  });

  it("ships the two file-convention icons beside the manifest set", () => {
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
  it("exports the themeColor viewport as a light/dark pair, both tied to --paper-desk (re-founded: the manifest's static theme_color stays light-only, but the viewport now follows the system)", () => {
    const themeColor = viewport.themeColor;
    expect(Array.isArray(themeColor)).toBe(true);
    const pair = themeColor as { media: string; color: string }[];
    expect(pair).toEqual([
      { media: "(prefers-color-scheme: light)", color: "#F7F2E9" },
      { media: "(prefers-color-scheme: dark)", color: "#16130F" },
    ]);
    for (const { color } of pair) {
      expect(tokensCss).toContain(color);
    }
  });

  it("declares the apple install surface from the messages module", () => {
    expect(metadata.appleWebApp).toEqual({
      capable: true,
      title: messages.brand.wordmark,
      statusBarStyle: "default",
    });
  });

  it("registers a service worker in exactly ONE place — the push card's accept gesture — and never at layout or mount level (the D13 tripwire, re-aimed at #145)", () => {
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
    expect(offenders).toEqual([
      join(webRoot, "src", "play", "push-prompt-card.tsx"),
    ]);
  });
});
