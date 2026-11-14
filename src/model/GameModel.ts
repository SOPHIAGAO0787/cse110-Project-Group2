import { EventBus } from "../core/EventBus";
import { Enemy } from "./Enemy";
import { Grid } from "./Grid";
import { starRating, type GameResult } from "./GameResult";
import { ENEMIES, TOWERS } from "./loadContent";
import { Lives } from "./Lives";
import { Path } from "./Path";
import { Tower } from "./Tower";
import type { MapConfig, PlaceResult, Vec } from "./types";
import { Wallet } from "./Wallet";
import { WaveManager } from "./WaveManager";

// All the game's state and rules for one map. No Konva here, so it can be tested directly.
// Keep this class thin: real logic lives in the classes it holds.
export class GameModel {
  map: MapConfig;
  events = new EventBus();
  enemies: Enemy[] = [];
  towers: Tower[] = [];

  path: Path;
  grid: Grid;
  wallet: Wallet;
  lives: Lives;
  waves: WaveManager;

  private nextId = 1; // every enemy gets its own number, so events can say which one
  private nextTowerId = 1; // every tower gets its own id

  // So1: stats for the result screen
  elapsedSeconds = 0;
  private towersPlaced = 0;
  private questionsSolved = 0;
  private finalWaveCleared = false;
  private finalResult: GameResult | null = null; // set once, when the game ends

  constructor(map: MapConfig) {
    this.map = map;
    this.path = new Path(map.path);
    this.grid = new Grid(map);
    this.wallet = new Wallet(map.startingCoins, this.events);
    this.lives = new Lives(map.startingLives, this.events);
    this.waves = new WaveManager(map.waves, this.events);
    this.events.on("waveCleared", ({ wave }) => {
      if (wave === this.waves.totalWaves) this.finalWaveCleared = true;
    });
  }

  // One step of the game, dt seconds long. The order matters, so don't reorder it.
  tick(dt: number): void {
    if (this.isOver) return; // the game is frozen once it ends
    if (Number.isFinite(dt) && dt > 0) this.elapsedSeconds += dt;

    // 1. Spawn the enemies the wave manager asks for (N1)
    for (const defId of this.waves.tick(dt)) {
      this.spawnEnemy(defId);
    }

    // 2. Move enemies along the path (R1)
    for (const enemy of this.enemies) {
      enemy.update(dt);
    }

    // 3. Towers shoot enemies in range (R3)
    for (const tower of this.towers) {
      if (tower.update(dt, this.enemies)) {
        this.events.emit("towerFired", { towerId: tower.id });
      }
    }

    // 4. R2: Remove dead enemies and enemies that reached the end.
    const remainingEnemies: Enemy[] = [];
    for (const enemy of this.enemies) {
      if (enemy.isDead()) {
        // Enemy has been killed, so it gives a reward
        this.events.emit("enemyKilled", {
          enemyId: enemy.id,
          reward: enemy.def.reward,
        });
      } else if (enemy.reachedEnd()) {
        // Enemy has reached the end, so it costs a life
        this.events.emit("enemyLeaked", {
          enemyId: enemy.id,
        });
      } else {
        // Keep enemies that are still alive and moving.
        remainingEnemies.push(enemy);
      }
    }

    this.enemies = remainingEnemies;

    // 5. So1: end the game. Defeat is checked first, so losing the last life on the
    //    same step the last wave clears is still a defeat.
    if (this.lives.remaining <= 0) {
      this.finish(false);
    } else if (this.finalWaveCleared) {
      this.finish(true);
    }
  }

  get isOver(): boolean {
    return this.finalResult !== null;
  }

  // The finished game's stats, or null while it is still being played.
  get result(): GameResult | null {
    return this.finalResult;
  }

  // Called when the player answers a tower question correctly.
  recordQuestionSolved(): void {
    if (this.isOver) return;
    this.questionsSolved++;
  }

  startNextWave(): void {
    if (this.isOver) return;
    this.waves.start();
  }

  // Places a tower if the tile is free and the player can afford it, otherwise says why not.
  tryPlaceTower(defId: string, tile: Vec): PlaceResult {
    const def = TOWERS.find((d) => d.id === defId);
    if (!def) throw new Error(`Unknown tower "${defId}"`);

    if (this.grid.isOccupied(tile)) return "occupied"; // check first: isBuildable is also false when occupied
    if (!this.grid.isBuildable(tile)) return "blocked";
    // Spend after the tile checks, so a bad tile never costs coins
    if (!this.wallet.spend(def.cost)) {
      return "funds";
    }

    this.grid.occupy(tile);
    const tower = new Tower(this.nextTowerId++, def, tile);
    this.towers.push(tower);
    this.towersPlaced++;
    this.events.emit("towerPlaced", { towerId: tower.id, defId: def.id, tile });
    return "ok";
  }

  // Adds one enemy of the given kind (an id from enemies.json, e.g. "basic") at the start of the path.
  spawnEnemy(defId: string): void {
    for (const def of ENEMIES) {
      if (def.id === defId) {
        const enemy = new Enemy(this.nextId, def, this.path);
        this.nextId++;
        this.enemies.push(enemy);
        this.events.emit("enemySpawned", { enemyId: enemy.id });
        return;
      }
    }
    throw new Error(`Unknown enemy "${defId}"`);
  }

  private finish(won: boolean): void {
    this.finalResult = {
      won,
      stars: starRating(won, this.lives.remaining, this.map.startingLives),
      elapsedSeconds: this.elapsedSeconds,
      towersPlaced: this.towersPlaced,
      remainingLives: this.lives.remaining,
      finalCoins: this.wallet.coins,
      questionsSolved: this.questionsSolved,
    };
    this.events.emit("gameOver", { won });
  }
}
