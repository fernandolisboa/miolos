# Evidence — #161 Termo accent harmony (PR #170, ADR-0067)

Before/after pairs for the three Termo surfaces ADR-0067 consequence (a) repaints, at 1440×900 (`-desktop`) and 390×844 (`-mobile`). Static file:// fixtures of the real rendered markup (the napkin idiom: real components rendered in a throwaway vitest file, CSS-module classes unhashed, real stylesheets and fonts linked), shot with the repo's puppeteer.

Every `before-*` is a **control fixture of main's shipped composition**: it links `git show origin/main:packages/ui/tokens.css` (`--accent-termo: #C08A1E`) and carries main's `accentVars("termo")` inline pair (`--ink-on-accent: var(--ink)`). Every `after-*` links this branch's `tokens.css` (`#8D6212`) and inline pair (`var(--paper-desk)`). Step-7 pixel proof on the hub CTA: before fill `#C08A1E`, darkest label pixel `#211D19` (`--ink`); after fill `#8D6212`, lightest label pixel `#F7F2E9` (`--paper-desk`).

- `before-*` / `after-*` — the hub, all four game cards. The pair Fernando's #161 report names: Termo's dark-on-mustard CTA vs the family's light-on-deep treatment.
- `play-before-*` / `play-after-*` — `/termo` mid-game: board with `correct` tiles and the keyboard's `correct` keys.
- `conclusion-before-*` / `conclusion-after-*` — the won conclusion: stamp ring, washi tape, day-card chips.
