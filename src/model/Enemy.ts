import type { Path } from "./Path";
import type { EnemyDef, Vec } from "./types";


/*
 * Represents a single enemy traveling along a predefined path.
 *
 * R1: Tracks the enemy's position, distance traveled, and remaining health.
 * R2: Handles damage, death, and reaching the end of the path.
 * Enemy-specific attributes such as speed, maximum health, and reward
 * are provided through the EnemyDef configuration.
 */
export class Enemy {
  id: number;
  def: EnemyDef;
  distance = 0; // tiles travelled along the path
  pos: Vec;
  hp: number;
  private path: Path;

  constructor(id: number, def: EnemyDef, path: Path) {
    this.id = id;
    this.def = def;
    this.path = path;
    this.pos = path.pointAt(0);
    this.hp = def.hp;
  }

  update(dt: number): void {
    // R1
    // If the enemy has reached the end of the path or is dead, do not update its position
    if (dt <= 0 || this.reachedEnd() || this.isDead()) {
      return;
    }

    // Calculate how far the enemy should move in this update
    const movement = this.def.speed * dt;

    // Update the total distance travelled along the path
    this.distance = Math.min(
      this.distance + movement,
      this.path.length
    );

    // Convert the distance travelled along the path to a position
    this.pos = this.path.pointAt(this.distance);
  }

  takeDamage(amount: number): void {
    // R2: If the enemy is already dead, do not apply damage
    if (amount <= 0) {
      return;
    }

    // Reduce health, but don't allow it to become negative
    this.hp = Math.max(0, this.hp - amount);
  }

  isDead(): boolean {
    return this.hp <= 0;
  }

  reachedEnd(): boolean {
    return this.distance >= this.path.length;
  }
}