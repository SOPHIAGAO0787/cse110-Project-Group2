import { describe, expect, it } from "vitest";
import { GameModel } from "./GameModel";
import { loadMap } from "./loadContent";
import map1 from "../data/maps/map1.json";

describe("GameModel", () => {
  it("starts with the map's coins and lives", () => {
    const game = new GameModel(loadMap(map1));
    expect(game.wallet.coins).toBe(100);
    expect(game.lives.remaining).toBe(20);
  });

  it("spawnEnemy adds an enemy at the start of the path and announces it", () => {
    const game = new GameModel(loadMap(map1));
    const spawned: number[] = [];
    game.events.on("enemySpawned", (e) => spawned.push(e.enemyId));

    game.spawnEnemy("basic");

    expect(game.enemies).toHaveLength(1);
    expect(game.enemies[0].pos).toEqual({ x: 0, y: 1 });
    expect(spawned).toEqual([game.enemies[0].id]);
  });

  it("gives every enemy a different id", () => {
    const game = new GameModel(loadMap(map1));
    game.spawnEnemy("basic");
    game.spawnEnemy("basic");
    expect(game.enemies[0].id).not.toBe(game.enemies[1].id);
  });

  it("ticks without errors", () => {
    const game = new GameModel(loadMap(map1));
    game.spawnEnemy("basic");
    expect(() => game.tick(0.016)).not.toThrow();
  });
});
