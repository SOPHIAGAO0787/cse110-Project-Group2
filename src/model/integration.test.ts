import { describe, expect, it } from "vitest";
import map1 from "../data/maps/map1.json";
import { WAVE_PREPARATION_SECONDS } from "./WaveManager";
import { GameModel } from "./GameModel";
import { ENEMIES, loadMap } from "./loadContent";

// These tests run a real game on map1 with no screen, to check that the parts work together.
// Each one needs two tasks. Whichever of the two merges second turns its test on.
describe("Integration: a game on map1", () => {
  it("starting wave 1 spawns its enemies on the path (R1, N1)", () => {
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
  it("an enemy that reaches the base costs one life (R2, N2)", () => {
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
  it("killing an enemy adds its reward to the coins (R2, St1)", () => {
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

  it("placing a tower spends its cost, and with too few coins nothing is placed (B1, St1)", () => {
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

  it.todo("a tower next to the path kills a passing enemy (B1, R3)");
  it.todo(
    "a full round ends in victory with towers placed and defeat with none, and final coins = start - spent + rewards (St3)",
  );
});

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
  game.tick(6.3);
  for (const enemy of game.enemies) enemy.takeDamage(enemy.hp);
  game.tick(0);
  expect(game.result?.won).toBe(true);
  expect(game.waves.preparationRemaining).toBeNull();
  game.tick(100);
  expect(game.waves.currentWave).toBe(2);
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
