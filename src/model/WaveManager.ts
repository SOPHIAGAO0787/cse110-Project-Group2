import type { EventBus } from "../core/EventBus";
import type { WaveConfig } from "./types";

// Decides when enemies spawn, wave by wave.
// TODO(N1): start() begins the next wave and emits "waveStarted"; tick() returns the enemy ids
// to spawn this frame, spaced intervalSec apart; track enemiesLeft (count down on
// "enemyKilled" and "enemyLeaked"); emit "waveCleared" when it reaches 0.
export class WaveManager {
  currentWave = 0; // 0 = no wave started yet, 1 = first wave
  enemiesLeft = 0;
  isRunning = false;
  private waves: WaveConfig[];
  private events: EventBus;

  constructor(waves: WaveConfig[], events: EventBus) {
    this.waves = waves;
    this.events = events;
  }

  get totalWaves(): number {
    return this.waves.length;
  }

  start(): void {
    // TODO(N1)
  }

  // Returns the kinds of enemies to spawn this frame (ids from enemies.json), e.g. ["basic"] or [].
  tick(dt: number): string[] {
    return []; // TODO(N1)
  }
}
