import type { MapConfig, Vec } from "./types";

// Textured maps. A tileset is a picture sheet cut into square cells, plus a legend that gives
// every cell a one-character name. A map's `art` is a grid of those names, one per tile, so
// the look of every tile is chosen by hand. Nothing here touches Konva: it only works out
// which cell of the sheet goes on which tile. TerrainView does the drawing.

// What a tile is, which has to agree with the map's `tiles` ('.' blocked, '#' buildable, 'P' path)
export type TileKind = "blocked" | "buildable" | "path";

// The sides of a tile that the road runs out of: N is towards row 0, like the screen.
export type Side = "N" | "E" | "S" | "W";

export type Rotation = 0 | 90 | 180 | 270;

// One legend entry. `cells` lists [column, row] positions on the sheet. With more than one,
// each tile picks one of them, always the same one for the same tile, so a patch of grass
// doesn't repeat. `connects` is for road pieces: which sides they open onto.
export interface TileArtDef {
  kind: TileKind;
  cells: [number, number][];
  connects?: Side[];
  rotation?: Rotation; // turns the cell clockwise, so one drawing can serve a second corner
}

// A road drawn over the ground, from cells on the same sheet. The cells are transparent, so the
// ground shows through, and the road follows the enemy route by itself: a map's art then only
// names the ground under it. Draw `straight` running up and down (joining N and S) and `corner`
// joining N and E; the code turns them for every other direction.
export interface RoadArt {
  ground?: string; // legend name drawn under the road. Left out, the first blocked entry is used
  straight: [number, number][];
  corner: [number, number][];
}

export interface Tileset {
  id: string;
  sheet: string; // file name inside public/tilesets/
  cellSize: number; // pixels per cell on the sheet
  // Pixels shaved off every edge of a cell when drawing it, 0 if left out. The outermost pixels
  // of an exported cell are often a little off (blended with the background, or a rim line), and
  // show up as thin lines between tiles. Re-export with the art running past the cell edge,
  // then this can go.
  inset?: number;
  // Draws the road as an overlay instead of with `path` pieces from the legend. Optional.
  road?: RoadArt;
  // Characters are kept in the order written. The first entry of a kind is what a tile of
  // that kind gets when the map's art does not say otherwise.
  legend: Record<string, TileArtDef>;
}

// What to draw on one tile: a cell of the sheet and how far to turn it
export interface TileSprite {
  x: number; // tile column
  y: number; // tile row
  col: number; // cell column on the sheet
  row: number; // cell row on the sheet
  rotation: Rotation;
}

const KINDS: TileKind[] = ["blocked", "buildable", "path"];
const SIDES: Side[] = ["N", "E", "S", "W"];
const ROTATIONS: Rotation[] = [0, 90, 180, 270];
const TILE_CHARACTER: Record<string, TileKind> = { ".": "blocked", "#": "buildable", P: "path" };

// Every cell is [column, row], two whole numbers from 0
function checkCells(id: string, label: string, cells: unknown[]): void {
  for (const cell of cells) {
    const ok =
      Array.isArray(cell) && cell.length === 2 && cell.every((n) => Number.isInteger(n) && n >= 0);
    if (!ok) {
      throw new Error(`${id}: ${label} has a bad cell, expected [column, row]`);
    }
  }
}

// Checks a tileset file and returns it typed. Mistakes fail loudly in the tests,
// instead of showing up as a wrong picture in the game.
export function loadTileset(data: unknown): Tileset {
  const tileset = data as Tileset;
  const id = tileset.id;

  if (typeof id !== "string" || typeof tileset.sheet !== "string") {
    throw new Error("tileset: needs an id and a sheet file name");
  }
  if (!Number.isInteger(tileset.cellSize) || tileset.cellSize <= 0) {
    throw new Error(`${id}: cellSize must be a whole number of pixels`);
  }
  if (
    tileset.inset !== undefined &&
    (!Number.isInteger(tileset.inset) || tileset.inset < 0 || tileset.inset * 2 >= tileset.cellSize)
  ) {
    throw new Error(`${id}: inset must be a whole number of pixels, less than half a cell`);
  }
  if (tileset.legend === undefined || tileset.legend === null) {
    throw new Error(`${id}: needs a legend`);
  }

  for (const [character, def] of Object.entries(tileset.legend)) {
    if (character.length !== 1 || character.trim() === "") {
      throw new Error(`${id}: legend name "${character}" must be one visible character`);
    }
    if (!KINDS.includes(def.kind)) {
      throw new Error(`${id}: "${character}" has unknown kind "${def.kind}"`);
    }
    if (!Array.isArray(def.cells) || def.cells.length === 0) {
      throw new Error(`${id}: "${character}" needs at least one cell`);
    }
    checkCells(id, `"${character}"`, def.cells);
    if (def.rotation !== undefined && !ROTATIONS.includes(def.rotation)) {
      throw new Error(`${id}: "${character}" rotation must be 0, 90, 180 or 270`);
    }
    if (def.kind === "path") {
      const sides = def.connects;
      if (!Array.isArray(sides) || sides.length < 2 || !sides.every((s) => SIDES.includes(s))) {
        throw new Error(
          `${id}: road piece "${character}" needs connects with two or more of N, E, S, W`,
        );
      }
    } else if (def.connects !== undefined) {
      throw new Error(`${id}: only road pieces have connects ("${character}")`);
    }
  }
  if (tileset.road !== undefined) {
    checkRoad(tileset);
  }
  return tileset;
}

