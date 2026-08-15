import type { Game } from "@miolos/core";
import type { ReactElement } from "react";

import { messages } from "../i18n";
import {
  ACCENT_APP_SHADOW,
  ACCENT_APP_TAPE,
  ACCENT_SHADOW,
  ACCENT_TAPE,
  INK,
  INK_2,
  LINE,
  PAPER_CARD,
  PAPER_DESK,
  TEXTURE_DOT,
} from "./tokens";

/**
 * The Open Graph card, as two pure builders (#34, ADR-0054).
 *
 * NEITHER constructs an `ImageResponse`. Both return a plain element tree, so
 * both are renderable and assertable in jsdom without a rasteriser
 * (`T-WEB-S200`/`S208`), and the one file that genuinely rasterises is
 * quarantined to `// @vitest-environment node` (`T-WEB-S202`).
 *
 * ## The card draws NO puzzle content, and the signature is the mechanism
 *
 * `gameCard` takes a `Game` and an already-formatted date string. There is no
 * parameter a daily response can enter through, which makes "no puzzle
 * content on the card" a TYPE-LEVEL property rather than a runtime scan
 * (ADR-0054 decision 8). For Nonogram this is a refusal and not an
 * impossibility, and ADR-0033 decision 2 `:49-55` insists on the distinction
 * being stated in those words: `solveNonogram(clues)` recovers the picture
 * from the PUBLISHED clues alone — measured over 280 dailies, 0 mismatches,
 * worst 0.338 ms (ADR-0033 Context `:26-30`) — so withholding it protects
 * nothing about the picture's shape. **It is a PRODUCT decision, not a
 * confidentiality one.** The OG ESLint wall is the mechanical half.
 *
 * ## The scale rule: every absolute LENGTH is the f6 MOBILE frame's × 3
 *
 * An OG card is read in a chat bubble at roughly 300-500 px wide, so the
 * 1200 px PNG is displayed at about ⅓ scale — the size of
 * `f6-conclusao-mobile`'s paper card, not the desktop frame's. Multiplying
 * f6's lengths by three makes the card look like the shipped mobile system at
 * the size the recipient actually sees it, and it is what keeps
 * `DESIGN.md:36`'s `N = 3-6` shadow range true AT DISPLAY SCALE (15px ÷ 3 = 5)
 * rather than violated or ignored.
 *
 * **Three quantities are not lengths and do not take the rule.** An angle
 * looks like itself at every scale, so the rotation is f6's −0.5 deg
 * unchanged. Optical size is the one property that must be DIVIDED by three
 * (plan 040 §7.2a; the committed cut is the 36 pt instance, chosen against the
 * 32 px display size of the name). And two lengths are rounded off the ×3
 * value deliberately: the card width (1040, not 1062 — the largest 4pt width
 * leaving a whole-number 80px desk margin) and the padding (72, not 66 — the
 * 4pt-scale value nearest it).
 *
 * ## Satori constraints, each one a landmine
 *
 * 1. **`display: flex` on any element with more than one child.** A plain
 *    `<div>` with two children THROWS at render, and jsdom does not catch it.
 *    The tree below is written flex-first for that reason.
 * 2. **A `background` SHORTHAND drops the gradient** as soon as it also
 *    carries a colour or a `/ <size>` — measured, 0 non-background pixels. So
 *    nothing here uses the shorthand.
 * 3. **A `px` colour stop inside a tiled radial gradient renders nothing.**
 *    Satori resolves it as `value / elementWidth` of the gradient's radius, so
 *    `3px` inside a `72px` tile on a 1200-wide element becomes 0.13px of
 *    radius at EVERY output size. Percentage stops are already fractions and
 *    do tile correctly — the gradient is available, and the lattice below
 *    ships anyway for SPEED: median 48-51 ms against the percentage
 *    gradient's 74-80 ms, ~26 ms per card on a route that can never be
 *    cached. It also states the dot radius in px instead of a 5.893 % figure
 *    re-derived from the tile diagonal every time the tile changes.
 * 4. **Every weight and style used must have a registered face** — satori
 *    synthesises none of them. Three faces ship; the card uses exactly those.
 */

/** The output size every card is rasterised at. */
export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;

/** The desk texture's lattice pitch — `DESIGN.md:13`'s 24px mobile tile × 3. */
const DOT_TILE = 72;
/** `DESIGN.md:13`'s 1px mobile dot radius × 3, as a diameter. */
const DOT_DIAMETER = 6;

const CARD_BOX_WIDTH = 1040;
const CARD_BOX_HEIGHT = 460;
const CARD_PADDING = 72; // --space-6 × 3

/**
 * The desk texture, as explicit elements on a `DOT_TILE` lattice.
 *
 * **The count is DERIVED, never a literal.** `ceil(1200/72) × ceil(630/72)`
 * is 17 × 9 = 153. A hand-written 120 leaves the bottom-right 80×70 corner of
 * the desk with zero dots — the texture simply stops — because the last dot
 * is index 152 and any count below that truncates. `T-WEB-S200` asserts both
 * the derivation and the 153.
 */
function deskDots(): ReactElement[] {
  const columns = Math.ceil(CARD_WIDTH / DOT_TILE);
  const rows = Math.ceil(CARD_HEIGHT / DOT_TILE);
  const dots: ReactElement[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      dots.push(
        <div
          key={`${row}-${column}`}
          style={{
            position: "absolute",
            left: column * DOT_TILE,
            top: row * DOT_TILE,
            width: DOT_DIAMETER,
            height: DOT_DIAMETER,
            borderRadius: DOT_DIAMETER / 2,
            backgroundColor: TEXTURE_DOT,
          }}
        />,
      );
    }
  }
  return dots;
}

