import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HubMenu } from "../app/hub-menu";
import HojePage from "../app/page";
import { messages, routes } from "../src/i18n";

beforeEach(() => {
  window.localStorage.clear();
  vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.example.test");
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ error: "no-session" }), { status: 401 }),
      ),
    ),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function menuButton(): HTMLElement {
  return screen.getByRole("button", { name: messages.hoje.menu.label });
}

describe("the hub's primary nav is Modo livre, then Arquivo (T-WEB-S770)", () => {
  it("holds exactly those two links, in that order", () => {
    render(<HojePage />);
    const nav = screen.getByRole("navigation", {
      name: messages.hoje.links.aria,
    });
    const links = within(nav).getAllByRole("link");

    expect(links.map((link) => link.textContent)).toEqual([
      messages.hoje.links.freePlay,
      messages.hoje.links.archive,
    ]);
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      routes.freePlay,
      routes.archive,
    ]);
  });
});

describe("the hub menu opens onto Estatísticas and Ajustes (T-WEB-S771)", () => {
  it("starts closed and toggles aria-expanded on each click", () => {
    render(<HubMenu />);
    const button = menuButton();

    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("link")).toBeNull();

    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByRole("link", { name: messages.hoje.menu.stats }),
    ).toHaveAttribute("href", routes.stats);
    expect(
      screen.getByRole("link", { name: messages.hoje.menu.settings }),
    ).toHaveAttribute("href", routes.settings);

    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("controls the panel it reveals", () => {
    render(<HubMenu />);
    const button = menuButton();
    const panel = document.getElementById(
      button.getAttribute("aria-controls") ?? "",
    );

    expect(panel).not.toBeNull();
    expect(panel).toHaveAttribute("hidden");
    fireEvent.click(button);
    expect(panel).not.toHaveAttribute("hidden");
  });
});

describe("the hub menu closes like a disclosure (T-WEB-S772)", () => {
  it("closes on Escape and hands focus back to the button", () => {
    render(<HubMenu />);
    const button = menuButton();
    fireEvent.click(button);
    const stats = screen.getByRole("link", { name: messages.hoje.menu.stats });
    stats.focus();

    fireEvent.keyDown(stats, { key: "Escape" });

    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button).toHaveFocus();
  });

  it("closes on a press outside, and stays open on a press inside", () => {
    render(
      <>
        <HubMenu />
        <p>fora</p>
      </>,
    );
    const button = menuButton();
    fireEvent.click(button);

    fireEvent.pointerDown(
      screen.getByRole("link", { name: messages.hoje.menu.stats }),
    );
    expect(button).toHaveAttribute("aria-expanded", "true");

    fireEvent.pointerDown(screen.getByText("fora"));
    expect(button).toHaveAttribute("aria-expanded", "false");
  });

  it("closes when focus leaves the menu, and not when it moves within", () => {
    render(
      <>
        <HubMenu />
        <button type="button">depois</button>
      </>,
    );
    const button = menuButton();
    fireEvent.click(button);
    const stats = screen.getByRole("link", { name: messages.hoje.menu.stats });
    const settings = screen.getByRole("link", {
      name: messages.hoje.menu.settings,
    });

    fireEvent.blur(stats, { relatedTarget: settings });
    expect(button).toHaveAttribute("aria-expanded", "true");

    fireEvent.blur(settings, {
      relatedTarget: screen.getByRole("button", { name: "depois" }),
    });
    expect(button).toHaveAttribute("aria-expanded", "false");
  });
});

describe("the hub footer holds the legal links (T-WEB-S773)", () => {
  it("is the page's contentinfo, with Privacidade and Termos and nothing else", () => {
    render(<HojePage />);
    const footer = screen.getByRole("contentinfo");
    const links = within(footer).getAllByRole("link");

    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      routes.privacy,
      routes.terms,
    ]);
    expect(links.map((link) => link.textContent)).toEqual([
      messages.hoje.footer.privacy,
      messages.hoje.footer.terms,
    ]);
    expect(
      within(screen.getByRole("main")).queryByText(
        messages.hoje.footer.privacy,
      ),
    ).toBeNull();
  });
});
