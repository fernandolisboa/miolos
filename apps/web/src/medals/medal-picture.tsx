import type { MedalArt, MedalMark } from "./art";
import styles from "./medals-section.module.css";

const STAR =
  "32,45.5 34.7,52.3 42,52.8 36.4,57.4 38.2,64.5 32,60.6 25.8,64.5 27.6,57.4 22,52.8 29.3,52.3";

function Mark({ mark }: { readonly mark: MedalMark }) {
  switch (mark.kind) {
    case "numeral":
      return (
        <text
          x="32"
          y="56"
          textAnchor="middle"
          dominantBaseline="central"
          className={styles.numeral}
          fontSize={mark.text.length >= 3 ? 14 : 19}
        >
          {mark.text}
        </text>
      );
    case "games":
      return mark.colors.map((color, index) => (
        <rect
          key={color}
          x={24 + (index % 2) * 9}
          y={47.5 + Math.floor(index / 2) * 9}
          width="7"
          height="7"
          rx="1.5"
          style={{ fill: color }}
        />
      ));
    case "star":
      return <polygon points={STAR} className={styles.star} />;
  }
}

function Stripes({
  colors,
  side,
}: {
  readonly colors: readonly string[];
  readonly side: -1 | 1;
}) {
  const width = colors.length > 2 ? 2 : 2.4;
  return colors.map((color, index) => {
    const t = (index + 1) / (colors.length + 1);
    return (
      <line
        key={index}
        x1={32 - side * (22 - 16 * t)}
        y1="0"
        x2={32 - side * (6 - 14 * t)}
        y2="42"
        style={{ stroke: color, strokeWidth: width }}
      />
    );
  });
}

export function MedalPicture({ art }: { readonly art: MedalArt }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 64 84"
      className={styles.picture}
      style={{ "--ribbon": art.ribbon }}
    >
      <polygon points="10,0 26,0 40,40 26,44" className={styles.ribbonBack} />
      <Stripes colors={art.stripes} side={1} />
      <polygon points="54,0 38,0 24,40 38,44" className={styles.ribbon} />
      <Stripes colors={art.stripes} side={-1} />
      <circle cx="35" cy="59" r="22" className={styles.discShadow} />
      <circle cx="32" cy="56" r="22" className={styles.disc} />
      <circle cx="32" cy="56" r="16.5" className={styles.discLine} />
      <Mark mark={art.mark} />
    </svg>
  );
}
