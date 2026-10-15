import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { messages } from "../src/i18n";
import tip from "../src/play/info-tip.module.css";
import {
  PlayScreenChrome,
  type PlayChromeState,
} from "../src/play/screen-chrome";
import shared from "../src/play/screen.module.css";
import { bodyOf, decl, stylesheet } from "./css-source";

const SHARED_CSS = stylesheet("src/play/screen.module.css");
const ONE_COLUMN = bodyOf(SHARED_CSS, "@media (max-width: 1023px)");
const PHONE = bodyOf(SHARED_CSS, "@media (max-width: 768px)");
const RESET_CSS = stylesheet("src/play/reset-control.module.css");
const RULES = messages.games.sudoku.play.rules;

function playing(used: number, ready = used < 3): PlayChromeState {
  return {
    kind: "playing",
    readouts: {
      progressShort: "1",
      progressLong: "1 de 81",
      hint: { ready, used, explain: null, cell: null, onReveal: () => {} },
      onReset: null,
    },
  };
}

function chrome(state: PlayChromeState) {
  return (
    <PlayScreenChrome
      game="sudoku"
      pageModifier=""
      state={state}
      back={{ href: "/", label: "Hoje", ariaLabel: "Voltar" }}
      topDate="15 de outubro"
      note={null}
      clock="none"
      extraStat={null}
    >
      <div />
    </PlayScreenChrome>
  );
}

function staticPage(state: PlayChromeState): HTMLElement {
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(chrome(state));
  return host;
}

function face(hint: Element | null) {
  return {
    name: hint?.getAttribute("aria-label"),
    long: hint?.querySelector(`.${shared.hintLong}`)?.textContent,
    short: hint?.getAttribute("data-short"),
    left: hint?.getAttribute("data-left"),
  };
}

describe("the rules open from an (i) beside the title (T-WEB-S910)", () => {
  it("is a named button that toggles the rules paragraph as a popover", () => {
    render(chrome(playing(0)));
    const toggle = screen.getByRole("button", {
      name: messages.play.rulesAria,
    });
    const rules = screen.getByText(RULES);

    expect(toggle.getAttribute("popovertarget")).toBe(rules.id);
    expect(rules.getAttribute("popover")).toBe("auto");
    expect(rules.tagName).toBe("P");
  });

  it("sits right after the title, and the skeleton draws the same ring with no control", () => {
    const live = staticPage(playing(0));
    const skeleton = staticPage({ kind: "skeleton" });
    const ring = (page: HTMLElement) =>
      page.querySelector(`.${shared.titleRow} > .${shared.rulesToggle}`);

    expect(ring(live)?.previousElementSibling?.tagName).toBe("H1");
    expect(ring(live)?.querySelector("button")?.className).toBe(tip.button);
    expect(ring(skeleton)?.querySelector("button")).toBeNull();
    expect(ring(skeleton)?.firstElementChild?.className).toBe(tip.button);
    expect(skeleton.textContent).toContain(RULES);
  });
});

describe("in two columns the rules read inline; in one they open as a card (T-WEB-S911)", () => {
  it("undoes the popover box in two columns and hides the ring there", () => {
    const rules = bodyOf(SHARED_CSS, ".rules");

    expect(decl(rules, "display")).toBe("block");
    expect(decl(rules, "position")).toBe("static");
    expect(decl(bodyOf(SHARED_CSS, ".rulesToggle"), "display")).toBe("none");
  });

  it("hides the paragraph in one column and opens it as a fixed card", () => {
    expect(decl(bodyOf(ONE_COLUMN, ".rules"), "display")).toBe("none");
    expect(decl(bodyOf(ONE_COLUMN, ".rulesToggle"), "display")).toBe(
      "inline-flex",
    );
    expect(decl(bodyOf(ONE_COLUMN, ".rules:popover-open"), "display")).toBe(
      "block",
    );
  });

  it("keeps the open card's box at every width, so one left open across the fold never covers the page", () => {
    const open = bodyOf(SHARED_CSS, ".rules:popover-open");

    expect(SHARED_CSS.indexOf(".rules:popover-open")).toBeLessThan(
      SHARED_CSS.indexOf("@media (max-width: 1023px)"),
    );
    expect(decl(open, "position")).toBe("fixed");
    expect(decl(open, "inset")).toBe("var(--space-3) var(--space-3) auto");
    expect(decl(open, "background")).toBe("var(--paper-card)");
    expect(decl(bodyOf(ONE_COLUMN, ".rules:popover-open"), "position")).toBe(
      undefined,
    );
  });

  it("falls back to the inline paragraph where popovers do not exist", () => {
    const fallback = bodyOf(
      ONE_COLUMN,
      "@supports not selector(:popover-open)",
    );

    expect(decl(bodyOf(fallback, ".rules"), "display")).toBe("block");
    expect(decl(bodyOf(fallback, ".rulesToggle"), "display")).toBe("none");
  });
});

