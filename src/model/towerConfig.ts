import { CircleRange } from "./geometry/CircleRange";
import { SectorRange } from "./geometry/SectorRange";
import { MAX_SPREAD, MIN_SPREAD, clampSpread, sectorRadius } from "./geometry/sector";
import type { RangeShape, TowerConfig, TowerDef, Vec } from "./types";

// What a tower uses when the player did not choose anything.
export function defaultConfig(def: TowerDef): TowerConfig {
  switch (def.range.kind) {
    case "circle":
      return { kind: "circle", radius: def.range.radius };
    case "sector":
      return { kind: "sector", facing: 0, spread: (MIN_SPREAD + MAX_SPREAD) / 2 };
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
  }
}

export function makeRange(def: TowerDef, tile: Vec, config: TowerConfig): RangeShape {
  switch (config.kind) {
    case "circle":
      return new CircleRange(tile, config.radius);
    case "sector":
      return new SectorRange(tile, config.facing, config.spread, rangeReach(def, config));
  }
}

// One line for cards and menus.
export function describeRange(def: TowerDef): string {
  switch (def.range.kind) {
    case "circle":
      return `${def.range.radius} tiles`;
    case "sector":
      return `cone, area ${def.range.area} tiles²`;
  }
}
