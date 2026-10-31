import type { Vec } from "./types";

/*
 * The route enemies walk, as a list of corner points
 * TODO(R1): length = total distance along all segments;
 * pointAt(d) = the position d tiles along the route (clamped to the start and end)
 *
 * R1 - Path and Enemy Movement
 * Represents the route enemies follow as a sequence of waypoints
 * Provides methods to calculate the total path length and determine
 * an enemy's position based on the distance traveled along the path
 */

export class Path {
  points: Vec[];

  constructor(points: Vec[]) {
    this.points = points;
  }

  // Calculates the total length of the path in tile units
  // by summing the distances between consecutive waypoints
  get length(): number {
    let total = 0;

    for (let i = 1; i < this.points.length; i++) {
      const start = this.points[i - 1];
      const end = this.points[i];

      // Calculate the horizontal and vertical displacement
      const dx = end.x - start.x;
      const dy = end.y - start.y;

      // Add the distance of the current segment
      total += Math.hypot(dx, dy);
    }

    return total;
  }

  /**
   * Returns the position at a given distance along the path
   *
   * @param distance - Distance traveled from the start, in tile units
   * @returns The interpolated position as a Vec (x, y)
   *
   * Distances outside the path are clamped to its endpoints
   */
  pointAt(distance: number): Vec {
    if (this.points.length === 0) {
      throw new Error("Path cannot be empty");
    }

    // Prevent negative distances from going before the start
    let remaining = Math.max(0, distance);

    // Traverse each segment until the target distance is reached
    for (let i = 1; i < this.points.length; i++) {
      const start = this.points[i - 1];
      const end = this.points[i];

      const segmentLength = Math.hypot(end.x - start.x, end.y - start.y);

      // Ignore segments where consecutive waypoints are identical
      if (segmentLength === 0) continue;

      if (remaining <= segmentLength) {
        // Fraction of the current segment traveled (0 to 1)
        const t = remaining / segmentLength;

        // Linearly interpolate between the segment's endpoints
        return {
          x: start.x + t * (end.x - start.x),
          y: start.y + t * (end.y - start.y),
        };
      }

      remaining -= segmentLength;
    }

    // Return the final waypoint if distance exceeds the path length
    return this.points[this.points.length - 1];
  }
}
