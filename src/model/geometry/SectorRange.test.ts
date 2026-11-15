import { describe, expect, it } from "vitest";
import { SectorRange } from "./SectorRange";

const deg = (d: number) => (d * Math.PI) / 180;

describe("SectorRange", () => {
  // apex (5, 5), facing right, 60° wide, 3 tiles long
  const cone = new SectorRange({ x: 5, y: 5 }, 0, deg(60), 3);

  it("contains a point straight ahead", () => {
    expect(cone.contains({ x: 7, y: 5 })).toBe(true);
  });

  it("contains a point exactly at the reach", () => {
    expect(cone.contains({ x: 8, y: 5 })).toBe(true);
  });

  it("does not contain a point past the reach", () => {
    expect(cone.contains({ x: 8.01, y: 5 })).toBe(false);
  });

  it("does not contain a point behind the apex", () => {
    expect(cone.contains({ x: 4, y: 5 })).toBe(false);
  });

  it("contains the apex itself", () => {
    expect(cone.contains({ x: 5, y: 5 })).toBe(true);
  });

  it("includes points just inside the edge and excludes points just outside", () => {
    const at = (angle: number) => ({
      x: 5 + 2 * Math.cos(deg(angle)),
      y: 5 + 2 * Math.sin(deg(angle)),
    });
    expect(cone.contains(at(29))).toBe(true);
    expect(cone.contains(at(31))).toBe(false);
    expect(cone.contains(at(-29))).toBe(true);
    expect(cone.contains(at(-31))).toBe(false);
  });

  it("works when facing left, across the ±180° seam", () => {
    const left = new SectorRange({ x: 5, y: 5 }, Math.PI, deg(60), 3);
    expect(left.contains({ x: 3, y: 5.5 })).toBe(true); // just below the -x axis
    expect(left.contains({ x: 3, y: 4.5 })).toBe(true); // just above it
    expect(left.contains({ x: 7, y: 5 })).toBe(false);
  });

  it("y grows downward: facing +y points at the bottom of the screen", () => {
    const down = new SectorRange({ x: 5, y: 5 }, Math.PI / 2, deg(60), 3);
    expect(down.contains({ x: 5, y: 7 })).toBe(true);
    expect(down.contains({ x: 5, y: 3 })).toBe(false);
  });
});
