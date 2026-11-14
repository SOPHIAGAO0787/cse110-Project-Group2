import { describe, expect, it } from "vitest";
import { findMap, loadMap, MAPS } from "./loadContent";
import map1 from "../data/maps/map1.json";

// A tiny valid map: path runs left to right along row 1
function validMap() {
  return {
    id: "test",
    name: "Test",
    colors: { buildable: "#00ff00", path: "#996633", blocked: "#000000" },
    decoration: "trees",
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

  it("rejects a map without colors", () => {
    const map = { ...validMap(), colors: undefined };
    expect(() => loadMap(map)).toThrow(/colors/);
  });

  it("rejects a map whose colors are null", () => {
    const map = { ...validMap(), colors: null };
    expect(() => loadMap(map)).toThrow(/colors/);
  });

  it("rejects a map missing one of its colors", () => {
    const map = { ...validMap(), colors: { buildable: "#00ff00", path: "#996633" } };
    expect(() => loadMap(map)).toThrow(/colors/);
  });

  it("rejects an unknown decoration", () => {
    const map = { ...validMap(), decoration: "flowers" };
    expect(() => loadMap(map)).toThrow(/flowers/);
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

describe("MAPS", () => {
  it("has four maps with different ids", () => {
    expect(MAPS).toHaveLength(4);
    const ids: string[] = [];
    for (const map of MAPS) {
      expect(ids).not.toContain(map.id);
      ids.push(map.id);
    }
  });

  // The game screen's layout is made for this size
  it("makes every map 16 by 10 tiles", () => {
    for (const map of MAPS) {
      expect(map.cols).toBe(16);
      expect(map.rows).toBe(10);
    }
  });

  it("starts with map1", () => {
    expect(MAPS[0].id).toBe("map1");
  });
});

describe("findMap", () => {
  it("finds a map by its id", () => {
    expect(findMap("map2").name).toBe("Angle Canyon");
  });

  it("throws for an unknown id", () => {
    expect(() => findMap("map9")).toThrow(/map9/);
  });
});
