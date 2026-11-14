import { describe, expect, it } from "vitest";
import { RECT_NEAR_DISTANCE, isValidRectSize, rectFromPointer, rectSizes, rectZone } from "./rect";

describe("rectSizes", () => {
  it("allows 2×2, 3×2 and 2×3 for an area of 6, smallest first", () => {
    expect(rectSizes(6)).toEqual([
      { width: 2, depth: 2 },
      { width: 3, depth: 2 },
      { width: 2, depth: 3 },
    ]);
  });

  it("never offers a strip that is 1 tile wide or long", () => {
    for (const { width, depth } of rectSizes(12)) {
      expect(width).toBeGreaterThanOrEqual(2);
      expect(depth).toBeGreaterThanOrEqual(2);
    }
    expect(rectSizes(6)).not.toContainEqual({ width: 1, depth: 6 });
    expect(rectSizes(6)).not.toContainEqual({ width: 6, depth: 1 });
  });

  it("offers more shapes when the maximum area grows (upgrades)", () => {
    const before = rectSizes(6);
    const after = rectSizes(8);
    expect(after.length).toBeGreaterThan(before.length);
    expect(after).toContainEqual({ width: 4, depth: 2 });
    expect(after).toContainEqual({ width: 2, depth: 4 });
    for (const size of before) expect(after).toContainEqual(size);
  });

  it("is empty when nothing fits", () => {
    expect(rectSizes(3)).toEqual([]);
  });
});

describe("isValidRectSize", () => {
  it("accepts allowed shapes and rejects the rest", () => {
    expect(isValidRectSize(2, 3, 6)).toBe(true);
    expect(isValidRectSize(3, 2, 6)).toBe(true);
    expect(isValidRectSize(1, 6, 6)).toBe(false); // strip
    expect(isValidRectSize(2, 4, 6)).toBe(false); // too big
    expect(isValidRectSize(2.5, 2, 6)).toBe(false); // not whole tiles
    expect(isValidRectSize(2, 4, 8)).toBe(true); // fine after an upgrade
  });
});

describe("rectZone", () => {
  const tile = { x: 5, y: 5 };

  it("puts an odd width centred on the tower", () => {
    // 3 wide, 2 deep, facing up: columns 4–6, rows 3–4 (touching the tower's row 5)
    expect(rectZone(tile, "up", 3, 2, 1)).toEqual({ col: 4, row: 3, cols: 3, rows: 2 });
    expect(rectZone(tile, "up", 3, 2, -1)).toEqual({ col: 4, row: 3, cols: 3, rows: 2 });
  });

  it("puts the extra tile of an even width on the chosen side", () => {
    // the tower sits above the left column of a 2-wide block (the extra tile is to the right)…
    expect(rectZone(tile, "down", 2, 2, 1)).toEqual({ col: 5, row: 6, cols: 2, rows: 2 });
    // …or above its right column
    expect(rectZone(tile, "down", 2, 2, -1)).toEqual({ col: 4, row: 6, cols: 2, rows: 2 });
  });

  it("works in all four facings", () => {
    expect(rectZone(tile, "up", 2, 3, 1)).toEqual({ col: 5, row: 2, cols: 2, rows: 3 });
    expect(rectZone(tile, "down", 2, 3, 1)).toEqual({ col: 5, row: 6, cols: 2, rows: 3 });
    expect(rectZone(tile, "left", 2, 3, 1)).toEqual({ col: 2, row: 5, cols: 3, rows: 2 });
    expect(rectZone(tile, "right", 2, 3, 1)).toEqual({ col: 6, row: 5, cols: 3, rows: 2 });
  });

  it("flips sideways for left and right too (side follows +y)", () => {
    expect(rectZone(tile, "right", 2, 2, 1)).toEqual({ col: 6, row: 5, cols: 2, rows: 2 });
    expect(rectZone(tile, "right", 2, 2, -1)).toEqual({ col: 6, row: 4, cols: 2, rows: 2 });
  });

  it("always touches the tower and never covers it", () => {
    for (const facing of ["up", "down", "left", "right"] as const) {
      for (const side of [1, -1] as const) {
        for (const { width, depth } of rectSizes(6)) {
          const z = rectZone(tile, facing, width, depth, side);
          const covers = (x: number, y: number) =>
            x >= z.col && x < z.col + z.cols && y >= z.row && y < z.row + z.rows;
          expect(covers(tile.x, tile.y)).toBe(false);
          // one of the four neighbours of the tower is in the block
          const touching = [
            [0, -1],
            [0, 1],
            [-1, 0],
            [1, 0],
          ].some(([dx, dy]) => covers(tile.x + dx, tile.y + dy));
          expect(touching).toBe(true);
          expect(z.cols * z.rows).toBe(width * depth);
        }
      }
    }
  });
});

describe("rectFromPointer", () => {
  const tile = { x: 5, y: 5 };

  it("faces the axis the pointer is furthest along", () => {
    expect(rectFromPointer(tile, { x: 5.2, y: 2 }, 6).facing).toBe("up");
    expect(rectFromPointer(tile, { x: 5.2, y: 8 }, 6).facing).toBe("down");
    expect(rectFromPointer(tile, { x: 2, y: 5.2 }, 6).facing).toBe("left");
    expect(rectFromPointer(tile, { x: 8, y: 5.2 }, 6).facing).toBe("right");
  });

  it("flips the side with the side of the tower the pointer is on", () => {
    expect(rectFromPointer(tile, { x: 5.4, y: 2 }, 6).side).toBe(1);
    expect(rectFromPointer(tile, { x: 4.6, y: 2 }, 6).side).toBe(-1);
    expect(rectFromPointer(tile, { x: 8, y: 5.4 }, 6).side).toBe(1);
    expect(rectFromPointer(tile, { x: 8, y: 4.6 }, 6).side).toBe(-1);
  });

  it("picks bigger blocks the further the pointer is, up to the biggest", () => {
    const at = (distance: number) => rectFromPointer(tile, { x: 5, y: 5 - distance }, 6);
    const area = (distance: number) => at(distance).width * at(distance).depth;
    expect(area(RECT_NEAR_DISTANCE)).toBe(4);
    expect(area(2.5)).toBe(6);
    expect(area(10)).toBe(6);
    expect(area(0.2)).toBe(4); // closer than the first step: still the smallest
  });

  it("uses a bigger ladder when the max area is bigger", () => {
    const far = rectFromPointer(tile, { x: 5, y: -10 }, 12);
    expect(far.width * far.depth).toBe(12);
  });

  it("copes with a pointer exactly on the tower", () => {
    const choice = rectFromPointer(tile, tile, 6);
    expect(choice).toMatchObject({ facing: "up", side: 1, width: 2, depth: 2 });
  });

  it("throws when no rectangle fits", () => {
    expect(() => rectFromPointer(tile, { x: 5, y: 2 }, 3)).toThrow();
  });
});
