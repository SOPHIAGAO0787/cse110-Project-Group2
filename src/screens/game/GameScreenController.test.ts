// @vitest-environment jsdom
import type { ScreenSwitcher } from "../../app/types";
import Konva from "konva";
import "vitest-canvas-mock";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { GameScreenController } from "./GameScreenController";
import { GameModel } from "../../model/GameModel";
import { GameLoop } from "../../core/GameLoop";
import { WAVE_PREPARATION_SECONDS } from "../../model/WaveManager";
import { GridView } from "./GridView";
import { QuestionPrompt } from "./QuestionPrompt";
import { QuestionService } from "../../model/questions/QuestionService";
import { TOWERS } from "../../model/loadContent";
import { GameScreenView } from "./GameScreenView";
import map from "../../data/maps/map1.json";
import map2 from "../../data/maps/map2.json";
import { MAPS } from "../../model/loadContent";
import { Progress } from "../../model/Progress";
import { TowerProgress } from "../../model/TowerProgress";
import { TowersView } from "./TowersView";
import { CIRCLE_TOWER_COLOR } from "../theme";
import { Sound, type EffectName } from "../../core/Sound";

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
const frames = vi.hoisted(() => [] as ((dt: number) => void)[]);
vi.mock("../../core/GameLoop", () => ({
  GameLoop: class {
    constructor(tick: (dt: number) => void) {
      frames.push(tick);
    }
    start() {}
    stop() {}
  },
}));

let controller: GameScreenController;
let model: GameModel;
let switchTo: Mock<ScreenSwitcher["switchTo"]>;
let progress: Progress;
let towerProgress: TowerProgress;
let playSound: Mock<(name: EffectName) => void>; // counts the effects instead of playing them

function hud(): string {
  const value = (name: string) =>
    controller.group.findOne<Konva.Text>(`.hud-${name}-value`)?.text();
  const lives = value("lives");
  const wave = value("wave");
  const enemies = value("enemies");
  if (lives === undefined || wave === undefined || enemies === undefined)
    throw new Error("HUD status boxes are missing from the screen");
  return `Lives: ${lives}   ·   Wave: ${wave}   ·   Enemies Remaining: ${enemies}`;
}

function expectHud(coins: number, lives: number, wave: number, enemies: number): void {
  expect(controller.group.findOne<Konva.Text>(".game-coins")!.text()).toBe(`Coins: ${coins}`);
  expect(hud()).toBe(
    `Lives: ${lives}   ·   Wave: ${wave}/${map.waves.length}   ·   Enemies Remaining: ${enemies}`,
  );
}

// Clicks the real button with this label on the screen, e.g. "Start Wave".
// How many enemies wave n (1-based) of map1 sends, and how long its last enemy takes to spawn.
function waveSize(n: number): number {
  return map.waves[n - 1].groups.reduce((total, group) => total + group.count, 0);
}
function lastSpawnSeconds(n: number): number {
  const { groups } = map.waves[n - 1];
  // Every enemy waits its group's interval before the next spawns; the last one has no wait after it.
  const total = groups.reduce((sum, group) => sum + group.count * group.intervalSec, 0);
  return total - groups[groups.length - 1].intervalSec;
}

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

// Clicks the Start Wave button, which reads "Start Next Wave" during the countdown.
function clickStartWave(): void {
  const next = controller.group
    .find<Konva.Text>("Text")
    .find((t) => t.text() === "Start Next Wave");
  if (next === undefined) {
    clickButton("Start Wave");
  } else {
    clickButton("Start Next Wave");
  }
}

beforeEach(() => {
  models.length = 0;
  grids.length = 0;
  vi.spyOn(GameLoop.prototype, "start").mockImplementation(() => {});
  switchTo = vi.fn<ScreenSwitcher["switchTo"]>();
  progress = new Progress(MAPS);
  towerProgress = new TowerProgress();
  const sound = new Sound();
  playSound = vi.spyOn(sound, "play").mockImplementation(() => {});
  controller = new GameScreenController({ switchTo }, progress, towerProgress, sound);
  controller.show();
  model = models[models.length - 1];
});

afterEach(() => {
  controller.hide();
  controller.group.destroy();
  vi.restoreAllMocks();
});

describe("GameScreenController HUD event wiring", () => {
  it("keeps shared tower unlocks when switching to a different map", () => {
    controller.hide();
    progress.currentMapId = "map2";
    towerProgress.maxLevels.delete("circle");
    controller.show();
    model = models[models.length - 1];

    expect(model.map.id).toBe("map2");
    expect(model.tryPlaceTower("circle", { x: 0, y: 0 })).toBe("locked");
    expect(
      controller.group.find<Konva.Text>("Text").some((text) => text.text() === "Circle Tower"),
    ).toBe(false);

    towerProgress.maxLevels.set("circle", 0);
    controller.hide();
    controller.show();
    model = models[models.length - 1];

    expect(model.map.id).toBe("map2");
    expect(
      controller.group.find<Konva.Text>("Text").some((text) => text.text() === "Circle Tower"),
    ).toBe(true);
  });

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
      model.events.emit("waveCleared", { wave: number, bonus: 0 });
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

  it("Start Wave updates the HUD through the first two waves", () => {
    const total = map.waves.length;
    clickButton("Start Wave");
    expect(hud()).toContain(`Wave: 1/${total}   ·   Enemies Remaining: ${waveSize(1)}`);

    // Spawn all of wave 1, then kill one enemy and let the rest leak.
    model.tick(lastSpawnSeconds(1) + 0.1);
    expect(model.enemies).toHaveLength(waveSize(1));
    const first = model.enemies[0];
    model.events.emit("enemyKilled", { enemyId: first.id, reward: first.def.reward });
    expect(controller.group.findOne<Konva.Text>(".game-coins")!.text()).toBe(
      `Coins: ${map.startingCoins + first.def.reward}`,
    );
    expect(hud()).toContain(`Enemies Remaining: ${waveSize(1) - 1}`);
    for (let i = 1; i < waveSize(1); i++) {
      model.events.emit("enemyLeaked", { enemyId: model.enemies[i].id });
    }
    expect(hud()).toContain(`Wave: 1/${total}   ·   Enemies Remaining: 0`);

    // A click skips preparation and starts wave 2 immediately.
    clickStartWave();
    expect(model.waves.currentWave).toBe(2);
    // These enemies were removed through events above; remove their stale model objects.
    model.enemies = [];
    model.tick(0);
    expect(hud()).toContain(`Wave: 2/${total}   ·   Enemies Remaining: ${waveSize(2)}`);
    model.tick(lastSpawnSeconds(2) + 0.1);
    const wave2 = [...model.enemies];
    for (const enemy of wave2) {
      model.events.emit("enemyLeaked", { enemyId: enemy.id });
    }
    expect(hud()).toContain(`Wave: 2/${total}   ·   Enemies Remaining: 0`);
    // Wave 2 is not the last one, so the button now starts wave 3.
    clickStartWave();
    expect(model.waves.currentWave).toBe(3);
    expect(hud()).toContain(`Wave: 3/${total}`);
  });
});

