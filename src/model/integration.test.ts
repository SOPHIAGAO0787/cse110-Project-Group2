import { describe, expect, it } from "vitest";
import map1 from "../data/maps/map1.json";
import { WAVE_PREPARATION_SECONDS } from "./WaveManager";
import { GameModel } from "./GameModel";
import { ENEMIES, loadMap, MAPS, TOWERS } from "./loadContent";
import { Progress } from "./Progress";
import type { Vec } from "./types";

// The most ticks a test loop may run. A game that stops making progress then fails the test
// instead of hanging it.
const MAX_TICKS = 100000;

// Throws once a test loop has run more than MAX_TICKS ticks
function failIfTooManyTicks(ticks: number): void {
  if (ticks > MAX_TICKS) {
    throw new Error(`The game was still running after ${MAX_TICKS} ticks`);
  }
}

// The stars a finished game earned
function finalStars(game: GameModel): number {
  const result = game.result;
  if (result === null) {
    throw new Error("The game is not over yet");
  }
  return result.stars;
}

// What one tower of this kind costs, read from towers.json
function towerCost(defId: string): number {
  for (const def of TOWERS) {
    if (def.id === defId) {
      return def.cost;
    }
  }
  throw new Error(`Unknown tower "${defId}"`);
}

// Runs the game in small steps until it ends. Whenever a wave is cleared and the next one is
// waiting, it first places circle towers on the free tiles it can afford, then starts the wave
// at once instead of waiting out the preparation time.
function playUntilOver(game: GameModel, towerTiles: Vec[]): void {
  const step = 0.05; // seconds per tick, about 3 frames
  let ticks = 0;
  while (!game.isOver) {
    ticks++;
    failIfTooManyTicks(ticks);
    if (game.waves.currentWave === 0 || game.waves.preparationRemaining !== null) {
      for (const tile of towerTiles) {
        if (game.wallet.canAfford(towerCost("circle"))) {
          game.tryPlaceTower("circle", tile);
        }
      }
      game.startNextWave();
    }
    game.tick(step);
  }
}

