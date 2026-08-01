import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Reading a CSS Module as TEXT, so a layout rule can be asserted at all.
 *
 * The test environment is jsdom, which implements no layout: it has no
 * `getBoundingClientRect` worth the name, no flexbox and no grid, so a board
 * wider than its phone, a 38px-wide touch target or a header collapsed to
 * fit-content are all invisible to every rendering test in this suite. Those
 * three defects were found by measuring the real page in a browser (step 6 of
 * the flow in CLAUDE.md), and the numbers stay in the PR body. What lives
 * here is the tripwire: the arithmetic the browser would do, run against the
 * declarations the stylesheet actually ships, so the fix cannot be undone
 * silently.
 *
 * This is deliberately a text reader and not a CSS parser — the project takes
 * no dependency for it, and the shapes below are the ones this repo's own
 * stylesheets use.
 */

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * A stylesheet anywhere under `apps/web/`, by its repo-relative path,
 * comments stripped.
 *
 * The path argument is not decoration: CSS Modules hash class names PER
 * FILE, so the play screen's rules now live in two sheets (the shared
 * `src/play/screen.module.css` and each game's own board module) and the
 * assertions below have to read whichever one actually declares the rule
 * (plan 018 §5.5). It also unlocks `app/page.module.css`, which the previous
 * `src/binairo/`-only resolver could not reach at all.
 */
export function stylesheet(relativePath: string): string {
  return stripComments(
    readFileSync(path.join(here, "..", relativePath), "utf8"),
  );
}

/**
 * The body of the first block whose prelude opens a line — `.grid` therefore
 * never matches `.gridCard`, and a top-level rule always wins over the same
 * selector nested in a media query further down.
 */
export function bodyOf(css: string, prelude: string): string {
  const opener = new RegExp(`^[ \\t]*${escape(prelude)}[ \\t]*\\{`, "m");
  const match = opener.exec(css);
  if (match === null) {
    throw new Error(`no block for \`${prelude}\``);
  }
  const open = match.index + match[0].length - 1;
  let depth = 0;
  for (let index = open; index < css.length; index += 1) {
    if (css[index] === "{") {
      depth += 1;
    } else if (css[index] === "}") {
      depth -= 1;
      if (depth === 0) {
        return css.slice(open + 1, index);
      }
    }
  }
  throw new Error(`unterminated block for \`${prelude}\``);
}

/**
 * One declaration's value, or `undefined` when the block does not carry it.
 * Anchored on a line start or a `;` so `width` never reads `max-width`.
 */
export function decl(body: string, property: string): string | undefined {
  const match = new RegExp(
    `(?:^|;)\\s*${escape(property)}\\s*:\\s*([^;}]+)`,
    "m",
  ).exec(body);
  const value = match?.[1];
  return value === undefined ? undefined : value.trim();
}

/** A `<length>` in px, from a declaration that must exist. */
export function pixels(value: string | undefined): number {
  const match = /^(-?[\d.]+)px$/.exec(value?.trim() ?? "");
  if (match === null) {
    throw new Error(`\`${String(value)}\` is not a px length`);
  }
  return Number(match[1]);
}

/** A px-valued design token from `packages/ui/tokens.css`. */
export function token(name: string): number {
  const tokens = readFileSync(
    path.join(here, "..", "..", "..", "packages", "ui", "tokens.css"),
    "utf8",
  );
  const match = new RegExp(`${escape(name)}\\s*:\\s*([^;]+)`).exec(tokens);
  return pixels(match?.[1]);
}

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

function escape(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
