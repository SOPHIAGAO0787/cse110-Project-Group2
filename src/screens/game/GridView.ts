import Konva from "konva";
import type { MapConfig } from "../../model/types";
import { TILE } from "./GameScreenView";

const COLORS: { [tile: string]: string } = { P: "#c2a878", "#": "#4a7c59", ".": "#2e3b2e" };

// Draws the map: one square per tile, plus a dashed line showing the enemy route.
export class GridView {
  group = new Konva.Group({ listening: false });

  constructor(map: MapConfig) {
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
    this.group.add(new Konva.Line({ points, stroke: "#f4e9c8", strokeWidth: 2, dash: [6, 6] }));
  }
}
