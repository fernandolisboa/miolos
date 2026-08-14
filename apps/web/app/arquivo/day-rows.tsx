import Link from "next/link";

import type { ArchiveDayGroup } from "../../src/archive/group-days";
import {
  archiveDayRoute,
  formatDayInMonth,
  formatLongDate,
  messages,
} from "../../src/i18n";
import { accentVars } from "../../src/play/accent";
import styles from "./arquivo.module.css";

/**
 * The archive's day rows — ONE component, rendered by the index's "Dias
 * recentes" section and by every month page (#31, plan 037 §7.5). A second
 * copy is how the two surfaces drift, and the day page exists precisely so
 * this row can be one date link instead of four game links.
 *
 * Each row is one `<Link>` and one touch target ≥44px. The game names carry
 * their game's accent as a 3px left RULE (a shape, ADR-0041 decision 1) and
 * never as text colour; the row's accessible name is one composed sentence
 * naming the date and the games, so the rules never carry meaning alone
 * (ADR-0041 decision 5).
 *
 * `prefetch={false}` on every row: a month page holds up to 31 of these into
 * a `force-dynamic`, database-reading route family, and Next's default
 * viewport prefetch would turn one page view into up to 31 extra RSC
 * requests. **The cost is smaller than this comment used to claim, and the
 * measured figure is what stands** (step-6 group 5): against the real build
 * — Next 16.2.12, no PPR, no `loading.tsx` — a prefetch of a `force-dynamic`
 * route returns a **160-byte tree and issues zero database queries**, so the
 * bill is ~31 tiny requests rather than "dozens of RSC requests against
 * database-reading routes". The guard stays: it costs nothing, it is the
 * multiplier ADR-0053 decision 2's revisit trigger watches for, and the
 * overstated version becomes true the day `cacheComponents`/PPR is enabled.
 *
 * `dateFormat` is what the index and a month page differ by, and only that
 * (step-6 F9). On a month page the `<h1>` already states the month and the
 * year, so a row that repeats them in all 31 rows leaves the page with about
 * six distinct words in it; the index's rows span months, so there the full
 * date is the varying part. The SAME string feeds the visible text and the
 * row's accessible name, which is what keeps WCAG 2.5.3's label-in-name true
 * in both modes.
 */
export function DayRows({
  groups,
  dateFormat = "long",
}: {
  readonly groups: readonly ArchiveDayGroup[];
  readonly dateFormat?: "long" | "dayInMonth";
}) {
  return (
    <ul className={styles.rows}>
      {groups.map((group) => {
        const label =
          dateFormat === "long"
            ? formatLongDate(group.date)
            : formatDayInMonth(group.date);
        const names: readonly string[] = group.games.map(
          (game) => messages.games[game].name,
        );
        return (
          <li key={group.date} className={styles.row}>
            <Link
              className={styles.rowLink}
              href={archiveDayRoute(group.date)}
              prefetch={false}
              aria-label={messages.archive.dayRowAria(label, names)}
            >
              <span className={styles.rowDate}>{label}</span>
              {/* A SHORT day renders fewer names and nothing else — no
                  placeholder, no greyed slot, no "3 de 4". `aria-hidden`
                  because the row's own label already names them, composed
                  as one sentence. */}
              <span aria-hidden className={styles.rowGames}>
                {group.games.map((game) => (
                  <span
                    key={game}
                    className={styles.rowGame}
                    style={accentVars(game)}
                  >
                    {messages.games[game].name}
                  </span>
                ))}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
