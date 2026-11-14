import { describe, expect, it } from "vitest";
import { RectRange } from "./RectRange";

describe("RectRange", () => {
  // columns 4–6, rows 3–4: spans x 3.5 up to 6.5 and y 2.5 up to 4.5
  const range = new RectRange({ col: 4, row: 3, cols: 3, rows: 2 });

  it("contains the centre of every tile in the block", () => {
    for (let x = 4; x <= 6; x++) {
      for (let y = 3; y <= 4; y++) expect(range.contains({ x, y })).toBe(true);
    }
  });

  it("does not contain the tiles around the block", () => {
    expect(range.contains({ x: 3, y: 3 })).toBe(false);
    expect(range.contains({ x: 7, y: 3 })).toBe(false);
    expect(range.contains({ x: 5, y: 2 })).toBe(false);
    expect(range.contains({ x: 5, y: 5 })).toBe(false); // the tower's own tile
  });

  it("includes positions between tile centres, up to the tile edge", () => {
    expect(range.contains({ x: 3.5, y: 2.5 })).toBe(true); // top-left corner
    expect(range.contains({ x: 6.49, y: 4.49 })).toBe(true);
    expect(range.contains({ x: 3.49, y: 3 })).toBe(false);
    expect(range.contains({ x: 6.5, y: 3 })).toBe(false); // that belongs to the next tile
    expect(range.contains({ x: 5, y: 4.5 })).toBe(false);
  });
});