function checkRoad(tileset: Tileset): void {
  const { id, legend } = tileset;
  const road = tileset.road as RoadArt;
  for (const shape of ["straight", "corner"] as const) {
    const cells = road[shape];
    if (!Array.isArray(cells) || cells.length === 0) {
      throw new Error(`${id}: road needs at least one ${shape} cell`);
    }
    checkCells(id, `road ${shape}`, cells);
  }
  if (road.ground !== undefined) {
    const def = legend[road.ground];
    if (def === undefined) {
      throw new Error(`${id}: road ground "${road.ground}" is not in the legend`);
    }
    if (def.kind === "path") {
      throw new Error(`${id}: road ground "${road.ground}" must be ground, not a road piece`);
    }
  }
}

const STEP: Record<Side, Vec> = {
  N: { x: 0, y: -1 },
  E: { x: 1, y: 0 },
  S: { x: 0, y: 1 },
  W: { x: -1, y: 0 },
};
const OPPOSITE: Record<Side, Side> = { N: "S", E: "W", S: "N", W: "E" };

// The tiles the enemies walk over, in order. Corners are listed once.
function routeTiles(map: MapConfig): Vec[] {
  const tiles: Vec[] = [{ x: map.path[0].x, y: map.path[0].y }];
  for (let i = 1; i < map.path.length; i++) {
    const to = map.path[i];
    const last = tiles[tiles.length - 1];
    const dx = Math.sign(to.x - last.x);
    const dy = Math.sign(to.y - last.y);
    if (dx !== 0 && dy !== 0) throw new Error("path points are diagonal");
    for (let at = { x: last.x + dx, y: last.y + dy }; ; at = { x: at.x + dx, y: at.y + dy }) {
      tiles.push(at);
      if (at.x === to.x && at.y === to.y) break;
    }
  }
  return tiles;
}

function sideBetween(from: Vec, to: Vec): Side {
  for (const side of SIDES) {
    if (from.x + STEP[side].x === to.x && from.y + STEP[side].y === to.y) return side;
  }
  throw new Error("path points are not next to each other");
}

// Which sides of each road tile the road runs out of, worked out from the enemy route.
// The first tile opens towards the edge it came from, the last one towards the edge it leaves by.
// The key is "x,y".
export function roadSides(map: MapConfig): Map<string, Set<Side>> {
  const route = routeTiles(map);
  const sides = new Map<string, Set<Side>>();
  route.forEach((tile, i) => {
    const arriving = i > 0 ? sideBetween(route[i - 1], tile) : sideBetween(tile, route[1] ?? tile);
    const leaving = i < route.length - 1 ? sideBetween(tile, route[i + 1]) : arriving;
    const key = `${tile.x},${tile.y}`;
    const open = sides.get(key) ?? new Set<Side>();
    open.add(OPPOSITE[arriving]);
    open.add(leaving);
    sides.set(key, open);
  });
  return sides;
}

function sameSides(a: Iterable<Side>, b: Iterable<Side>): boolean {
  const left = [...a].sort().join("");
  const right = [...b].sort().join("");
  return left === right;
}

// The ground that shows under an overlay road: the road's own `ground`, else the first blocked entry.
function roadGround(tileset: Tileset): string {
  if (tileset.road?.ground !== undefined) return tileset.road.ground;
  const found = Object.entries(tileset.legend).find(([, def]) => def.kind === "blocked");
  if (found === undefined) {
    throw new Error(`${tileset.id}: a road overlay needs a blocked tile to show under it`);
  }
  return found[0];
}

// The art for a map that doesn't have its own: ground everywhere and road pieces that follow
// the route. It is also a good grid to start from when drawing a map by hand.
export function defaultArt(map: MapConfig, tileset: Tileset): string[] {
  const entries = Object.entries(tileset.legend);
  const firstOfKind = (kind: TileKind): string => {
    const found = entries.find(([, def]) => def.kind === kind);
    if (found === undefined) throw new Error(`${tileset.id}: has no ${kind} tile`);
    return found[0];
  };
  const sides = roadSides(map);

  return map.tiles.map((row, y) =>
    [...row]
      .map((character, x) => {
        if (character !== "P") return firstOfKind(TILE_CHARACTER[character]);
        const open = sides.get(`${x},${y}`);
        if (open === undefined) {
          throw new Error(
            `${map.id}: (${x}, ${y}) is a 'P' tile but the enemy route never crosses it`,
          );
        }
        if (tileset.road !== undefined) return roadGround(tileset);
        const piece = entries.find(
          ([, def]) => def.kind === "path" && sameSides(def.connects ?? [], open),
        );
        if (piece === undefined) {
          throw new Error(
            `${tileset.id}: no road piece opens onto ${[...open].sort().join("")} (tile ${x}, ${y} of ${map.id})`,
          );
        }
        return piece[0];
      })
      .join(""),
  );
}

