import { describe, expect, it } from "vitest";
import { loadMap } from "./loadContent";
import map1 from "../data/maps/map1.json";

// A tiny valid map: path runs left to right along row 1
function validMap() {
  return {
    id: "test",
    name: "Test",
    cols: 4,
    rows: 3,
    tiles: ["#...", "PPPP", "...#"],
    path: [
      { x: 0, y: 1 },
      { x: 3, y: 1 },
    ],
    startingCoins: 100,
    startingLives: 20,
    waves: [{ groups: [{ enemy: "basic", count: 3, intervalSec: 1 }] }],
  };
}

describe("loadMap", () => {
  it("accepts the real Map 1", () => {
    const map = loadMap(map1);
    expect(map.cols).toBe(16);
    expect(map.tiles).toHaveLength(map.rows);
  });

  it("accepts a valid map", () => {
    expect(loadMap(validMap()).id).toBe("test");
  });

  it("rejects a map whose row count doesn't match rows", () => {
    const map = { ...validMap(), rows: 4 };
    expect(() => loadMap(map)).toThrow(/rows/);
  });

  it("rejects a row with the wrong width", () => {
    const map = { ...validMap(), tiles: ["#...", "PPPPP", "...#"] };
    expect(() => loadMap(map)).toThrow(/row 1/);
  });

  it("rejects an unknown tile character", () => {
    const map = { ...validMap(), tiles: ["#..x", "PPPP", "...#"] };
    expect(() => loadMap(map)).toThrow(/'x'/);
  });

  it("rejects a diagonal path segment", () => {
    const map = {
      ...validMap(),
      tiles: ["#...", "PPPP", "...P"],
      path: [
        { x: 0, y: 1 },
        { x: 3, y: 2 },
      ],
    };
    expect(() => loadMap(map)).toThrow(/diagonal/);
  });

  it("rejects a path point that is not on a 'P' tile", () => {
    const map = {
      ...validMap(),
      path: [
        { x: 0, y: 1 },
        { x: 3, y: 0 },
      ],
    };
    expect(() => loadMap(map)).toThrow(/\(3, 0\)/);
  });
});
