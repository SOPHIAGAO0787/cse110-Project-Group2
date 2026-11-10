import { describe, expect, it } from "vitest";
import { MAPS } from "./loadContent";
import { Progress } from "./Progress";

describe("Progress", () => {
  it("starts on the first map with only that map unlocked", () => {
    const progress = new Progress(MAPS);
    expect(progress.currentMapId).toBe("map1");
    expect(progress.isUnlocked("map1")).toBe(true);
    expect(progress.isUnlocked("map2")).toBe(false);
    expect(progress.isUnlocked("map4")).toBe(false);
  });

  it("starts with no stars on any map", () => {
    const progress = new Progress(MAPS);
    for (const map of MAPS) {
      expect(progress.starsFor(map.id)).toBe(0);
    }
  });

  it("unlocks only the next map after a win", () => {
    const progress = new Progress(MAPS);
    progress.recordResult("map1", 2);
    expect(progress.isUnlocked("map2")).toBe(true);
    expect(progress.isUnlocked("map3")).toBe(false);
  });

  it("unlocks nothing after a loss", () => {
    const progress = new Progress(MAPS);
    progress.recordResult("map1", 0);
    expect(progress.isUnlocked("map2")).toBe(false);
  });

  it("keeps the best stars when a later game does worse", () => {
    const progress = new Progress(MAPS);
    progress.recordResult("map1", 3);
    progress.recordResult("map1", 1);
    progress.recordResult("map1", 0);
    expect(progress.starsFor("map1")).toBe(3);
    expect(progress.isUnlocked("map2")).toBe(true);
  });

  it("raises the stars when a later game does better", () => {
    const progress = new Progress(MAPS);
    progress.recordResult("map1", 1);
    progress.recordResult("map1", 3);
    expect(progress.starsFor("map1")).toBe(3);
  });

  it("records a win on the last map", () => {
    const progress = new Progress(MAPS);
    progress.recordResult("map4", 2);
    expect(progress.starsFor("map4")).toBe(2);
  });

  it("throws for an unknown map", () => {
    const progress = new Progress(MAPS);
    expect(() => progress.isUnlocked("map9")).toThrow(/map9/);
  });
});
