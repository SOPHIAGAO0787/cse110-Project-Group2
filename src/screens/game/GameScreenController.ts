import type Konva from "konva";
import { GameLoop } from "../../core/GameLoop";
import { Sound } from "../../core/Sound";
import { GameModel } from "../../model/GameModel";
import { findMap } from "../../model/loadContent";
import type { MapConfig } from "../../model/types";
import type { Screen, ScreenSwitcher } from "../../app/types";
import { GameScreenView } from "./GameScreenView";
import { GridView } from "./GridView";
import { createTerrain } from "./TerrainView";
import { QuestionService } from "../../model/questions/QuestionService";
import { EnemiesView } from "./EnemiesView";
import { EffectsView } from "./EffectsView";
import { TowerProgress } from "../../model/TowerProgress";
import type { Progress } from "../../model/Progress";
import { TowersView } from "./TowersView";
import { PlacementController } from "./PlacementController";

// Connects the game model to the screen: input → model, model events → views.
export class GameScreenController implements Screen {
  group: Konva.Group;
  private app: ScreenSwitcher;
  private progress: Progress; // which map to play and the bonus coins; finished games save stars here
  private sound: Sound;
  private map: MapConfig;
  private view: GameScreenView;
  private model: GameModel;
  private loop: GameLoop;
  private placement: PlacementController | null = null; // null while no game is running
  private questions = new QuestionService();
  private active = false; // false while the screen is hidden
  private screenHeight = 0; // last size given to resize(), used to fit the shop cards
  private speed = 1; // 1 is normal speed, 2 is double, 0.5 is half. Kept between games.
  private onSpeedKey: (e: KeyboardEvent) => void; // the Space key listener, added in show()

  // Map progress tracks stars; tower progress tracks shop purchases.
  constructor(
    app: ScreenSwitcher,
    progress: Progress,
    private towerProgress: TowerProgress = new TowerProgress(),
    sound: Sound = new Sound(),
  ) {
    this.app = app;
    this.progress = progress;
    this.sound = sound;
    this.map = findMap(progress.currentMapId);
    this.view = new GameScreenView(
      this.map.cols,
      this.map.rows,
      () => this.model.startNextWave(),
      // Leaving ends the game without a result, so nothing is recorded on Progress
      () => this.app.switchTo("maps"),
      () => this.openSettings(),
      () => this.closeSettings(),
      // Restart starts a new game on the same map, the way the map screen starts one
      () => this.app.switchTo("game"),
      () => this.app.switchTo("menu"),
      () => this.changeSpeed(),
      this.questions,
      this.sound,
    );
    this.group = this.view.group;

    // Space switches the speed, like clicking the speed button
    this.onSpeedKey = (e: KeyboardEvent) => {
      if (e.key !== " " || e.repeat) {
        return;
      }
      // The settings pause the game, and a question uses the keyboard for the answer
      if (this.view.settings.isOpen() || this.view.prompt.group.visible()) {
        return;
      }
      e.preventDefault(); // Space would also scroll the page
      this.changeSpeed();
    };

    // A real game is created in show(). These are only here so the fields are never empty.
    this.model = new GameModel(this.map, this.towerProgress);
    this.loop = new GameLoop((dt) => this.model.tick(dt));
  }