// These tests run a real game on map1 with no screen, to check that the parts work together.
// Each one needs two tasks. Whichever of the two merges second turns its test on.
describe("Integration: a game on map1", () => {
  it("starting wave 1 spawns its enemies on the path", () => {
    const game = new GameModel(loadMap(map1));
    game.startNextWave();
    game.tick(0);
    expect(game.enemies).toHaveLength(1);
    expect(game.enemies[0].pos).toEqual(map1.path[0]);
    game.tick(0.5);
    expect(game.enemies).toHaveLength(1);
    expect(game.enemies[0].pos).toEqual(
      game.path.pointAt(ENEMIES.find((def) => def.id === "basic")!.speed * 0.5),
    );
    game.tick(4.3); // first wave's last spawn is due at 4.8 seconds
    expect(game.enemies).toHaveLength(5);
    expect(new Set(game.enemies.map((enemy) => enemy.id)).size).toBe(5);
    expect(game.waves.enemiesLeft).toBe(5);
    for (const enemy of game.enemies) {
      game.events.emit("enemyLeaked", { enemyId: enemy.id });
    }
    expect(game.waves.enemiesLeft).toBe(0);
    expect(game.waves.isRunning).toBe(false);
  });

  // Verify that reaching the path endpoint removes the enemy,
  // deducts one life, and emits the livesChanged event.
  it("an enemy that reaches the base costs one life", () => {
    const game = new GameModel(loadMap(map1));
    const livesChanged: number[] = [];

    game.events.on("livesChanged", ({ lives }) => {
      livesChanged.push(lives);
    });

    game.spawnEnemy("basic");
    const enemy = game.enemies[0];

    // Move the enemy to the end of the path.
    enemy.update(game.path.length / enemy.def.speed);

    // GameModel should detect and process the leak.
    game.tick(0);

    expect(game.enemies).toHaveLength(0);
    expect(game.lives.remaining).toBe(map1.startingLives - 1);
    expect(livesChanged).toEqual([map1.startingLives - 1]);
    expect(game.wallet.coins).toBe(map1.startingCoins);
  });

  // Verify that killing an enemy removes it, awards its reward
  // through Wallet, and emits coinsChanged.
  it("killing an enemy adds its reward to the coins", () => {
    const game = new GameModel(loadMap(map1));
    const coinsChanged: number[] = [];

    game.events.on("coinsChanged", ({ coins }) => {
      coinsChanged.push(coins);
    });

    game.spawnEnemy("basic");
    const enemy = game.enemies[0];
    const reward = enemy.def.reward;

    // Simulate damage until the enemy dies.
    enemy.takeDamage(enemy.hp);

    // GameModel should detect the death and award coins.
    game.tick(0);

    expect(game.enemies).toHaveLength(0);
    expect(game.wallet.coins).toBe(map1.startingCoins + reward);
    expect(coinsChanged).toEqual([map1.startingCoins + reward]);
    expect(game.lives.remaining).toBe(map1.startingLives);
  });

  it("placing a tower spends its cost, and with too few coins nothing is placed", () => {
    const game = new GameModel(loadMap(map1));

    // map1 starts with 100 coins, and a circle tower costs 50
    expect(game.tryPlaceTower("circle", { x: 0, y: 2 })).toBe("ok");
    expect(game.wallet.coins).toBe(50);
    expect(game.tryPlaceTower("circle", { x: 1, y: 2 })).toBe("ok");
    expect(game.wallet.coins).toBe(0);

    expect(game.tryPlaceTower("circle", { x: 0, y: 3 })).toBe("funds");
    expect(game.wallet.coins).toBe(0);
    expect(game.towers).toHaveLength(2);
  });

  it("winning map1 unlocks map2, and losing does not", () => {
    const progress = new Progress(MAPS);

    const lost = new GameModel(loadMap(map1));
    lost.lives.remaining = 0;
    lost.tick(0);
    progress.recordResult("map1", finalStars(lost));
    expect(progress.isUnlocked("map2")).toBe(false);

    const won = new GameModel(loadMap(map1));
    won.events.emit("waveCleared", { wave: map1.waves.length, bonus: 0 });
    won.tick(0);
    progress.recordResult("map1", finalStars(won));
    expect(progress.isUnlocked("map2")).toBe(true);
    expect(progress.starsFor("map1")).toBe(3);
  });

  it("a tower next to the path kills a passing enemy", () => {
    const game = new GameModel(loadMap(map1));
    const rewards: number[] = [];
    game.events.on("enemyKilled", ({ reward }) => {
      rewards.push(reward);
    });

    // (3, 3) is next to the corner where the path turns from going down to going right,
    // so the enemy stays in the circle's range on both sides of the corner, long enough
    // for three shots to kill it.
    expect(game.tryPlaceTower("circle", { x: 3, y: 3 })).toBe("ok");
    game.spawnEnemy("basic");
    const enemy = game.enemies[0];

    let ticks = 0;
    while (game.enemies.length > 0) {
      ticks++;
      failIfTooManyTicks(ticks);
      game.tick(0.05);
    }

    // It died on the way, so it never reached the base
    expect(enemy.isDead()).toBe(true);
    expect(enemy.distance).toBeLessThan(game.path.length);
    expect(game.lives.remaining).toBe(map1.startingLives);
    // The kill paid the enemy's reward
    expect(rewards).toEqual([enemy.def.reward]);
    expect(game.wallet.coins).toBe(map1.startingCoins - towerCost("circle") + enemy.def.reward);
  });

  it("a full round ends in victory with towers placed and defeat with none, and final coins = start - spent + rewards", () => {
    const won = new GameModel(loadMap(map1));
    let spent = 0;
    let rewards = 0;
    won.events.on("towerPlaced", ({ defId }) => {
      spent += towerCost(defId);
    });
    // Every time the coins go up it is a reward (kill rewards, plus any bonus the game pays)
    let lastCoins = won.wallet.coins;
    won.events.on("coinsChanged", ({ coins }) => {
      if (coins > lastCoins) {
        rewards += coins - lastCoins;
      }
      lastCoins = coins;
    });

    // Buildable tiles beside the path, best first. A circle on (6, 3) or (3, 3) kills a basic
    // enemy on its own, and with the rest the five waves of map1 can be won.
    const towerTiles: Vec[] = [
      { x: 6, y: 3 },
      { x: 3, y: 3 },
      { x: 3, y: 2 },
      { x: 7, y: 3 },
      { x: 6, y: 2 },
      { x: 4, y: 5 },
    ];
    playUntilOver(won, towerTiles);

    const wonResult = won.result;
    if (wonResult === null) {
      throw new Error("The game should be over");
    }
    expect(wonResult.won).toBe(true);
    expect(won.towers.length).toBeGreaterThan(0);
    expect(rewards).toBeGreaterThan(0);
    expect(won.wallet.coins).toBe(map1.startingCoins - spent + rewards);
    expect(wonResult.finalCoins).toBe(won.wallet.coins);

    // With no towers every enemy gets through. One life left means the first one ends the game.
    const lost = new GameModel(loadMap(map1));
    lost.lives.remaining = 1;
    playUntilOver(lost, []);

    const lostResult = lost.result;
    if (lostResult === null) {
      throw new Error("The game should be over");
    }
    expect(lostResult.won).toBe(false);
    expect(lostResult.towersPlaced).toBe(0);
    expect(lostResult.enemiesDefeated).toBe(0);
    expect(lost.wallet.coins).toBe(map1.startingCoins);
    expect(lostResult.finalCoins).toBe(map1.startingCoins);
  });
});

