// @vitest-environment jsdom
import type { ScreenSwitcher } from "../../app/types";
import Konva from "konva";
import "vitest-canvas-mock";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { GameScreenController } from "./GameScreenController";
import { GameModel } from "../../model/GameModel";
import { GameLoop } from "../../core/GameLoop";
import map from "../../data/maps/map1.json";
import map2 from "../../data/maps/map2.json";
import { MAPS } from "../../model/loadContent";
import { Progress } from "../../model/Progress";

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
let switchTo: Mock<ScreenSwitcher["switchTo"]>;
let progress: Progress;

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

// Clicks the real button with this label on the screen, e.g. "Start Wave".
function clickButton(text: string): void {
  const label = controller.group.find<Konva.Text>("Text").find((t) => t.text() === text);
  if (label === undefined) {
    throw new Error(`${text} button is missing from the screen`);
  }
  const button = label.getParent();
  if (button === null) {
    throw new Error(`${text} label has no button group`);
  }
  button.fire("click");
}

beforeEach(() => {
  models.length = 0;
  vi.spyOn(GameLoop.prototype, "start").mockImplementation(() => {});
  switchTo = vi.fn<ScreenSwitcher["switchTo"]>();
  progress = new Progress(MAPS);
  controller = new GameScreenController({ switchTo }, progress);
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
      // Set the count by hand so this test only checks the HUD.
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
      // The real Lives model handles the leak and emits livesChanged.
      model.events.emit("enemyLeaked", { enemyId: 2 - remaining });
      expect(model.lives.remaining).toBe(remaining);
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

  it("Start Wave updates the HUD through both waves", () => {
    clickButton("Start Wave");
    expect(hud()).toContain("Wave: 1/2   ·   Enemies Remaining: 5");

    // Spawn all of wave 1, then kill one enemy and let the rest leak.
    model.tick(5);
    expect(model.enemies).toHaveLength(5);
    const first = model.enemies[0];
    model.events.emit("enemyKilled", { enemyId: first.id, reward: first.def.reward });
    expect(hud()).toContain(`Coins: ${map.startingCoins + first.def.reward}`);
    expect(hud()).toContain("Enemies Remaining: 4");
    for (let i = 1; i < 5; i++) {
      model.events.emit("enemyLeaked", { enemyId: model.enemies[i].id });
    }
    expect(hud()).toContain("Wave: 1/2   ·   Enemies Remaining: 0");

    // Wave 2 has 8 enemies. Clicking again after the last wave changes nothing.
    clickButton("Start Wave");
    expect(hud()).toContain("Wave: 2/2   ·   Enemies Remaining: 8");
    model.tick(7);
    const wave2 = model.enemies.slice(model.enemies.length - 8);
    for (const enemy of wave2) {
      model.events.emit("enemyLeaked", { enemyId: enemy.id });
    }
    expect(hud()).toContain("Wave: 2/2   ·   Enemies Remaining: 0");
    clickButton("Start Wave");
    expect(hud()).toContain("Wave: 2/2   ·   Enemies Remaining: 0");
  });
});

describe("GameScreenController game over (So1)", () => {
  it("sends the model's final result to the result screen", () => {
    expect(model.tryPlaceTower("circle", { x: 0, y: 2 })).toBe("ok");
    model.lives.remaining = 1;
    model.events.emit("enemyLeaked", { enemyId: 99 });
    model.tick(0);

    expect(switchTo).toHaveBeenCalledTimes(1);
    expect(switchTo).toHaveBeenCalledWith("result", model.result);
    expect(model.result).toMatchObject({ won: false, towersPlaced: 1, remainingLives: 0 });
  });

  it("records a win so the next map unlocks", () => {
    // Clearing the last wave with every life left is a 3-star win
    model.events.emit("waveCleared", { wave: map.waves.length });
    model.tick(0);

    expect(model.result).toMatchObject({ won: true, stars: 3 });
    expect(progress.starsFor("map1")).toBe(3);
    expect(progress.isUnlocked("map2")).toBe(true);
  });

  it("records a loss without unlocking the next map", () => {
    model.lives.remaining = 0;
    model.tick(0);

    expect(model.result).toMatchObject({ won: false });
    expect(progress.isUnlocked("map2")).toBe(false);
  });
});

describe("GameScreenController Back to maps", () => {
  it("goes back to the map screen without recording a result", () => {
    clickButton("Back to maps");

    expect(switchTo).toHaveBeenCalledWith("maps");
    expect(model.result).toBeNull();
    expect(progress.starsFor("map1")).toBe(0);
  });
});

describe("GameScreenController map choice", () => {
  it("plays the map picked on the map screen", () => {
    controller.hide();
    progress.currentMapId = "map2";
    controller.show();
    model = models[models.length - 1];

    // map2 starts at a different corner and has one more wave than map1
    expect(model.path.pointAt(0)).toEqual(map2.path[0]);
    expect(hud()).toContain(`Wave: 0/${map2.waves.length}`);
  });
});
