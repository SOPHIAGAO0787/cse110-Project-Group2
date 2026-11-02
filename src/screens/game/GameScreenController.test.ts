// @vitest-environment jsdom
import Konva from "konva";
import "vitest-canvas-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GameScreenController } from "./GameScreenController";
import { GameModel } from "../../model/GameModel";
import { GameLoop } from "../../core/GameLoop";
import map from "../../data/maps/map1.json";

// Capture real model instances without exposing the controller's private fields.
// All state and the EventBus remain real; only the animation loop is stopped.
const models = vi.hoisted(() => [] as GameModel[]);
vi.mock("../../model/GameModel", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../model/GameModel")>();
  return {
    GameModel: class extends original.GameModel {
      constructor(...args: ConstructorParameters<typeof original.GameModel>) {
        super(...args);
        models.push(this);
      }
    },
  };
});

let controller: GameScreenController;
let model: GameModel;

function hud(): string {
  const text = controller.group
    .getChildren()
    .find((node) => node instanceof Konva.Text && node.text().startsWith("Coins:"));
  if (!(text instanceof Konva.Text)) throw new Error("HUD text is missing from the screen");
  return text.text();
}

function expectHud(coins: number, lives: number, wave: number, enemies: number): void {
  expect(hud()).toBe(
    `Coins: ${coins}   ·   Lives: ${lives}   ·   Wave: ${wave}/${map.waves.length}   ·   Enemies Remaining: ${enemies}`,
  );
}

beforeEach(() => {
  models.length = 0;
  vi.spyOn(GameLoop.prototype, "start").mockImplementation(() => {});
  controller = new GameScreenController({ switchTo: vi.fn() });
  controller.show();
  model = models[models.length - 1];
});

afterEach(() => {
  controller.hide();
  controller.group.destroy();
  vi.restoreAllMocks();
});

describe("GameScreenController HUD event wiring", () => {
  it("shows the map's starting values before any events", () => {
    expectHud(map.startingCoins, map.startingLives, 0, 0);
  });

  it.each([135, 65, 0])("refreshes coinsChanged from current wallet state (%i)", (coins) => {
    if (coins > map.startingCoins) {
      model.wallet.add(coins - map.startingCoins);
    } else {
      expect(model.wallet.spend(map.startingCoins - coins)).toBe(true);
    }
    expectHud(coins, map.startingLives, 0, 0);
  });

  it.each([19, 1, 0])("refreshes livesChanged from current lives state (%i)", (lives) => {
    model.lives.remaining = lives;
    model.events.emit("livesChanged", { lives });
    expectHud(map.startingCoins, lives, 0, 0);
  });

  it("tracks the first and final wave, retaining the cleared wave number", () => {
    for (const [index, wave] of map.waves.entries()) {
      const number = index + 1;
      const enemies = wave.groups.reduce((sum, group) => sum + group.count, 0);
      model.waves.currentWave = number;
      model.waves.enemiesLeft = enemies;
      model.events.emit("waveStarted", { wave: number, totalWaves: map.waves.length });
      expectHud(map.startingCoins, map.startingLives, number, enemies);

      model.waves.enemiesLeft = 0;
      model.events.emit("waveCleared", { wave: number });
      expectHud(map.startingCoins, map.startingLives, number, 0);
    }
  });

  it("refreshes enemies and coins after a simulated kill, including the last enemy", () => {
    model.waves.currentWave = 1;
    model.waves.enemiesLeft = 2;
    model.events.emit("waveStarted", { wave: 1, totalWaves: map.waves.length });
    for (const enemies of [1, 0]) {
      // WaveManager is still unfinished; simulate its count before emitting.
      // The real Wallet handles the reward and emits coinsChanged.
      model.waves.enemiesLeft = enemies;
      model.events.emit("enemyKilled", { enemyId: 2 - enemies, reward: 5 });
      expectHud(map.startingCoins + (2 - enemies) * 5, map.startingLives, 1, enemies);
    }
  });

  it("refreshes enemies and lives after a simulated escape down to zero", () => {
    model.waves.currentWave = 1;
    model.lives.remaining = 2;
    model.waves.enemiesLeft = 2;
    model.events.emit("waveStarted", { wave: 1, totalWaves: map.waves.length });
    for (const remaining of [1, 0]) {
      model.waves.enemiesLeft = remaining;
      model.lives.remaining = remaining;
      model.events.emit("enemyLeaked", { enemyId: 2 - remaining });
      expectHud(map.startingCoins, remaining, 1, remaining);
    }
  });

  it("reads the full state after the Wallet applies a kill reward exactly once", () => {
    model.wallet.coins = 0;
    model.lives.remaining = 0;
    model.waves.currentWave = map.waves.length;
    model.waves.enemiesLeft = 0;
    model.events.emit("enemyKilled", { enemyId: 1, reward: 99 });
    expect(model.wallet.coins).toBe(99);
    expectHud(99, 0, map.waves.length, 0);

    // A zero reward emits no coinsChanged, so enemyKilled must also refresh the HUD.
    model.lives.remaining = 1;
    model.waves.currentWave = 1;
    model.waves.enemiesLeft = 1;
    model.events.emit("enemyKilled", { enemyId: 2, reward: 0 });
    expect(model.wallet.coins).toBe(99);
    expectHud(99, 1, 1, 1);
  });

  it("disconnects old model events when hidden and resets the HUD on re-entry", () => {
    const oldModel = model;
    const initial = hud();
    controller.hide();
    oldModel.wallet.coins = 999;
    oldModel.events.emit("coinsChanged", { coins: 999 });
    expect(hud()).toBe(initial);

    controller.show();
    model = models[models.length - 1];
    expect(model).not.toBe(oldModel);
    expectHud(map.startingCoins, map.startingLives, 0, 0);
    oldModel.events.emit("coinsChanged", { coins: 999 });
    expectHud(map.startingCoins, map.startingLives, 0, 0);

    model.wallet.coins = 25;
    model.events.emit("coinsChanged", { coins: 25 });
    expectHud(25, map.startingLives, 0, 0);
  });
});
