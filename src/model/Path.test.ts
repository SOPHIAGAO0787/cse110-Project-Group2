import { describe, it, expect } from "vitest";
import { Path } from "./Path";

describe("Path (R1)", () => {
  const path = new Path([
    { x: 0, y: 0 },
    { x: 4, y: 0 },
    { x: 4, y: 3 },
  ]);

  it("length adds up every segment", () => {
    expect(path.length).toBe(7);
  });

  it("returns the first and last points", () => {
    expect(path.pointAt(0)).toEqual({ x: 0, y: 0 });
    expect(path.pointAt(7)).toEqual({ x: 4, y: 3 });
  });

  it("lands exactly on a corner", () => {
    expect(path.pointAt(4)).toEqual({ x: 4, y: 0 });
  });

  it("interpolates along a segment", () => {
    expect(path.pointAt(5)).toEqual({ x: 4, y: 1 });
  });

  it("clamps distances outside the path", () => {
    expect(path.pointAt(-2)).toEqual({ x: 0, y: 0 });
    expect(path.pointAt(100)).toEqual({ x: 4, y: 3 });
  });
});
