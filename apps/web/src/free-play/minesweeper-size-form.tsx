"use client";

import {
  MINESWEEPER_CUSTOM_LIMITS,
  customMinesweeperSize,
  type MinesweeperSize,
} from "@miolos/games/minesweeper";
import { useId, useState } from "react";

import { minesweeperFreeMessages } from "../minesweeper/free-messages";
import styles from "./minesweeper-free.module.css";

const copy = minesweeperFreeMessages.custom;

type Field = keyof MinesweeperSize;

const FIELDS: readonly Field[] = ["rows", "columns", "mines"];

function asText(size: MinesweeperSize): Record<Field, string> {
  return {
    rows: String(size.rows),
    columns: String(size.columns),
    mines: String(size.mines),
  };
}

function clamped(
  values: Record<Field, string>,
  mines = Number(values.mines),
): MinesweeperSize {
  return customMinesweeperSize(
    Number(values.rows),
    Number(values.columns),
    mines,
  );
}

export function MinesweeperSizeForm({
  size,
  onPlay,
}: {
  readonly size: MinesweeperSize;
  readonly onPlay: (size: MinesweeperSize) => void;
}) {
  const id = useId();
  const [values, setValues] = useState(() => asText(size));
  const limits = {
    rows: MINESWEEPER_CUSTOM_LIMITS.rows,
    columns: MINESWEEPER_CUSTOM_LIMITS.columns,
    mines: {
      min: MINESWEEPER_CUSTOM_LIMITS.mines.min,
      max: clamped(values, Infinity).mines,
    },
  };

  return (
    <form
      aria-label={copy.label}
      noValidate
      className={styles.sizeForm}
      onSubmit={(event) => {
        event.preventDefault();
        const next = clamped(values);
        setValues(asText(next));
        onPlay(next);
      }}
    >
      {FIELDS.map((field) => (
        <div key={field} className={styles.sizeField}>
          <label htmlFor={`${id}-${field}`} className={styles.sizeLabel}>
            {copy[field]}
          </label>
          <input
            id={`${id}-${field}`}
            className={styles.sizeInput}
            type="number"
            inputMode="numeric"
            min={limits[field].min}
            max={limits[field].max}
            step={1}
            value={values[field]}
            aria-describedby={`${id}-${field}-range`}
            onChange={(event) => {
              setValues({ ...values, [field]: event.target.value });
            }}
          />
          <span id={`${id}-${field}-range`} className={styles.sizeRange}>
            {copy.range(limits[field].min, limits[field].max)}
          </span>
        </div>
      ))}
      <button type="submit" className={styles.sizePlay}>
        {copy.play}
      </button>
    </form>
  );
}
