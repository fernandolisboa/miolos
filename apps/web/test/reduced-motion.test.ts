import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  cssFiles,
  parseCss,
  stylesheet,
  uncoveredSelectors,
} from "./reduced-motion";
import { webCodeOf, webSources } from "./ts-source";

const JS_MOTION =
  /requestAnimationFrame|\.animate\(|behavior:\s*["']smooth["']|scrollIntoView|framer-motion|from\s+["']motion["']/;

describe("every CSS animation has a reduced-motion stand-down (T-WEB-S410)", () => {
  const sheets = cssFiles();

  it("finds every stylesheet under apps/web and packages/ui", () => {
    expect(sheets.length).toBeGreaterThanOrEqual(20);
  });

  it("every selector that runs a transition or animation is calmed in its own file", () => {
    for (const sheet of sheets) {
      const rules = parseCss(stylesheet(sheet.absolute));
      expect(uncoveredSelectors(rules), sheet.path).toEqual([]);
    }
  });

  it("declares no JS animation API, or the repo would need this test extended", () => {
    for (const source of webSources()) {
      const hit = JS_MOTION.exec(webCodeOf(source));
      expect(hit, `${source}: ${String(hit?.[0])}`).toBeNull();
    }

    const uiFiles = ["src/index.ts", "src/ad-slot-placements.ts"];
    for (const file of uiFiles) {
      const code = stylesheet(
        join(import.meta.dirname, "..", "..", "..", "packages", "ui", file),
      );
      const hit = JS_MOTION.exec(code);
      expect(hit, `packages/ui/${file}: ${String(hit?.[0])}`).toBeNull();
    }
  });
});