describe("GameScreenController feedback", () => {
  function textsOnScreen(): string[] {
    return controller.group.find<Konva.Text>("Text").map((text) => text.text());
  }

  it("shows the reward where an enemy is defeated", () => {
    model.spawnEnemy("basic");
    const enemy = model.enemies[0];
    enemy.takeDamage(enemy.hp);
    model.tick(0.1);

    expect(textsOnScreen()).toContain(`+${enemy.def.reward}`);
  });

  it("draws a health bar once an enemy is damaged", () => {
    model.spawnEnemy("basic");
    const barColor = "#34c97a";
    const bars = () =>
      controller.group.find<Konva.Rect>("Rect").filter((rect) => rect.fill() === barColor);

    frames[frames.length - 1](0.1);
    expect(bars()).toHaveLength(0);

    model.enemies[0].takeDamage(1);
    frames[frames.length - 1](0.1);
    expect(bars()).toHaveLength(1);
  });

  it("shows the wave number when a wave starts", () => {
    clickButton("Start Wave");
    expect(textsOnScreen()).toContain("Wave 1");
  });

  it("says how many coins clearing a wave gave", () => {
    model.events.emit("waveCleared", { wave: 1, bonus: 25 });
    expect(textsOnScreen()).toContain("Wave 1 cleared: +25 coins");
  });

  it("says nothing about coins for a wave with no bonus", () => {
    model.events.emit("waveCleared", { wave: 1, bonus: 0 });
    expect(textsOnScreen().some((text) => text.includes("cleared"))).toBe(false);
  });

  it("shows the bonus in the coins at the top", () => {
    const before = model.wallet.coins;
    model.events.emit("waveCleared", { wave: 1, bonus: 25 });
    expect(controller.group.findOne<Konva.Text>(".game-coins")!.text()).toBe(
      `Coins: ${before + 25}`,
    );
  });

  it("flashes the red frame when an enemy leaks", () => {
    const frame = controller.group
      .getChildren()
      .find((node) => node instanceof Konva.Rect && node.stroke() === "#ff3b3b");
    if (!(frame instanceof Konva.Rect)) {
      throw new Error("The leak frame is missing from the screen");
    }
    expect(frame.opacity()).toBe(0);

    model.events.emit("enemyLeaked", { enemyId: 1 });
    expect(frame.opacity()).toBeGreaterThan(0.9); // the fade-out has just started
  });
});

// The tutorial's current tip, read from the screen
function tutorialText(): string {
  const tip = controller.group.findOne<Konva.Text>(".tutorial-tip");
  if (tip === undefined) {
    throw new Error("The tutorial is missing from the screen");
  }
  return tip.text();
}

