// @vitest-environment jsdom
import type { ScreenSwitcher } from "../../app/types";
import Konva from "konva";
import "vitest-canvas-mock";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { GameScreenController } from "./GameScreenController";
import { GameModel } from "../../model/GameModel";
import { GameLoop } from "../../core/GameLoop";
import map from "../../data/maps/map1.json";
import { PlayerProgress } from "../../model/PlayerProgress";
import { GridView } from "./GridView";
import { GameScreenView } from "./GameScreenView";

// Capture real model instances without exposing the controller's private fields.
// All state and the EventBus remain real; only the animation loop is stopped.
const models = vi.hoisted(() => [] as GameModel[]);
const grids = vi.hoisted(() => [] as GridView[]);
vi.mock("./GridView", async (importOriginal) => {
  const original = await importOriginal<typeof import("./GridView")>();
  return {
    GridView: class extends original.GridView {
      constructor(...args: ConstructorParameters<typeof original.GridView>) {
        super(...args);
        grids.push(this);
      }
    },
  };
});
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
let progress: PlayerProgress;

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

// Clicks the real Start Wave button on the screen.
function clickStartWave(): void {
  const label = controller.group.find<Konva.Text>("Text").find((t) => t.text() === "Start Wave");
  if (label === undefined) {
    throw new Error("Start Wave button is missing from the screen");
  }
  const button = label.getParent();
  if (button === null) {
    throw new Error("Start Wave label has no button group");
  }
  button.fire("click");
}

beforeEach(() => {
  models.length = 0;
  grids.length = 0;
  vi.spyOn(GameLoop.prototype, "start").mockImplementation(() => {});
  switchTo = vi.fn<ScreenSwitcher["switchTo"]>();
  progress = new PlayerProgress();
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
    clickStartWave();
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
    clickStartWave();
    expect(hud()).toContain("Wave: 2/2   ·   Enemies Remaining: 8");
    model.tick(7);
    const wave2 = model.enemies.slice(model.enemies.length - 8);
    for (const enemy of wave2) {
      model.events.emit("enemyLeaked", { enemyId: enemy.id });
    }
    expect(hud()).toContain("Wave: 2/2   ·   Enemies Remaining: 0");
    clickStartWave();
    expect(hud()).toContain("Wave: 2/2   ·   Enemies Remaining: 0");
  });
});

describe("GameScreenController tower upgrades", () => {
  function prepareTower() {
    progress.maxLevels.set("circle", 1);
    model.wallet.add(200);
    expect(model.tryPlaceTower("circle", { x: 0, y: 2 })).toBe("ok");

    const grid = grids[grids.length - 1];
    vi.spyOn(grid, "tileUnderMouse").mockReturnValue({ x: 0, y: 2 });
    return grid;
  }

  it.each(["click", "tap"])("upgrades the clicked tower on %s and shows the result", (event) => {
    const grid = prepareTower();
    const message = vi.spyOn(GameScreenView.prototype, "showMessage");
    const coinsBefore = model.wallet.coins;

    grid.group.fire(event);

    expect(model.towers[0].level).toBe(1);
    expect(model.wallet.coins).toBe(coinsBefore - 75);
    expect(message).toHaveBeenCalledWith("Circle Tower upgraded to Level 2.");
  });

  it("ignores clicks on an empty tile", () => {
    const grid = prepareTower();
    vi.mocked(grid.tileUnderMouse).mockReturnValue({ x: 1, y: 2 });
    const upgrade = vi.spyOn(model, "tryUpgradeTower");

    grid.group.fire("click");

    expect(upgrade).not.toHaveBeenCalled();
  });

  it("shows a rejected upgrade without spending coins", () => {
    const grid = prepareTower();
    progress.maxLevels.set("circle", 0);
    const message = vi.spyOn(GameScreenView.prototype, "showMessage");
    const coinsBefore = model.wallet.coins;

    grid.group.fire("click");

    expect(model.towers[0].level).toBe(0);
    expect(model.wallet.coins).toBe(coinsBefore);
    expect(message).toHaveBeenCalledWith("Buy a higher maximum level in the Tower Shop first.");
  });

  it("does not upgrade while dragging a placement card", () => {
    const grid = prepareTower();
    const upgrade = vi.spyOn(model, "tryUpgradeTower");
    const title = controller.group
      .find<Konva.Text>("Text")
      .find((text) => text.text() === "Circle Tower")!;
    title.getParent()!.fire("pointerdown");

    grid.group.fire("click");

    expect(upgrade).not.toHaveBeenCalled();
  });

  it("disconnects upgrade clicks when the screen is hidden", () => {
    const grid = prepareTower();
    const upgrade = vi.spyOn(model, "tryUpgradeTower");

    controller.hide();
    grid.group.fire("click");

    expect(upgrade).not.toHaveBeenCalled();
  });

  it("ignores clicks after the game ends", () => {
    const grid = prepareTower();
    model.lives.remaining = 0;
    model.tick(0);
    const upgrade = vi.spyOn(model, "tryUpgradeTower");

    grid.group.fire("click");

    expect(upgrade).not.toHaveBeenCalled();
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
});
