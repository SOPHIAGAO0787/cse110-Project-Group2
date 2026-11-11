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

  private cooldown = 0; // seconds until the next shot

    update(dt: number, enemies: Enemy[]): void {
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.cooldown > 0) return;

    const inRange = enemies.filter(
        (e) => !e.isDead() && !e.reachedEnd() && this.range.contains(e.pos),
    );
    if (inRange.length === 0) return;   

    // single target: furthest along the path, ties go to the lowest id
    const target = inRange.reduce((best, e) =>
        e.distance > best.distance || (e.distance === best.distance && e.id < best.id) ? e : best,
    );
    target.takeDamage(this.def.damage);
    this.cooldown = 1 / this.def.fireRatePerSec;
    }
}
