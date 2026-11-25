// @vitest-environment jsdom
import "vitest-canvas-mock";
import { afterEach, expect, it } from "vitest";
import { MAPS } from "../../model/loadContent";
import { Progress } from "../../model/Progress";
import { TowerProgress } from "../../model/TowerProgress";
import { loadGame, SAVE_KEY } from "../../model/saveGame";
import { TowerShopScreen } from "./TowerShopScreen";

// A fresh set of models represents starting the app again after a refresh.
afterEach(() => localStorage.clear());

it("opens the shop after a refresh with an invalid saved level and keeps valid progress", () => {
  localStorage.setItem(
    SAVE_KEY,
    JSON.stringify({
      progress: { stars: { map1: 3 }, bonusCoins: 10 },
      towers: { shopCoins: 80, levels: { circle: 999, triangle: 1 } },
    }),
  );
  const progress = new Progress(MAPS);
  const towers = new TowerProgress();
  loadGame(progress, towers);

  // The original bug threw during construction when the shop read level 999's stats.
  const shop = new TowerShopScreen({ switchTo: () => {} }, towers, () => {});
  try {
    shop.resize(1200, 800);
    shop.show();
    expect(shop.group.visible()).toBe(true);
    expect(towers.getMaxLevel("circle")).toBe(0);
    expect(towers.getMaxLevel("triangle")).toBe(1);
    expect(towers.shopCoins).toBe(80);
    expect(progress.isUnlocked("map2")).toBe(true);
    expect(progress.bonusCoins).toBe(10);
  } finally {
    shop.hide();
    shop.group.destroy();
  }
});
