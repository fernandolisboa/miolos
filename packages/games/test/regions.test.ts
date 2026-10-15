import { describe, expect, it } from "vitest";

import { floodRegion, neighbours, relabel } from "../src/regions";

describe("the shared region helpers", () => {
  it("lists a cell's orthogonal neighbours inside the board", () => {
    expect(neighbours(3, 0)).toEqual([1, 3]);
    expect(neighbours(3, 4)).toEqual([1, 3, 5, 7]);
    expect(neighbours(3, 8)).toEqual([5, 7]);
  });

  it("floods only the 4-connected cells of the start's region", () => {
    const regions = [0, 0, 1, 1, 0, 1, 0, 1, 1];
    expect([...floodRegion(3, regions, 0)].sort()).toEqual([0, 1, 4]);
    expect([...floodRegion(3, regions, 6)]).toEqual([6]);
  });

  it("renumbers regions by first appearance", () => {
    expect(relabel([4, 4, 2, 7, 2, 4])).toEqual([0, 0, 1, 2, 1, 0]);
  });
});
