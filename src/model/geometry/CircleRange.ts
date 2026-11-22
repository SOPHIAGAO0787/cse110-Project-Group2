import type { RangeShape, Vec } from "../types";

// A circular attack range: everything within `radius` of the center.
export class CircleRange implements RangeShape {
  center: Vec;
  radius: number;

  constructor(center: Vec, radius: number) {
    this.center = center;
    this.radius = radius;
  }

  contains(p: Vec): boolean {
    const dx = p.x - this.center.x;
    const dy = p.y - this.center.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance <= this.radius;
  }
}
