import { formatElapsed, messages } from "../i18n";

/**
 * The discreet count-up readout (plan 017 §8.3). Two of these render at
 * once — one in the mobile top bar, one in the desktop stats card — because
 * the responsive reflow moves the readout across subtrees, which no CSS
 * (and certainly not `display: contents`) can do (§12.2). The media queries
 * in the module hide exactly one of the pair, and `display: none` removes it
 * from the accessibility tree too, so a real browser exposes one timer.
 *
 * `role="timer"` rather than a bare `<span aria-label>`: ARIA prohibits
 * naming a generic element, so the mobile readout — which has no visible
 * "Tempo" label beside it — would otherwise be an unlabelled number. The
 * role's implicit live region is off, so nothing is announced on each tick.
 */
export function TimerReadout({
  elapsedMs,
  className,
}: {
  readonly elapsedMs: number;
  readonly className?: string;
}) {
  const formatted = formatElapsed(elapsedMs);
  return (
    <span
      className={className}
      role="timer"
      aria-label={messages.binairo.timerAria(formatted)}
    >
      {formatted}
    </span>
  );
}
