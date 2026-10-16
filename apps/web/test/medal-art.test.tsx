import {
  MEDAL_DEFINITIONS,
  MEDAL_IDS,
  ORIGINAL_GAMES,
  type MedalsResponse,
} from "@miolos/core";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { artOf } from "../src/medals/art";
import { medalCopy } from "../src/medals/copy";
import { MedalsSection, tipShift } from "../src/medals/medals-section";
import styles from "../src/medals/medals-section.module.css";
import { ACCENTS } from "../src/play/accent";
import { bodyOf, decl, stylesheet } from "./css-source";

const medalsClient = vi.hoisted(() => ({ fetchMedals: vi.fn() }));
vi.mock("../src/medals/medals-client", () => medalsClient);

afterEach(() => {
  vi.restoreAllMocks();
});

async function renderEarned(medals: MedalsResponse["medals"]) {
  medalsClient.fetchMedals.mockResolvedValue({ medals });
  const view = render(<MedalsSection />);
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  return view;
}

describe("every catalog medal is drawn from its rule (T-WEB-S780)", () => {
  it("renders one medal with a mark for every catalog id", async () => {
    const { container } = await renderEarned([...MEDAL_IDS]);

    const items = container.querySelectorAll(`.${styles.medal}`);
    expect(items).toHaveLength(MEDAL_IDS.length);
    for (const item of items) {
      expect(
        item.querySelector(`svg text, svg rect, .${styles.star}`),
      ).not.toBeNull();
    }
  });

  it("takes the numeral, ribbon and stripes from the rule", () => {
    for (const { rule } of MEDAL_DEFINITIONS) {
      const art = artOf(rule);
      switch (rule.kind) {
        case "totalWins":
          expect(art.mark).toEqual({
            kind: "numeral",
            text: String(rule.count),
          });
          expect(art.ribbon).toBe(
            rule.game === null ? "var(--accent-app)" : ACCENTS[rule.game],
          );
          break;
        case "streakReached":
          expect(art.mark).toEqual({
            kind: "numeral",
            text: String(rule.days),
          });
          expect(art.stripes).toHaveLength(1);
          break;
        case "perfectDaysReached":
          expect(art.mark).toEqual({
            kind: "numeral",
            text: String(rule.count),
          });
          expect(art.stripes).toHaveLength(2);
          break;
        case "fullDaysReached":
          expect(art.mark).toEqual({
            kind: "numeral",
            text: String(rule.count),
          });
          expect(art.ribbon).toBe("var(--accent-app)");
          break;
        case "termoGuessWins":
          expect(art.mark).toEqual({
            kind: "numeral",
            text: `${String(rule.guesses)}ª`,
          });
          expect(art.ribbon).toBe(ACCENTS.termo);
          break;
        case "eachGameWon":
          expect(art.mark).toEqual({
            kind: "games",
            colors: ORIGINAL_GAMES.map((game) => ACCENTS[game]),
          });
          break;
        case "curated":
          expect(art.mark).toEqual({ kind: "star" });
          break;
      }
    }
  });
});

describe("the medal's tip waits 200 ms, follows a mouse and focus, and toggles on tap (T-WEB-S781)", () => {
  it("holds the tip invisible for its first 200 ms", () => {
    const tip = bodyOf(
      stylesheet("src/medals/medals-section.module.css"),
      ".tip",
    );
    const [name, duration, delay, fill] = (decl(tip, "animation") ?? "").split(
      /\s+/,
    );
    expect([duration, delay, fill]).toEqual(["0s", "200ms", "backwards"]);
    expect(
      decl(
        bodyOf(
          bodyOf(
            stylesheet("src/medals/medals-section.module.css"),
            `@keyframes ${name ?? ""}`,
          ),
          "from",
        ),
        "visibility",
      ),
    ).toBe("hidden");
  });

  it("opens when a mouse enters, never on a touch hover, and closes on leave", async () => {
    const { container } = await renderEarned(["first-win"]);
    const item = container.querySelector(`.${styles.medal}`) as HTMLElement;
    const tip = screen.getByRole("tooltip", { hidden: true });

    fireEvent.pointerEnter(item, { pointerType: "touch" });
    expect(tip).not.toBeVisible();

    fireEvent.pointerEnter(item, { pointerType: "mouse" });
    expect(tip).toBeVisible();
    fireEvent.pointerLeave(item, { pointerType: "mouse" });
    expect(tip).not.toBeVisible();
  });

  it("opens on keyboard focus, closes on Escape, and a tap toggles it", async () => {
    await renderEarned(["first-win"]);
    const button = screen.getByRole("button", {
      name: medalCopy["first-win"].name,
    });
    const tip = within(button.parentElement as HTMLElement).getByRole(
      "tooltip",
      { hidden: true },
    );

    fireEvent.focus(button);
    expect(tip).toBeVisible();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(tip).not.toBeVisible();
    fireEvent.blur(button);

    const tap = () => {
      fireEvent.pointerDown(button, { pointerType: "touch" });
      fireEvent.focus(button);
      fireEvent.click(button);
    };
    tap();
    expect(tip).toBeVisible();
    tap();
    expect(tip).not.toBeVisible();
  });
});

describe("a medal's tilt is fixed by its catalog place (T-WEB-S782)", () => {
  it("earning another medal never turns one already shown", async () => {
    const tiltOf = (container: HTMLElement) =>
      (
        within(container)
          .getByRole("button", { name: medalCopy["streak-7"].name })
          .querySelector(`.${styles.tilt}`) as HTMLElement
      ).style.rotate;

    const alone = await renderEarned(["streak-7"]);
    const before = tiltOf(alone.container);
    alone.unmount();

    const joined = await renderEarned(["first-win", "wins-10", "streak-7"]);
    expect(tiltOf(joined.container)).toBe(before);
    expect(before).not.toBe("");
  });
});

describe("a tip that would leave the viewport is pulled back inside it (T-WEB-S783)", () => {
  it("shifts right past the left edge, left past the right edge, and not at all inside", () => {
    expect(tipShift(-42, 178, 360)).toBe(50);
    expect(tipShift(200, 400, 360)).toBe(-48);
    expect(tipShift(8, 352, 360)).toBe(0);
  });

  it("writes the shift onto the open tip", async () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(
      DOMRect.fromRect({ x: -42, y: 0, width: 220, height: 40 }),
    );
    vi.spyOn(document.documentElement, "clientWidth", "get").mockReturnValue(
      360,
    );
    await renderEarned(["first-win"]);
    const button = screen.getByRole("button", {
      name: medalCopy["first-win"].name,
    });

    fireEvent.focus(button);

    expect(
      screen.getByRole("tooltip").style.getPropertyValue("--tip-shift"),
    ).toBe("50px");
  });
});

describe("the Dias Cheios medals wear a stripe set no other family uses (T-WEB-S853)", () => {
  it("full-* stripes are ink then paper and differ from every other rule kind's", () => {
    const key = (stripes: readonly string[]) => stripes.join("|");
    const full = MEDAL_DEFINITIONS.filter(
      ({ rule }) => rule.kind === "fullDaysReached",
    ).map(({ rule }) => key(artOf(rule).stripes));
    expect(new Set(full)).toEqual(
      new Set([key(["var(--ink)", "var(--paper-card)"])]),
    );

    for (const { rule } of MEDAL_DEFINITIONS) {
      if (rule.kind !== "fullDaysReached") {
        expect(full, rule.kind).not.toContain(key(artOf(rule).stripes));
      }
    }
  });
});
