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
    // everything after it is the arrow, the flag, the grid lines and the hover tint
    expect(order).toHaveLength(terrainAt + 5);
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

describe("GridView path markers", () => {
  // The center of the tile at a path point, in pixels
  function center(p: { x: number; y: number }): { x: number; y: number } {
    return { x: (p.x + 0.5) * TILE, y: (p.y + 0.5) * TILE };
  }

  it("puts an arrow on the first path tile and a flag on the last, on every map", () => {
    for (const map of MAPS) {
      // Once with the plain colors and once with textured ground
      const views = [
        new GridView(map, () => true),
        new GridView(map, () => true, new Konva.Group()),
      ];
      for (const view of views) {
        const arrows = view.group.find<Konva.Arrow>(".spawn-arrow");
        expect(arrows).toHaveLength(1);
        const points = arrows[0].points();
        // The arrow's middle is the first tile's center
        const start = center(map.path[0]);
        expect((points[0] + points[2]) / 2).toBe(start.x);
        expect((points[1] + points[3]) / 2).toBe(start.y);

        const flags = view.group.find(".exit-flag");
        expect(flags).toHaveLength(1);
        const end = center(map.path[map.path.length - 1]);
        expect(flags[0].x()).toBe(end.x);
        expect(flags[0].y()).toBe(end.y);
      }
    }
  });

  it("points the arrow toward the second path point", () => {
    for (const map of MAPS) {
      const view = new GridView(map, () => true);
      const points = view.group.find<Konva.Arrow>(".spawn-arrow")[0].points();
      // The arrow goes from (points[0], points[1]) to its tip at (points[2], points[3])
      const arrowX = points[2] - points[0];
      const arrowY = points[3] - points[1];
      const roadX = map.path[1].x - map.path[0].x;
      const roadY = map.path[1].y - map.path[0].y;
      expect(Math.sign(arrowX)).toBe(Math.sign(roadX));
      expect(Math.sign(arrowY)).toBe(Math.sign(roadY));
    }
  });

  it("points the arrow down when the road starts going down", () => {
    const map = {
      ...MAPS[0],
      path: [
        { x: 2, y: 0 },
        { x: 2, y: 5 },
        { x: 8, y: 5 },
      ],
    };
    const view = new GridView(map, () => true);
    const points = view.group.find<Konva.Arrow>(".spawn-arrow")[0].points();
    expect(points[2]).toBe(points[0]); // no sideways part
    expect(points[3]).toBeGreaterThan(points[1]); // the tip is lower on the screen
  });
});
