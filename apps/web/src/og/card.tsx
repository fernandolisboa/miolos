import type { Game } from "@miolos/core";
import type { ReactElement } from "react";

import { messages } from "../i18n";
import { ogCopy } from "./copy";
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

export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;

const DOT_TILE = 72;

const DOT_DIAMETER = 6;

const CARD_BOX_WIDTH = 1040;
const CARD_BOX_HEIGHT = 460;
const CARD_PADDING = 72;

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
          border: `3px solid ${LINE}`,
          borderRadius: 18,
          boxShadow: `15px 15px 0 ${args.shadow}`,
          transform: "rotate(-0.5deg)",
        }}
      >
        <div
          style={{
            display: "flex",
            position: "absolute",
            top: -30,
            left: 90,
            width: 174,
            height: 57,
            borderRadius: 6,
            backgroundColor: args.tape,
            transform: "rotate(-4deg)",
          }}
        />
        {args.children}
      </div>
    </div>
  );
}

const kickerStyle = {
  fontFamily: "Instrument Sans",
  fontWeight: 600,
  fontSize: 33,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: INK_2,
} as const;

const displayStyle = {
  fontFamily: "Fraunces",
  fontWeight: 500,
  fontSize: 96,
  color: INK,
} as const;

const bodyStyle = {
  fontFamily: "Instrument Sans",
  fontWeight: 400,
  fontSize: 39,
  lineHeight: 1.5,
  color: INK_2,
} as const;

const wordmarkStyle = {
  fontFamily: "Fraunces",
  fontWeight: 500,
  fontSize: 39,
  color: INK,
} as const;

export function gameCard(args: {
  readonly game: Game;

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

export function archiveCard(args: {
  readonly display: string;
  readonly caption: string;
}): ReactElement {
  return paper({
    tape: ACCENT_APP_TAPE,
    shadow: ACCENT_APP_SHADOW,
    children: (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
        }}
      >
        <div style={displayStyle}>{args.display}</div>
        <div style={{ ...bodyStyle, marginTop: 12 }}>{args.caption}</div>
        <div style={{ display: "flex", flexGrow: 1 }} />
        <div style={wordmarkStyle}>{messages.brand.wordmark}</div>
      </div>
    ),
  });
}

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
        <div style={{ ...bodyStyle, marginTop: 12 }}>{ogCopy.siteTagline}</div>
      </div>
    ),
  });
}

export function archiveIndexCard(): ReactElement {
  return archiveCard({
    display: messages.archive.title,
    caption: ogCopy.archiveTagline,
  });
}
