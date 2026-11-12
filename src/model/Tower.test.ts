import { describe, expect, it } from "vitest";
import { GameModel } from "./GameModel";
import { loadMap } from "./loadContent";
import map1 from "../data/maps/map1.json";

function setup() {
  const game = new GameModel(loadMap(map1));
  game.tryPlaceTower("circle", { x: 0, y: 2 });
  return { game, tower: game.towers[0] };
}

describe("Tower.update", () => {
  it("damages an enemy in range and reports that it fired", () => {
    const { game, tower } = setup();
    game.spawnEnemy("basic");
    const enemy = game.enemies[0];

    expect(tower.update(0, game.enemies)).toBe(true);
    expect(enemy.hp).toBe(enemy.def.hp - tower.def.damage);
  });

  it("ignores enemies outside the range", () => {
    const { game, tower } = setup();
    game.spawnEnemy("basic");
    const enemy = game.enemies[0];
    enemy.update(10); // walk it far from the tower

    expect(tower.update(0, game.enemies)).toBe(false);
    expect(enemy.hp).toBe(enemy.def.hp);
  });

  it("waits for the cooldown before firing again", () => {
    const { game, tower } = setup();
    game.spawnEnemy("basic");

    expect(tower.update(0, game.enemies)).toBe(true);
    expect(tower.update(0.1, game.enemies)).toBe(false);
    expect(tower.update(1 / tower.def.fireRatePerSec, game.enemies)).toBe(true);
  });

  it("targets the enemy furthest along the path", () => {
    const { game, tower } = setup();
    game.spawnEnemy("basic");
    game.spawnEnemy("basic");
    const [behind, ahead] = game.enemies;
    ahead.update(0.5); // move one slightly forward, both stay in range

    tower.update(0, game.enemies);

    expect(ahead.hp).toBe(ahead.def.hp - tower.def.damage);
    expect(behind.hp).toBe(behind.def.hp);
  });
});

