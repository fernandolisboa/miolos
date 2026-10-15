import { PICTURE_TONES } from "@miolos/games/nonogram-colors";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { JustEnded } from "../src/play/just-ended";
import { PictureArt } from "../src/play/picture-art";
import styles from "../src/play/picture-art.module.css";
import type { ConclusionPicture } from "../src/play/types";
import { readSettings, writeSettings } from "../src/settings/settings";
import { contrast } from "./contrast";
import { bodyOf, colorTokens, decl, stylesheet } from "./css-source";

const PICTURE: ConclusionPicture = {
  size: 3,
  // prettier-ignore
  cells: [
    0, 1, 0,
    1, 1, 1,
    0, 1, 0,
  ],
  label: "figura",
};

const TONES = ".r.gyg.n.";

function figure(): SVGElement {
  return screen.getByRole("img", { name: "figura" }) as unknown as SVGElement;
}

function subpaths(path: Element | null | undefined): string[] {
  return path?.getAttribute("d")?.match(/M\d+ \d+h1v1h-1z/g) ?? [];
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  window.localStorage.clear();
});

describe("the picture paints its tones over the ink silhouette (T-WEB-S900)", () => {
  it("draws one path per tone, each holding exactly its cells, plus the outline", () => {
    render(<PictureArt picture={{ ...PICTURE, tones: TONES }} className="x" />);

    const toned = figure().querySelector("[data-toned]");
    expect(toned).not.toBeNull();
    const fills = [...(toned?.querySelectorAll("path[style]") ?? [])];
    expect(
      fills.map((path) => (path as SVGPathElement).style.fill).sort(),
    ).toEqual([
      "var(--tone-g)",
      "var(--tone-n)",
      "var(--tone-r)",
      "var(--tone-y)",
    ]);
    const green = fills.find(
      (path) => (path as SVGPathElement).style.fill === "var(--tone-g)",
    );
    expect(subpaths(green)).toEqual(["M0 1h1v1h-1z", "M2 1h1v1h-1z"]);

    const outline = toned?.querySelector(`.${String(styles.outline)}`);
    expect(outline?.getAttribute("d")).toContain("M1 0h1");
    expect(outline?.getAttribute("d")).not.toContain("M1 1h1");

    expect(subpaths(figure().querySelector(":scope > path"))).toHaveLength(5);
  });

  it("keeps the one-color picture when there are no tones, or tones that do not fit it", () => {
    for (const tones of [undefined, "", ".r.gyg.n", "rr.gyg.n.", ".r.gyg.nn"]) {
      const { unmount } = render(
        <PictureArt picture={{ ...PICTURE, tones }} className="x" />,
      );
      expect(figure().querySelector("[data-toned]"), String(tones)).toBeNull();
      expect(figure().querySelectorAll("path"), String(tones)).toHaveLength(1);
      unmount();
    }
  });
});

describe("the tones wipe in only on a game that just ended, with the animation on (T-WEB-S901)", () => {
  function wiping(): boolean {
    return (
      figure()
        .querySelector("[data-toned]")
        ?.classList.contains(String(styles.wipe)) ?? false
    );
  }

  it("wipes under JustEnded with the setting on, and paints still otherwise", () => {
    const toned = { ...PICTURE, tones: TONES };
    const { unmount } = render(
      <JustEnded value>
        <PictureArt picture={toned} className="x" />
      </JustEnded>,
    );
    expect(wiping()).toBe(true);
    unmount();

    const revisit = render(<PictureArt picture={toned} className="x" />);
    expect(wiping()).toBe(false);
    revisit.unmount();

    writeSettings({ ...readSettings(), endAnimation: false });
    render(
      <JustEnded value>
        <PictureArt picture={toned} className="x" />
      </JustEnded>,
    );
    expect(wiping()).toBe(false);
  });

  it("stands the wipe down under reduced motion", () => {
    const css = stylesheet("src/play/picture-art.module.css");
    const reduced = bodyOf(css, "@media (prefers-reduced-motion: reduce)");
    expect(decl(bodyOf(reduced, ".wipe"), "animation")).toBe("none");
  });
});

describe("every tone has a token in both themes, and the outline carries the shape (T-WEB-S902)", () => {
  it("defines --tone-<letter> for the whole palette in light and dark", () => {
    for (const theme of ["light", "dark"] as const) {
      const tokens = colorTokens(theme);
      for (const tone of PICTURE_TONES) {
        expect(tokens.has(`--tone-${tone}`), `${theme} ${tone}`).toBe(true);
      }
    }
    const css = stylesheet("../../packages/ui/tokens.css");
    const auto = bodyOf(css, "@media (prefers-color-scheme: dark)");
    for (const tone of PICTURE_TONES) {
      expect(auto, tone).toContain(`--tone-${tone}:`);
    }
  });

  it("outlines in --ink, which clears 3:1 on the card paper in both themes", () => {
    const css = stylesheet("src/play/picture-art.module.css");
    expect(decl(bodyOf(css, ".outline"), "stroke")).toBe("var(--ink)");
    for (const theme of ["light", "dark"] as const) {
      const tokens = colorTokens(theme);
      expect(
        contrast(tokens.get("--ink") ?? "", tokens.get("--paper-card") ?? ""),
        theme,
      ).toBeGreaterThanOrEqual(3);
    }
  });
});
