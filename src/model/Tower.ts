import { CircleRange } from "./geometry/CircleRange";
import type { Enemy } from "./Enemy";
import type { ShopLevel } from "./shop/types";
import type { RangeShape, TowerDef, Vec } from "./types";

export class Tower {
  id: number;
  def: TowerDef;
  tile: Vec;
  range: RangeShape;

  // 0 means Level 1.
  level = 0;

  private cooldown = 0; // seconds until the next shot

  constructor(id: number, def: TowerDef, tile: Vec) {
    this.id = id;
    this.tile = tile;

    // Make a separate copy for this tower.
    this.def = {
      ...def,
      range: { ...def.range },
    };

    this.range = new CircleRange(tile, this.def.range.radius);
  }

  upgrade(stats: ShopLevel): void {
    this.level += 1;

    this.def.damage = stats.damage;
    this.def.fireRatePerSec = stats.attackSpeed;
    this.def.range.radius = stats.radius;

    // Replace the old attack area with the larger one.
    this.range = new CircleRange(this.tile, stats.radius);
  }

  update(dt: number, enemies: Enemy[]): boolean {
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.cooldown > 0) return false;

    const inRange = enemies.filter(
      (e) => !e.isDead() && !e.reachedEnd() && this.range.contains(e.pos),
    );
    if (inRange.length === 0) return false;

    // single target: furthest along the path, ties go to the lowest id
    const target = inRange.reduce((best, e) =>
      e.distance > best.distance || (e.distance === best.distance && e.id < best.id) ? e : best,
    );
    target.takeDamage(this.def.damage);
    this.cooldown = 1 / this.def.fireRatePerSec;
    return true;
  }
}
