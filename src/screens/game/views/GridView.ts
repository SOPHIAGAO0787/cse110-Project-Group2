import Konva from "konva";
import { COLORS, TILE } from "../../../core/constants";
import type { MapConfig } from "../../../model/types";

// Draws the map: one square per tile, plus a line showing the enemy route.
export class GridView {
  readonly group = new Konva.Group({ listening: false });

  constructor(map: MapConfig) {
    map.tiles.forEach((row, y) => {
      [...row].forEach((ch, x) => {
        this.group.add(
          new Konva.Rect({
            x: x * TILE,
            y: y * TILE,
            width: TILE,
            height: TILE,
            fill: ch === "P" ? COLORS.path : ch === "#" ? COLORS.buildable : COLORS.blocked,
            stroke: COLORS.gridLine,
            strokeWidth: 1,
          })
        );
      });
    });

    // Waypoints sit at tile centers, hence the +0.5
    this.group.add(
      new Konva.Line({
        points: map.path.flatMap((p) => [(p.x + 0.5) * TILE, (p.y + 0.5) * TILE]),
        stroke: COLORS.route,
        strokeWidth: 2,
        dash: [6, 6],
        lineJoin: "round",
      })
    );
  }
}