// Checks a map's art against its tileset and its tiles. Called when the map is loaded.
// A map without art is checked by working its art out, which fails if the tileset lacks a piece.
export function checkArt(map: MapConfig, tileset: Tileset): void {
  // An overlay road has to fit the route too: only straight and corner pieces exist
  parseRoad(map, tileset);
  if (map.art === undefined) {
    defaultArt(map, tileset);
    return;
  }
  const art = map.art;
  if (art.length !== map.rows) {
    throw new Error(`${map.id}: art has ${art.length} rows but rows is ${map.rows}`);
  }
  const sides = roadSides(map);

  for (let y = 0; y < art.length; y++) {
    if (art[y].length !== map.cols) {
      throw new Error(`${map.id}: art row ${y} has ${art[y].length} tiles but cols is ${map.cols}`);
    }
    for (let x = 0; x < map.cols; x++) {
      const name = art[y][x];
      const def = tileset.legend[name];
      if (def === undefined) {
        throw new Error(
          `${map.id}: art '${name}' at (${x}, ${y}) is not in the "${tileset.id}" legend`,
        );
      }
      const expected = TILE_CHARACTER[map.tiles[y][x]];
      if (tileset.road !== undefined && expected === "path") {
        // The road is drawn over this tile, so its art names the ground that shows under it
        if (def.kind === "path") {
          throw new Error(
            `${map.id}: art '${name}' at (${x}, ${y}) is a road piece, but "${tileset.id}" draws its road from road cells: name the ground under it`,
          );
        }
        continue;
      }
        // Buildable and blocked pictures are only looks, so either may go on either kind of ground
        const isGround = (kind: TileKind): boolean => kind !== "path";
        if (def.kind !== expected && !(isGround(def.kind) && isGround(expected))) {
        throw new Error(
            `${map.id}: art '${name}' at (${x}, ${y}) is a ${def.kind} picture on a ${expected} tile`,
        );
        }
      const open = sides.get(`${x},${y}`);
      if (def.kind === "path" && open !== undefined && !sameSides(def.connects ?? [], open)) {
        throw new Error(
          `${map.id}: art '${name}' at (${x}, ${y}) opens onto ${[...(def.connects ?? [])].sort().join("")} but the route there uses ${[...open].sort().join("")}`,
        );
      }
    }
  }
}

// A number from 0 to count - 1 for each tile. It looks random but is always the same for the
// same tile, so a map looks the same every time it is played.
function variantFor(x: number, y: number, count: number): number {
  const hash = (Math.imul(x + 1, 73856093) ^ Math.imul(y + 1, 19349663)) >>> 0;
  return hash % count;
}

// What to draw on every tile of the map, row by row.
export function parseArt(map: MapConfig, tileset: Tileset): TileSprite[] {
  const art = map.art ?? defaultArt(map, tileset);
  const sprites: TileSprite[] = [];
  for (let y = 0; y < art.length; y++) {
    for (let x = 0; x < art[y].length; x++) {
      const def = tileset.legend[art[y][x]];
      const [col, row] = def.cells[variantFor(x, y, def.cells.length)];
      sprites.push({ x, y, col, row, rotation: def.rotation ?? 0 });
    }
  }
  return sprites;
}

// Which cell list and how far to turn it, by the sides a road tile opens onto (sorted letters).
// Straight cells run N to S and corner cells join N and E; a quarter turn clockwise moves
// every side one step round (N to E, E to S, S to W, W to N).
const STRAIGHT_TURN: Record<string, Rotation> = { NS: 0, EW: 90 };
const CORNER_TURN: Record<string, Rotation> = { EN: 0, ES: 90, SW: 180, NW: 270 };

// The road pieces to draw over the ground, one per tile the enemies cross, in route order.
// Empty for a tileset without a `road`.
export function parseRoad(map: MapConfig, tileset: Tileset): TileSprite[] {
  const road = tileset.road;
  if (road === undefined) return [];

  const sprites: TileSprite[] = [];
  for (const [key, open] of roadSides(map)) {
    const [x, y] = key.split(",").map(Number);
    const shape = [...open].sort().join("");
    const [cells, rotation] =
      shape in STRAIGHT_TURN
        ? [road.straight, STRAIGHT_TURN[shape]]
        : shape in CORNER_TURN
          ? [road.corner, CORNER_TURN[shape]]
          : [undefined, 0 as Rotation];
    if (cells === undefined) {
      throw new Error(
        `${map.id}: the road at (${x}, ${y}) opens onto ${shape}, but an overlay road only has straight and corner pieces`,
      );
    }
    const [col, row] = cells[variantFor(x, y, cells.length)];
    sprites.push({ x, y, col, row, rotation });
  }
  return sprites;
}