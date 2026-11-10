// @vitest-environment jsdom
import Konva from "konva";
import "vitest-canvas-mock";
import { describe, expect, it } from "vitest";
import { MAPS } from "../../model/loadContent";
import { GridView } from "./GridView";
import { TILE } from "./GameScreenView";

// The colors of the squares drawn on the tile at (x, y)
function fillsAt(view: GridView, x: number, y: number): string[] {
  const fills: string[] = [];
  for (const rect of view.group.find<Konva.Rect>("Rect")) {
    if (rect.x() === x * TILE && rect.y() === y * TILE && rect.visible()) {
      // GridView only fills with plain colors, never gradients
      fills.push(rect.fill() as string);
    }
  }
  return fills;
}

describe("GridView", () => {
  it("draws every tile in its map's own colors", () => {
    for (const map of MAPS) {
      const view = new GridView(map, () => true);
      for (let y = 0; y < map.rows; y++) {
        for (let x = 0; x < map.cols; x++) {
          const tile = map.tiles[y][x];
          let expected = map.colors.blocked;
          if (tile === "#") {
            expected = map.colors.buildable;
          } else if (tile === "P") {
            expected = map.colors.path;
          }
          expect(fillsAt(view, x, y)).toContain(expected);
        }
      }
    }
  });
});
