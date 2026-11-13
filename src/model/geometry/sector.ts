import type { Vec } from "../types";

// Triangle tower maths. Pure functions, no Konva.
//
// A cone's area is ½·θ·r², so keeping the area constant gives r = √(2A / θ):
// a wider angle means a shorter reach.

export const MIN_SPREAD = (15 * Math.PI) / 180;
export const MAX_SPREAD = (75 * Math.PI) / 180;

// Pointer distance from the tower (in tiles) that gives the widest and the narrowest cone.
export const NEAR_DISTANCE = 0.75;
export const FAR_DISTANCE = 4;

export function clampSpread(spread: number): number {
  return Math.min(MAX_SPREAD, Math.max(MIN_SPREAD, spread));
}

export function sectorRadius(spread: number, area: number): number {
  return Math.sqrt((2 * area) / spread);
}

// Turns a pointer position (in tile units, not snapped to a tile) into a cone:
// it faces the pointer, and the closer the pointer the wider the cone.
export function sectorFromPointer(tile: Vec, pointer: Vec): { facing: number; spread: number } {
  const dx = pointer.x - tile.x;
  const dy = pointer.y - tile.y;
  const t = (Math.hypot(dx, dy) - NEAR_DISTANCE) / (FAR_DISTANCE - NEAR_DISTANCE);
  const clamped = Math.min(1, Math.max(0, t));
  return {
    facing: Math.atan2(dy, dx),
    spread: MAX_SPREAD - clamped * (MAX_SPREAD - MIN_SPREAD),
  };
}
