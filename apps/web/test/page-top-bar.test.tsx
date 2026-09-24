import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PageTopBar } from "../src/components/page-top-bar";
import { messages, routes } from "../src/i18n";

const WEB = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const TOP_BAR_PAGES = [
  "app/arquivo/day-view.tsx",
  "app/arquivo/index-view.tsx",
  "app/arquivo/month-view.tsx",
  "app/estatisticas/page.tsx",
  "app/modo-livre/page.tsx",
  "app/privacidade/page.tsx",
  "app/termos/page.tsx",
  "app/vincular/page.tsx",
];

function filesUnder(dir: string, suffix: string): string[] {
  return readdirSync(path.join(WEB, dir), { recursive: true })
    .map(String)
    .filter((name) => name.endsWith(suffix))
    .map((name) => path.join(dir, name));
}

describe("one back-link and wordmark bar for every secondary page (T-WEB-S400)", () => {
  it("every page with the bar renders the shared component, and no stylesheet under app/ keeps a copy of its rules", () => {
    const users = filesUnder("app", ".tsx")
      .filter((file) =>
        readFileSync(path.join(WEB, file), "utf8").includes("<PageTopBar"),
      )
      .sort();
    expect(users).toEqual(TOP_BAR_PAGES);

    const copies = filesUnder("app", ".module.css").filter((file) =>
      /^\s*\.(topBar|barKicker)\b/m.test(
        readFileSync(path.join(WEB, file), "utf8"),
      ),
    );
    expect(copies).toEqual([]);
  });

  it("goes home by default and takes another destination with its own words", () => {
    const { unmount } = render(<PageTopBar />);
    expect(
      screen.getByRole("link", { name: messages.play.backAria }),
    ).toHaveAttribute("href", routes.home);
    expect(screen.getByText(messages.brand.wordmark)).toBeInTheDocument();
    unmount();

    render(
      <PageTopBar
        back={{ href: routes.archive, label: "Voltar", ariaLabel: "Arquivo" }}
        kicker={messages.archive.title}
      />,
    );
    expect(screen.getByRole("link", { name: "Arquivo" })).toHaveAttribute(
      "href",
      routes.archive,
    );
    expect(screen.getByText(messages.archive.title)).toBeInTheDocument();
  });
});
