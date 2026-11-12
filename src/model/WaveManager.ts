import type { EventBus } from "../core/EventBus";
import type { WaveConfig } from "./types";

export const WAVE_PREPARATION_SECONDS = 10;

// Schedules enemy definition IDs; GameModel creates enemies and announces their IDs.
export class WaveManager {
  currentWave = 0; // 0 = no wave started yet, 1 = first wave
  enemiesLeft = 0; // includes enemies still waiting to spawn
  isRunning = false;
  preparationRemaining: number | null = null;
  private waves: WaveConfig[];
  private events: EventBus;
  private groupIndex = 0;
  private spawnedInGroup = 0;
  private elapsed = 0;
  private nextSpawnAt = 0;
  private scheduledLeft = 0;
  private pendingSpawns = 0;
  // Keep removed IDs until the next wave so duplicate spawn/removal events are ignored.
  private enemyAlive = new Map<number, boolean>();

  constructor(waves: WaveConfig[], events: EventBus) {
    this.waves = waves;
    this.events = events;
    events.on("enemySpawned", ({ enemyId }) => {
      if (!this.isRunning || this.pendingSpawns === 0 || this.enemyAlive.has(enemyId)) return;
      this.pendingSpawns--;
      this.enemyAlive.set(enemyId, true);
    });
    events.on("enemyKilled", ({ enemyId }) => this.removeEnemy(enemyId));
    events.on("enemyLeaked", ({ enemyId }) => this.removeEnemy(enemyId));
  }

  get totalWaves(): number {
    return this.waves.length;
  }

  get lastSpawnRemaining(): number | null {
    if (!this.isRunning || this.scheduledLeft === 0) return null;
    const groups = this.waves[this.currentWave - 1].groups;
    let remaining = this.nextSpawnAt - this.elapsed;
    for (let i = this.groupIndex; i < groups.length; i++) {
      const count = groups[i].count - (i === this.groupIndex ? this.spawnedInGroup + 1 : 0);
      remaining += count * groups[i].intervalSec;
    }
    return Math.max(0, remaining);
  }

  start(): void {
    if (this.currentWave !== 0 && this.preparationRemaining === null) return;
    this.beginWave();
  }

  private beginWave(): void {
    if (this.isRunning || this.currentWave >= this.totalWaves) return;
    this.preparationRemaining = null;
    const wave = this.waves[this.currentWave];
    this.currentWave++;
    this.groupIndex = 0;
    this.spawnedInGroup = 0;
    this.elapsed = 0;
    this.nextSpawnAt = 0;
    this.pendingSpawns = 0;
    this.enemyAlive.clear();
    this.scheduledLeft = wave.groups.reduce((sum, group) => sum + group.count, 0);
    this.enemiesLeft = this.scheduledLeft;
    this.isRunning = true;
    this.skipEmptyGroups();
    this.events.emit("waveStarted", { wave: this.currentWave, totalWaves: this.totalWaves });
    this.finishIfCleared();
  }

  // First enemy is due at time 0 (including tick(0)). Later enemies wait their
  // group's interval, including the first enemy of each subsequent nonempty group.
  tick(dt: number): string[] {
    if (!Number.isFinite(dt) || dt < 0) return [];
    while (this.preparationRemaining !== null) {
      const remaining = this.preparationRemaining;
      const tolerance = Number.EPSILON * Math.max(1, remaining, dt) * 8;
      if (dt + tolerance < remaining) {
        this.preparationRemaining = remaining - dt;
        return [];
      }
      dt = Math.max(0, dt - remaining);
      this.beginWave();
    }
    if (!this.isRunning) return [];
    this.elapsed += dt;
    const groups = this.waves[this.currentWave - 1].groups;
    const spawns: string[] = [];
    // Allow only floating-point rounding error at an exact time boundary.
    const tolerance = Number.EPSILON * Math.max(1, this.elapsed, this.nextSpawnAt) * 8;
    while (this.groupIndex < groups.length && this.nextSpawnAt <= this.elapsed + tolerance) {
      const group = groups[this.groupIndex];
      spawns.push(group.enemy);
      this.scheduledLeft--;
      this.pendingSpawns++;
      this.spawnedInGroup++;
      if (this.spawnedInGroup === group.count) {
        this.groupIndex++;
        this.spawnedInGroup = 0;
        this.skipEmptyGroups();
      }
      if (this.groupIndex < groups.length) {
        this.nextSpawnAt += groups[this.groupIndex].intervalSec;
      }
    }
    return spawns;
  }

  private skipEmptyGroups(): void {
    const groups = this.waves[this.currentWave - 1].groups;
    while (this.groupIndex < groups.length && groups[this.groupIndex].count === 0) {
      this.groupIndex++;
    }
  }

  private removeEnemy(enemyId: number): void {
    if (!this.isRunning || this.enemyAlive.get(enemyId) !== true) return;
    this.enemyAlive.set(enemyId, false);
    this.enemiesLeft--;
    this.finishIfCleared();
  }

  private finishIfCleared(): void {
    if (
      !this.isRunning ||
      this.enemiesLeft !== 0 ||
      this.scheduledLeft !== 0 ||
      this.pendingSpawns !== 0
    )
      return;
    this.isRunning = false;
    if (this.currentWave < this.totalWaves) {
      this.preparationRemaining = WAVE_PREPARATION_SECONDS;
    }
    this.events.emit("waveCleared", { wave: this.currentWave });
  }
}
