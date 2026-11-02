import { EventBus } from "../core/EventBus";
import { Enemy } from "./Enemy";
import { Grid } from "./Grid";
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
  private nextTowerId = 1; //every tower gets its own id

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

    // 5. TODO(So1): emit "gameOver" when lives reach 0 or the last wave is cleared
  }

  startNextWave(): void {
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
}
