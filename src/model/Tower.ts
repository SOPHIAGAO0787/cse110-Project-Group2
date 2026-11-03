import { CircleRange } from "./geometry/CircleRange";
import type { Enemy } from "./Enemy";
import type { RangeShape, TowerDef, Vec } from "./types";

// A placed tower that shoots enemies inside its range.
export class Tower {
  id: number;
  def: TowerDef;
  tile: Vec;
  range: RangeShape;

  constructor(id: number, def: TowerDef, tile: Vec) {
    this.id = id;
    this.def = def;
    this.tile = tile;
    // Only circle towers exist in Sprint 1. New shapes will check def.range.kind here.
    this.range = new CircleRange(tile, def.range.radius);
  }

  update(dt: number, enemies: Enemy[]): void {
    // Towers don't attack yet, so there is nothing to update.
  }
}
