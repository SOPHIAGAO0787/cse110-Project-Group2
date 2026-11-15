import type { Enemy } from "./Enemy";
import { defaultConfig, fireRateFor, makeRange, normalizeConfig, rangeReach } from "./towerConfig";
import type { ShopLevel } from "./shop/types";
import type { RangeShape, TowerConfig, TowerDef, Vec } from "./types";

// A placed tower that shoots enemies inside its range.
export class Tower {
  id: number;
  def: TowerDef;
  tile: Vec;
  config: TowerConfig; // what the player chose when placing it (e.g. the triangle's direction)
  range: RangeShape;

  // 0 means Level 1.
  level = 0;

  // How much progress we have made toward the next shot.
  private shotProgress = 0;

  constructor(id: number, def: TowerDef, tile: Vec, config?: TowerConfig) {
    this.id = id;
    this.tile = tile;

    // Make a separate copy for this tower.
    this.def = {
      ...def,
      range: { ...def.range },
    };

    this.config = normalizeConfig(this.def, config ?? defaultConfig(this.def));
    this.range = makeRange(this.def, tile, this.config);
  }

  // Applies the next shop level: more damage and a faster fire rate for every tower.
  // Only the circle's range is a plain radius that the shop level sets; a cone or block
  // keeps the shape the player chose.
  upgrade(stats: ShopLevel): void {
    this.level += 1;

    this.def.damage = stats.damage;
    this.def.fireRatePerSec = stats.attackSpeed;

    if (this.def.range.kind === "circle" && this.config.kind === "circle") {
      this.def.range.radius = stats.radius;
      this.config = { kind: "circle", radius: stats.radius };
      // Replace the old attack area with the larger one.
      this.range = makeRange(this.def, this.tile, this.config);
    }
  }

  // How far the range reaches from the tower, in tiles.
  get reach(): number {
    return rangeReach(this.def, this.config);
  }

  // Shots per second. It depends on what the player chose (a smaller rectangle fires faster).
  get fireRate(): number {
    return fireRateFor(this.def, this.config);
  }

  // The enemies the next shot hits: everyone in range for an "all" tower,
  // otherwise only the one furthest along the path (ties go to the lowest id).
  private findTargets(enemies: Enemy[]): Enemy[] {
    const inRange = enemies.filter(
      (e) => !e.isDead() && !e.reachedEnd() && this.range.contains(e.pos),
    );
    if (this.def.attack === "all" || inRange.length <= 1) return inRange;

    return [
      inRange.reduce((best, e) =>
        e.distance > best.distance || (e.distance === best.distance && e.id < best.id) ? e : best,
      ),
    ];
  }

  // The enemy this tower would shoot right now, or undefined if nothing is in range.
  // The views use it to turn a tower towards its target. It changes nothing.
  aimTarget(enemies: Enemy[]): Enemy | undefined {
    return this.findTargets(enemies)[0];
  }

  // Returns how many shots were fired during this step.
  update(dt: number, enemies: Enemy[]): number {
    if (!Number.isFinite(dt) || dt <= 0) return 0;

    // With no targets the tower reloads, but keeps at most one shot ready so shots can't pile up.
    // (Resetting to 0 instead would stop a tower from ever firing at enemies that cross its
    // cone faster than one firing interval.)
    const rate = this.fireRate;
    if (this.findTargets(enemies).length === 0) {
      this.shotProgress = Math.min(1, this.shotProgress + dt * rate);
      return 0;
    }

    this.shotProgress += dt * rate;

    let shots = 0;
    while (this.shotProgress >= 1) {
      const targets = this.findTargets(enemies);

      if (targets.length === 0) {
        this.shotProgress = Math.min(this.shotProgress, 1);
        break;
      }

      for (const target of targets) {
        target.takeDamage(this.def.damage);
      }
      this.shotProgress -= 1;
      shots++;
    }
    return shots;
  }
}
