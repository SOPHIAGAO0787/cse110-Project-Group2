import { describe, it, expect } from "vitest";
import { Grid } from "./Grid";
import type { MapConfig } from "./types";

//      x0  x1  x2
// y0   #   P   .
// y1   #   #   #
// y2   #   #   #

const map: MapConfig = {
  id: "test",
  name: "test",
  cols: 3,
  rows: 3,
  tiles: ["#P.", "###","###"],
  path: [],
  startingCoins: 0,
  startingLives: 0,
  waves: [],
};

describe("Grid (B1)", () => {
  it("'#' tiles are buildable", () => {
    const grid = new Grid(map);
    expect(grid.isBuildable({ x: 0, y: 0 })).toBe(true);
    expect(grid.isBuildable({ x: 2, y: 1 })).toBe(true);
  });
  it("'P' and '.' tiles are not buildable", () => {
    const grid = new Grid(map);
    expect(grid.isBuildable({ x: 1, y: 0 })).toBe(false);
    expect(grid.isBuildable({ x: 2, y: 0 })).toBe(false);
  });
  it("tiles outside the map are not buildable", () => {
    const grid = new Grid(map);
    expect(grid.isBuildable({ x: 0, y: 5 })).toBe(false);
    expect(grid.isBuildable({ x: 5, y: 0 })).toBe(false);
    expect(grid.isBuildable({ x: 8, y: 5 })).toBe(false);
    expect(grid.isBuildable({ x: 0, y: -5 })).toBe(false);
  });
  it("an occupied tile is not buildable", () => {
    const grid = new Grid(map);
    expect(grid.isBuildable({ x: 1, y: 0 })).toBe(false);
    expect(grid.isBuildable({ x: 0, y: 0 })).toBe(true);
    grid.occupy({ x: 0, y: 0 });
    expect(grid.isBuildable({ x: 0, y: 0 })).toBe(false);
  });
});
