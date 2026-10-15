"use client";

import { useLayoutEffect, useRef } from "react";

import { MEDAL_DEFINITIONS } from "@miolos/core";

import { messages } from "../i18n";
import { useTip } from "../play/use-tip";
import { artOf, medalRotation } from "./art";
import { medalCopy } from "./copy";
import { MedalPicture } from "./medal-picture";
import styles from "./medals-section.module.css";
import { useMedals } from "./use-medals";

const VIEWPORT_MARGIN_PX = 8;

type CatalogMedal = (typeof MEDAL_DEFINITIONS)[number];

export function MedalsSection() {
  const medals = useMedals();
  if (medals === undefined || medals === null) {
    return null;
  }
  const earned = new Set<string>(medals.medals);
  const shown = MEDAL_DEFINITIONS.flatMap((definition, index) =>
    earned.has(definition.id) ? [{ definition, index }] : [],
  );
  if (shown.length === 0) {
    return null;
  }
  return (
    <section className={styles.medals}>
      <h2 className={styles.heading}>{messages.medals.title}</h2>

      <ul role="list" className={styles.list}>
        {shown.map(({ definition, index }) => (
          <Medal
            key={definition.id}
            definition={definition}
            catalogIndex={index}
          />
        ))}
      </ul>
    </section>
  );
}

function Medal({
  definition,
  catalogIndex,
}: {
  readonly definition: CatalogMedal;
  readonly catalogIndex: number;
}) {
  const [open, tipId, rootProps, buttonProps] = useTip<HTMLLIElement>();
  const tipRef = useRef<HTMLSpanElement>(null);
  const copy = medalCopy[definition.id];

  useLayoutEffect(() => {
    const tip = tipRef.current;
    if (!open || tip === null) return;
    tip.style.setProperty("--tip-shift", "0px");
    const { left, right } = tip.getBoundingClientRect();
    const edge = document.documentElement.clientWidth - VIEWPORT_MARGIN_PX;
    const shift =
      left < VIEWPORT_MARGIN_PX
        ? VIEWPORT_MARGIN_PX - left
        : right > edge
          ? edge - right
          : 0;
    tip.style.setProperty("--tip-shift", `${String(shift)}px`);
  }, [open]);

  return (
    <li className={styles.medal} {...rootProps}>
      <button type="button" className={styles.button} {...buttonProps}>
        <span
          className={styles.tilt}
          style={{ rotate: `${String(medalRotation(catalogIndex))}deg` }}
        >
          <MedalPicture art={artOf(definition.rule)} />
        </span>
        <span className={styles.name}>{copy.name}</span>
      </button>
      <span
        ref={tipRef}
        id={tipId}
        role="tooltip"
        hidden={!open}
        className={styles.tip}
      >
        {copy.description}
      </span>
    </li>
  );
}
