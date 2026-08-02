/**
 * The pointer-stroke machinery every dragging board shares, moved verbatim
 * out of `binairo/grid.tsx` (plan 020 §5.3, P19/P20).
 *
 * **Why it is here and why only now.** ADR-0029 consequence (b) is the
 * standing rule — *"a later contributor who wants to 'finish the job' by
 * hoisting the board into `play/` is undoing decision 2, not completing
 * it"* — and this is not the board: there is no JSX, no geometry, no game
 * vocabulary and no `styles` import below. Consequence (c) then names the
 * trigger in writing: *"the pointer-stroke machinery stays in
 * `binairo/grid.tsx` until #25 gives it a second consumer"*. #25's Nonogram
 * board drags, so the condition is met and this move is the execution of a
 * decision already recorded, not a new one.
 *
 * **The move is a move.** Every comment below is the one #18 paid for, kept
 * where it was written: the primary-button guard, the pointer-id scoping,
 * the `elementFromPoint` resolution, the capture net, and the reason a tap
 * in paint mode is resolved on `pointerup` rather than by the cell's own
 * `click`. A tidy-up while moving is how those findings come back.
 *
 * **`onStrokeEnd` is the one thing here that is new**, and it is the only
 * part that is a decision rather than a relocation: ADR-0037 decision (2)
 * owns it, and the Binairo retrofit is instructed to use it rather than
 * derive a second mechanism. It exists because pointer capture retargets
 * the trailing `click` to the container, so on a board whose caret lives in
 * state a stroke would otherwise leave DOM focus where it was.
 */
import { useRef, type PointerEvent as ReactPointerEvent } from "react";

/**
 * The five container handlers, as ONE object so a board cannot forget
 * `onLostPointerCapture` — the net that keeps a stroke from outliving its
 * own pointer (binairo/grid.tsx:123-131).
 */
export interface PointerStrokeHandlers {
  readonly onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => void;
  readonly onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => void;
  readonly onPointerUp: (e: ReactPointerEvent<HTMLDivElement>) => void;
  readonly onPointerCancel: (e: ReactPointerEvent<HTMLDivElement>) => void;
  readonly onLostPointerCapture: (e: ReactPointerEvent<HTMLDivElement>) => void;
}

export interface PointerStroke {
  readonly handlers: PointerStrokeHandlers;
  /**
   * True when the trailing pointer `click` must be ignored because this
   * stroke already wrote. `detail === 0` is a KEYBOARD activation and is
   * never suppressed (finding `drag-flag-kills-keyboard-cell-entry`).
   */
  readonly consumedClick: (event: { readonly detail: number }) => boolean;
}

