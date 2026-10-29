import type { MapConfig, Vec } from "./types";

// Which tiles can hold a tower.
// A tile is buildable if it is inside the map, is '#', and has no tower on it yet.
export class Grid {
  private map: MapConfig;
  private occupied: Vec[] = []; // tiles that already have a tower

  constructor(map: MapConfig) {
    this.map = map;
  }

  isBuildable(tile: Vec): boolean {
    const inside = tile.x >= 0 && tile.x < this.map.cols && tile.y >= 0 && tile.y < this.map.rows;
    if (!inside) {
      return false;
    }
    // tiles holds one string per row, so the row (y) comes first
    if (this.map.tiles[tile.y][tile.x] !== "#") {
      return false;
    }
    return !this.isOccupied(tile);
  }

  isOccupied(tile: Vec): boolean {
    for (const t of this.occupied) {
      if (t.x === tile.x && t.y === tile.y) {
        return true;
      }
    }
    return false;
  }

  // Call only after isBuildable(tile) says yes.
  occupy(tile: Vec): void {
    this.occupied.push({ x: tile.x, y: tile.y });
  }
}
