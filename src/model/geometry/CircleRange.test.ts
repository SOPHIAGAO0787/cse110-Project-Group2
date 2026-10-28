import { describe, expect, it } from "vitest";
import { CircleRange } from "./CircleRange";

describe("CircleRange", () => {
  const range = new CircleRange({ x: 5, y: 5 }, 2);

  it("contains its own center", () => {
    expect(range.contains({ x: 5, y: 5 })).toBe(true);
  });

  it("contains a point exactly on the edge", () => {
    expect(range.contains({ x: 7, y: 5 })).toBe(true);
  });

  it("does not contain a point just outside the edge", () => {
    expect(range.contains({ x: 7.01, y: 5 })).toBe(false);
  });

  it("measures diagonal distance, not a square", () => {
    // (6.5, 6.5) is inside the 2-radius square but about 2.12 from the center
    expect(range.contains({ x: 6.5, y: 6.5 })).toBe(false);
  });

  it("with radius 0 contains only the center", () => {
    const point = new CircleRange({ x: 1, y: 1 }, 0);
    expect(point.contains({ x: 1, y: 1 })).toBe(true);
    expect(point.contains({ x: 1, y: 1.1 })).toBe(false);
  });
});