export function usePointerStroke(input: {
  /** False disables the drag path entirely (Binairo's cycle mode). */
  readonly painting: boolean;
  readonly onTap: (index: number) => void;
  readonly onPaintOver: (index: number) => void;
  /**
   * Called once at `pointerup` with the cell the stroke ended on. The
   * composite-widget boards use it to move DOM focus; Binairo omits it.
   * This is the focus door pointer capture leaves open: the browser
   * retargets the trailing `click` to the CONTAINER, so a cell's own
   * `onClick` focus fix never runs during a stroke (grid.tsx:139-151).
   */
  readonly onStrokeEnd?: (index: number) => void;
}): PointerStroke {
  const { painting, onTap, onPaintOver, onStrokeEnd } = input;

  const dragging = useRef(false);
  const dragged = useRef(false);
  /** True once `onPointerUp` has already applied this stroke's tap. */
  const tapped = useRef(false);
  const startIndex = useRef<number | null>(null);
  const lastIndex = useRef<number | null>(null);
  /**
   * The pointer that opened the current stroke, or null when none is open.
   * Every handler below is scoped to it (finding
   * `grid-stroke-state-is-not-scoped-to-a-pointerid`): without this, a
   * second contact anywhere on the board — a palm, the holding thumb, a
   * deliberate second finger — ends the stroke the first finger is still
   * drawing, and every cell it goes on to cross writes nothing, with no
   * visual signal that input stopped. Verified in Chrome with real
   * multi-touch: a second finger tapping a given cell mid-drag silently
   * dropped the last two cells of a four-cell stroke.
   */
  const strokePointer = useRef<number | null>(null);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    // Primary button only, and before any ref is touched. A stroke that
    // never opens leaves `dragging.current` false, so `onPointerUp` below
    // no-ops on its own guard and a right- or middle-click writes nothing
    // (finding `right-button-pointerup-writes-a-cell`). It used to be
    // impossible: the browser fires `auxclick`, not `click`, for a
    // non-primary button, so the cell's own handler was never reached —
    // resolving the tap on `pointerup` is what made the button matter.
    // NOT `isPrimary`: a single touch contact reports `button === 0` and
    // `isPrimary === true`, and a pen contacting with the barrel button
    // held still reports `button === 0`, so touch and pen are untouched.
    if (event.button !== 0) {
      return;
    }
    // A stroke is already open: this is a second contact, and it must not
    // touch the first one's state. Returning here leaves every latch and
    // index belonging to the pointer that opened the stroke.
    if (strokePointer.current !== null) {
      return;
    }
    strokePointer.current = event.pointerId;
    dragged.current = false;
    tapped.current = false;
    dragging.current = painting;
    const index = cellIndexAt(event.clientX, event.clientY);
    startIndex.current = index;
    lastIndex.current = index;
    if (!painting) {
      return;
    }
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // jsdom and pens that release early both throw here; capture is an
      // optimisation, and `elementFromPoint` resolves the cell either way.
    }
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging.current || event.pointerId !== strokePointer.current) {
      return;
    }
    // Required, not defensive: under pointer capture — and on touch
    // generally — `pointerenter` never fires on the cells being crossed, so
    // the only way to know which cell is under the pointer is to ask.
    const index = cellIndexAt(event.clientX, event.clientY);
    if (index === null || index === lastIndex.current) {
      return;
    }
    if (!dragged.current) {
      dragged.current = true;
      // The cell the stroke began on: `click` will be suppressed below, so
      // without this the first cell of every drag would be skipped.
      if (startIndex.current !== null) {
        onPaintOver(startIndex.current);
      }
    }
    lastIndex.current = index;
    onPaintOver(index);
  };

  const endDrag = () => {
    dragging.current = false;
    strokePointer.current = null;
  };

  /**
   * Scoped end: only the pointer that opened the stroke may close it.
   *
   * The safety net against the obvious hazard — a stroke whose `pointerup`
   * never arrives would latch the board dead — is `onLostPointerCapture` on
   * the container, which the browser fires whenever capture ends for ANY
   * reason (release, cancel, the element leaving the document). A stroke can
   * therefore never outlive its own pointer.
   */
  const endStroke = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerId !== strokePointer.current) {
      return;
    }
    endDrag();
  };

  /**
   * A tap in paint/erase mode is resolved HERE, never by the cell's `click`
   * (finding `paint-mode-tap-dead-under-pointer-capture`). `onPointerDown`
   * takes pointer capture on this container, and the browser then retargets
   * the trailing `click` to the container too — so the cell button's own
   * handler is never in that event's propagation path and a stationary tap
   * would write nothing at all. Issue #18 asks for "tap-to-cycle plus a
   * paint mode"; without this, paint and erase are drag-only.
   *
   * Both latches below are set here and cleared by the NEXT `pointerdown`,
   * so the state a `click` reads always belongs to the stroke that produced
   * it.
   *
   * `onStrokeEnd` is handed the ending cell HERE and nowhere else, after the
   * stroke is closed: a consumer that moves DOM focus can then fire whatever
   * focus handlers it likes against a hook that no longer has a stroke open.
   * The end cell is read once and reused as the tap comparison, so the two
   * can never disagree about where the pointer lifted.
   */
  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    // A second contact lifting must not resolve — or end — the first
    // contact's stroke.
    if (event.pointerId !== strokePointer.current) {
      return;
    }
    const start = startIndex.current;
    const end = cellIndexAt(event.clientX, event.clientY);
    if (
      dragging.current &&
      !dragged.current &&
      start !== null &&
      end === start
    ) {
      tapped.current = true;
      onTap(start);
    }
    endDrag();
    if (end !== null) {
      // Lifting outside the board hands nothing back: there is no cell to
      // focus, and inventing one would move the caret somewhere the player
      // never pointed.
      onStrokeEnd?.(end);
    }
  };

  return {
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: endStroke,
      onLostPointerCapture: endStroke,
    },
    consumedClick: (event) =>
      // A drag has already applied every cell it crossed and a paint tap was
      // already applied on `pointerup`; the browser fires a trailing `click`
      // on top of both, and where `tap` TOGGLES, honouring it would undo
      // what the stroke wrote. `detail` is 0 for a keyboard activation and
      // >= 1 for a pointer one, so Enter/Space still writes while a latch is
      // up (finding `drag-flag-kills-keyboard-cell-entry`).
      event.detail > 0 && (dragged.current || tapped.current),
  };
}

/** The cell under a client point, or `null` outside the board. */
function cellIndexAt(x: number, y: number): number | null {
  const target = document.elementFromPoint(x, y);
  const cell = target?.closest("[data-cell-index]");
  const raw = cell?.getAttribute("data-cell-index");
  if (raw === null || raw === undefined) {
    return null;
  }
  const index = Number.parseInt(raw, 10);
  return Number.isInteger(index) ? index : null;
}
