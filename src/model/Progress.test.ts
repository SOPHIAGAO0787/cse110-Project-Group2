import { describe, expect, it } from "vitest";
import { MAPS } from "./loadContent";
import { COINS_PER_CORRECT_ANSWER, Progress } from "./Progress";

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

describe("Progress mini-game rewards", () => {
  it("starts with no bonus coins", () => {
    const progress = new Progress(MAPS);
    expect(progress.bonusCoins).toBe(0);
  });

  it("gives coins for each correct answer and adds up rounds", () => {
    const progress = new Progress(MAPS);
    progress.addMiniGameReward(3);
    progress.addMiniGameReward(2);
    expect(progress.bonusCoins).toBe(5 * COINS_PER_CORRECT_ANSWER);
  });

  it("gives nothing for a round with no correct answers", () => {
    const progress = new Progress(MAPS);
    progress.addMiniGameReward(0);
    progress.addMiniGameReward(-1);
    expect(progress.bonusCoins).toBe(0);
  });

  it("clears the bonus once a game uses it", () => {
    const progress = new Progress(MAPS);
    progress.addMiniGameReward(4);
    progress.useBonusCoins();
    expect(progress.bonusCoins).toBe(0);
  });

  it("never changes stars or unlocks", () => {
    const progress = new Progress(MAPS);
    progress.addMiniGameReward(10);
    expect(progress.isUnlocked("map2")).toBe(false);
    for (const map of MAPS) {
      expect(progress.starsFor(map.id)).toBe(0);
    }
  });

  it("keeps the bonus when a game is won or lost", () => {
    const progress = new Progress(MAPS);
    progress.addMiniGameReward(2);
    progress.recordResult("map1", 3);
    progress.recordResult("map2", 0);
    expect(progress.bonusCoins).toBe(2 * COINS_PER_CORRECT_ANSWER);
  });
});
