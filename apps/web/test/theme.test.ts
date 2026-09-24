import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/font/google", () => ({
  Fraunces: () => ({ variable: "--font-fraunces" }),
  Instrument_Sans: () => ({ variable: "--font-instrument-sans" }),
}));

import RootLayout from "../app/layout";
import {
  applyThemeChoice,
  readThemeChoice,
  THEME_CHOICES,
  themeScript,
} from "../src/theme/theme";

interface ElementLike {
  type: string;
  props: { [key: string]: unknown; children?: unknown };
}

function runThemeScript(): void {
  eval(themeScript);
}

beforeEach(() => {
  window.localStorage.clear();
  delete document.documentElement.dataset.theme;
});

afterEach(() => {
  window.localStorage.clear();
  delete document.documentElement.dataset.theme;
  vi.restoreAllMocks();
});

describe("the pre-hydration theme script (T-WEB-S393)", () => {
  it("applies a valid stored value to document.documentElement.dataset.theme", () => {
    for (const value of ["light", "dark"] as const) {
      window.localStorage.setItem("miolos-theme", value);
      delete document.documentElement.dataset.theme;
      runThemeScript();
      expect(document.documentElement.dataset.theme).toBe(value);
    }
  });

  it("leaves no attribute for a missing key or garbage value", () => {
    for (const stored of [null, "system", "sepia", ""]) {
      if (stored === null) {
        window.localStorage.removeItem("miolos-theme");
      } else {
        window.localStorage.setItem("miolos-theme", stored);
      }
      delete document.documentElement.dataset.theme;
      runThemeScript();
      expect(document.documentElement.dataset.theme).toBeUndefined();
    }
  });

  it("leaves no attribute when storage throws", () => {
    vi.spyOn(window.localStorage.__proto__, "getItem").mockImplementation(
      () => {
        throw new Error("blocked");
      },
    );
    expect(() => runThemeScript()).not.toThrow();
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });

  it("ships as the root layout's one <head> script, on an <html> that suppresses the hydration warning it causes", () => {
    const html = RootLayout({ children: null }) as unknown as ElementLike;
    expect(html.props.suppressHydrationWarning).toBe(true);

    const [head] = html.props.children as ElementLike[];
    if (head === undefined) {
      throw new Error("root layout has no <head> element");
    }
    expect(head.type).toBe("head");
    const script = (head.props.children as ElementLike).props as {
      dangerouslySetInnerHTML: { __html: string };
    };
    expect(script.dangerouslySetInnerHTML.__html).toBe(themeScript);
  });
});

describe("readThemeChoice and applyThemeChoice (T-WEB-S394)", () => {
  it("defaults to system when nothing is stored", () => {
    expect(readThemeChoice()).toBe("system");
  });

  it("round-trips light and dark through storage and the DOM attribute", () => {
    for (const choice of ["light", "dark"] as const) {
      applyThemeChoice(choice);
      expect(window.localStorage.getItem("miolos-theme")).toBe(choice);
      expect(document.documentElement.dataset.theme).toBe(choice);
      expect(readThemeChoice()).toBe(choice);
    }
  });

  it("clears both the key and the attribute for system", () => {
    applyThemeChoice("dark");
    applyThemeChoice("system");
    expect(window.localStorage.getItem("miolos-theme")).toBeNull();
    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(readThemeChoice()).toBe("system");
  });

  it("falls back to system for a garbage stored value", () => {
    window.localStorage.setItem("miolos-theme", "sepia");
    expect(readThemeChoice()).toBe("system");
  });

  it("does not throw when storage throws", () => {
    vi.spyOn(window.localStorage.__proto__, "setItem").mockImplementation(
      () => {
        throw new Error("blocked");
      },
    );
    expect(() => applyThemeChoice("dark")).not.toThrow();
  });

  it("keeps the choice set non-vacuous", () => {
    expect(THEME_CHOICES).toEqual(["system", "light", "dark"]);
  });
});
