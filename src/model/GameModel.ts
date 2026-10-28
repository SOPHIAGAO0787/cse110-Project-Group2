import { EventBus } from "../core/EventBus";
import { Enemy } from "./Enemy";
import { Grid } from "./Grid";
import { ENEMIES } from "./loadContent";
import { Lives } from "./Lives";
import { Path } from "./Path";
import type { Tower } from "./Tower";
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

  constructor(map: MapConfig) {
    this.map = map;
    this.path = new Path(map.path);
    this.grid = new Grid(map);
    this.wallet = new Wallet(map.startingCoins, this.events);
    this.lives = new Lives(map.startingLives, this.events);
    this.waves = new WaveManager(map.waves, this.events);
  }

  // One step of the game, dt seconds long. The order matters, so don't reorder it.
  tick(dt: number): void {
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
      tower.update(dt, this.enemies);
    }

    // 4. TODO(R2): remove dead enemies (emit "enemyKilled" with the reward)
    //    and enemies that reached the end (emit "enemyLeaked")

    // 5. TODO(N3): emit "gameOver" when lives reach 0 or the last wave is cleared
  }

  startNextWave(): void {
    this.waves.start();
  }

  // TODO(B2): check the grid and the wallet, then create the Tower, occupy the tile,
  // spend the cost, and emit "towerPlaced".
  tryPlaceTower(defId: string, tile: Vec): PlaceResult {
    return "blocked"; // TODO(B2)
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
}
