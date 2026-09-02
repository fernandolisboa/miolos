import type { CSSProperties, ReactElement, ReactNode } from "react";
import Link from "next/link";

import type { Game } from "@miolos/core";

import { messages, routes } from "../i18n";
import { accentVars } from "./accent";
import screen from "./screen.module.css";
import { TimerReadout } from "./timer-readout";

export type ChromeGame = Exclude<Game, "termo">;

const ACCENTS: Readonly<Record<ChromeGame, CSSProperties>> = {
  sudoku: accentVars("sudoku"),
  nonogram: accentVars("nonogram"),
  binairo: accentVars("binairo"),
};

const BLANK_READOUT = "\u00a0";

export interface PlayChromeBack {
  readonly href: string;
  readonly label: string;
  readonly ariaLabel: string;
}

export interface PlayChromeNote {
  readonly text: string;
  readonly className: string;
}

export interface PlayChromeStat {
  readonly label: string;
  readonly value: string;
  readonly className: string;
}

export interface PlayChromeReadouts {
  readonly progressShort: string;
  readonly progressLong: string;
  readonly hint: {
    readonly ready: boolean;
    readonly label: string;
    readonly explain: string | null;
    readonly onReveal: () => void;
  };
}

export type PlayChromeState =
  | { readonly kind: "playing"; readonly readouts: PlayChromeReadouts }
  | { readonly kind: "skeleton" | "generating" | "error" };

export type PlayChromeClock = "none" | "blank" | { readonly elapsedMs: number };

export const DAILY_PLAY_BACK: PlayChromeBack = {
  href: routes.home,
  label: messages.play.back,
  ariaLabel: messages.play.backAria,
};

function clockBar(clock: PlayChromeClock): ReactNode {
  if (clock === "none") {
    return null;
  }
  if (clock === "blank") {
    return (
      <span aria-hidden className={screen.timerBar}>
        {BLANK_READOUT}
      </span>
    );
  }
  return (
    <TimerReadout className={screen.timerBar} elapsedMs={clock.elapsedMs} />
  );
}

function clockRow(clock: PlayChromeClock): ReactNode {
  if (clock === "none") {
    return null;
  }
  return (
    <div className={screen.statRow}>
      <span className={screen.statLabel}>{messages.play.timerLabel}</span>
      {clock === "blank" ? (
        <span className={screen.timerCard}>{BLANK_READOUT}</span>
      ) : (
        <TimerReadout
          className={screen.timerCard}
          elapsedMs={clock.elapsedMs}
        />
      )}
    </div>
  );
}

export function PlayScreenChrome({
  game,
  pageModifier,
  state,
  back,
  topDate,
  kicker,
  title,
  rules,
  note,
  clock,
  extraStat,
  children,
}: {
  readonly game: ChromeGame;
  readonly pageModifier: string;
  readonly state: PlayChromeState;
  readonly back: PlayChromeBack;
  readonly topDate: string;
  readonly kicker: string;
  readonly title: string;
  readonly rules: string;
  readonly note: PlayChromeNote | null;
  readonly clock: PlayChromeClock;
  readonly extraStat: PlayChromeStat | null;
  readonly children: ReactNode;
}): ReactElement {
  const skeleton = state.kind === "skeleton";
  const readouts = state.kind === "playing" ? state.readouts : null;

  return (
    <main
      className={`${screen.page} ${pageModifier}`}
      style={ACCENTS[game]}
      data-play-state={state.kind}
    >
      <header className={screen.topBar}>
        <Link
          className={screen.back}
          href={back.href}
          aria-label={back.ariaLabel}
        >
          {back.label}
        </Link>
        <span className={screen.wordmark}>{messages.brand.wordmark}</span>
        <span className={screen.barKicker}>{kicker}</span>
        <span className={screen.topDate}>{topDate}</span>
        {clockBar(clock)}
      </header>

      <div className={screen.titleBlock}>
        <p className={screen.titleKicker}>{kicker}</p>

        <div className={screen.titleRow}>
          <h1 className={screen.title}>{title}</h1>
          <span
            aria-hidden={readouts === null ? true : undefined}
            className={screen.progressBar}
          >
            {readouts === null ? BLANK_READOUT : readouts.progressShort}
          </span>
        </div>
        <p className={screen.rules}>{rules}</p>
        {note === null ? null : <p className={note.className}>{note.text}</p>}
      </div>

      {/* The daily skeleton hides the whole stats card; free play leaves it
          exposed and hides each blank readout instead — see ADR-0077. */}
      <div
        aria-hidden={skeleton ? true : undefined}
        className={screen.statsCard}
      >
        <div
          aria-hidden={skeleton ? undefined : true}
          className={screen.tape}
        />
        {clockRow(clock)}
        <div className={screen.statRow}>
          <span className={screen.statLabel}>
            {messages.play.progressLabel}
          </span>
          <span
            aria-hidden={readouts === null && !skeleton ? true : undefined}
            className={screen.progressCard}
          >
            {readouts === null ? BLANK_READOUT : readouts.progressLong}
          </span>
        </div>
        {extraStat === null ? null : (
          <div className={screen.statRow}>
            <span className={screen.statLabel}>{extraStat.label}</span>
            <span className={extraStat.className}>{extraStat.value}</span>
          </div>
        )}
      </div>

      <section className={screen.board}>
        {children}
        {readouts === null || readouts.hint.explain === null ? null : (
          <p className={screen.hintExplain}>{readouts.hint.explain}</p>
        )}
      </section>

      {readouts === null ? (
        <div
          aria-hidden
          className={`${screen.hint} ${screen.hintUsed} ${screen.placeholder}`}
        >
          {BLANK_READOUT}
        </div>
      ) : (
        <button
          type="button"
          className={`${screen.hint}${readouts.hint.ready ? "" : ` ${screen.hintUsed}`}`}
          aria-disabled={!readouts.hint.ready}
          onClick={readouts.hint.onReveal}
        >
          {readouts.hint.label}
        </button>
      )}
    </main>
  );
}
