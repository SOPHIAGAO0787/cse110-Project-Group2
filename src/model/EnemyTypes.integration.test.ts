import { describe, expect, it } from "vitest";
import enemies from "../data/enemies.json";
import map1 from "../data/maps/map1.json";
import map2 from "../data/maps/map2.json";
import map3 from "../data/maps/map3.json";
import map4 from "../data/maps/map4.json";

describe("Enemy type configurations", () => {
  const maps = [map1, map2, map3, map4];
  const validIds = new Set(enemies.map((enemy) => enemy.id));

  it("uses only defined enemy types", () => {
    for (const map of maps) {
      for (const wave of map.waves) {
        for (const group of wave.groups) {
          expect(validIds.has(group.enemy)).toBe(true);
        }
      }
    }
  });

  it("preserves the expected enemy counts", () => {
    const expectedCounts = [
      [5, 8],
      [6, 9, 12],
      [8, 10, 14],
      [8, 12, 14, 18],
    ];

    maps.forEach((map, index) => {
      const counts = map.waves.map((wave) =>
        wave.groups.reduce((total, group) => total + group.count, 0),
      );

      expect(counts).toEqual(expectedCounts[index]);
    });
  });

  it("introduces fast and tank enemies progressively", () => {
    for (const map of maps) {
      const firstWaveTypes = map.waves[0].groups.map((group) => group.enemy);

      expect(firstWaveTypes).toEqual(["basic"]);

      const laterTypes = map.waves
        .slice(1)
        .flatMap((wave) => wave.groups.map((group) => group.enemy));

      expect(laterTypes).toContain("fast");

      if (map.waves.length >= 3) {
        expect(laterTypes).toContain("tank");
      }
    }
  });
});
