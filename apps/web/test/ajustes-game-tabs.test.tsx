import { fireEvent, render, screen, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";

import { GameTabs } from "../app/ajustes/game-tabs";
import { messages } from "../src/i18n";
import { ACCENTS } from "../src/play/accent";
import { GameSettings } from "../src/settings/game-settings";
import groupStyles from "../src/settings/game-settings.module.css";
import { settingsGames } from "../src/settings/settings";
import { bodyOf, decl, stylesheet } from "./css-source";

const copy = messages.settings.games;
const NAMES = [
  copy.tabs.general,
  ...settingsGames().map((game) => messages.games[game].name),
];

afterEach(() => {
  localStorage.clear();
  document.body.innerHTML = "";
});

function selected(): HTMLElement {
  return screen.getByRole("tab", { selected: true });
}

describe("the Jogos card shows one tab at a time: Geral, then every game with settings (T-WEB-S1084)", () => {
  it("names a tablist Jogo with Geral first and one tab per game, each in its accent", () => {
    render(<GameTabs />);
    const list = screen.getByRole("tablist", { name: copy.tabs.label });
    const tabs = within(list).getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual(NAMES);
    expect(tabs[0]?.style.getPropertyValue("--accent")).toBe("");
    settingsGames().forEach((game, index) => {
      expect(tabs[index + 1]?.style.getPropertyValue("--accent")).toBe(
        ACCENTS[game],
      );
    });
  });

  it("opens on Geral with only its panel shown, each panel labelled by its tab", () => {
    render(<GameTabs />);
    expect(selected()).toHaveTextContent(copy.tabs.general);
    const panel = screen.getByRole("tabpanel");
    expect(panel).toHaveAccessibleName(copy.tabs.general);
    expect(
      within(panel).getByRole("group", { name: copy.general }),
    ).toBeInTheDocument();

    for (const tab of screen.getAllByRole("tab", { hidden: true })) {
      const controlled = document.getElementById(
        tab.getAttribute("aria-controls") ?? "",
      );
      expect(controlled?.getAttribute("aria-labelledby")).toBe(tab.id);
      expect(controlled?.hidden).toBe(
        tab.getAttribute("aria-selected") !== "true",
      );
    }
  });

  it("server markup selects Geral and hides every game panel", () => {
    document.body.innerHTML = renderToStaticMarkup(<GameTabs />);
    const tabs = [...document.querySelectorAll('[role="tab"]')];
    expect(tabs.map((tab) => tab.getAttribute("aria-selected"))).toEqual(
      NAMES.map((_, index) => String(index === 0)),
    );
    const panels = [...document.querySelectorAll('[role="tabpanel"]')];
    expect(panels.map((panel) => panel.hasAttribute("hidden"))).toEqual(
      NAMES.map((_, index) => index !== 0),
    );
  });
});

describe("the Jogos tabs follow the WAI-ARIA tabs pattern (T-WEB-S1085)", () => {
  it("a click selects a tab and shows only that game's settings", () => {
    render(<GameTabs />);
    fireEvent.click(screen.getByRole("tab", { name: "Rainhas" }));
    expect(selected()).toHaveTextContent("Rainhas");
    const panel = screen.getByRole("tabpanel");
    expect(panel).toHaveAccessibleName("Rainhas");
    expect(within(panel).getAllByRole("switch")).toHaveLength(4);
    expect(screen.queryByRole("group", { name: copy.general })).toBeNull();
  });

  it("arrows step and wrap, Home and End jump, and focus and the one tab stop follow", () => {
    render(<GameTabs />);
    const first = selected();
    first.focus();
    const last = NAMES.length - 1;
    const steps: [string, number][] = [
      ["ArrowLeft", last],
      ["ArrowRight", 0],
      ["ArrowDown", 1],
      ["ArrowUp", 0],
      ["End", last],
      ["Home", 0],
      ["ArrowRight", 1],
    ];
    for (const [key, index] of steps) {
      fireEvent.keyDown(document.activeElement ?? first, { key });
      expect(selected()).toHaveTextContent(NAMES[index] ?? "");
      expect(document.activeElement).toBe(selected());
      expect(
        screen
          .getAllByRole("tab")
          .map((tab) => tab.tabIndex)
          .filter((stop) => stop === 0),
      ).toHaveLength(1);
      expect(selected().tabIndex).toBe(0);
    }
  });

  it("ignores other keys and leaves Alt, Ctrl and Meta chords to the browser", () => {
    render(<GameTabs />);
    selected().focus();
    fireEvent.keyDown(selected(), { key: "a" });
    for (const modifier of ["altKey", "ctrlKey", "metaKey"]) {
      const event = new KeyboardEvent("keydown", {
        key: "ArrowLeft",
        [modifier]: true,
        bubbles: true,
        cancelable: true,
      });
      selected().dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
    }
    expect(selected()).toHaveTextContent(copy.tabs.general);
  });

  it("hides each panel's legend visually but keeps it as the group's name, while the dialog's stays shown", () => {
    render(<GameTabs />);
    const legend = screen
      .getByRole("group", { name: copy.general })
      .querySelector("legend");
    expect(legend).toHaveClass(groupStyles.legendHidden ?? "");
    expect(
      decl(
        bodyOf(
          stylesheet("src/settings/game-settings.module.css"),
          ".legendHidden",
        ),
        "composes",
      ),
    ).toBe('hidden from "../components/visually-hidden.module.css"');
    document.body.innerHTML = "";
    render(<GameSettings games={["sudoku"]} clock />);
    for (const shown of document.querySelectorAll("legend")) {
      expect(shown).toHaveClass(groupStyles.legend ?? "");
    }
  });
});
