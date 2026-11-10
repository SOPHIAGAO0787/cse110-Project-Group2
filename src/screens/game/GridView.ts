import Konva from "konva";
import type { Decoration, MapConfig, Vec } from "../../model/types";
import { TILE } from "./GameScreenView";

const PATCH_EDGE = 3; // how far the dark edge around a patch of build tiles sticks out, in pixels

// Draws the map: the scenery, the build spots, and a road along the enemy route.
// While the player places a tower, grid lines show each tile, and the tile under
// the mouse is tinted green if a tower can go there and red if not.
export class GridView {
  group = new Konva.Group();
  private gridLines = new Konva.Group({ visible: false, opacity: 0.4, listening: false });
  private hover = new Konva.Rect({
    width: TILE,
    height: TILE,
    opacity: 0.45,
    visible: false,
    listening: false, // so the tile underneath still gets the mouse
  });
  private isBuildable: (tile: Vec) => boolean;

  // isBuildable answers "can a tower go on this tile?" (the controller passes in the model's grid)
  constructor(map: MapConfig, isBuildable: (tile: Vec) => boolean) {
    this.isBuildable = isBuildable;

    // The scenery is one big rectangle, so the map has no lines between tiles
    this.group.add(
      new Konva.Rect({
        width: map.cols * TILE,
        height: map.rows * TILE,
        fill: map.colors.blocked,
      }),
    );

    // Build tiles in two passes. First a dark square a little bigger than each tile,
    // then the tiles on top. Next to each other the tiles cover the dark squares,
    // so only a dark edge around each patch of build tiles is left.
    const edges = new Konva.Group({ opacity: 0.3, listening: false });
    for (let y = 0; y < map.rows; y++) {
      for (let x = 0; x < map.cols; x++) {
        if (map.tiles[y][x] === "#") {
          edges.add(
            new Konva.Rect({
              x: x * TILE - PATCH_EDGE,
              y: y * TILE - PATCH_EDGE,
              width: TILE + 2 * PATCH_EDGE,
              height: TILE + 2 * PATCH_EDGE,
              fill: "black",
            }),
          );
        }
      }
    }
    // Drawn as one picture, so where two squares overlap the edge does not get darker.
    // (cache() fails on an empty group, so skip it on a map with no build tiles.)
    if (edges.hasChildren()) {
      edges.cache();
    }
    this.group.add(edges);
    for (let y = 0; y < map.rows; y++) {
      for (let x = 0; x < map.cols; x++) {
        if (map.tiles[y][x] === "#") {
          this.group.add(
            new Konva.Rect({
              x: x * TILE,
              y: y * TILE,
              width: TILE,
              height: TILE,
              fill: map.colors.buildable,
              // A thin outline in the same color hides the seams between neighbors
              stroke: map.colors.buildable,
              strokeWidth: 1,
              listening: false,
            }),
          );
        }
      }
    }

    // Decorations on about a third of the blocked tiles. scatter() picks the tiles and
    // nudges each decoration off the tile center, so they don't line up in rows.
    for (let y = 0; y < map.rows; y++) {
      for (let x = 0; x < map.cols; x++) {
        const spot = scatter(x, y);
        if (map.tiles[y][x] === "." && spot < 35) {
          const decoration = makeDecoration(map.decoration);
          decoration.x((x + 0.5) * TILE + (spot % 7) * 2 - 6);
          decoration.y((y + 0.5) * TILE + (spot % 5) * 2 - 4);
          decoration.scale({ x: 0.8 + (spot % 3) * 0.15, y: 0.8 + (spot % 3) * 0.15 });
          this.group.add(decoration);
        }
      }
    }

    // The road follows the enemy route. Path points are tile centers, so add half a tile.
    const points: number[] = [];
    for (const p of map.path) {
      points.push((p.x + 0.5) * TILE, (p.y + 0.5) * TILE);
    }
    // A dark line one tile wide, then the road color on top, a little narrower,
    // so a dark edge shows on both sides of the road
    this.group.add(
      new Konva.Line({
        points,
        stroke: "black",
        opacity: 0.3,
        strokeWidth: TILE,
        lineCap: "round",
        lineJoin: "round",
        listening: false,
      }),
    );
    this.group.add(
      new Konva.Line({
        points,
        stroke: map.colors.path,
        strokeWidth: TILE - 8,
        lineCap: "round",
        lineJoin: "round",
        listening: false,
      }),
    );

    // One line along every tile edge, hidden until showGrid(true)
    for (let x = 0; x <= map.cols; x++) {
      this.gridLines.add(
        new Konva.Line({ points: [x * TILE, 0, x * TILE, map.rows * TILE], stroke: "white" }),
      );
    }
    for (let y = 0; y <= map.rows; y++) {
      this.gridLines.add(
        new Konva.Line({ points: [0, y * TILE, map.cols * TILE, y * TILE], stroke: "white" }),
      );
    }
    this.group.add(this.gridLines);

    this.group.add(this.hover);
    this.group.on("mousemove", () => this.moveHover());
    this.group.on("mouseleave", () => this.hover.visible(false));
  }

