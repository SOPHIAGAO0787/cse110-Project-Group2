import type { RangeShape, Vec } from "../types";
import type { RectZone } from "./rect";

// A block of whole tiles: everything inside any of its tiles is in range.
export class RectRange implements RangeShape {
  zone: RectZone;

  constructor(zone: RectZone) {
    this.zone = zone;
  }

  contains(p: Vec): boolean {
    // A tile (c, r) spans [c - 0.5, c + 0.5) in both directions.
    const { col, row, cols, rows } = this.zone;
    return p.x >= col - 0.5 && p.x < col + cols - 0.5 && p.y >= row - 0.5 && p.y < row + rows - 0.5;
  }
}
