import { describe, expect, it } from "vitest";
import { GameModel } from "./GameModel";
import { PlayerProgress } from "./PlayerProgress";
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

  it("rejects a locked tower without spending coins or occupying its tile", () => {
    const progress = new PlayerProgress();
    progress.maxLevels.delete("circle");
    const model = new GameModel(map, progress);
    const startingCoins = model.wallet.coins;

    expect(model.tryPlaceTower("circle", buildTile)).toBe("locked");
    expect(model.wallet.coins).toBe(startingCoins);
    expect(model.towers).toHaveLength(0);
    expect(model.grid.isOccupied(buildTile)).toBe(false);

    // Unlocking through the same shared object allows placement.
    progress.maxLevels.set("circle", 0);
    expect(model.tryPlaceTower("circle", buildTile)).toBe("ok");
  });

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

// Test for R2: Remove dead enemies and enemies that reached the base
describe("GameModel enemy cleanup (R2)", () => {
  it("removes dead enemies and awards coins", () => {
    const game = new GameModel(loadMap(map1));
    const startingCoins = game.wallet.coins;

    game.spawnEnemy("basic");
    const enemy = game.enemies[0];
    const reward = enemy.def.reward;

    enemy.takeDamage(enemy.hp);
    game.tick(0);

    expect(game.enemies).toHaveLength(0);
    expect(game.wallet.coins).toBe(startingCoins + reward);
  });

  it("removes leaked enemies and deducts one life", () => {
    const game = new GameModel(loadMap(map1));
    const startingLives = game.lives.remaining;

    game.spawnEnemy("basic");
    const enemy = game.enemies[0];

    enemy.update(game.path.length / enemy.def.speed);
    game.tick(0);

    expect(game.enemies).toHaveLength(0);
    expect(game.lives.remaining).toBe(startingLives - 1);
  });

  it("does not remove enemies still alive on the path", () => {
    const game = new GameModel(loadMap(map1));

    game.spawnEnemy("basic");
    game.tick(0);

    expect(game.enemies).toHaveLength(1);
  });

  it("does not reward or penalize the same enemy twice", () => {
    const game = new GameModel(loadMap(map1));
    const startingCoins = game.wallet.coins;

    game.spawnEnemy("basic");
    const enemy = game.enemies[0];
    enemy.takeDamage(enemy.hp);

    game.tick(0);
    game.tick(0);

    expect(game.wallet.coins).toBe(startingCoins + enemy.def.reward);
    expect(game.enemies).toHaveLength(0);
  });

  it("prioritizes death over leaking", () => {
    const game = new GameModel(loadMap(map1));
    const startingLives = game.lives.remaining;
    const startingCoins = game.wallet.coins;

    game.spawnEnemy("basic");
    const enemy = game.enemies[0];

    enemy.update(game.path.length / enemy.def.speed);
    enemy.takeDamage(enemy.hp);

    game.tick(0);

    expect(game.enemies).toHaveLength(0);
    expect(game.wallet.coins).toBe(startingCoins + enemy.def.reward);
    expect(game.lives.remaining).toBe(startingLives);
  });

  it("clears the wave after its final enemy leaks", () => {
    const game = new GameModel(loadMap(map1));
    const clearedWaves: number[] = [];

    game.events.on("waveCleared", ({ wave }) => {
      clearedWaves.push(wave);
    });

    game.startNextWave();

    // Spawn every scheduled enemy in the wave,
    // (assuming the wave has a finite #of enemies).
    const wave = game.map.waves[0];
    const totalCount = wave.groups.reduce((sum, group) => sum + group.count, 0);

    // Advance in small increments until all enemies have spawned.
    for (let i = 0; i < 10000 && game.enemies.length < totalCount; i++) {
      game.tick(0.1);
    }

    expect(game.enemies).toHaveLength(totalCount);
    expect(game.waves.isRunning).toBe(true);

    // Force every enemy to reach the end of the path.
    for (const enemy of game.enemies) {
      enemy.update(game.path.length / enemy.def.speed);
    }

    game.tick(0);

    expect(game.enemies).toHaveLength(0);
    expect(game.waves.enemiesLeft).toBe(0);
    expect(game.waves.isRunning).toBe(false);
    expect(clearedWaves).toEqual([1]);
  });
});

