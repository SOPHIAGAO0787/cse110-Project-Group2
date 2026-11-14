import type { MapConfig } from "./types";

// What the player has done across games: which map they picked and the best stars on each map.
// It lives in memory only, so refreshing the page starts over.
export class Progress {
  currentMapId: string; // the map the player picked to play
  private mapIds: string[]; // in unlock order
  private bestStars: number[]; // one per map, same order as mapIds. 0 = not won yet

  constructor(maps: MapConfig[]) {
    this.mapIds = [];
    this.bestStars = [];
    for (const map of maps) {
      this.mapIds.push(map.id);
      this.bestStars.push(0);
    }
    this.currentMapId = this.mapIds[0];
  }

  // The first map is always open. Every other map opens once the map before it is won.
  isUnlocked(mapId: string): boolean {
    const index = this.indexOf(mapId);
    if (index === 0) {
      return true;
    }
    return this.bestStars[index - 1] > 0;
  }

  starsFor(mapId: string): number {
    return this.bestStars[this.indexOf(mapId)];
  }

  // Saves a finished game. A win earns 1–3 stars and a loss earns 0 (see starRating),
  // so keeping the highest count also means a loss never undoes a win.
  recordResult(mapId: string, stars: number): void {
    const index = this.indexOf(mapId);
    if (stars > this.bestStars[index]) {
      this.bestStars[index] = stars;
    }
  }

  private indexOf(mapId: string): number {
    for (let i = 0; i < this.mapIds.length; i++) {
      if (this.mapIds[i] === mapId) {
        return i;
      }
    }
    throw new Error(`Unknown map "${mapId}"`);
  }
}
