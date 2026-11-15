import { describe, expect, it } from "vitest";
import {
  FAR_DISTANCE,
  MAX_SPREAD,
  MIN_SPREAD,
  NEAR_DISTANCE,
  clampSpread,
  sectorFromPointer,
  sectorRadius,
} from "./sector";

describe("sectorRadius", () => {
  it("keeps the area constant: ½·θ·r² is the same for every angle", () => {
    const area = 2.6;
    for (const spread of [MIN_SPREAD, Math.PI / 6, Math.PI / 4, MAX_SPREAD]) {
      const r = sectorRadius(spread, area);
      expect(0.5 * spread * r * r).toBeCloseTo(area);
    }
  });

  it("reaches further for a narrower cone", () => {
    expect(sectorRadius(MIN_SPREAD, 2.6)).toBeGreaterThan(sectorRadius(MAX_SPREAD, 2.6));
  });
});

describe("clampSpread", () => {
  it("keeps values between 15° and 75°", () => {
    expect(clampSpread(0)).toBe(MIN_SPREAD);
    expect(clampSpread(10)).toBe(MAX_SPREAD);
    expect(clampSpread(Math.PI / 4)).toBe(Math.PI / 4);
  });
});

describe("sectorFromPointer", () => {
  const tile = { x: 3, y: 2 };

  it("faces the pointer", () => {
    expect(sectorFromPointer(tile, { x: 6, y: 2 }).facing).toBeCloseTo(0); // east
    expect(sectorFromPointer(tile, { x: 3, y: 5 }).facing).toBeCloseTo(Math.PI / 2); // down the screen
    expect(sectorFromPointer(tile, { x: 3, y: -1 }).facing).toBeCloseTo(-Math.PI / 2); // up
  });

  it("gives the widest cone for a close pointer and the narrowest for a far one", () => {
    expect(sectorFromPointer(tile, { x: 3 + NEAR_DISTANCE, y: 2 }).spread).toBeCloseTo(MAX_SPREAD);
    expect(sectorFromPointer(tile, { x: 3 + FAR_DISTANCE, y: 2 }).spread).toBeCloseTo(MIN_SPREAD);
  });

  it("clamps pointers closer than NEAR or further than FAR", () => {
    expect(sectorFromPointer(tile, { x: 3, y: 2 }).spread).toBeCloseTo(MAX_SPREAD); // on the tower
    expect(sectorFromPointer(tile, { x: 30, y: 2 }).spread).toBeCloseTo(MIN_SPREAD);
  });

  it("narrows steadily as the pointer moves away", () => {
    const mid = sectorFromPointer(tile, { x: 3 + (NEAR_DISTANCE + FAR_DISTANCE) / 2, y: 2 }).spread;
    expect(mid).toBeCloseTo((MAX_SPREAD + MIN_SPREAD) / 2);
  });
});
