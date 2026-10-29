import type { MapConfig, Vec } from "./types";

// Which tiles can hold a tower.
// TODO(St2): a tile is buildable if it is '#', inside the map, and not occupied.
export class Grid {
  private map: MapConfig;
  private occupied = new Set<string>();

  constructor(map: MapConfig) {
    this.map = map;
  }

  private key(tile: Vec): string {
    return `${tile.x},${tile.y}`;
  }

  private inBounds(tile: Vec): boolean {
    return (
      Number.isInteger(tile.x) &&
      Number.isInteger(tile.y) &&
      tile.x >= 0 &&
      tile.x < this.map.cols &&
      tile.y >= 0 &&
      tile.y < this.map.rows
    );
  }

  isBuildable(tile: Vec): boolean {
    return (
      this.inBounds(tile) &&
      this.map.tiles[tile.y][tile.x] === "#" && // tiles[row][col] = tiles[y][x]
      !this.isOccupied(tile)
    );
  }

  isOccupied(tile: Vec): boolean {
    return this.occupied.has(this.key(tile));
  }

  occupy(tile: Vec): void {
    if (!this.isBuildable(tile)) {
      throw new Error(`Cannot occupy tile (${tile.x}, ${tile.y})`);
    }
    this.occupied.add(this.key(tile));
  }
}