describe("the hint keeps its full name and shows a short face in one column (T-WEB-S912)", () => {
  it("names the button with the full label and carries the short face as data", () => {
    expect(
      face(staticPage(playing(1)).querySelector(`.${shared.hint}`)),
    ).toEqual({
      name: messages.play.hint.available(2),
      long: messages.play.hint.available(2),
      short: messages.play.hint.short,
      left: "2",
    });
  });

  it("reads spent with a zero badge, the short word still inside the name", () => {
    const spent = face(staticPage(playing(3)).querySelector(`.${shared.hint}`));

    expect(spent.name).toBe(messages.play.hint.used);
    expect(spent.left).toBe("0");
    expect(messages.play.hint.used.toLowerCase()).toContain(
      messages.play.hint.short.toLowerCase(),
    );
  });

  it("draws the same short face in the skeleton, so the pill keeps its width", () => {
    const skeleton = face(
      staticPage({ kind: "skeleton" }).querySelector(`.${shared.hint}`),
    );

    expect(skeleton.short).toBe(messages.play.hint.short);
    expect(skeleton.left).not.toBeNull();
    expect(skeleton.long).not.toBeUndefined();
  });

  it("swaps the faces at the one-column fold", () => {
    expect(decl(bodyOf(ONE_COLUMN, ".hintLong"), "display")).toBe("none");
    expect(decl(bodyOf(ONE_COLUMN, ".hint::before"), "content")).toBe(
      "attr(data-short)",
    );
    expect(decl(bodyOf(ONE_COLUMN, ".hint::after"), "content")).toBe(
      "attr(data-left)",
    );
  });

  it("rings the count instead of filling it, so the digit keeps the pill's measured ink", () => {
    const badge = bodyOf(ONE_COLUMN, ".hint::after");

    expect(decl(badge, "background")).toBeUndefined();
    expect(decl(badge, "box-shadow")).toBe("inset 0 0 0 1.5px currentColor");
  });
});

describe("in one column Recomeçar, Ajustes and the hint share one row (T-WEB-S913)", () => {
  it("puts the hint at the row's end at its own width, the reset box spanning both tracks", () => {
    const areas = decl(bodyOf(ONE_COLUMN, ".page"), "grid-template-areas");

    expect(areas?.trim().endsWith('"reset hint"')).toBe(true);
    expect(decl(bodyOf(ONE_COLUMN, ".reset"), "grid-column")).toBe("1 / -1");
    expect(decl(bodyOf(ONE_COLUMN, ".hint"), "width")).toBe("auto");
  });

  it("positions the hint, so it paints and takes taps above the reset box it overlaps", () => {
    expect(decl(bodyOf(SHARED_CSS, ".reset"), "position")).toBe("relative");
    expect(decl(bodyOf(ONE_COLUMN, ".hint"), "position")).toBe("relative");
  });

  it("opens the confirm upward as a card, so it never runs off the page", () => {
    const ask = bodyOf(bodyOf(RESET_CSS, "@media (max-width: 1023px)"), ".ask");

    expect(decl(ask, "inset")).toBe("auto 0 0");
    expect(decl(ask, "background")).toBe("var(--paper-card)");
  });
});

describe("a phone page keeps a 16px side margin (T-WEB-S914)", () => {
  it("pads the page by --space-4 on both sides", () => {
    expect(decl(bodyOf(PHONE, ".page"), "padding")).toBe(
      "var(--space-3) var(--space-4) var(--space-5)",
    );
  });
});
