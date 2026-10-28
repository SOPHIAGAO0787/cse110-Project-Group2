import type { MapConfig, Vec } from "./types";

// Which tiles can hold a tower.
// TODO(W2): a tile is buildable if it is '#', inside the map, and not occupied.
export class Grid {
  private map: MapConfig;

  constructor(map: MapConfig) {
    this.map = map;
  }

  isBuildable(tile: Vec): boolean {
    return false; // TODO(W2)
  }

  isOccupied(tile: Vec): boolean {
    return false; // TODO(W2)
  }

  occupy(tile: Vec): void {
    // TODO(W2)
  }
}
