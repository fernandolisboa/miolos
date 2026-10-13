import fc from "fast-check";

import { WEEKDAYS } from "../src/weekday";

export const FC_SEED = 297_297;
export const seedArb = fc.integer({ min: 0, max: 0xffffffff });
export const weekdayArb = fc.constantFrom(...WEEKDAYS);
