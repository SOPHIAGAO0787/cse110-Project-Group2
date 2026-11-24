import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import type { TowerShopView } from "./TowerShopView";
import { TowerShopScreen } from "./TowerShopScreen";
import { TowerProgress } from "../../model/TowerProgress";
import { GameModel } from "../../model/GameModel";
import { loadMap } from "../../model/loadContent";
import map1 from "../../data/maps/map1.json";

type ShopCallbacks = ConstructorParameters<typeof TowerShopView>[0];
type ShopState = Parameters<TowerShopView["render"]>[0];

// Record what the screen asks the view to display.
const view = vi.hoisted(() => ({
  render: vi.fn(),
  showPopup: vi.fn(),
  clickAction: () => {},
  selectTower: (_id: string) => {},
}));

// Replace drawing with simple functions for these tests.
vi.mock("./TowerShopView", () => ({
  TowerShopView: class {
    group = {};
    render = view.render;
    showPopup = view.showPopup;

    constructor(callbacks: ShopCallbacks) {
      view.clickAction = callbacks.onAction;
      view.selectTower = callbacks.onSelect;
    }
  },
}));

function displayedState(): ShopState {
  return view.render.mock.lastCall![0];
}

describe("Tower shop UI interactions", () => {
  let progress: TowerProgress;
  let onBuy: Mock<() => void>;

  beforeEach(() => {
    vi.clearAllMocks();

    progress = new TowerProgress();

    onBuy = vi.fn();
    new TowerShopScreen({ switchTo: vi.fn() }, progress, onBuy);
  });

  it("provides the tower's cost and abilities to the view", () => {
    const state = displayedState();
    const tower = state.towers.find((item) => item.def.id === "circle")!;

    expect(tower.def.name).toBe("Circle Tower");
    expect(tower.def.description).toBe("Hits enemies inside a circle around it.");
    expect(tower.unlockCost).toBe(tower.def.cost);
    expect(tower.levels[0].damage).toBe(5);
    expect(tower.levels[0].attackSpeed).toBe(1);
    expect(tower.levels[0].radius).toBe(2.5);
  });

  it("provides the next upgrade's cost and improved abilities", () => {
    const tower = displayedState().towers.find((item) => item.def.id === "circle")!;

    const current = tower.levels[0];
    const next = tower.levels[1];

    expect(current.upgradeCost).toBe(75);
    expect(next.damage).toBeGreaterThan(current.damage);
    expect(next.attackSpeed).toBeGreaterThan(current.attackSpeed);
    expect(next.radius).toBeGreaterThan(current.radius);
  });

  it("upgrades Circle and updates shared progress", () => {
    view.clickAction();

    const state = displayedState();

    expect(state.coins).toBe(125);
    expect(state.levels.get("circle")).toBe(1);
    expect(progress.shopCoins).toBe(125);
    expect(progress.getMaxLevel("circle")).toBe(1);
    expect(view.showPopup).not.toHaveBeenCalled();
    expect(onBuy).toHaveBeenCalledTimes(1);
  });

  it("requests a popup without changing coins or level when funds are insufficient", () => {
    progress.shopCoins = 50;

    const rendersBeforeAttempt = view.render.mock.calls.length;

    view.clickAction(); // The first upgrade costs 75; only 50 are available.

    expect(view.showPopup).toHaveBeenCalledWith(
      "You need 75 coins, but have 50.\nEarn 25 more coins.",
    );
    expect(progress.shopCoins).toBe(50);
    expect(progress.getMaxLevel("circle")).toBe(0);
    expect(view.render).toHaveBeenCalledTimes(rendersBeforeAttempt);
    expect(onBuy).not.toHaveBeenCalled();
  });

  it.each(["triangle", "rectangle"])(
    "unlocks %s and buys both upgrades for use in the game",
    (id) => {
      progress.shopCoins = 1000;
      view.selectTower(id);
      const shopTower = displayedState().towers.find((tower) => tower.def.id === id)!;
      const game = new GameModel(loadMap(map1), progress);
      game.wallet.add(1000);

      expect(game.tryPlaceTower(id, { x: 0, y: 2 })).toBe("locked");
      view.clickAction();
      expect(game.tryPlaceTower(id, { x: 0, y: 2 })).toBe("ok");
      const tower = game.towers[0];
      const originalConfig = { ...tower.config };
      const originalRange = tower.range;
      const baseRate = tower.fireRate;
      const baseSpeed = tower.def.fireRatePerSec;
      let shopCoins = 1000 - shopTower.unlockCost;

      for (let level = 1; level <= 2; level++) {
        expect(game.tryUpgradeTower(tower.id)).toContain("Tower Shop");
        view.clickAction();
        shopCoins -= shopTower.levels[level - 1].upgradeCost!;
        expect(progress.shopCoins).toBe(shopCoins);
        expect(progress.getMaxLevel(id)).toBe(level);

        const gameCoins = game.wallet.coins;
        expect(game.tryUpgradeTower(tower.id)).toContain(`Level ${level + 1}`);
        expect(game.wallet.coins).toBe(gameCoins - shopTower.levels[level - 1].upgradeCost!);
        expect(tower.def.damage).toBe(shopTower.levels[level].damage);
        expect(tower.fireRate).toBeCloseTo(
          (baseRate * shopTower.levels[level].attackSpeed) / baseSpeed,
        );
        expect(tower.config).toEqual(originalConfig);
        expect(tower.range).toBe(originalRange);
      }

      view.clickAction();
      expect(progress.shopCoins).toBe(shopCoins);
      expect(progress.getMaxLevel(id)).toBe(2);
      expect(tower.level).toBe(2);
    },
  );
});
