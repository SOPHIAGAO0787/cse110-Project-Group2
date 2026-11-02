import { describe, expect, it } from "vitest";
import { GameModel } from "./GameModel";
import { loadMap, TOWERS } from "./loadContent";
import map1 from "../data/maps/map1.json";
import type { Vec } from "./types";

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

// B1: placing towers through the model (tryPlaceTower)
function findTile(rows: string[], ch: string): Vec {
  for (let y = 0; y < rows.length; y++) {
    const x = rows[y].indexOf(ch);
    if (x !== -1) return { x, y };
  }
  throw new Error(`no '${ch}' tile in map`);
}

describe("GameModel.tryPlaceTower", () => {
  const map = loadMap(map1);
  const buildTile = findTile(map.tiles, "#");
  const pathTile = findTile(map.tiles, "P");

  it("ok on a # tile, and the tower is added to the model", () => {
    const model = new GameModel(map);
    expect(model.tryPlaceTower("circle", buildTile)).toBe("ok");
    expect(model.towers).toHaveLength(1);
    expect(model.towers[0].tile).toEqual(buildTile);
  });

  it("blocked on a path tile", () => {
    const model = new GameModel(map);
    expect(model.tryPlaceTower("circle", pathTile)).toBe("blocked");
    expect(model.towers).toHaveLength(0);
  });

  it("occupied when the same tile is used twice", () => {
    const model = new GameModel(map);
    model.tryPlaceTower("circle", buildTile);
    expect(model.tryPlaceTower("circle", buildTile)).toBe("occupied");
    expect(model.towers).toHaveLength(1);
  });

  it("emits towerPlaced", () => {
    const model = new GameModel(map);
    const seen: string[] = [];
    model.events.on("towerPlaced", (e) => seen.push(e.defId));
    model.tryPlaceTower("circle", buildTile);
    expect(seen).toEqual(["circle"]);
  });

  it("throws on an unknown tower id", () => {
    const model = new GameModel(map);
    expect(() => model.tryPlaceTower("nope", buildTile)).toThrow();
  });

  it("takes the tower's cost off the coins", () => {
    const model = new GameModel(map);
    const startingCoins = model.wallet.coins;
    model.tryPlaceTower("circle", buildTile);
    expect(model.wallet.coins).toBe(startingCoins - TOWERS[0].cost);
  });

  it("ok with exactly enough coins", () => {
    const model = new GameModel(map);
    model.wallet.coins = TOWERS[0].cost;
    expect(model.tryPlaceTower("circle", buildTile)).toBe("ok");
    expect(model.wallet.coins).toBe(0);
  });

  it("funds with one coin too few, and nothing changes", () => {
    const model = new GameModel(map);
    const tooFew = TOWERS[0].cost - 1;
    model.wallet.coins = tooFew;
    expect(model.tryPlaceTower("circle", buildTile)).toBe("funds");
    expect(model.wallet.coins).toBe(tooFew);
    expect(model.towers).toHaveLength(0);
    expect(model.grid.isOccupied(buildTile)).toBe(false);
  });

  it("does not charge for a tile it can't use", () => {
    const model = new GameModel(map);
    const startingCoins = model.wallet.coins;
    model.tryPlaceTower("circle", pathTile);
    expect(model.wallet.coins).toBe(startingCoins);
  });
});
