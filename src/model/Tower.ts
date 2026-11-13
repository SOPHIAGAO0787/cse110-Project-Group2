import type { Enemy } from "./Enemy";
import { defaultConfig, makeRange, normalizeConfig, rangeReach } from "./towerConfig";
import type { RangeShape, TowerConfig, TowerDef, Vec } from "./types";

// A placed tower that shoots enemies inside its range.
export class Tower {
  id: number;
  def: TowerDef;
  tile: Vec;
  config: TowerConfig; // what the player chose when placing it (e.g. the triangle's direction)
  range: RangeShape;

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

  // How far the range reaches from the tower, in tiles.
  get reach(): number {
    return rangeReach(this.def, this.config);
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

    // Do not save up shots while there are no targets.
    if (this.findTargets(enemies).length === 0) {
      this.shotProgress = 0;
      return 0;
    }

    this.shotProgress += dt * this.def.fireRatePerSec;

    let shots = 0;
    while (this.shotProgress >= 1) {
      const targets = this.findTargets(enemies);

      if (targets.length === 0) {
        this.shotProgress = 0;
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
