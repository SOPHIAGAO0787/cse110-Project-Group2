import { describe, expect, it } from "vitest";
import { TOWERS } from "./loadContent";
import {
  configFromPointer,
  defaultConfig,
  describeRange,
  fireRateFor,
  rangeReach,
} from "./towerConfig";

const circle = TOWERS.find((d) => d.id === "circle")!;
const triangle = TOWERS.find((d) => d.id === "triangle")!;
const rectangle = TOWERS.find((d) => d.id === "rectangle")!;

describe("configFromPointer", () => {
  const tile = { x: 5, y: 5 };

  it("gives circle towers nothing to aim", () => {
    expect(configFromPointer(circle, tile, { x: 8, y: 5 })).toBeUndefined();
  });

  it("aims a triangle's cone at the pointer", () => {
    expect(configFromPointer(triangle, tile, { x: 8, y: 5 })).toMatchObject({
      kind: "sector",
      facing: 0,
    });
  });

  it("picks a square tower's block from the pointer", () => {
    expect(configFromPointer(rectangle, tile, { x: 5.4, y: 2 })).toEqual({
      kind: "rect",
      facing: "up",
      side: 1,
      width: 2,
      depth: 3,
    });
  });
});

describe("square tower config", () => {
  it("has a default that is a valid block", () => {
    const config = defaultConfig(rectangle);
    expect(config).toMatchObject({ kind: "rect", facing: "up" });
  });

  it("describes itself on the shop card", () => {
    expect(describeRange(rectangle)).toBe("block up to 6 tiles²");
  });

  it("reaches as far as its depth, from the tower's centre", () => {
    expect(rangeReach(rectangle, { kind: "rect", facing: "up", width: 2, depth: 3, side: 1 })).toBe(
      3.5,
    );
  });

  it("fires at the base rate for a block of rateArea tiles, faster for smaller ones", () => {
    const base = rectangle.fireRatePerSec;
    expect(
      fireRateFor(rectangle, { kind: "rect", facing: "up", width: 2, depth: 3, side: 1 }),
    ).toBeCloseTo(base);
    expect(
      fireRateFor(rectangle, { kind: "rect", facing: "up", width: 2, depth: 2, side: 1 }),
    ).toBeCloseTo(base * 1.5);
    expect(fireRateFor(circle)).toBe(circle.fireRatePerSec);
  });
});
