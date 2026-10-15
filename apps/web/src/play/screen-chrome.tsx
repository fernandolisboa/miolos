import { type CSSProperties, type ReactElement, type ReactNode } from "react";
import Link from "next/link";

import { FREE_HINTS_PER_PUZZLE, type Game } from "@miolos/core";

import { Wordmark } from "../components/brand-mark";
import { lazyChunk } from "../components/lazy-chunk";
import { messages } from "../i18n";
import { useSettings } from "../settings/settings";
import {
  GameSettingsButton,
  GameSettingsPlaceholder,
} from "../settings/settings-dialog";
import { accentVars } from "./accent";
import { useFreeHintsPerPuzzle } from "./free-hints";
import { PlayTitle, type PlayTitleNote } from "./play-title";
import { ResetControl, ResetPlaceholder } from "./reset-control";
import screen from "./screen.module.css";
import { TimerReadout } from "./timer-readout";

export type ChromeGame = Exclude<Game, "termo">;

const ACCENTS: Readonly<Record<ChromeGame, CSSProperties>> = {
  sudoku: accentVars("sudoku"),
  nonogram: accentVars("nonogram"),
  binairo: accentVars("binairo"),
  crossword: accentVars("crossword"),
  queens: accentVars("queens"),
};

const BLANK_READOUT = "\u00a0";

export interface PlayChromeBack {
  readonly href: string;
  readonly label: string;
  readonly ariaLabel: string;
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
    readonly used: number;
    readonly explain: string | null;
    readonly cell: number | null;
    readonly onReveal: () => void;
  };
  readonly onReset: (() => void) | null;
}

export type PlayChromeState =
  | { readonly kind: "playing"; readonly readouts: PlayChromeReadouts }
  | { readonly kind: "skeleton" | "generating" | "error" };

export type PlayChromeClock = "none" | "blank" | { readonly elapsedMs: number };

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

function hintLabel(left: number): string {
  return left > 0
    ? messages.play.hint.available(left)
    : messages.play.hint.used;
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

// Outside every route's first load; a failed chunk leaves the live region alone (ADR-0113).
let LoadedHintCard: typeof import("./hint-card").HintCard | null = null;
const useHintCardLoaded = lazyChunk(() =>
  import("./hint-card").then((module) => {
    LoadedHintCard = module.HintCard;
  }),
);

export function PlayScreenChrome({
  game,
  pageModifier,
  state,
  back,
  topDate,
  note,
  clock: clockSetting,
  extraStat,
  children,
}: {
  readonly game: ChromeGame;
  readonly pageModifier: string;
  readonly state: PlayChromeState;
  readonly back: PlayChromeBack;
  readonly topDate: string;
  readonly note: PlayTitleNote | null;
  readonly clock: PlayChromeClock;
  readonly extraStat: PlayChromeStat | null;
  readonly children: ReactNode;
}): ReactElement {
  const allowance = useFreeHintsPerPuzzle() ?? FREE_HINTS_PER_PUZZLE;
  const clock = useSettings().showClock ? clockSetting : "none";
  const skeleton = state.kind === "skeleton";
  const readouts = state.kind === "playing" ? state.readouts : null;
  const hint = readouts?.hint;
  const reason = hint?.explain ?? null;
  const cardLoaded = useHintCardLoaded();
  const left = Math.max(allowance - (hint?.used ?? 0), 0);
  const label = hintLabel(left);
  const { kicker, play } = messages.games[game];

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
        <Wordmark className={screen.wordmark} />
        <span className={screen.barKicker}>{kicker}</span>
        <span className={screen.topDate}>{topDate}</span>
        {clockBar(clock)}
      </header>

      <PlayTitle
        kicker={kicker}
        title={play.title}
        rules={play.rules}
        note={note}
        inert={skeleton}
      >
        <span
          aria-hidden={readouts === null ? true : undefined}
          className={screen.progressBar}
        >
          {readouts === null ? BLANK_READOUT : readouts.progressShort}
        </span>
      </PlayTitle>

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
        <div aria-live="polite" className={screen.hintLive}>
          {reason === null ? null : <p key={hint?.used}>{reason}</p>}
        </div>
        {reason === null ||
        hint?.cell == null ||
        !cardLoaded ||
        LoadedHintCard === null ? null : (
          <LoadedHintCard key={hint.used} text={reason} cell={hint.cell} />
        )}
      </section>

      <div className={screen.reset}>
        {readouts === null ? (
          <>
            <ResetPlaceholder />
            <GameSettingsPlaceholder />
          </>
        ) : (
          <>
            <ResetControl onReset={readouts.onReset} />
            <GameSettingsButton game={game} clock={clockSetting !== "none"} />
          </>
        )}
      </div>

      {readouts === null ? (
        <div
          aria-hidden
          className={`${screen.hint} ${screen.hintUsed} ${screen.placeholder}`}
          data-short={messages.play.hint.short}
          data-left={BLANK_READOUT}
        >
          <span className={screen.hintLong}>{BLANK_READOUT}</span>
        </div>
      ) : (
        <button
          type="button"
          className={`${screen.hint}${readouts.hint.ready ? "" : ` ${screen.hintUsed}`}`}
          aria-disabled={!readouts.hint.ready}
          aria-label={label}
          data-short={messages.play.hint.short}
          data-left={left}
          onClick={readouts.hint.onReveal}
        >
          <span className={screen.hintLong}>{label}</span>
        </button>
      )}
    </main>
  );
}
