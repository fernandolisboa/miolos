import { afterEach, describe, expect, it } from "vitest";

import { formatElapsed, formatLongDate, formatShortDate } from "../src/i18n";

// T-WEB-22 (plan 017 §15). The formatters render the PUZZLE's calendar day,
// which is a server-derived string, never `new Date()` — so the host clock's
// timezone may not shift the rendered day by one. The offsets below bracket
// the real world: Kiritimati is UTC+14 (the day is already over there when
// São Paulo starts it) and Baker Island is UTC-12.
const originalTz = process.env.TZ;

function withTimeZone(timeZone: string | undefined, run: () => void) {
  // Node re-reads process.env.TZ on the next Date/Intl construction, so the
  // assignment is enough — no module reload needed.
  process.env.TZ = timeZone;
  try {
    run();
  } finally {
    process.env.TZ = originalTz;
  }
}

afterEach(() => {
  process.env.TZ = originalTz;
});

describe("formatLongDate", () => {
  it("renders the puzzle's own calendar day in pt-BR", () => {
    expect(formatLongDate("2026-07-30")).toBe("30 de julho de 2026");
  });

  it("renders the same day under a UTC+14 and a UTC-12 host clock", () => {
    withTimeZone("Pacific/Kiritimati", () => {
      expect(formatLongDate("2026-07-30")).toBe("30 de julho de 2026");
    });
    withTimeZone("Etc/GMT+12", () => {
      expect(formatLongDate("2026-07-30")).toBe("30 de julho de 2026");
    });
  });

  it("does not roll over at the edges of a month or a year", () => {
    expect(formatLongDate("2026-01-01")).toBe("1 de janeiro de 2026");
    expect(formatLongDate("2026-12-31")).toBe("31 de dezembro de 2026");
    expect(formatLongDate("2024-02-29")).toBe("29 de fevereiro de 2024");
  });
});

describe("formatShortDate", () => {
  it("renders day and abbreviated month with no connective and no full stop", () => {
    expect(formatShortDate("2026-07-30")).toBe("30 jul");
  });

  it("renders the same day under a UTC+14 and a UTC-12 host clock", () => {
    withTimeZone("Pacific/Kiritimati", () => {
      expect(formatShortDate("2026-07-30")).toBe("30 jul");
    });
    withTimeZone("Etc/GMT+12", () => {
      expect(formatShortDate("2026-07-30")).toBe("30 jul");
    });
  });

  it("never contains the pt-BR connective the long form uses", () => {
    expect(formatShortDate("2026-01-01")).not.toContain(" de ");
  });
});

describe("formatElapsed", () => {
  it("renders a count-up clock, zero-padded under an hour", () => {
    expect(formatElapsed(0)).toBe("00:00");
    expect(formatElapsed(272_000)).toBe("04:32");
    expect(formatElapsed(59_999)).toBe("00:59");
  });

  it("grows an hours field only once there is an hour to show", () => {
    expect(formatElapsed(3_599_999)).toBe("59:59");
    expect(formatElapsed(3_600_000)).toBe("1:00:00");
    expect(formatElapsed(3_872_000)).toBe("1:04:32");
    expect(formatElapsed(86_399_000)).toBe("23:59:59");
  });

  it("floors partial seconds and never renders a negative clock", () => {
    expect(formatElapsed(1_999)).toBe("00:01");
    expect(formatElapsed(-5_000)).toBe("00:00");
  });
});