/**
 * The paper card and everything around it: desk, texture, tape, shadow.
 *
 * The accent reaches exactly two surfaces — the tape and the offset shadow —
 * and no word on the card is ever accent-coloured. That is ADR-0041 decision 1
 * obeyed WITHOUT invoking its exception: `DESIGN.md`'s colour section says
 * outright that "the kicker is no longer among" the sanctioned accent
 * surfaces, so the reference frames' accent-coloured kickers predate ADR-0041
 * and are not copied. It also means Termo's mustard — the lowest-contrast
 * accent in the family — is never a question. `T-WEB-S200` walks the tree for
 * it, with the tape and the shadow as its counted floor.
 */
function paper(args: {
  readonly tape: string;
  readonly shadow: string;
  readonly children: ReactElement;
}): ReactElement {
  return (
    <div
      style={{
        display: "flex",
        position: "relative",
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: PAPER_DESK,
      }}
    >
      {deskDots()}
      <div
        style={{
          display: "flex",
          position: "relative",
          width: CARD_BOX_WIDTH,
          height: CARD_BOX_HEIGHT,
          padding: CARD_PADDING,
          backgroundColor: PAPER_CARD,
          border: `3px solid ${LINE}`, // --line, 1px × 3
          borderRadius: 18, // --radius 6 × 3
          boxShadow: `15px 15px 0 ${args.shadow}`, // f6's 5px × 3
          transform: "rotate(-0.5deg)", // f6's own angle: an angle is not a length
        }}
      >
        <div
          style={{
            display: "flex",
            position: "absolute",
            top: -30, // f6's -10 × 3
            left: 90, // f6's 30 × 3
            width: 174, // f6's 58 × 3
            height: 57, // f6's 19 × 3
            borderRadius: 6, // --radius-tape 2 × 3
            backgroundColor: args.tape,
            transform: "rotate(-4deg)", // f6's own angle
          }}
        />
        {args.children}
      </div>
    </div>
  );
}

/** The kicker's type, shared by both cards' top line. `--text-kicker` × 3. */
const kickerStyle = {
  fontFamily: "Instrument Sans",
  fontWeight: 600,
  fontSize: 33,
  letterSpacing: "0.16em", // DESIGN.md:29's 0.14-0.16em band
  textTransform: "uppercase",
  color: INK_2,
} as const;

/** The card's protagonist. 96 = 32 × 3, the largest 4pt value the stack clears. */
const displayStyle = {
  fontFamily: "Fraunces",
  fontWeight: 500, // css2 cannot serve the app's 550; 500 is the editorial side
  fontSize: 96,
  color: INK,
} as const;

/** The card's secondary type level: f6's 13px body × 3. */
const bodyStyle = {
  fontFamily: "Instrument Sans",
  fontWeight: 400,
  fontSize: 39,
  lineHeight: 1.5,
  color: INK_2,
} as const;

/** The wordmark, at the same 39px secondary level — reused, not invented. */
const wordmarkStyle = {
  fontFamily: "Fraunces",
  fontWeight: 500,
  fontSize: 39,
  color: INK,
} as const;

/**
 * The per-day, per-game card. All eight dated routes render this one.
 *
 * `longDate` is REQUIRED, not optional: every game card is dated, so there is
 * no dateless variant, and the absence of a fallback is what makes the
 * signature a guarantee rather than a convention. It is the ONLY value
 * derived from a wall read that reaches this tree — and it is a date, the
 * same value the archive URL carries in plain sight and the sitemap
 * publishes, not puzzle content.
 */
export function gameCard(args: {
  readonly game: Game;
  /** Already formatted by `formatLongDate`. */
  readonly longDate: string;
}): ReactElement {
  const game = messages.games[args.game];
  return paper({
    tape: ACCENT_TAPE[args.game],
    shadow: ACCENT_SHADOW[args.game],
    children: (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
        }}
      >
        <div style={kickerStyle}>{game.kicker}</div>
        <div style={{ ...displayStyle, marginTop: 24 }}>{game.name}</div>
        <div style={{ ...bodyStyle, marginTop: 12 }}>{args.longDate}</div>
        <div style={{ display: "flex", flexGrow: 1 }} />
        <div style={wordmarkStyle}>{messages.brand.wordmark}</div>
      </div>
    ),
  });
}

/**
 * The root site card — the one static card in the family. It reads nothing,
 * has no dynamic segment and no dynamic API, so Next prerenders it at build.
 *
 * It is not any one game's, so it takes `--accent-app` ("sealing-wax red:
 * streak, promo"), and `DESIGN.md:37` describes ONE tape over a card's top
 * edge rather than four. The tagline is `messages.og.siteTagline`, written
 * for this surface: `meta.title` already contains the wordmark this card sets
 * at 96px, and `meta.description` is 133 characters — three wrapped lines of
 * body copy where the composition wants one line.
 */
export function siteCard(): ReactElement {
  return paper({
    tape: ACCENT_APP_TAPE,
    shadow: ACCENT_APP_SHADOW,
    children: (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          width: "100%",
          height: "100%",
        }}
      >
        <div style={displayStyle}>{messages.brand.wordmark}</div>
        <div style={{ ...bodyStyle, marginTop: 12 }}>
          {messages.og.siteTagline}
        </div>
      </div>
    ),
  });
}
