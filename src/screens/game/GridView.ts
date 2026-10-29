import Konva from "konva";
import type { MapConfig, Vec } from "../../model/types";
import { TILE } from "./GameScreenView";

const COLORS: { [tile: string]: string } = { P: "#c2a878", "#": "#4a7c59", ".": "#2e3b2e" };

// Draws the map: one square per tile, plus a dashed line showing the enemy route.
// While the mouse is over the map, the tile under it is tinted green if a tower
// can go there and red if not.
export class GridView {
  group = new Konva.Group();
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

    for (let y = 0; y < map.rows; y++) {
      for (let x = 0; x < map.cols; x++) {
        const tile = map.tiles[y][x];
        this.group.add(
          new Konva.Rect({
            x: x * TILE,
            y: y * TILE,
            width: TILE,
            height: TILE,
            fill: COLORS[tile],
            stroke: "#00000022",
          }),
        );
      }
    }

    // Path points are tile centers, so add half a tile
    const points: number[] = [];
    for (const p of map.path) {
      points.push((p.x + 0.5) * TILE, (p.y + 0.5) * TILE);
    }
    this.group.add(
      new Konva.Line({ points, stroke: "#f4e9c8", strokeWidth: 2, dash: [6, 6], listening: false }),
    );

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

  // Puts the tint on the tile under the mouse
  private moveHover(): void {
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
