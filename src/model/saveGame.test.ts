// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MAPS } from "./loadContent";
import { Progress } from "./Progress";
import { loadGame, SAVE_KEY, saveGame } from "./saveGame";
import { SHOP_TOWERS } from "./shop/loadShopContent";
import { TowerProgress } from "./TowerProgress";

let progress: Progress;
let towerProgress: TowerProgress;

// Loads whatever is in storage into a fresh Progress and TowerProgress
function loadFresh(): void {
  progress = new Progress(MAPS);
  towerProgress = new TowerProgress();
  loadGame(progress, towerProgress);
}

// The values a brand new game starts with
function expectFreshStart(): void {
  for (const map of MAPS) {
    expect(progress.starsFor(map.id)).toBe(0);
  }
  expect(progress.isUnlocked("map2")).toBe(false);
  expect(progress.bonusCoins).toBe(0);
  expect(progress.tutorialDone).toBe(false);
  expect(towerProgress.shopCoins).toBe(new TowerProgress().shopCoins);
  expect(towerProgress.getMaxLevel("circle")).toBe(0);
  expect(towerProgress.getMaxLevel("triangle")).toBe(-1);
}

describe("saveGame and loadGame", () => {
  beforeEach(() => {
    localStorage.clear();
    // Broken saves print a warning; keep the test output clean
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("gives back the same stars, unlocks, coins, tutorial flag and tower levels", () => {
    const played = new Progress(MAPS);
    played.recordResult("map1", 3);
    played.recordResult("map2", 1);
    played.addMiniGameReward(2);
    played.tutorialDone = true;
    const shop = new TowerProgress();
    shop.shopCoins = 35;
    shop.maxLevels.set("circle", 2);
    shop.maxLevels.set("triangle", 0);
    saveGame(played, shop);

    loadFresh();
    expect(progress.starsFor("map1")).toBe(3);
    expect(progress.starsFor("map2")).toBe(1);
    expect(progress.starsFor("map3")).toBe(0);
    expect(progress.isUnlocked("map3")).toBe(true);
    expect(progress.isUnlocked("map4")).toBe(false);
    expect(progress.bonusCoins).toBe(played.bonusCoins);
    expect(progress.tutorialDone).toBe(true);
    expect(towerProgress.shopCoins).toBe(35);
    expect(towerProgress.getMaxLevel("circle")).toBe(2);
    expect(towerProgress.getMaxLevel("triangle")).toBe(0);
    expect(towerProgress.getMaxLevel("rectangle")).toBe(-1);
  });

  it("keeps everything under one key", () => {
    saveGame(new Progress(MAPS), new TowerProgress());
    expect(localStorage.length).toBe(1);
    expect(localStorage.getItem(SAVE_KEY)).not.toBeNull();
  });

  it("starts fresh when nothing is saved", () => {
    loadFresh();
    expectFreshStart();
  });

  it("starts fresh when the save is not valid JSON", () => {
    localStorage.setItem(SAVE_KEY, "{not json");
    loadFresh();
    expectFreshStart();
  });

  it("starts fresh when the save is not an object", () => {
    localStorage.setItem(SAVE_KEY, "null");
    loadFresh();
    expectFreshStart();

    localStorage.setItem(SAVE_KEY, "42");
    loadFresh();
    expectFreshStart();
  });

  it("skips values with the wrong type", () => {
    const save = {
      progress: {
        stars: { map1: "3", map2: 2.5, map3: -1 },
        bonusCoins: "10",
        tutorialDone: "yes",
      },
      towers: { shopCoins: null, levels: { triangle: "1", circle: true } },
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    loadFresh();
    expectFreshStart();

    localStorage.setItem(SAVE_KEY, JSON.stringify({ progress: 5, towers: "x" }));
    loadFresh();
    expectFreshStart();
  });

  it("skips stars and bonus coins above the maximum", () => {
    const save = { progress: { stars: { map1: 4 }, bonusCoins: 9999 }, towers: {} };
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    loadFresh();
    expectFreshStart();
  });

  it.each(SHOP_TOWERS)("ignores an out-of-range saved level for $def.id", (tower) => {
    const save = {
      towers: { shopCoins: 80, levels: { [tower.def.id]: tower.levels.length } },
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    loadFresh();
    expect(towerProgress.getMaxLevel(tower.def.id)).toBe(
      new TowerProgress().getMaxLevel(tower.def.id),
    );
    expect(towerProgress.shopCoins).toBe(80);
  });

  it("ignores tower IDs that no longer exist", () => {
    localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({ towers: { levels: { removedTower: 0, triangle: 1 } } }),
    );
    loadFresh();
    expect(towerProgress.getMaxLevel("removedTower")).toBe(-1);
    expect(towerProgress.getMaxLevel("triangle")).toBe(1);
  });

  it.each(SHOP_TOWERS)("restores the highest available level for $def.id", (tower) => {
    const level = tower.levels.length - 1;
    localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({ towers: { levels: { [tower.def.id]: level } } }),
    );
    loadFresh();
    expect(towerProgress.getMaxLevel(tower.def.id)).toBe(level);
  });

  it("keeps the good values from a partly broken save", () => {
    const save = {
      progress: { stars: { map1: 2, map2: "x" }, bonusCoins: "x" },
      towers: { shopCoins: 80, levels: { circle: "x", triangle: 1 } },
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    loadFresh();
    expect(progress.starsFor("map1")).toBe(2);
    expect(progress.starsFor("map2")).toBe(0);
    expect(progress.bonusCoins).toBe(0);
    expect(towerProgress.shopCoins).toBe(80);
    expect(towerProgress.getMaxLevel("circle")).toBe(0);
    expect(towerProgress.getMaxLevel("triangle")).toBe(1);
  });
});