// Lets every enemy of the running wave spawn, and kills each one right away so none leak.
function clearWave(game: GameModel): void {
  while (game.waves.lastSpawnRemaining !== null) {
    game.tick(0.1);
    for (const enemy of game.enemies) enemy.takeDamage(enemy.hp);
  }
  for (const enemy of game.enemies) enemy.takeDamage(enemy.hp);
  game.tick(0);
}

it("prepares the next wave only after cleanup, then ends normally after the final wave", () => {
  const game = new GameModel(loadMap(map1));
  game.tick(10);
  expect(game.waves.currentWave).toBe(0);
  game.startNextWave();
  game.tick(4.8);
  expect(game.waves.lastSpawnRemaining).toBeNull();
  expect(game.waves.preparationRemaining).toBeNull();
  for (const enemy of game.enemies) enemy.takeDamage(enemy.hp);
  game.tick(0);
  expect(game.waves.preparationRemaining).toBe(WAVE_PREPARATION_SECONDS);
  expect(game.isOver).toBe(false);
  game.tick(WAVE_PREPARATION_SECONDS - 1);
  expect(game.waves.preparationRemaining).toBe(1);
  game.tick(1);
  expect(game.waves.currentWave).toBe(2);
  expect(game.enemies).toHaveLength(1);
  const finalWave = map1.waves.length;
  for (let wave = 2; wave < finalWave; wave++) {
    clearWave(game);
    expect(game.isOver).toBe(false);
    expect(game.waves.preparationRemaining).toBe(WAVE_PREPARATION_SECONDS);
    game.startNextWave();
    expect(game.waves.currentWave).toBe(wave + 1);
  }
  clearWave(game);
  expect(game.result?.won).toBe(true);
  expect(game.waves.preparationRemaining).toBeNull();
  game.tick(100);
  expect(game.waves.currentWave).toBe(finalWave);
});

it("freezes preparation after defeat", () => {
  const game = new GameModel(loadMap(map1));
  game.startNextWave();
  game.tick(4.8);
  for (const enemy of game.enemies) enemy.takeDamage(enemy.hp);
  game.tick(0);
  expect(game.waves.preparationRemaining).toBe(WAVE_PREPARATION_SECONDS);
  game.lives.remaining = 0;
  game.tick(0);
  expect(game.result?.won).toBe(false);
  game.tick(100);
  expect(game.waves.preparationRemaining).toBe(WAVE_PREPARATION_SECONDS);
  expect(game.waves.currentWave).toBe(1);
});

describe("Integration: every map", () => {
  // loadMap only checks the corners of the path, so walk an enemy over every map to check the road
  // between them too: every step stays on a 'P' tile and moves no farther than its speed allows.
  it("an enemy walks smoothly along the road on every map, then costs one life", () => {
    const step = 0.05; // seconds per tick, about 3 frames
    for (const map of MAPS) {
      const game = new GameModel(map);
      game.spawnEnemy("basic");
      const enemy = game.enemies[0];
      let last = enemy.pos;

      let ticks = 0;
      while (game.enemies.length > 0) {
        ticks++;
        failIfTooManyTicks(ticks);
        game.tick(step);
        const tileX = Math.round(enemy.pos.x);
        const tileY = Math.round(enemy.pos.y);
        expect(map.tiles[tileY][tileX], `${map.id} at (${tileX}, ${tileY})`).toBe("P");
        const moved = Math.hypot(enemy.pos.x - last.x, enemy.pos.y - last.y);
        expect(moved).toBeLessThanOrEqual(enemy.def.speed * step + 0.001);
        last = enemy.pos;
      }

      expect(last).toEqual(map.path[map.path.length - 1]);
      expect(game.lives.remaining).toBe(map.startingLives - 1);
    }
  });
});
