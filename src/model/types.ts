// Shared contracts. Every module codes against these shapes.
// Changing this file affects everyone: post in Slack first and keep the change in its own PR.

// A position in tile units, not pixels. (3, 2) is the center of the tile in column 3, row 2.
// Positions between tiles are fractions, e.g. an enemy halfway along a path segment.
// Only views convert to pixels.
export interface Vec {
  x: number;
  y: number;
}

export interface MapConfig {
  id: string;
  name: string;
  cols: number;
  rows: number;
  // One string per row: '#' buildable, 'P' enemy path, '.' blocked
  tiles: string[];
  // Corners of the route enemies walk, spawn → base. Consecutive points share a row or column.
  path: Vec[];
  startingCoins: number;
  startingLives: number;
  waves: WaveConfig[];
}

export interface WaveConfig {
  // Groups spawn one after another; each spawns `count` enemies `intervalSec` apart
  groups: { enemy: string; count: number; intervalSec: number }[];
}

export interface EnemyDef {
  id: string;
  name: string;
  hp: number;
  speed: number; // tiles per second
  reward: number; // coins earned when killed
  color: string;
}

export interface TowerDef {
  id: string;
  name: string;
  description: string;
  cost: number;
  damage: number; // per shot
  fireRatePerSec: number;
  range: { kind: "circle"; radius: number }; // Sprint 2: sector (triangle), rect
}

// "Is this point inside the tower's range?" Each tower shape implements this.
export interface RangeShape {
  contains(p: Vec): boolean;
}

export interface Question {
  id: string;
  prompt: string;
  answer: number;
  tolerance: number; // accept answers within ± tolerance
  hint: string; // shown after a wrong answer
}

// What happened when the player tried to place a tower.
// "blocked" = not a buildable tile, "occupied" = a tower is already there, "funds" = not enough coins
export type PlaceResult = "ok" | "blocked" | "occupied" | "funds";

// Everything that happens in a game, announced on the EventBus.
// enemyId / towerId are the number of one specific enemy or tower in this game.
// defId is the kind, from the JSON files (e.g. "circle").
export interface GameEvents {
  enemySpawned: { enemyId: number };
  enemyKilled: { enemyId: number; reward: number };
  enemyLeaked: { enemyId: number };
  coinsChanged: { coins: number };
  livesChanged: { lives: number };
  waveStarted: { wave: number; totalWaves: number };
  waveCleared: { wave: number };
  towerPlaced: { towerId: number; defId: string; tile: Vec };
  gameOver: { won: boolean };
}
