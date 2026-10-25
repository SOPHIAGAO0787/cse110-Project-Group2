import type { Vec } from "./types";

// The route enemies walk, as a list of corner points.
// TODO(R1): length = total distance along all segments;
// pointAt(d) = the position d tiles along the route (clamped to the start and end).
export class Path {
  points: Vec[];

  constructor(points: Vec[]) {
    this.points = points;
  }

  get length(): number {
    return 0; // TODO(R1)
  }

  pointAt(distance: number): Vec {
    return this.points[0]; // TODO(R1)
  }
}
