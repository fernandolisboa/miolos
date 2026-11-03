# ADR-0159 — The archive calendar picks months and years in place, on the client

**Status:** Accepted — 2026-11-03 (issue #461)

## Context

The archive showed a "Por mês" list of month buttons under its calendar. Fernando asked for the standard date-picker drill-down instead (#461): click the month title and the grid turns into the year's months; click the year and it turns into years. Only months and years with puzzles can be picked.

## Decision

1. **The view (days, months, years) is client state** in `CalendarPicker` (`app/arquivo/calendar-picker.tsx`). The day grid stays server-rendered and is passed in as `children`. `ArchiveBody` keys the picker by month, so a month link resets it to the days.
2. **All three grids are rendered from the first paint and stacked in one grid cell** (`.calendarViews`); the inactive ones are `inert`, `aria-hidden` and `visibility: hidden`. The card keeps the day view's size in every view.
3. **Choosing the month already on screen goes back to its days**; its cell is still a `Link` with its real `href`.
4. The title's accessible name is its visible text; the "Escolher outro mês/ano" hint is an `aria-describedby`. Escape climbs back one level.

## Consequences

- The month grid's `/arquivo/mes/YYYY-MM` hrefs are in the server HTML even in a one-month archive, which the impeccable workflow's discovery grep (ADR-0053 decision 12) needs now that the list is gone. Do not turn the stacked grids into conditional rendering: T-WEB-S167 pins the href.
- Without JavaScript the title does nothing; the previous/next month steps still reach every month.
- `/arquivo` and `/arquivo/mes/[mes]` now ship a small client chunk.

## Rejected

- **URL-driven views** (`?ver=meses`, server-rendered): no client JS, but every toggle is a server round trip with a database read and a history entry, which is not how a date picker behaves.
- **Keeping the month list beside the picker:** two controls for one choice.
