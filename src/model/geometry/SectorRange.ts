import type { RangeShape, Vec } from "../types";

// A cone (pie slice) attack range: everything within `radius` of the apex
// and within half of `spread` on either side of the facing direction.
export class SectorRange implements RangeShape {
  apex: Vec;
  facing: number; // radians, 0 = pointing right (+x); y grows downward like the screen
  spread: number; // the full angle of the cone, in radians
  radius: number;

  constructor(apex: Vec, facing: number, spread: number, radius: number) {
    this.apex = apex;
    this.facing = facing;
    this.spread = spread;
    this.radius = radius;
  }

  contains(p: Vec): boolean {
    const dx = p.x - this.apex.x;
    const dy = p.y - this.apex.y;
    const distance = Math.hypot(dx, dy);
    if (distance > this.radius) return false;
    if (distance === 0) return true; // the angle to the apex itself is meaningless

    // Smallest signed angle between the facing direction and the direction to p,
    // wrapped into [-π, π] so facing left (π) still works just below the -x axis.
    const diff = Math.atan2(dy, dx) - this.facing;
    const wrapped = Math.atan2(Math.sin(diff), Math.cos(diff));
    return Math.abs(wrapped) <= this.spread / 2;
  }
}
