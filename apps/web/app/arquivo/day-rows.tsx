import Link from "next/link";

import type { ArchiveDayGroup } from "../../src/archive/group-days";
import { archiveDayRoute, formatLongDate, messages } from "../../src/i18n";
import { accentVars } from "../../src/play/accent";
import styles from "./arquivo.module.css";

/**
 * The archive's day rows — ONE component, rendered by the index's "Dias
 * recentes" section and by every month page (#31, plan 037 §7.5). A second
 * copy is how the two surfaces drift, and the day page exists precisely so
 * this row can be one date link instead of four game links.
 *
 * Each row is one `<Link>` and one touch target ≥44px. The game names carry
 * their game's accent as a 2px left RULE (a shape, ADR-0041 decision 1) and
 * never as text colour; the row's accessible name is one composed sentence
 * naming the date and the games, so the rules never carry meaning alone
 * (ADR-0041 decision 5).
 *
 * `prefetch={false}` on every row: a month page holds up to 31 of these into
 * a `force-dynamic`, database-reading route family, and Next's default
 * viewport prefetch would turn one page view into dozens of RSC requests —
 * the exact multiplier ADR-0053 decision 2's own revisit trigger watches
 * for, produced by the framework rather than by traffic.
 */
export function DayRows({
  groups,
}: {
  readonly groups: readonly ArchiveDayGroup[];
}) {
  return (
    <ul className={styles.rows}>
      {groups.map((group) => {
        const longDate = formatLongDate(group.date);
        const names: readonly string[] = group.games.map(
          (game) => messages.games[game].name,
        );
        return (
          <li key={group.date} className={styles.row}>
            <Link
              className={styles.rowLink}
              href={archiveDayRoute(group.date)}
              prefetch={false}
              aria-label={messages.archive.dayRowAria(longDate, names)}
            >
              <span className={styles.rowDate}>{longDate}</span>
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