  // Called every time the player enters the game screen: starts a fresh game on the chosen map.
  show(): void {
    this.map = findMap(this.progress.currentMapId);
    this.model = new GameModel(this.map, this.towerProgress);
    // Coins earned in the mini-game are added to the map's starting coins
    this.model.wallet.add(this.progress.bonusCoins);

    // R1: create the enemy view
    const enemiesView = new EnemiesView();
    const towersView = new TowersView();
    const effectsView = new EffectsView();
    this.loop = new GameLoop((dt) => {
      if (!this.active) return;
      // The game keeps running while a question is open, so double speed drops to normal speed
      // to leave time for reading.
      let speed = this.speed;
      if (this.view.prompt.group.visible() && speed > 1) {
        speed = 1;
      }
      // Double speed runs the same step twice. One step of 2 * dt would be faster to compute,
      // but an enemy could then jump over a narrow tower range between two steps.
      // Half speed runs one step of half the time.
      let steps = 1;
      let stepTime = dt;
      if (speed === 2) {
        steps = 2;
      } else {
        stepTime = dt * speed;
      }
      for (let i = 0; i < steps; i++) {
        this.model.tick(stepTime);
      }
      if (this.active) this.refreshWaveTimers();
      enemiesView.sync(this.model.enemies); // R1: update the enemy view with the current model state
      // towers turn towards their targets, and turn faster when the game runs faster
      towersView.update(this.model.towers, this.model.enemies, stepTime * steps);
      effectsView.syncHealthBars(this.model.enemies);
    });
    this.view.mapGroup.destroyChildren();

    const gridView = new GridView(
      this.map,
      (tile) => this.model.grid.isBuildable(tile),
      createTerrain(this.map),
    );

    //Draw the grid and render enemies over it
    this.view.mapGroup.add(gridView.group);
    this.view.mapGroup.add(towersView.group);
    this.view.mapGroup.add(enemiesView.group); // R1: add the enemy view to the map group
    this.view.mapGroup.add(effectsView.group); // on top, so the bars and popups are never covered

    this.placement = new PlacementController(
      this.view,
      this.model,
      this.map,
      this.towerProgress,
      this.questions,
      gridView,
      () => this.active,
      this.screenHeight,
    );

    const refreshHud = () => {
      this.refreshUpgradeHint();
      this.refreshWaveTimers();
      this.view.setHud(
        this.model.wallet.coins,
        this.model.lives.remaining,
        this.model.waves.currentWave,
        this.model.waves.totalWaves,
        this.model.waves.enemiesLeft,
      );
    };

    refreshHud();
    const events = this.model.events;
    // So1: the model builds the final stats; the result screen only displays them
    events.on("gameOver", () => {
      this.loop.stop();
      this.view.prompt.cancel();
      this.disposePlacement();
      this.refreshWaveTimers();
      const result = this.model.result;
      if (result) {
        // A win unlocks the next map and its stars show on the map screen
        this.progress.recordResult(this.map.id, result.stars);
        // This game had the bonus coins. Leaving early (no result) keeps them for the next game.
        this.progress.useBonusCoins();
        this.app.switchTo("result", result);
      }
    });

    events.on("coinsChanged", refreshHud);
    events.on("livesChanged", refreshHud);
    events.on("waveStarted", refreshHud);
    // Once a round has started, leaving goes through the settings instead
    events.on("waveStarted", () => this.view.backButton.visible(false));
    events.on("waveCleared", refreshHud);
    events.on("enemyKilled", refreshHud);
    events.on("enemyLeaked", refreshHud); //listeners for add/fire
    events.on("towerPlaced", ({ towerId }) => {
      const tower = this.model.towers.find((t) => t.id === towerId);
      if (tower) towersView.add(tower);
    });
    events.on("towerFired", ({ towerId }) => towersView.fire(towerId));

    // Feedback for kills, new waves and lost lives
    events.on("enemyKilled", ({ enemyId, reward }) => {
      // The model removes the enemy after this event, so it is still in the list here
      for (const enemy of this.model.enemies) {
        if (enemy.id === enemyId) {
          effectsView.showKill(enemy, reward);
        }
      }
    });
    events.on("waveStarted", ({ wave }) => this.view.showWaveBanner(wave));
    events.on("enemyLeaked", () => this.view.flashLeak());

    // Sound effects. Towers firing make no sound: with many towers it would never stop.
    events.on("waveStarted", () => this.sound.play("wave"));
    events.on("enemyKilled", () => this.sound.play("pop"));
    events.on("enemyLeaked", () => this.sound.play("leak"));
    events.on("towerPlaced", () => this.sound.play("place"));
    events.on("gameOver", ({ won }) => {
      if (won) {
        this.sound.play("win");
      } else {
        this.sound.play("lose");
      }
    });

    // A new game starts unpaused, with the back arrow showing
    this.view.settings.close();
    this.view.backButton.visible(true);

    window.addEventListener("keydown", this.onSpeedKey);
    this.active = true;
    this.group.visible(true);
    this.loop.start();
  }

  hide(): void {
    this.active = false;
    window.removeEventListener("keydown", this.onSpeedKey);
    this.view.prompt.cancel(); // closes the popup and removes its key listener
    this.view.settings.close(); // also removes its Escape listener
    this.disposePlacement();
    this.loop.stop();
    this.model.events.clear();
    this.group.visible(false);
  }

  resize(width: number, height: number): void {
    this.screenHeight = height;
    this.view.resize(width, height);
    if (this.placement) {
      this.placement.resize(height);
    }
  }

  private refreshWaveTimers(): void {
    const waves = this.model.waves;
    this.view.setWaveTimers(
      this.model.isOver ? null : waves.preparationRemaining,
      this.model.isOver ? null : waves.lastSpawnRemaining,
      !this.model.isOver &&
        !waves.isRunning &&
        waves.currentWave < waves.totalWaves &&
        (waves.currentWave === 0 || waves.preparationRemaining !== null),
    );
  }

  // The game is paused while the settings are open
  private openSettings(): void {
    // Escape closes both the settings and an open question, so the gear waits until it is answered
    if (this.view.prompt.group.visible()) {
      return;
    }
    this.view.settings.open();
    this.refreshUpgradeHint();
    this.loop.stop();
  }

  private closeSettings(): void {
    this.view.settings.close();
    this.loop.start();
  }

  private refreshUpgradeHint(): void {
    if (this.placement) {
      this.placement.refreshUpgradeHint();
    }
  }

  // Removes the tower cards and the placement listeners when a game ends or the screen closes
  private disposePlacement(): void {
    if (this.placement) {
      this.placement.dispose();
      this.placement = null;
    }
  }

  // Goes from normal to double to half speed, then back to normal
  private changeSpeed(): void {
    if (this.speed === 1) {
      this.speed = 2;
    } else if (this.speed === 2) {
      this.speed = 0.5;
    } else {
      this.speed = 1;
    }
    this.view.setSpeed(this.speed);
  }
}
