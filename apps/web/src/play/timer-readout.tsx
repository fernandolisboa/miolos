import { formatElapsed, messages } from "../i18n";

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
      aria-label={messages.play.timerAria(formatted)}
    >
      {formatted}
    </span>
  );
}
