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
  it("draws the scenery as one rectangle in the map's blocked color", () => {
    for (const map of MAPS) {
      const view = new GridView(map, () => true);
      const scenery = view.group.find<Konva.Rect>("Rect")[0];
      expect(scenery.fill()).toBe(map.colors.blocked);
      expect(scenery.width()).toBe(map.cols * TILE);
      expect(scenery.height()).toBe(map.rows * TILE);
    }
  });

  it("draws every build tile in the map's buildable color", () => {
    for (const map of MAPS) {
      const view = new GridView(map, () => true);
      for (let y = 0; y < map.rows; y++) {
        for (let x = 0; x < map.cols; x++) {
          if (map.tiles[y][x] === "#") {
            expect(fillsAt(view, x, y)).toContain(map.colors.buildable);
          }
        }
      }
    }
  });

  it("draws the road in the map's path color along the enemy route", () => {
    for (const map of MAPS) {
      const view = new GridView(map, () => true);
      let road: Konva.Line | null = null;
      for (const line of view.group.find<Konva.Line>("Line")) {
        if (line.stroke() === map.colors.path) {
          road = line;
        }
      }
      if (road === null) {
        throw new Error(`${map.id}: no road drawn`);
      }
      // Two numbers (x and y) per corner of the route
      expect(road.points()).toHaveLength(map.path.length * 2);
    }
  });

  it("shows the grid lines only while a tower is being placed", () => {
    const map = MAPS[0];
    const view = new GridView(map, () => true);
    const gridLines: Konva.Line[] = [];
    for (const line of view.group.find<Konva.Line>("Line")) {
      if (line.stroke() === "white") {
        gridLines.push(line);
      }
    }
    // One line on each side of every column and every row
    expect(gridLines).toHaveLength(map.cols + 1 + map.rows + 1);
    expect(gridLines[0].isVisible()).toBe(false);

    view.showGrid(true);
    expect(gridLines[0].isVisible()).toBe(true);

    view.showGrid(false);
    expect(gridLines[0].isVisible()).toBe(false);
  });

  it("puts decorations only on blocked tiles", () => {
    for (const map of MAPS) {
      const view = new GridView(map, () => true);
      const decorations = view.group.find(".decoration");
      expect(decorations.length).toBeGreaterThan(0);
      for (const decoration of decorations) {
        // Each decoration sits a few pixels off its tile's center, so rounding down finds the tile
        const x = Math.floor(decoration.x() / TILE);
        const y = Math.floor(decoration.y() / TILE);
        expect(map.tiles[y][x]).toBe(".");
      }
    }
  });
});

describe("GridView with textured ground", () => {
  const map = MAPS[0];
  const lines = (view: GridView) => view.group.find<Konva.Line>("Line");

  it("shows the terrain it is given", () => {
    const terrain = new Konva.Group();
    const view = new GridView(map, () => true, terrain);
    expect(view.group.getChildren()).toContain(terrain);
  });

  it("draws neither the colored build tiles, the decorations nor the road under the terrain", () => {
    const view = new GridView(map, () => true, new Konva.Group());
    expect(view.group.find(".decoration")).toHaveLength(0);
    expect(lines(view).filter((line) => line.stroke() === map.colors.path)).toHaveLength(0);
    for (const rect of view.group.find<Konva.Rect>("Rect")) {
      expect(rect.fill()).not.toBe(map.colors.buildable);
    }
  });

  it("keeps the scenery rectangle, which catches the mouse and shows through a missing sheet", () => {
    const view = new GridView(map, () => true, new Konva.Group());
    const scenery = view.group.find<Konva.Rect>("Rect")[0];
    expect(scenery.fill()).toBe(map.colors.blocked);
    expect(scenery.listening()).toBe(true);
  });

  it("puts the terrain under the grid lines and the hover tint", () => {
    const terrain = new Konva.Group();
    const view = new GridView(map, () => true, terrain);
    const order = view.group.getChildren();
    const terrainAt = order.indexOf(terrain);
    expect(terrainAt).toBeGreaterThan(0); // above the scenery rectangle
    // everything after it is the grid lines and the hover tint
    expect(order).toHaveLength(terrainAt + 3);
  });

  it("still shows the grid lines only while a tower is being placed", () => {
    const view = new GridView(map, () => true, new Konva.Group());
    const gridLines = lines(view).filter((line) => line.stroke() === "white");
    expect(gridLines).toHaveLength(map.cols + 1 + map.rows + 1);
    expect(gridLines[0].isVisible()).toBe(false);
    view.showGrid(true);
    expect(gridLines[0].isVisible()).toBe(true);
  });

  it("draws the plain colored look when the terrain is null", () => {
    const view = new GridView(map, () => true, null);
    expect(view.group.find(".decoration").length).toBeGreaterThan(0);
    expect(lines(view).some((line) => line.stroke() === map.colors.path)).toBe(true);
  });
});
