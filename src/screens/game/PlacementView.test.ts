// @vitest-environment jsdom
import Konva from "konva";
import "vitest-canvas-mock";
import { describe, expect, it } from "vitest";
import { MAX_SPREAD, sectorRadius } from "../../model/geometry/sector";
import { TOWERS } from "../../model/loadContent";
import { TILE } from "./GameScreenView";
import { PlacementView } from "./PlacementView";

const circle = TOWERS.find((d) => d.id === "circle")!;
const triangle = TOWERS.find((d) => d.id === "triangle")!;
const rectangle = TOWERS.find((d) => d.id === "rectangle")!;

function wedgeOf(view: PlacementView): Konva.Wedge {
  return view.group.findOne<Konva.Wedge>("Wedge")!;
}

function ringOf(view: PlacementView): Konva.Circle {
  // the ring is the circle with a stroke; the ghost has none
  return view.group.find<Konva.Circle>("Circle").find((c) => c.stroke())!;
}

describe("PlacementView", () => {
  it("shows the range ring for a circle tower", () => {
    const view = new PlacementView(circle);
    view.show({ x: 2, y: 2 }, true);
    expect(ringOf(view).visible()).toBe(true);
    expect(ringOf(view).radius()).toBe(2.5 * TILE);
  });

  it("shows no ring for a triangle tower until a cone is given", () => {
    const view = new PlacementView(triangle);
    view.show({ x: 2, y: 2 }, true);
    expect(ringOf(view).visible()).toBe(false);
    expect(wedgeOf(view).visible()).toBe(false);
  });

  it("draws the cone centred on the facing direction", () => {
    const spread = Math.PI / 3; // 60°
    const triangle = TOWERS.find((d) => d.id === "triangle")!;
    const view = new PlacementView(triangle);
    const triangleArea = triangle.range.kind === "sector" ? triangle.range.area : 0; // from towers.json
    view.showSector({ x: 2, y: 2 }, { facing: 0, spread }); // facing right

    const wedge = wedgeOf(view);
    expect(wedge.visible()).toBe(true);
    expect(wedge.angle()).toBeCloseTo(60);
    expect(wedge.rotation()).toBeCloseTo(-30); // starts 30° before the facing direction
    expect(wedge.radius()).toBeCloseTo(sectorRadius(spread, triangleArea) * TILE);
  });

  it("makes a wider cone shorter", () => {
    const view = new PlacementView(triangle);
    view.showSector({ x: 2, y: 2 }, { facing: 0, spread: MAX_SPREAD });
    const wide = wedgeOf(view).radius();
    view.showSector({ x: 2, y: 2 }, { facing: 0, spread: MAX_SPREAD / 3 });
    expect(wedgeOf(view).radius()).toBeGreaterThan(wide);
  });

  it("drags a ghost shaped like the tower, tinted by whether it can go there", () => {
    const shapeOf = (view: PlacementView) => view.group.getChildren().at(-1) as Konva.Shape;
    const cases = [
      [circle, "Circle"],
      [triangle, "Line"],
      [rectangle, "Rect"],
    ] as const;
    for (const [def, className] of cases) {
      const view = new PlacementView(def);
      view.show({ x: 2, y: 2 }, true);
      const ghost = shapeOf(view);
      expect(ghost.getClassName()).toBe(className);
      expect(ghost.visible()).toBe(true);
      expect(ghost.position()).toEqual({ x: 2.5 * TILE, y: 2.5 * TILE });
      const valid = ghost.fill();
      view.show({ x: 2, y: 2 }, false);
      expect(ghost.fill()).not.toBe(valid);
    }
  });

  it("hide() hides the ghost, ring and cone", () => {
    const view = new PlacementView(triangle);
    view.show({ x: 2, y: 2 }, true);
    view.showSector({ x: 2, y: 2 }, { facing: 0, spread: 1 });
    view.hide();
    expect(wedgeOf(view).visible()).toBe(false);
    expect(ringOf(view).visible()).toBe(false);
  });

  it("ignores showSector on a circle tower", () => {
    const view = new PlacementView(circle);
    view.showSector({ x: 2, y: 2 }, { facing: 0, spread: 1 });
    expect(wedgeOf(view).visible()).toBe(false);
  });

  describe("square tower block", () => {
    // the block's cells are the outlined rectangles inside the group
    const cellsOf = (view: PlacementView) =>
      view.group.find<Konva.Rect>("Rect").filter((r) => r.stroke() === "#e8a14a");

    it("shows nothing until a block is given", () => {
      const view = new PlacementView(rectangle);
      view.show({ x: 2, y: 2 }, true);
      expect(ringOf(view).visible()).toBe(false);
      expect(wedgeOf(view).visible()).toBe(false);
      expect(cellsOf(view)).toHaveLength(0);
    });

    it("draws one cell per tile, next to the tower", () => {
      const view = new PlacementView(rectangle);
      // 3 wide, 2 deep, facing up from tile (5, 5): columns 4–6, rows 3–4
      view.showRect({ x: 5, y: 5 }, { kind: "rect", facing: "up", width: 3, depth: 2, side: 1 });
      const cells = cellsOf(view);
      expect(cells).toHaveLength(6);
      expect(Math.min(...cells.map((c) => c.x()))).toBe(4 * TILE);
      expect(Math.max(...cells.map((c) => c.x()))).toBe(6 * TILE);
      expect(Math.min(...cells.map((c) => c.y()))).toBe(3 * TILE);
      expect(Math.max(...cells.map((c) => c.y()))).toBe(4 * TILE);
    });

    it("moves the block when the pointer changes side, and replaces the old cells", () => {
      const view = new PlacementView(rectangle);
      const tile = { x: 5, y: 5 };
      view.showConfig(tile, { kind: "rect", facing: "up", width: 2, depth: 2, side: 1 });
      expect(Math.min(...cellsOf(view).map((c) => c.x()))).toBe(5 * TILE);
      view.showConfig(tile, { kind: "rect", facing: "up", width: 2, depth: 2, side: -1 });
      expect(cellsOf(view)).toHaveLength(4);
      expect(Math.min(...cellsOf(view).map((c) => c.x()))).toBe(4 * TILE);
    });

    it("hide() hides the block, and showConfig draws a cone for a triangle", () => {
      const view = new PlacementView(rectangle);
      view.showRect({ x: 5, y: 5 }, { kind: "rect", facing: "up", width: 2, depth: 2, side: 1 });
      view.hide();
      const block = view.group.getChildren().find((n) => n instanceof Konva.Group)!;
      expect(block.visible()).toBe(false);

      const tri = new PlacementView(triangle);
      tri.showConfig({ x: 2, y: 2 }, { kind: "sector", facing: 0, spread: 1 });
      expect(wedgeOf(tri).visible()).toBe(true);
    });

    it("ignores showRect on a tower that is not a square tower", () => {
      const view = new PlacementView(circle);
      view.showRect({ x: 5, y: 5 }, { kind: "rect", facing: "up", width: 2, depth: 2, side: 1 });
      expect(cellsOf(view)).toHaveLength(0);
    });
  });
});
