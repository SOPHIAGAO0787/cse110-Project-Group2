import { CircleRange } from "./geometry/CircleRange";
import { RectRange } from "./geometry/RectRange";
import { SectorRange } from "./geometry/SectorRange";
import { isValidRectSize, rectFromPointer, rectSizes, rectZone } from "./geometry/rect";
import {
  MAX_SPREAD,
  MIN_SPREAD,
  clampSpread,
  sectorFromPointer,
  sectorRadius,
} from "./geometry/sector";
import type { RangeShape, TowerConfig, TowerDef, Vec } from "./types";

// What a tower uses when the player did not choose anything.
export function defaultConfig(def: TowerDef): TowerConfig {
  switch (def.range.kind) {
    case "circle":
      return { kind: "circle", radius: def.range.radius };
    case "sector":
      return { kind: "sector", facing: 0, spread: (MIN_SPREAD + MAX_SPREAD) / 2 };
    case "rect": {
      // The biggest block, facing up
      const { width, depth } = rectSizes(def.range.maxArea).at(-1) ?? { width: 0, depth: 0 };
      return { kind: "rect", facing: "up", width, depth, side: 1 };
    }
  }
}

// Checks a config against its tower and clamps values into their allowed range.
export function normalizeConfig(def: TowerDef, config: TowerConfig): TowerConfig {
  if (config.kind !== def.range.kind) {
    throw new Error(`"${def.id}" is a ${def.range.kind} tower, got a ${config.kind} config`);
  }
  switch (config.kind) {
    case "circle":
      if (!Number.isFinite(config.radius) || config.radius <= 0) {
        throw new Error("Circle radius must be a positive number");
      }
      return { ...config };
    case "sector":
      if (!Number.isFinite(config.facing) || !Number.isFinite(config.spread)) {
        throw new Error("Sector facing and spread must be finite numbers");
      }
      return { ...config, spread: clampSpread(config.spread) };
    case "rect": {
      if (def.range.kind !== "rect") throw new Error(`"${def.id}" is not a rectangle tower`);
      if (!["up", "down", "left", "right"].includes(config.facing)) {
        throw new Error("Rectangle facing must be up, down, left or right");
      }
      if (!isValidRectSize(config.width, config.depth, def.range.maxArea)) {
        throw new Error(
          `A ${config.width}×${config.depth} rectangle is not allowed (sides of at least 2, area up to ${def.range.maxArea})`,
        );
      }
      if (config.side !== 1 && config.side !== -1)
        throw new Error("Rectangle side must be 1 or -1");
      // An odd width is centred, so the side makes no difference: keep one spelling of it.
      return { ...config, side: config.width % 2 === 1 ? 1 : config.side };
    }
  }
}

// How far the range reaches from the tower, in tiles.
export function rangeReach(def: TowerDef, config: TowerConfig = defaultConfig(def)): number {
  switch (config.kind) {
    case "circle":
      return config.radius;
    case "sector":
      if (def.range.kind !== "sector") throw new Error(`"${def.id}" is not a sector tower`);
      return sectorRadius(config.spread, def.range.area);
    case "rect":
      return config.depth + 0.5; // from the tower's centre to the block's far edge
  }
}

// Shots per second for this choice. A smaller rectangle fires faster:
// the base rate is for a block of rateArea tiles, and the rate scales with rateArea / area.
export function fireRateFor(def: TowerDef, config: TowerConfig = defaultConfig(def)): number {
  if (config.kind !== "rect" || def.range.kind !== "rect") return def.fireRatePerSec;
  return (def.fireRatePerSec * def.range.rateArea) / (config.width * config.depth);
}

// Turns the pointer's position (in tile units, not snapped to a tile) into the config it picks,
// for towers the player aims. Circle towers are not aimed, so they get undefined.
export function configFromPointer(def: TowerDef, tile: Vec, pointer: Vec): TowerConfig | undefined {
  switch (def.range.kind) {
    case "circle":
      return undefined;
    case "sector":
      return { kind: "sector", ...sectorFromPointer(tile, pointer) };
    case "rect":
      return { kind: "rect", ...rectFromPointer(tile, pointer, def.range.maxArea) };
  }
}

export function makeRange(def: TowerDef, tile: Vec, config: TowerConfig): RangeShape {
  switch (config.kind) {
    case "circle":
      return new CircleRange(tile, config.radius);
    case "sector":
      return new SectorRange(tile, config.facing, config.spread, rangeReach(def, config));
    case "rect":
      return new RectRange(rectZone(tile, config.facing, config.width, config.depth, config.side));
  }
}

// One line for cards and menus.
export function describeRange(def: TowerDef): string {
  switch (def.range.kind) {
    case "circle":
      return `${def.range.radius} tiles`;
    case "sector":
      return `cone, area ${def.range.area} tiles²`;
    case "rect":
      return `block up to ${def.range.maxArea} tiles²`;
  }
}