describe("GameScreenController questions during gameplay", () => {
  function openQuestion() {
    let answer!: (correct: boolean) => void;
    vi.spyOn(GridView.prototype, "tileUnderMouse").mockReturnValue({ x: 0, y: 2 });
    const ask = vi.spyOn(QuestionPrompt.prototype, "ask").mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          answer = resolve;
        }),
    );
    const title = controller.group
      .find<Konva.Text>("Text")
      .find((text) => text.text() === "Circle Tower")!;
    const card = title.getParent()!;
    card.fire("pointerdown");
    window.dispatchEvent(new Event("pointerup"));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(ask).toHaveBeenCalledTimes(1);
    return { answer, ask, card };
  }

  async function settleAnswer() {
    for (let i = 0; i < 5; i++) await Promise.resolve();
  }

  it("uses TowersView for placement and firing without adding a duplicate marker", async () => {
    const add = vi.spyOn(TowersView.prototype, "add");
    const fire = vi.spyOn(TowersView.prototype, "fire").mockImplementation(() => {});
    const { answer } = openQuestion();
    // The shop card's icon has the same color, so count the circles before and after placing
    const circleTowerCount = () =>
      controller.group
        .find<Konva.Circle>("Circle")
        .filter((circle) => circle.fill() === CIRCLE_TOWER_COLOR).length;
    const before = circleTowerCount();

    answer(true);
    await settleAnswer();

    expect(model.towers).toHaveLength(1);
    const tower = model.towers[0];
    expect(add).toHaveBeenCalledExactlyOnceWith(tower);
    expect(circleTowerCount()).toBe(before + 1);

    model.spawnEnemy("tank"); // slow enough to still be in range when the first shot comes
    model.tick(1 / tower.fireRate);
    expect(fire).toHaveBeenCalledExactlyOnceWith(tower.id);

    controller.hide();
    model.events.emit("towerFired", { towerId: tower.id });
    expect(fire).toHaveBeenCalledTimes(1);
  });

  it("keeps the loop running while a question is pending and places once after answering", async () => {
    const stop = vi.spyOn(GameLoop.prototype, "stop");
    const start = vi.spyOn(GameLoop.prototype, "start").mockClear();
    model.startNextWave();
    model.tick(0);
    const { answer, ask, card } = openQuestion();
    const distanceBefore = model.enemies[0].distance;

    model.tick(0.5);
    expect(model.enemies[0].distance).toBeGreaterThan(distanceBefore);
    card.fire("pointerdown");
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(ask).toHaveBeenCalledTimes(1);
    expect(stop).not.toHaveBeenCalled();

    answer(true);
    await settleAnswer();
    expect(model.towers).toHaveLength(1);
    expect(start).not.toHaveBeenCalled();
  });

  it("rejects a correct answer if the game ends while the question is open", async () => {
    const cancel = vi.spyOn(QuestionPrompt.prototype, "cancel");
    const { answer } = openQuestion();
    model.lives.remaining = 0;
    model.tick(0);

    expect(cancel).toHaveBeenCalled();
    answer(true);
    await settleAnswer();
    expect(model.towers).toHaveLength(0);
  });

  it("rejects an old answer after leaving and starting a fresh game", async () => {
    const { answer } = openQuestion();
    const oldModel = model;
    controller.hide();
    controller.show();
    model = models[models.length - 1];

    answer(true);
    await settleAnswer();
    expect(oldModel.towers).toHaveLength(0);
    expect(model.towers).toHaveLength(0);
  });

  it("rechecks match coins after answering", async () => {
    const message = vi.spyOn(GameScreenView.prototype, "showMessage");
    const { answer } = openQuestion();
    model.wallet.spend(model.wallet.coins);
    answer(true);
    await settleAnswer();

    expect(model.towers).toHaveLength(0);
    expect(model.wallet.coins).toBe(0);
    expect(message).toHaveBeenCalledWith("Not enough coins");
  });

  it.each([
    ["locked", "Unlock this tower in the Tower Shop first"],
    ["occupied", "There is already a tower on this tile"],
    ["blocked", "Can't place a tower here"],
  ] as const)("shows a readable message when placement is %s", async (result, text) => {
    const message = vi.spyOn(GameScreenView.prototype, "showMessage");
    const { answer } = openQuestion();
    vi.spyOn(model, "tryPlaceTower").mockReturnValue(result);

    answer(true);
    await settleAnswer();

    expect(message).toHaveBeenCalledWith(text);
    expect(model.towers).toHaveLength(0);
  });

  it("moves the tutorial on once the tower's question opens and once the tower is built", async () => {
    clickButton("Show me");
    const { answer } = openQuestion();
    expect(tutorialText()).toContain("Answer the question");

    answer(true);
    await settleAnswer();
    expect(tutorialText()).toContain("Press Start Wave");
  });

  it("passes the tutorial's wave and speed tips if the player did them before building", async () => {
    clickButton("Show me");
    clickButton("Start Wave");
    window.dispatchEvent(new KeyboardEvent("keydown", { key: " " }));
    expect(tutorialText()).toContain("Drag a tower"); // still waiting for the first tower

    const { answer } = openQuestion();
    answer(true);
    await settleAnswer();
    expect(tutorialText()).toContain("Click a tower on the map to upgrade it");
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
    model.events.emit("waveCleared", { wave: map.waves.length, bonus: 0 });
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

// Clicks the icon button with this name, e.g. "back" or "settings"
function clickIcon(name: string): void {
  const button = controller.group.findOne("." + name);
  if (button === undefined) {
    throw new Error(`${name} button is missing from the screen`);
  }
  button.fire("click");
}

describe("GameScreenController back arrow", () => {
  it("goes back to the map screen without recording a result", () => {
    clickIcon("back");

    expect(switchTo).toHaveBeenCalledWith("maps");
    expect(model.result).toBeNull();
    expect(progress.starsFor("map1")).toBe(0);
  });

  it("hides once the first wave starts and shows again in a new game", () => {
    const back = controller.group.findOne(".back");
    expect(back?.visible()).toBe(true);

    clickButton("Start Wave");
    expect(back?.visible()).toBe(false);

    controller.hide();
    controller.show();
    expect(back?.visible()).toBe(true);
  });
});

describe("GameScreenController settings", () => {
  function settingsOpen(): boolean {
    const title = controller.group.find<Konva.Text>("Text").find((t) => t.text() === "Settings");
    if (title === undefined) {
      throw new Error("Settings title is missing from the screen");
    }
    return title.isVisible();
  }

  it("pauses the game while open and goes on after Resume", () => {
    const stop = vi.spyOn(GameLoop.prototype, "stop");
    const start = vi.spyOn(GameLoop.prototype, "start");

    clickIcon("settings");
    expect(settingsOpen()).toBe(true);
    expect(stop).toHaveBeenCalled();

    start.mockClear(); // show() already started the loop once
    clickButton("Resume");
    expect(settingsOpen()).toBe(false);
    expect(start).toHaveBeenCalled();
  });

  it("goes back to the map screen", () => {
    clickIcon("settings");
    clickButton("Back to maps");
    expect(switchTo).toHaveBeenCalledWith("maps");
  });

  it("restarts the same map without recording a result", () => {
    clickIcon("settings");
    clickButton("Restart");
    expect(switchTo).toHaveBeenCalledWith("game");
    expect(progress.starsFor("map1")).toBe(0);
  });

  it("goes to the main menu without recording a result", () => {
    clickIcon("settings");
    clickButton("Main menu");
    expect(switchTo).toHaveBeenCalledWith("menu");
    expect(progress.starsFor("map1")).toBe(0);
  });

  it("is closed again when a new game starts", () => {
    clickIcon("settings");
    controller.hide();
    controller.show();
    expect(settingsOpen()).toBe(false);
  });

  it("closes with Escape and the game goes on", () => {
    const start = vi.spyOn(GameLoop.prototype, "start");
    clickIcon("settings");
    start.mockClear(); // show() already started the loop once

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(settingsOpen()).toBe(false);
    expect(start).toHaveBeenCalled();
  });

  it("ignores Escape after leaving the game from the settings", () => {
    const start = vi.spyOn(GameLoop.prototype, "start");
    clickIcon("settings");
    clickButton("Back to maps");
    controller.hide(); // the App hides the game screen on the switch
    start.mockClear();

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(start).not.toHaveBeenCalled();
  });
});

describe("GameScreenController Tower Shop coins", () => {
  // Wins the current game with this many lives left
  function win(lives: number): void {
    model.lives.remaining = lives;
    model.events.emit("waveCleared", { wave: map.waves.length, bonus: 0 });
    model.tick(0);
  }

  it.each([
    [map.startingLives, 3, 75],
    [map.startingLives / 2, 2, 50],
    [1, 1, 25],
  ])("pays a win with %i lives left (%i stars) %i coins", (lives, stars, reward) => {
    win(lives);
    expect(model.result).toMatchObject({ won: true, stars, shopCoinsEarned: reward });
    expect(towerProgress.shopCoins).toBe(200 + reward);
  });

  it("pays again for winning the same map again", () => {
    win(1);
    controller.hide();
    controller.show();
    model = models[models.length - 1];
    win(map.startingLives);
    expect(model.result).toMatchObject({ won: true, stars: 3, shopCoinsEarned: 75 });
    expect(towerProgress.shopCoins).toBe(300);
  });

  it("pays nothing for a loss", () => {
    model.lives.remaining = 0;
    model.tick(0);
    expect(model.result).toMatchObject({ won: false, shopCoinsEarned: 0 });
    expect(towerProgress.shopCoins).toBe(200);
  });

  it("does not reward leaving an unfinished match", () => {
    clickIcon("back");
    controller.hide();
    expect(towerProgress.shopCoins).toBe(200);
    expect(switchTo).toHaveBeenCalledWith("maps");
  });
});

describe("GameScreenController mini-game bonus coins", () => {
  // Starts a new game, the way the App does when the player picks a map again
  function startNewGame(): void {
    controller.hide();
    controller.show();
    model = models[models.length - 1];
  }

  it("adds the bonus to the starting coins", () => {
    progress.addMiniGameReward(3);
    startNewGame();
    expectHud(map.startingCoins + progress.bonusCoins, map.startingLives, 0, 0);
  });

  it("uses up the bonus when the game is lost", () => {
    progress.addMiniGameReward(3);
    startNewGame();
    model.lives.remaining = 0;
    model.tick(0);

    expect(progress.bonusCoins).toBe(0);
    startNewGame();
    expectHud(map.startingCoins, map.startingLives, 0, 0);
  });

  it("uses up the bonus when the game is won", () => {
    progress.addMiniGameReward(3);
    const bonus = progress.bonusCoins;
    startNewGame();
    model.events.emit("waveCleared", { wave: map.waves.length, bonus: 0 });
    model.tick(0);

    // The bonus was part of this game's coins, so it counts in the final coins
    expect(model.result).toMatchObject({ won: true, finalCoins: map.startingCoins + bonus });
    expect(progress.bonusCoins).toBe(0);
  });

  it("keeps the bonus when the player leaves with the back arrow", () => {
    progress.addMiniGameReward(3);
    const bonus = progress.bonusCoins;
    startNewGame();
    clickIcon("back");

    expect(progress.bonusCoins).toBe(bonus);
    startNewGame();
    expectHud(map.startingCoins + bonus, map.startingLives, 0, 0);
  });

  it("keeps the whole bonus even if the player spent coins before leaving", () => {
    progress.addMiniGameReward(3);
    const bonus = progress.bonusCoins;
    startNewGame();
    model.wallet.spend(bonus);
    clickIcon("back");

    expect(progress.bonusCoins).toBe(bonus);
    startNewGame();
    expectHud(map.startingCoins + bonus, map.startingLives, 0, 0);
  });

  it("keeps the bonus when the player leaves with Settings → Back to maps", () => {
    progress.addMiniGameReward(3);
    const bonus = progress.bonusCoins;
    startNewGame();
    clickIcon("settings");
    clickButton("Back to maps");

    expect(switchTo).toHaveBeenCalledWith("maps");
    expect(progress.bonusCoins).toBe(bonus);
    startNewGame();
    expectHud(map.startingCoins + bonus, map.startingLives, 0, 0);
  });

  it("keeps the bonus when the player leaves with Settings → Main menu", () => {
    progress.addMiniGameReward(3);
    const bonus = progress.bonusCoins;
    startNewGame();
    clickIcon("settings");
    clickButton("Main menu");

    expect(switchTo).toHaveBeenCalledWith("menu");
    expect(progress.bonusCoins).toBe(bonus);
    startNewGame();
    expectHud(map.startingCoins + bonus, map.startingLives, 0, 0);
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

describe("GameScreenController shop cards", () => {
  beforeEach(() => {
    controller.hide();
    for (const tower of TOWERS) towerProgress.maxLevels.set(tower.id, 0);
    controller.show();
  });
  const CARD_HEIGHT = 340;

  // The cards, top to bottom, found by the tower name on each.
  function cards(): Konva.Group[] {
    return ["Circle Tower", "Triangle Tower", "Square Tower"].map((name) => {
      const title = controller.group.find<Konva.Text>("Text").find((t) => t.text() === name);
      if (title === undefined) throw new Error(`${name} card is missing from the shop`);
      return title.getParent() as Konva.Group;
    });
  }

  it("has a card for every tower, in the order of towers.json", () => {
    expect(cards()).toHaveLength(3);
  });

  it.each([600, 800, 1080])(
    "fit above the wave countdown without overlapping at height %i",
    (height) => {
      controller.resize(1280, height);
      const [first, second, third] = cards();
      const bottom = (card: Konva.Group) => card.y() + CARD_HEIGHT * card.scaleY();

      expect(first.y()).toBeGreaterThan(0);
      expect(bottom(first)).toBeLessThanOrEqual(second.y());
      expect(bottom(second)).toBeLessThanOrEqual(third.y());
      expect(bottom(third)).toBeLessThanOrEqual(height - 140); // the countdown text starts there
    },
  );

  it("keep their full size when there is room", () => {
    controller.resize(1280, 2000);
    for (const card of cards()) expect(card.scaleX()).toBe(1);
  });

  it("grow back when the window gets taller again", () => {
    controller.resize(1280, 600);
    const small = cards()[0].scaleX();
    controller.resize(1280, 1080);
    expect(cards()[0].scaleX()).toBeGreaterThan(small);
  });

  it("stay inside the shop panel's width", () => {
    controller.resize(1280, 600);
    for (const card of cards()) {
      expect(card.x()).toBeGreaterThanOrEqual(0);
      expect(card.x() + 228 * card.scaleX()).toBeLessThanOrEqual(260);
    }
  });
});

describe("GameScreenController tower upgrades", () => {
  it("creates one tower sprite and forwards firing events to its animation", () => {
    const add = vi.spyOn(TowersView.prototype, "add");
    const fire = vi.spyOn(TowersView.prototype, "fire").mockImplementation(() => {});
    expect(model.tryPlaceTower("circle", { x: 0, y: 2 })).toBe("ok");
    const tower = model.towers[0];

    expect(add).toHaveBeenCalledExactlyOnceWith(tower);
    model.spawnEnemy("tank"); // slow enough to still be in range when the first shot comes
    model.tick(1 / tower.fireRate);

    expect(fire).toHaveBeenCalledExactlyOnceWith(tower.id);
    controller.hide();
    model.events.emit("towerFired", { towerId: tower.id });
    expect(fire).toHaveBeenCalledTimes(1);
  });

  function prepareTower() {
    towerProgress.maxLevels.set("circle", 1);
    model.wallet.add(200);
    expect(model.tryPlaceTower("circle", { x: 0, y: 2 })).toBe("ok");

    const grid = grids[grids.length - 1];
    vi.spyOn(grid, "tileUnderMouse").mockReturnValue({ x: 0, y: 2 });
    return grid;
  }

  it("shows upgrade information on hover and refreshes it after clicking", () => {
    const grid = prepareTower();
    const hint = controller.group.findOne<Konva.Group>(".tower-upgrade-hint")!;
    const hintText = () =>
      hint
        .find<Konva.Text>("Text")
        .map((node) => node.text())
        .join("\n");
    grid.group.fire("pointermove");
    expect(hint.visible()).toBe(true);
    expect(hintText()).toContain("Upgrade to Level 2 · 75 coins");
    expect(hintText()).toContain("Click this tower to upgrade.");
    grid.group.fire("click");
    expect(hintText()).toContain("Circle Tower · Level 2");
    expect(hintText()).toContain("Unlock Level 3 in the Tower Shop first.");
    grid.group.fire("pointerleave");
    expect(hint.visible()).toBe(false);
  });

  it("refreshes hover affordability when the wallet changes", () => {
    const grid = prepareTower();
    grid.group.fire("pointermove");
    model.wallet.spend(model.wallet.coins);
    const hint = controller.group.findOne<Konva.Group>(".tower-upgrade-hint")!;
    expect(
      hint.find<Konva.Text>("Text").some((node) => node.text().startsWith("Need 75 more coins.")),
    ).toBe(true);
  });

  it("hides the upgrade hint on empty tiles, in settings, and when leaving the game", () => {
    const grid = prepareTower();
    const hint = controller.group.findOne<Konva.Group>(".tower-upgrade-hint")!;
    grid.group.fire("pointermove");
    expect(hint.visible()).toBe(true);
    vi.mocked(grid.tileUnderMouse).mockReturnValue({ x: 1, y: 2 });
    grid.group.fire("pointermove");
    expect(hint.visible()).toBe(false);
    vi.mocked(grid.tileUnderMouse).mockReturnValue({ x: 0, y: 2 });
    grid.group.fire("pointermove");
    clickIcon("settings");
    expect(hint.visible()).toBe(false);
    controller.hide();
    grid.group.fire("pointermove");
    expect(hint.visible()).toBe(false);
  });

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

  it("does not upgrade while the settings panel is open", () => {
    const grid = prepareTower();
    const upgrade = vi.spyOn(model, "tryUpgradeTower");
    clickIcon("settings");

    grid.group.fire("click");

    expect(upgrade).not.toHaveBeenCalled();
    expect(model.towers[0].level).toBe(0);
  });

  it("shows a rejected upgrade without spending coins", () => {
    const grid = prepareTower();
    towerProgress.maxLevels.set("circle", 0);
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

it("refreshes timers through simulated frames and resets them on re-entry", () => {
  const frame = frames[frames.length - 1];
  const timer = () =>
    controller.group
      .find<Konva.Text>("Text")
      .find((text) => /^(Next Wave In|Last Enemy Spawns In):/.test(text.text()));
  expect(timer()).toBeUndefined();
  clickStartWave();
  expect(timer()?.text()).toBe(`Last Enemy Spawns In: ${Math.ceil(lastSpawnSeconds(1))}s`);
  frame(Math.ceil(lastSpawnSeconds(1)));
  expect(timer()).toBeUndefined();
  for (const enemy of model.enemies) enemy.takeDamage(enemy.hp);
  frame(0);
  expect(timer()?.text()).toBe(`Next Wave In: ${WAVE_PREPARATION_SECONDS}s`);
  frame(1);
  expect(timer()?.text()).toBe(`Next Wave In: ${WAVE_PREPARATION_SECONDS - 1}s`);
  frame(WAVE_PREPARATION_SECONDS - 1);
  expect(hud()).toContain(`Wave: 2/${map.waves.length}`);
  expect(timer()?.text()).toBe(`Last Enemy Spawns In: ${Math.ceil(lastSpawnSeconds(2))}s`);
  const stop = vi.spyOn(GameLoop.prototype, "stop");
  controller.hide();
  expect(stop).toHaveBeenCalled();
  const elapsed = model.elapsedSeconds;
  frame(5);
  expect(model.elapsedSeconds).toBe(elapsed);
  controller.show();
  model = models[models.length - 1];
  expect(model.waves.preparationRemaining).toBeNull();
  expect(timer()).toBeUndefined();
  expectHud(map.startingCoins, map.startingLives, 0, 0);
});

it("shows an early-start button only during preparation and clears it after the final wave", () => {
  const button = () =>
    controller.group
      .find<Konva.Text>("Text")
      .find((text) => ["Start Wave", "Start Next Wave"].includes(text.text()))!;
  expect(button().text()).toBe("Start Wave");
  expect(button().getParent()!.visible()).toBe(true);
  clickStartWave();
  expect(button().getParent()!.visible()).toBe(false);
  model.tick(lastSpawnSeconds(1) + 0.01);
  for (const enemy of model.enemies) enemy.takeDamage(enemy.hp);
  model.tick(0);
  expect(button().text()).toBe("Start Next Wave");
  expect(button().getParent()!.visible()).toBe(true);
  clickStartWave();
  clickStartWave();
  expect(model.waves.currentWave).toBe(2);
  expect(model.waves.preparationRemaining).toBeNull();
  expect(button().getParent()!.visible()).toBe(false);
  expect(hud()).toContain(`Wave: 2/${map.waves.length}   ·   Enemies Remaining: ${waveSize(2)}`);
  // Play out every remaining wave, killing each enemy as it spawns so none leak.
  for (let wave = 2; wave <= map.waves.length; wave++) {
    while (model.waves.lastSpawnRemaining !== null) {
      model.tick(0.1);
      for (const enemy of model.enemies) enemy.takeDamage(enemy.hp);
    }
    for (const enemy of model.enemies) enemy.takeDamage(enemy.hp);
    model.tick(0);
    if (wave < map.waves.length) clickStartWave();
  }
  expect(model.result?.won).toBe(true);
  expect(button().getParent()!.visible()).toBe(false);
  expect(
    controller.group
      .find<Konva.Text>("Text")
      .some((text) => text.text().startsWith("Next Wave In:")),
  ).toBe(false);
  clickStartWave();
  expect(model.waves.currentWave).toBe(map.waves.length); // the game is over, so nothing starts
  controller.hide();
  controller.show();
  expect(button().text()).toBe("Start Wave");
  expect(button().getParent()!.visible()).toBe(true);
});

const press = (key: string) => window.dispatchEvent(new KeyboardEvent("keydown", { key }));
const settlePlacement = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

function openPlacementQuestion() {
  vi.spyOn(GridView.prototype, "tileUnderMouse").mockReturnValue({ x: 0, y: 2 });
  vi.spyOn(QuestionService.prototype, "questionFor").mockReturnValue({
    id: "test",
    prompt: "2 + 3?",
    answer: 5,
    tolerance: 0,
    hint: "Add them.",
    title: "Test Question",
  });
  const ask = vi.spyOn(QuestionPrompt.prototype, "ask");
  const card = controller.group
    .find<Konva.Text>("Text")
    .find((text) => text.text() === TOWERS.find((tower) => tower.id === "circle")!.name)!
    .getParent()!;
  card.fire("pointerdown");
  window.dispatchEvent(new Event("pointerup"));
  press("Enter");
  expect(ask).toHaveBeenCalledTimes(1);
  return { ask, card, prompt: ask.mock.instances[0] as QuestionPrompt };
}

it("keeps simulation and automatic waves running while an unanswered prompt stays functional", async () => {
  clickStartWave();
  const frame = frames[frames.length - 1];
  frame(4.8);
  for (const enemy of model.enemies) enemy.takeDamage(enemy.hp);
  frame(0);
  const stop = vi.spyOn(GameLoop.prototype, "stop");
  const start = vi.spyOn(GameLoop.prototype, "start").mockClear();
  const { prompt } = openPlacementQuestion();
  frame(1);
  expect(model.waves.preparationRemaining).toBe(WAVE_PREPARATION_SECONDS - 1);
  for (let i = 0; i < WAVE_PREPARATION_SECONDS - 1; i++) frame(1);
  expect(model.waves.currentWave).toBe(2);
  expect(model.enemies).toHaveLength(1);
  const distance = model.enemies[0].distance;
  frame(1);
  expect(model.enemies.length).toBeGreaterThan(1);
  expect(model.enemies[0].distance).toBeGreaterThan(distance);
  expect(prompt.group.visible()).toBe(true);
  press("5");
  press("Enter");
  await settlePlacement();
  expect(model.towers).toHaveLength(1);
  expect(stop).not.toHaveBeenCalled();
  expect(start).not.toHaveBeenCalled();
});

it("keeps the settings closed while a question is open, so one Escape only closes the question", () => {
  const { prompt } = openPlacementQuestion();
  clickIcon("settings");

  const title = controller.group.find<Konva.Text>("Text").find((t) => t.text() === "Settings");
  if (title === undefined) {
    throw new Error("Settings title is missing from the screen");
  }
  expect(title.isVisible()).toBe(false);
  expect(prompt.group.visible()).toBe(true);
});

it("prevents duplicate prompts and placements while retaining retries", async () => {
  const { ask, card, prompt } = openPlacementQuestion();
  card.fire("pointerdown");
  window.dispatchEvent(new Event("pointerup"));
  press("4");
  press("Enter");
  expect(model.towers).toHaveLength(0);
  expect(prompt.group.visible()).toBe(true);
  expect(ask).toHaveBeenCalledTimes(1);
  press("Backspace"); // a wrong answer stays in the box, so clear it before retrying
  press("5");
  press("Enter");
  press("Enter");
  await settlePlacement();
  expect(model.towers).toHaveLength(1);
  expect(ask).toHaveBeenCalledTimes(1);
});

it("does not place a tower after exhausting incorrect answers", async () => {
  const { prompt } = openPlacementQuestion();
  press("4");
  press("Enter");
  press("4"); // the box now reads "44", still wrong
  press("Enter");
  expect(prompt.group.visible()).toBe(true); // showing the right answer until dismissed
  press("Enter");
  await settlePlacement();
  expect(model.towers).toHaveLength(0);
  expect(prompt.group.visible()).toBe(false);
});

it("places the tower as soon as the answer is correct, while Correct! is still showing", async () => {
  const { prompt } = openPlacementQuestion();
  press("5");
  press("Enter");
  await settlePlacement();
  expect(model.towers).toHaveLength(1);
  expect(prompt.group.visible()).toBe(true);

  press("Enter"); // closes the popup and places nothing more
  await settlePlacement();
  expect(prompt.group.visible()).toBe(false);
  expect(model.towers).toHaveLength(1);
});

it("closes a Correct! popup when the game ends", async () => {
  const { prompt } = openPlacementQuestion();
  press("5");
  press("Enter");
  await settlePlacement();
  model.lives.remaining = 0;
  frames[frames.length - 1](0);
  expect(prompt.group.visible()).toBe(false);
});

it("titles the question after the tower or the general pool", () => {
  vi.spyOn(GridView.prototype, "tileUnderMouse").mockReturnValue({ x: 0, y: 2 });
  const ask = vi.spyOn(QuestionPrompt.prototype, "ask");
  const circle = TOWERS.find((tower) => tower.id === "circle")!;
  controller.group
    .find<Konva.Text>("Text")
    .find((text) => text.text() === circle.name)!
    .getParent()!
    .fire("pointerdown");
  window.dispatchEvent(new Event("pointerup"));
  press("Enter");
  expect(ask).toHaveBeenCalledTimes(1);
  expect(["General Geometry Question", `${circle.name} Question`]).toContain(
    ask.mock.calls[0][0].title,
  );
});

it.each(["defeat", "victory"])(
  "cancels a pending question on %s without relying on navigation",
  async (outcome) => {
    const { prompt } = openPlacementQuestion();
    if (outcome === "defeat") model.lives.remaining = 0;
    else model.events.emit("waveCleared", { wave: model.waves.totalWaves, bonus: 0 });
    frames[frames.length - 1](0);
    expect(prompt.group.visible()).toBe(false);
    press("5");
    press("Enter");
    await settlePlacement();
    expect(model.towers).toHaveLength(0);
    expect(switchTo).toHaveBeenCalledWith("result", model.result);
  },
);

it("rejects an already-correct answer if game over occurs before the continuation", async () => {
  openPlacementQuestion();
  press("5");
  press("Enter");
  model.lives.remaining = 0;
  frames[frames.length - 1](0);
  await settlePlacement();
  expect(model.towers).toHaveLength(0);
});

it("invalidates a resolved answer when leaving and immediately re-entering", async () => {
  const { prompt } = openPlacementQuestion();
  press("5");
  press("Enter"); // correct: the popup stays open showing Correct!
  const oldModel = model;
  controller.hide();
  expect(prompt.group.visible()).toBe(false); // leaving closes it anyway
  controller.show();
  model = models[models.length - 1];
  await settlePlacement();
  expect(oldModel.towers).toHaveLength(0);
  expect(model.towers).toHaveLength(0);
  expect(model.waves.currentWave).toBe(0);
});

it("cancels an unanswered question on leaving", async () => {
  const { prompt } = openPlacementQuestion();
  controller.hide();
  expect(prompt.group.visible()).toBe(false);
  await settlePlacement();
  expect(model.towers).toHaveLength(0);
});

it("rechecks funds after a correct answer", async () => {
  openPlacementQuestion();
  model.wallet.spend(model.wallet.coins);
  press("5");
  press("Enter");
  await settlePlacement();
  expect(model.towers).toHaveLength(0);
  expect(model.wallet.coins).toBe(0);
});

describe("GameScreenController game speed", () => {
  // The text on the speed button: "1x", "2x" or "0.5x"
  function speedLabel(): string {
    const button = controller.group.findOne<Konva.Group>(".speed");
    if (button === undefined) {
      throw new Error("speed button is missing from the screen");
    }
    const label = button.findOne<Konva.Text>("Text");
    if (label === undefined) {
      throw new Error("speed button has no label");
    }
    return label.text();
  }

  // Runs one frame of the game loop, dt seconds long
  function runFrame(dt: number): void {
    frames[frames.length - 1](dt);
  }

  it("starts at normal speed: one frame moves the game by dt", () => {
    runFrame(0.1);

    expect(speedLabel()).toBe("1x");
    expect(model.elapsedSeconds).toBeCloseTo(0.1);
  });

  it("runs two steps per frame after a click on the speed button", () => {
    clickIcon("speed");
    runFrame(0.1);

    expect(speedLabel()).toBe("2x");
    expect(model.elapsedSeconds).toBeCloseTo(0.2);
  });

  it("runs at half speed after a second click", () => {
    clickIcon("speed");
    clickIcon("speed");
    runFrame(0.1);

    expect(speedLabel()).toBe("0.5x");
    expect(model.elapsedSeconds).toBeCloseTo(0.05);
  });

  it("goes back to normal speed on a third click", () => {
    clickIcon("speed");
    clickIcon("speed");
    clickIcon("speed");
    runFrame(0.1);

    expect(speedLabel()).toBe("1x");
    expect(model.elapsedSeconds).toBeCloseTo(0.1);
  });

  it("switches the speed with the Space key", () => {
    press(" ");
    expect(speedLabel()).toBe("2x");

    press(" ");
    expect(speedLabel()).toBe("0.5x");

    press(" ");
    expect(speedLabel()).toBe("1x");
  });

  it("ignores Space while the settings are open", () => {
    clickIcon("settings");
    press(" ");

    expect(speedLabel()).toBe("1x");
  });

  it("ignores Space while a question is open", () => {
    openPlacementQuestion();
    press(" ");

    expect(speedLabel()).toBe("1x");
  });

  it("drops to one step per frame while a question is open", () => {
    clickIcon("speed");
    openPlacementQuestion();
    runFrame(0.1);

    expect(speedLabel()).toBe("2x");
    expect(model.elapsedSeconds).toBeCloseTo(0.1);
  });

  it("stays at half speed while a question is open", () => {
    clickIcon("speed");
    clickIcon("speed");
    openPlacementQuestion();
    runFrame(0.1);

    expect(speedLabel()).toBe("0.5x");
    expect(model.elapsedSeconds).toBeCloseTo(0.05);
  });

  it("keeps the chosen speed for the next game", () => {
    clickIcon("speed");
    controller.hide();
    controller.show();
    model = models[models.length - 1];
    runFrame(0.1);

    expect(speedLabel()).toBe("2x");
    expect(model.elapsedSeconds).toBeCloseTo(0.2);
  });

  it("ignores Space after leaving the game screen", () => {
    controller.hide();
    press(" ");

    expect(speedLabel()).toBe("1x");
  });
});

describe("GameScreenController sound effects", () => {
  it("plays the wave cue when a wave starts", () => {
    clickStartWave();

    expect(playSound).toHaveBeenCalledWith("wave");
  });

  it("plays a pop for a kill and a thud for a lost life", () => {
    model.events.emit("enemyKilled", { enemyId: 1, reward: 5 });
    expect(playSound).toHaveBeenLastCalledWith("pop");

    model.events.emit("enemyLeaked", { enemyId: 2 });
    expect(playSound).toHaveBeenLastCalledWith("leak");
  });

  it("plays the place sound when a tower is placed", () => {
    expect(model.tryPlaceTower("circle", { x: 0, y: 2 })).toBe("ok");

    expect(playSound).toHaveBeenCalledWith("place");
  });

  it("plays the win sound for a won game and the lose sound for a lost one", () => {
    model.events.emit("gameOver", { won: true });
    expect(playSound).toHaveBeenLastCalledWith("win");

    model.events.emit("gameOver", { won: false });
    expect(playSound).toHaveBeenLastCalledWith("lose");
  });

  it("plays nothing for a tower that fires", () => {
    model.events.emit("towerFired", { towerId: 1 });

    expect(playSound).not.toHaveBeenCalled();
  });

  it("plays nothing after leaving the game screen", () => {
    controller.hide();
    model.events.emit("enemyKilled", { enemyId: 1, reward: 5 });

    expect(playSound).not.toHaveBeenCalled();
  });
});

describe("GameScreenController confirm and cancel squares", () => {
  // The square tower is unlocked too, so there is an aimed tower to test with. The screen sits on
  // a real stage, because the aiming listens to the stage's pointer moves.
  let stage: Konva.Stage;
  beforeEach(() => {
    controller.hide();
    stage = new Konva.Stage({ container: document.createElement("div"), width: 1280, height: 720 });
    const layer = new Konva.Layer();
    stage.add(layer);
    layer.add(controller.group);
    for (const tower of TOWERS) towerProgress.maxLevels.set(tower.id, 0);
    controller.show();
    model = models[models.length - 1];
    vi.spyOn(GridView.prototype, "tileUnderMouse").mockReturnValue({ x: 0, y: 2 });
    vi.spyOn(QuestionService.prototype, "questionFor").mockReturnValue({
      id: "test",
      title: "Test Question",
      prompt: "2 + 3?",
      answer: 5,
      tolerance: 0,
      hint: "Add them.",
    });
  });
  afterEach(() => stage.destroy());

  const textNamed = (name: string) =>
    controller.group.find<Konva.Text>("Text").find((text) => text.text() === name)!;
  const dropTower = (name: string) => {
    textNamed(name).getParent()!.fire("pointerdown");
    window.dispatchEvent(new Event("pointerup"));
  };
  // The group holding the two squares: it is the parent of the "Enter" key hint
  const squares = () => textNamed("Enter").getParent() as Konva.Group;
  const green = () => squares().getChildren((n) => n instanceof Konva.Group)[0];
  const red = () => squares().getChildren((n) => n instanceof Konva.Group)[1];

  it("shows no squares until a tower is dropped, then shows them", () => {
    expect(squares().visible()).toBe(false);
    textNamed("Circle Tower").getParent()!.fire("pointerdown"); // picked up, still being dragged
    expect(squares().visible()).toBe(false);
    window.dispatchEvent(new Event("pointerup"));
    expect(squares().visible()).toBe(true);
  });

  it("asks the question when the green square is pressed, like Enter does", async () => {
    const ask = vi.spyOn(QuestionPrompt.prototype, "ask");
    dropTower("Circle Tower");
    green().fire("pointerdown");
    expect(ask).toHaveBeenCalledTimes(1);
    expect(squares().visible()).toBe(true); // stays up while the question is open

    // answering finishes the placement through the same path as Enter
    const prompt = ask.mock.instances[0] as QuestionPrompt;
    expect(prompt.group.visible()).toBe(true);
    press("5");
    press("Enter");
    await settlePlacement();
    expect(model.towers).toHaveLength(1);
    expect(squares().visible()).toBe(false);
  });

  it("drops the tower without a question when the red square is pressed, like Escape does", () => {
    const ask = vi.spyOn(QuestionPrompt.prototype, "ask");
    dropTower("Circle Tower");
    red().fire("pointerdown");
    expect(squares().visible()).toBe(false);
    expect(ask).not.toHaveBeenCalled();
    press("Enter"); // nothing is waiting to be confirmed any more
    expect(ask).not.toHaveBeenCalled();
    expect(model.towers).toHaveLength(0);
  });

  it("ignores the red square while a question is open", () => {
    const ask = vi.spyOn(QuestionPrompt.prototype, "ask");
    dropTower("Circle Tower");
    green().fire("pointerdown");
    red().fire("pointerdown");
    expect(squares().visible()).toBe(true);
    expect(ask).toHaveBeenCalledTimes(1);
  });

  it("does not ask again when the green square is pressed twice", () => {
    const ask = vi.spyOn(QuestionPrompt.prototype, "ask");
    dropTower("Circle Tower");
    green().fire("pointerdown");
    green().fire("pointerdown");
    expect(ask).toHaveBeenCalledTimes(1);
  });

  // The block's outlined cells, as "x,y" so two aims can be compared
  const blockCells = () =>
    controller.group
      .find<Konva.Rect>("Rect")
      .filter((r) => r.stroke() === "#e8a14a" && r.getParent()!.visible());
  const cellKeys = () => blockCells().map((c) => `${c.x()},${c.y()}`);

  describe("locking the aim with a click", () => {
    const pointAt = (x: number, y: number) => {
      vi.spyOn(GridView.prototype, "pointerInTiles").mockReturnValue({ x, y });
      stage.fire("pointermove");
    };

    it("follows the pointer until the map is clicked, then stays where it is", () => {
      dropTower("Square Tower");
      pointAt(4.5, 2.5);
      const aimed = cellKeys();
      expect(aimed.length).toBeGreaterThan(0);

      stage.fire("pointerdown"); // a click on the map locks the aim
      pointAt(0.5, 0.2);
      expect(cellKeys()).toEqual(aimed);
    });

    it("aims again after a second click", () => {
      dropTower("Square Tower");
      pointAt(4.5, 2.5);
      const aimed = cellKeys();
      stage.fire("pointerdown");
      stage.fire("pointerdown");
      pointAt(0.5, 0.2);
      expect(cellKeys()).not.toEqual(aimed);
    });

    it("draws the locked block with a heavier outline", () => {
      dropTower("Square Tower");
      pointAt(4.5, 2.5);
      const before = blockCells()[0].strokeWidth();
      stage.fire("pointerdown");
      expect(blockCells()[0].strokeWidth()).toBeGreaterThan(before);
    });

    it("does nothing for a click that is not on the map", () => {
      dropTower("Square Tower");
      pointAt(4.5, 2.5);
      const aimed = cellKeys();
      vi.spyOn(GridView.prototype, "tileUnderMouse").mockReturnValue(null);
      stage.fire("pointerdown");
      pointAt(0.5, 0.2);
      expect(cellKeys()).not.toEqual(aimed); // still following the pointer
    });

    it("starts unlocked again for the next tower", () => {
      dropTower("Square Tower");
      pointAt(4.5, 2.5);
      stage.fire("pointerdown");
      red().fire("pointerdown"); // cancel
      dropTower("Square Tower");
      const aimed = cellKeys();
      pointAt(4.5, 2.5);
      pointAt(0.5, 0.2);
      expect(cellKeys()).not.toEqual(aimed);
    });
  });

  it("removes the squares from the screen with the rest of the placement preview", () => {
    controller.hide();
    expect(
      controller.group.find<Konva.Text>("Text").filter((text) => text.text() === "Enter"),
    ).toHaveLength(0);
  });
});

describe("GameScreenController tutorial", () => {
  function tutorialShowing(): boolean {
    const tutorial = controller.group.findOne(".tutorial");
    if (tutorial === undefined) {
      throw new Error("The tutorial is missing from the screen");
    }
    return tutorial.visible();
  }

  it("offers the tour in the first game on map 1", () => {
    expect(tutorialShowing()).toBe(true);
    expect(tutorialText()).toBe("New here? Take the 1-minute tour.");
  });

  it("is not shown on the other maps", () => {
    controller.hide();
    progress.currentMapId = "map2";
    controller.show();
    expect(tutorialShowing()).toBe(false);
  });

  it("does not come back after Skip", () => {
    clickButton("Skip");
    expect(progress.tutorialDone).toBe(true);

    controller.hide();
    controller.show();
    expect(tutorialShowing()).toBe(false);
  });

  it("starts over from the offer in a new game if it was not finished", () => {
    clickButton("Show me");
    controller.hide();
    expect(tutorialShowing()).toBe(false);

    controller.show();
    expect(tutorialText()).toBe("New here? Take the 1-minute tour.");
  });

  it("is hidden when the game ends", () => {
    model.lives.remaining = 0;
    model.tick(0);
    expect(tutorialShowing()).toBe(false);
  });
});
