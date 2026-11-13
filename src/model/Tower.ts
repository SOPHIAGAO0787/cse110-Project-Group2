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

  // How much progress we have made toward the next shot.
  private shotProgress = 0;

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

  private findTarget(enemies: Enemy[]): Enemy | undefined {
    let target: Enemy | undefined;

    for (const enemy of enemies) {
      if (enemy.isDead() || enemy.reachedEnd()) {
        continue;
      }

      if (!this.range.contains(enemy.pos)) {
        continue;
      }

      if (!target || enemy.distance > target.distance) {
        target = enemy;
      } else if (enemy.distance === target.distance && enemy.id < target.id) {
        target = enemy;
      }
    }

    return target;
  }

  update(dt: number, enemies: Enemy[]): void {
    if (!Number.isFinite(dt) || dt <= 0) {
      return;
    }

    // Do not save up shots while there are no targets.
    if (!this.findTarget(enemies)) {
      this.shotProgress = 0;
      return;
    }

    this.shotProgress += dt * this.def.fireRatePerSec;

    while (this.shotProgress >= 1) {
      const target = this.findTarget(enemies);

      if (!target) {
        this.shotProgress = 0;
        break;
      }

      target.takeDamage(this.def.damage);
      this.shotProgress -= 1;
    }
  }
}
