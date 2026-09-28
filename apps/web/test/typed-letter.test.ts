import { describe, expect, it } from "vitest";

import { typedLetter } from "../src/play/typed-letter";

describe("typedLetter is the one letter filter for Termo and the Cruzadinha (T-WEB-S442)", () => {
  it("lower-cases and strips a diacritic to its base letter", () => {
    expect(typedLetter("Á")).toBe("a");
    expect(typedLetter("ç")).toBe("c");
    expect(typedLetter("õ")).toBe("o");
    expect(typedLetter("K")).toBe("k");
  });

  it("rejects every key that is not one letter", () => {
    for (const key of ["Enter", "Shift", "1", " ", "", "ab", "ß", "-"]) {
      expect(typedLetter(key)).toBeNull();
    }
  });
});
