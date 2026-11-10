import Konva from "konva";
import type { MapConfig, Vec } from "../../model/types";
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