  // The tile the mouse is over, or null if the mouse is not on the page.
  // Use it for anything that needs a tile from the mouse, like clicking to place a tower.
  tileUnderMouse(): Vec | null {
    // The mouse position in map pixels, already undoing the map's scaling
    const pointer = this.group.getRelativePointerPosition();
    if (pointer === null) {
      return null;
    }
    return { x: Math.floor(pointer.x / TILE), y: Math.floor(pointer.y / TILE) };
  }

  // Shows the grid lines while a tower is being placed, and hides them and the tint after.
  // The tint appears on the next mouse move over the map.
  showGrid(visible: boolean): void {
    this.gridLines.visible(visible);
    if (!visible) {
      this.hover.visible(false);
    }
  }

  // Puts the tint on the tile under the mouse, but only while the grid is showing
  private moveHover(): void {
    if (!this.gridLines.visible()) {
      return;
    }
    const tile = this.tileUnderMouse();
    if (tile === null) {
      return;
    }
    this.hover.position({ x: tile.x * TILE, y: tile.y * TILE });
    if (this.isBuildable(tile)) {
      this.hover.fill("#7cfc00");
    } else {
      this.hover.fill("#ff4d4d");
    }
    this.hover.visible(true);
  }
}

// A number from 0 to 99 for each tile. It looks random but is always the same for the
// same tile, so a map looks the same every time it is played.
function scatter(x: number, y: number): number {
  return (x * 37 + y * 131 + x * y * 17) % 100;
}

// One decoration, drawn around (0, 0) and smaller than a tile
function makeDecoration(kind: Decoration): Konva.Group {
  const decoration = new Konva.Group({ name: "decoration", listening: false });
  if (kind === "trees") {
    // A shadow, the leaves, and a lighter spot where the sun hits
    decoration.add(new Konva.Circle({ x: 3, y: 4, radius: 15, fill: "black", opacity: 0.2 }));
    decoration.add(new Konva.Circle({ radius: 15, fill: "#2e7d32" }));
    decoration.add(new Konva.Circle({ x: -5, y: -5, radius: 6, fill: "#4caf50" }));
  } else if (kind === "rocks") {
    // A dark rock with a lighter top
    decoration.add(new Konva.Ellipse({ y: 4, radiusX: 15, radiusY: 10, fill: "#6d3b1f" }));
    decoration.add(new Konva.Ellipse({ y: 1, radiusX: 10, radiusY: 6, fill: "#c0703a" }));
  } else if (kind === "waves") {
    // Two little white curves, one above the other
    for (const dy of [-5, 5]) {
      decoration.add(
        new Konva.Line({
          points: [-12, dy, -6, dy - 4, 0, dy, 6, dy - 4, 12, dy],
          tension: 0.5,
          stroke: "white",
          strokeWidth: 2,
          opacity: 0.7,
        }),
      );
    }
  } else {
    // A grey mountain with a snowy top
    decoration.add(
      new Konva.Line({ points: [-17, 13, 0, -15, 17, 13], closed: true, fill: "#4f5964" }),
    );
    decoration.add(
      new Konva.Line({ points: [-6, -4, 0, -15, 6, -4], closed: true, fill: "white" }),
    );
  }
  return decoration;
}
