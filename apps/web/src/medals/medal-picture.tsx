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

function Stripes({ colors }: { readonly colors: readonly string[] }) {
  const width = colors.length > 2 ? 2 : 2.4;
  return colors.flatMap((color, index) => {
    const t = (index + 1) / (colors.length + 1);
    const stroke = { stroke: color, strokeWidth: width };
    return [
      <line
        key={`l${String(index)}`}
        x1={10 + 16 * t}
        y1="0"
        x2={26 + 14 * t}
        y2="42"
        style={stroke}
      />,
      <line
        key={`r${String(index)}`}
        x1={54 - 16 * t}
        y1="0"
        x2={38 - 14 * t}
        y2="42"
        style={stroke}
      />,
    ];
  });
}

export function MedalPicture({ art }: { readonly art: MedalArt }) {
  const ribbon = { fill: art.ribbon };
  return (
    <svg aria-hidden viewBox="0 0 64 84" className={styles.picture}>
      <polygon
        points="10,0 26,0 40,40 26,44"
        style={{ fill: `color-mix(in srgb, ${art.ribbon} 80%, #000)` }}
      />
      <polygon points="54,0 38,0 24,40 38,44" style={ribbon} />
      <Stripes colors={art.stripes} />
      <circle cx="35" cy="59" r="22" style={ribbon} opacity="0.3" />
      <circle
        cx="32"
        cy="56"
        r="22"
        className={styles.disc}
        style={{ stroke: art.ribbon }}
      />
      <circle cx="32" cy="56" r="16.5" className={styles.discLine} />
      <Mark mark={art.mark} />
    </svg>
  );
}
