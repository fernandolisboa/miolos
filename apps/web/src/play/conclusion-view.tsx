"use client";

import type { Game } from "@miolos/core";
import nextDynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, type ReactNode } from "react";

import { messages, playRoutes } from "../i18n";
import { accentVars } from "./accent";
import {
  ConclusionAside,
  ConclusionCardHead,
  ConclusionTopBar,
  nextPendingDaily,
  OutcomeStamp,
  playedOutcome,
  ShippedStamp,
} from "./conclusion-chrome";
import { ConclusionStats } from "./conclusion-stats";
import styles from "./conclusion-view.module.css";
import {
  refreshServerDay,
  useDayState,
  useServerDayClaim,
  type DayEntry,
} from "./day-state";
import { EndingFlourish } from "./ending-flourish";
import { PictureArt } from "./picture-art";
import { RemoteConclusionView } from "./remote-conclusion-view";
import { ShareButton } from "./share-button";
import { startCompletionSync } from "./sync";
import type {
  ConclusionAnswer,
  ConclusionCopy,
  ConclusionOutcome,
  ConclusionPicture,
  ConclusionResult,
} from "./types";
import { useRecordSnapshot } from "./use-record-snapshot";

const PushPromptCard = nextDynamic(
  () => import("./push-prompt-card").then((mod) => mod.PushPromptCard),
  { ssr: false },
);

export function ConclusionView({
  game,
  date,
  copy,
  result,
  figure,
  outcome: given,
  lost: lostGame = false,
  answer,
}: {
  readonly game: Game;
  readonly date: string;
  readonly copy: ConclusionCopy;
  readonly result?: ConclusionResult;
  readonly figure?: ReactNode;
  readonly outcome?: ConclusionOutcome;
  readonly lost?: boolean;
  readonly answer?: ConclusionAnswer;
}) {
  const outcome = given ?? playedOutcome(copy, lostGame);
  const snapshot = useRecordSnapshot(game, date);
  const hydrated = snapshot.hydrated;
  const record = snapshot.hydrated ? snapshot.record : undefined;
  const dayState = useDayState(date);
  const claim = useServerDayClaim(date, game);

  useEffect(() => {
    return startCompletionSync();
  }, [date]);

  const accent = accentVars(game);

  const stored = record?.concluded === true ? record : undefined;

  const stamp: ConclusionResult | undefined = stored ?? result;
  const syncOutcome = stored?.syncOutcome;

  useEffect(() => {
    if (syncOutcome === "recorded") {
      refreshServerDay();
    }
  }, [syncOutcome]);

  if (!hydrated) {
    return (
      <main
        className={`${styles.page} ${styles.pageEmpty}`}
        style={accent}
        data-conclusion-state="skeleton"
      >
        <ConclusionTopBar date={date} kicker={copy.kicker} />
        <div className={styles.emptyBody}>
          <div aria-hidden className={styles.skeletonCard} />
        </div>
      </main>
    );
  }

  const lost = outcome?.state === "lost";

  if (!lost && stamp === undefined) {
    if (claim !== undefined) {
      return (
        <RemoteConclusionView
          game={game}
          date={date}
          copy={copy}
          claim={claim}
        />
      );
    }
    return (
      <main
        className={`${styles.page} ${styles.pageEmpty}`}
        style={accent}
        data-conclusion-state="empty"
      >
        <ConclusionTopBar date={date} kicker={copy.kicker} />
        <div className={styles.emptyBody}>
          <article className={styles.emptyCard}>
            <div aria-hidden className={styles.tape} />

            <div className={styles.titleRow}>
              <h1 className={styles.emptyTitle}>{copy.notYet.title}</h1>
            </div>
            <p className={styles.emptyBodyText}>
              {messages.conclusion.notYet.body}
            </p>
            <Link className={styles.emptyCta} href={playRoutes[game]}>
              {copy.notYet.cta}
            </Link>
          </article>
        </div>
      </main>
    );
  }

  const dayEntry = (dayGame: Game): DayEntry =>
    dayGame === game
      ? outcome === undefined
        ? { status: "completed", elapsedMs: stamp?.elapsedMs }
        : outcome.state === "lost"
          ? { status: "played", elapsedMs: undefined }
          : { status: "completed", elapsedMs: undefined }
      : dayState[dayGame];
  const next = nextPendingDaily(dayEntry);

  return (
    <main
      className={`${styles.page} ${styles.pageResult}`}
      style={accent}
      data-conclusion-state={lost ? "lost" : "result"}
    >
      <ConclusionTopBar date={date} kicker={copy.kicker} />

      <article className={styles.resultCard}>
        <ConclusionCardHead copy={copy} />
        <div className={styles.stampRow}>
          <EndingFlourish outcome={lost ? "lost" : "won"}>
            {outcome === undefined ? (
              stamp === undefined ? null : (
                <ShippedStamp title={copy.title} stamp={stamp} />
              )
            ) : (
              <OutcomeStamp outcome={outcome} />
            )}
          </EndingFlourish>
        </div>
        {outcome !== undefined && (
          <p role="status" className={styles.announcer}>
            {outcome.aria}
          </p>
        )}
        {answer !== undefined && (
          <div className={styles.dayWordRow}>
            <p className={styles.dayWordResult}>{answer.result}</p>
            <p className={styles.dayWordLead}>{answer.lead}</p>
            <p className={styles.dayWord}>{answer.canonical}</p>
          </div>
        )}
        {figure !== undefined && (
          <div className={styles.figureRow}>{figure}</div>
        )}

        {syncOutcome === "recorded" && (
          <ConclusionStats
            game={game}
            date={date}
            elapsedMs={stamp?.elapsedMs}
            lost={lost}
          />
        )}
        {syncOutcome === "pending" && (
          <p className={styles.sync}>{messages.conclusion.sync.pending}</p>
        )}
        {syncOutcome === "rejected" && (
          <p className={styles.sync}>{messages.conclusion.sync.rejected}</p>
        )}
      </article>

      <ConclusionAside
        streak={syncOutcome === "recorded"}
        entryOf={dayEntry}
        next={next}
        share={
          <ShareButton
            game={game}
            date={date}
            stored={stored}
            stamp={lost ? undefined : stamp}
          />
        }
        prompt={<PushPromptCard />}
      />
    </main>
  );
}

export function PictureFigure({
  picture,
}: {
  readonly picture: ConclusionPicture;
}) {
  return (
    <>
      <PictureArt picture={picture} className={styles.picture} />
      {picture.name !== undefined && (
        <div className={styles.pictureCaption}>
          {picture.lead !== undefined && (
            <p className={styles.pictureLead}>{picture.lead}</p>
          )}
          <p className={styles.pictureName}>{picture.name}</p>
        </div>
      )}
    </>
  );
}
