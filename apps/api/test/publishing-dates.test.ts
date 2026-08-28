import { describe, expect, it } from "vitest";

import { addDays, isoWeekdayOf } from "../src/publishing/dates";

describe("addDays", () => {
  it("crosses month and year ends, leap days included", () => {
    expect(addDays("2026-08-31", 1)).toBe("2026-09-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2027-02-28", 1)).toBe("2027-03-01");
    expect(addDays("2026-08-01", 0)).toBe("2026-08-01");
    expect(addDays("2026-08-01", 6)).toBe("2026-08-07");
  });

  it("rejects a non-ISO date", () => {
    expect(() => addDays("01/08/2026", 1)).toThrow(RangeError);
  });
});

describe("isoWeekdayOf", () => {
  it("maps 2026-08-03 to Monday (1) and 2026-08-02 to Sunday (7)", () => {
    expect(isoWeekdayOf("2026-08-03")).toBe(1);
    expect(isoWeekdayOf("2026-08-02")).toBe(7);
    expect(isoWeekdayOf("2026-08-01")).toBe(6);
  });

  it("rejects a non-ISO date", () => {
    expect(() => isoWeekdayOf("2026-8-3")).toThrow(RangeError);
  });
});
