import { type ReactElement, type ReactNode } from "react";
import Link from "next/link";

import { FREE_HINTS_PER_PUZZLE, type Game } from "@miolos/core";

import { Wordmark } from "../components/brand-mark";
import { lazyChunk } from "../components/lazy-chunk";
import type { FreePlayGame } from "../free-play/catalog";
import { messages } from "../i18n";
import { useSettings } from "../settings/settings";
import {
  GameSettingsButton,
  GameSettingsPlaceholder,
} from "../settings/settings-dialog";
import { accentVars } from "./accent";
import { useFreeHintsPerPuzzle } from "./free-hints";
import { PlayTitle, type PlayTitleNote } from "./play-title";
import {
  ResetControl,
  ResetPlaceholder,
  type ResetCopy,
} from "./reset-control";
import screen from "./screen.module.css";
import { TimerReadout } from "./timer-readout";
import { UndoControl, UndoPlaceholder } from "./undo-control";
import type { BoardEdits } from "./undo";

export type DailyChromeGame = Exclude<Game, "termo">;
export type PlayChromeGame = Exclude<FreePlayGame, "termo">;

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
  readonly onReset: BoardEdits["onReset"];
  readonly onUndo?: BoardEdits["onUndo"];
  readonly resetCopy?: ResetCopy;
  readonly hint: {
    readonly ready: boolean;
    readonly used: number;
    readonly explain: string | null;
    readonly cell: number | null;
    readonly onReveal: () => void;
  } | null;
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
const useHintCard = lazyChunk(() =>
  import("./hint-card").then((module) => module.HintCard),
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
  readonly game: PlayChromeGame;
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
  const hint = readouts?.hint ?? null;
  const reason = hint?.explain ?? null;
  const card = useHintCard();
  const left = Math.max(allowance - (hint?.used ?? 0), 0);
  const label = hintLabel(left);
  const { kicker, play } = messages.games[game];

  return (
    <main
      className={`${screen.page} ${pageModifier}`}
      style={accentVars(game)}
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
        card.state !== "ready" ? null : (
          <card.value key={hint.used} text={reason} cell={hint.cell} />
        )}
      </section>

      <div className={screen.reset}>
        {readouts === null ? (
          <>
            <UndoPlaceholder />
            <ResetPlaceholder />
            <GameSettingsPlaceholder />
          </>
        ) : (
          <>
            {readouts.onUndo !== undefined && (
              <UndoControl onUndo={readouts.onUndo} />
            )}
            <ResetControl
              onReset={readouts.onReset}
              copy={readouts.resetCopy}
            />
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
        hint !== null && (
          <button
            type="button"
            className={`${screen.hint}${hint.ready ? "" : ` ${screen.hintUsed}`}`}
            aria-disabled={!hint.ready}
            aria-label={label}
            data-short={messages.play.hint.short}
            data-left={left}
            onClick={hint.onReveal}
          >
            <span className={screen.hintLong}>{label}</span>
          </button>
        )
      )}
    </main>
  );
}
