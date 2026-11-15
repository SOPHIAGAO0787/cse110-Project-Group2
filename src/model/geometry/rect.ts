import type { Facing, Vec } from "../types";

// Square tower maths. Pure functions, no Konva.
//
// The tower sits on one tile and fires into a block of whole tiles that touches it,
// stretching away in the facing direction. `width` runs across that direction, `depth` along it.

// Every side of the block must be at least this long (no 1-wide strips).
export const MIN_SIDE = 2;

// Pointer distance from the tower (in tiles) where the pointer starts picking bigger blocks,
// and how many more tiles it takes to reach the next block in the list.
export const RECT_NEAR_DISTANCE = 1;
export const RECT_STEP_DISTANCE = 1;

export interface RectSize {
  width: number;
  depth: number;
}

// A block of tiles: the top-left tile (col, row) and how many tiles it spans.
export interface RectZone {
  col: number;
  row: number;
  cols: number;
  rows: number;
}

export interface RectChoice extends RectSize {
  facing: Facing;
  side: 1 | -1;
}

// Every block that fits in maxArea, smallest first.
// Raising maxArea (an upgrade) adds blocks to the end of the list.
export function rectSizes(maxArea: number): RectSize[] {
  const sizes: RectSize[] = [];
  for (let width = MIN_SIDE; width * MIN_SIDE <= maxArea; width++) {
    for (let depth = MIN_SIDE; width * depth <= maxArea; depth++) {
      sizes.push({ width, depth });
    }
  }
  return sizes.sort((a, b) => a.width * a.depth - b.width * b.depth || a.depth - b.depth);
}

export function isValidRectSize(width: number, depth: number, maxArea: number): boolean {
  return (
    Number.isInteger(width) &&
    Number.isInteger(depth) &&
    width >= MIN_SIDE &&
    depth >= MIN_SIDE &&
    width * depth <= maxArea
  );
}

// The tiles a block covers. The tower tile is not part of it.
export function rectZone(
  tile: Vec,
  facing: Facing,
  width: number,
  depth: number,
  side: 1 | -1,
): RectZone {
  // Where the block starts and ends across the facing direction, relative to the tower tile.
  // An odd width is centred; an even one has an extra tile on the chosen side.
  const start = width % 2 === 1 ? -(width - 1) / 2 : side === 1 ? 0 : -(width - 1);

  switch (facing) {
    case "up":
      return { col: tile.x + start, row: tile.y - depth, cols: width, rows: depth };
    case "down":
      return { col: tile.x + start, row: tile.y + 1, cols: width, rows: depth };
    case "left":
      return { col: tile.x - depth, row: tile.y + start, cols: depth, rows: width };
    case "right":
      return { col: tile.x + 1, row: tile.y + start, cols: depth, rows: width };
  }
}

// Turns a pointer position (in tile units, not snapped to a tile) into a block:
// it faces the way the pointer is furthest from the tower, the pointer's side decides
// where an even width's extra tile goes, and the further the pointer the bigger the block.
export function rectFromPointer(tile: Vec, pointer: Vec, maxArea: number): RectChoice {
  const dx = pointer.x - tile.x;
  const dy = pointer.y - tile.y;

  const horizontal = Math.abs(dx) > Math.abs(dy);
  const facing: Facing = horizontal ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
  const across = horizontal ? dy : dx;

  const sizes = rectSizes(maxArea);
  if (sizes.length === 0) throw new Error(`No rectangle fits in an area of ${maxArea}`);
  const step = Math.floor((Math.hypot(dx, dy) - RECT_NEAR_DISTANCE) / RECT_STEP_DISTANCE);
  const size = sizes[Math.min(sizes.length - 1, Math.max(0, step))];

  return { facing, side: across < 0 ? -1 : 1, ...size };
}
