import { describe, expect, it } from "vitest";
import map1 from "../data/maps/map1.json";
import { GameModel } from "./GameModel";
import { loadMap } from "./loadContent";
import { PlayerProgress } from "./PlayerProgress";
import { SHOP_TOWERS } from "./shop/loadShopContent";

const circle = SHOP_TOWERS.find((tower) => tower.def.id === "circle")!;

function createGame(maxLevel: number) {
  const progress = new PlayerProgress();
  progress.maxLevels.set("circle", maxLevel);

  const game = new GameModel(loadMap(map1), progress);
  expect(game.tryPlaceTower("circle", { x: 0, y: 2 })).toBe("ok");
  return game;
}

describe("GameModel.tryUpgradeTower", () => {
  it("emits towerFired when an upgraded tower attacks and awards kill coins", () => {
    const game = createGame(1);
    game.wallet.add(200);
    const tower = game.towers[0];
    game.tryUpgradeTower(tower.id);
    game.spawnEnemy("basic");
    const enemy = game.enemies[0];
    enemy.hp = tower.def.damage;
    const coinsBefore = game.wallet.coins;
    const fired: number[] = [];
    game.events.on("towerFired", (event) => fired.push(event.towerId));

    game.tick(0.016);

    expect(fired).toEqual([tower.id]);
    expect(game.enemies).toHaveLength(0);
    expect(game.wallet.coins).toBe(coinsBefore + enemy.def.reward);

    game.tick(0.016);
    expect(fired).toEqual([tower.id]);
  });

  it("spends coins and applies the next level's damage, speed, and range", () => {
    const game = createGame(1);
    game.wallet.add(200);
    const coinsBefore = game.wallet.coins;
    const tower = game.towers[0];
    const next = circle.levels[1];

    expect(game.tryUpgradeTower(tower.id)).toBe("Circle Tower upgraded to Level 2.");

    expect(tower.level).toBe(1);
    expect(tower.def.damage).toBe(next.damage);
    expect(tower.def.fireRatePerSec).toBe(next.attackSpeed);
    expect(tower.def.range.radius).toBe(next.radius);
    expect(tower.range.contains({ x: next.radius, y: 2 })).toBe(true);
    expect(game.wallet.coins).toBe(coinsBefore - circle.levels[0].upgradeCost!);
  });

  it("refuses an upgrade beyond the purchased cap without spending coins", () => {
    const game = createGame(0);
    game.wallet.add(200);
    const coinsBefore = game.wallet.coins;

    expect(game.tryUpgradeTower(game.towers[0].id)).toContain("Tower Shop");
    expect(game.towers[0].level).toBe(0);
    expect(game.wallet.coins).toBe(coinsBefore);
  });

  it("keeps the stats and coins unchanged when the upgrade is unaffordable", () => {
    const game = createGame(1);
    const tower = game.towers[0];
    const statsBefore = structuredClone(tower.def);
    const coinsBefore = game.wallet.coins;

    expect(game.tryUpgradeTower(tower.id)).toContain("coins to upgrade");
    expect(tower.level).toBe(0);
    expect(tower.def).toEqual(statsBefore);
    expect(game.wallet.coins).toBe(coinsBefore);
  });

  it("does not upgrade other placed towers or the base definition", () => {
    const game = createGame(1);
    game.wallet.add(200);
    expect(game.tryPlaceTower("circle", { x: 1, y: 2 })).toBe("ok");
    const baseBefore = structuredClone(circle.def);

    game.tryUpgradeTower(game.towers[0].id);

    expect(game.towers[1].level).toBe(0);
    expect(game.towers[1].def).toEqual(baseBefore);
    expect(circle.def).toEqual(baseBefore);
  });

  it("rejects an unknown tower without spending coins", () => {
    const game = createGame(1);
    const coinsBefore = game.wallet.coins;

    expect(game.tryUpgradeTower(999)).toBe("Tower not found.");
    expect(game.wallet.coins).toBe(coinsBefore);
  });

  it("refuses upgrades after the game ends", () => {
    const game = createGame(1);
    game.wallet.add(200);
    game.lives.remaining = 0;
    game.tick(0);
    const coinsBefore = game.wallet.coins;

    expect(game.tryUpgradeTower(game.towers[0].id)).toBe("The game has ended.");
    expect(game.towers[0].level).toBe(0);
    expect(game.wallet.coins).toBe(coinsBefore);
  });
});