// So1: the game ends in victory or defeat and records its stats for the result screen.
// map1 has two waves with 13 enemies in total, so with no towers every enemy leaks:
// 14 lives survive with 1 left, 13 or fewer lose.
describe("GameModel game result (So1)", () => {
  function gameWithLives(startingLives: number): GameModel {
    return new GameModel(loadMap({ ...map1, startingLives }));
  }

  // Starts each wave as soon as the previous one clears, and ticks until the game ends.
  function playUntilOver(game: GameModel): boolean[] {
    const outcomes: boolean[] = [];
    game.events.on("gameOver", ({ won }) => outcomes.push(won));
    game.events.on("waveCleared", () => game.startNextWave());
    game.startNextWave();
    for (let i = 0; i < 10000 && !game.isOver; i++) {
      game.tick(0.1);
    }
    return outcomes;
  }

  it("ends in victory when the last wave is cleared with lives left", () => {
    const game = gameWithLives(14);

    expect(playUntilOver(game)).toEqual([true]);
    expect(game.result).toMatchObject({ won: true, stars: 1, remainingLives: 1 });
    expect(game.waves.currentWave).toBe(map1.waves.length);
  });

  it("ends in defeat as soon as the last life is lost", () => {
    const game = gameWithLives(3);

    expect(playUntilOver(game)).toEqual([false]);
    expect(game.result).toMatchObject({ won: false, stars: 0, remainingLives: 0 });
    expect(game.waves.currentWave).toBe(1); // lost during wave 1, so wave 2 never started
  });

  it("counts losing the last life on the step the last wave clears as a defeat", () => {
    const game = gameWithLives(13);

    expect(playUntilOver(game)).toEqual([false]);
    expect(game.waves.isRunning).toBe(false); // the last wave did clear
  });

  it("is not over after an earlier wave clears", () => {
    const game = gameWithLives(20);
    const outcomes: boolean[] = [];
    const cleared: number[] = [];
    game.events.on("gameOver", ({ won }) => outcomes.push(won));
    game.events.on("waveCleared", ({ wave }) => cleared.push(wave));

    game.startNextWave();
    for (let i = 0; i < 10000 && cleared.length === 0; i++) {
      game.tick(0.1);
    }

    expect(cleared).toEqual([1]);
    expect(outcomes).toEqual([]);
    expect(game.isOver).toBe(false);
    expect(game.result).toBeNull();
  });

  it("emits gameOver once and then freezes the game", () => {
    const game = gameWithLives(1);
    expect(playUntilOver(game)).toEqual([false]);
    const time = game.elapsedSeconds;
    const positions = game.enemies.map((enemy) => enemy.distance);
    let laterGameOvers = 0;
    game.events.on("gameOver", () => laterGameOvers++);

    game.tick(1);
    game.tick(1);
    game.startNextWave();

    expect(laterGameOvers).toBe(0);
    expect(game.elapsedSeconds).toBe(time);
    expect(game.enemies.map((enemy) => enemy.distance)).toEqual(positions);
    expect(game.waves.currentWave).toBe(1);
  });

  it("counts elapsed time and ignores negative or non-finite steps", () => {
    const game = gameWithLives(20);

    game.tick(0.1);
    game.tick(0.2);
    game.tick(-1);
    game.tick(Number.NaN);
    game.tick(Number.POSITIVE_INFINITY);

    expect(game.elapsedSeconds).toBeCloseTo(0.3);
  });

  it("records the stats at the moment the game ends", () => {
    const game = gameWithLives(1);
    const tile = { x: 0, y: 2 };
    expect(game.tryPlaceTower("circle", tile)).toBe("ok");
    expect(game.tryPlaceTower("circle", tile)).toBe("occupied"); // failed placements don't count
    game.recordQuestionSolved();
    game.recordQuestionSolved();
    game.tick(0.5);

    game.events.emit("enemyLeaked", { enemyId: 99 }); // costs the only life
    game.tick(0.25);

    expect(game.result).toEqual({
      won: false,
      stars: 0,
      elapsedSeconds: 0.75,
      towersPlaced: 1,
      remainingLives: 0,
      finalCoins: map1.startingCoins - TOWERS.find((d) => d.id === "circle")!.cost,
      questionsSolved: 2,
    });
  });

  it("does not change the result after the game ends", () => {
    const game = gameWithLives(1);
    game.events.emit("enemyLeaked", { enemyId: 99 });
    game.tick(0);
    const result = { ...game.result };

    game.recordQuestionSolved();
    game.tryPlaceTower("circle", { x: 0, y: 2 });

    expect(game.result).toEqual(result);
  });
});
