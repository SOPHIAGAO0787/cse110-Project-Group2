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

  describe("block label", () => {
    const labelOf = (view: PlacementView) =>
      view.group.find<Konva.Text>("Text").find((t) => t.text().includes("Fire Rate"))!;
    const rectCfg = (width: number, depth: number) =>
      ({ kind: "rect", facing: "up", width, depth, side: 1 }) as const;

    it("says the block's size and how fast it fires", () => {
      const view = new PlacementView(rectangle);
      // 3 wide, 2 deep facing up is 3 columns by 2 rows; rateArea 6 over area 6 keeps the base 0.7
      view.showRect({ x: 5, y: 5 }, rectCfg(3, 2));
      expect(labelOf(view).text()).toBe("3x2  Fire Rate: 0.7/s");
      expect(labelOf(view).visible()).toBe(true);
    });

    it("fires faster for a smaller block", () => {
      const view = new PlacementView(rectangle);
      view.showRect({ x: 5, y: 5 }, rectCfg(1, 2));
      expect(labelOf(view).text()).toBe("1x2  Fire Rate: 2.1/s");
    });

    it("counts columns by rows as drawn, so a sideways block is wide", () => {
      const view = new PlacementView(rectangle);
      view.showRect({ x: 5, y: 5 }, { kind: "rect", facing: "right", width: 3, depth: 2, side: 1 });
      expect(labelOf(view).text()).toMatch(/^2x3 /);
    });

    it("sits above the block's top left corner, big enough to read", () => {
      const view = new PlacementView(rectangle);
      view.showRect({ x: 5, y: 5 }, rectCfg(3, 2)); // columns 4–6, rows 3–4
      const label = labelOf(view);
      expect(label.x()).toBe(4 * TILE);
      expect(label.y() + label.height()).toBeLessThanOrEqual(3 * TILE);
      expect(label.fontSize()).toBeGreaterThanOrEqual(TILE * 0.4);
    });

    it("goes under the block when the block is against the top edge", () => {
      const view = new PlacementView(rectangle);
      view.showRect({ x: 5, y: 2 }, rectCfg(3, 2)); // facing up from row 2: rows 0–1
      expect(labelOf(view).y()).toBeGreaterThanOrEqual(2 * TILE);
    });

    it("follows the block when it changes, and is hidden by hide()", () => {
      const view = new PlacementView(rectangle);
      view.showRect({ x: 5, y: 5 }, rectCfg(3, 2));
      view.showRect({ x: 5, y: 5 }, rectCfg(2, 2));
      expect(labelOf(view).text()).toMatch(/^2x2 /);
      view.hide();
      expect(labelOf(view).visible()).toBe(false);
    });

    it("is not shown for a tower that is not a square tower", () => {
      const view = new PlacementView(circle);
      view.showRect({ x: 5, y: 5 }, rectCfg(2, 2));
      expect(view.group.find<Konva.Text>("Text").every((t) => !t.visible())).toBe(true);
    });
  });

  describe("confirm and cancel squares", () => {
    const bounds = { cols: 16, rows: 10 };
    const squares = (view: PlacementView) =>
      view.prompt.getChildren().filter((n): n is Konva.Group => n instanceof Konva.Group);
    const hints = (view: PlacementView) =>
      view.prompt.find<Konva.Text>("Text").map((t) => t.text());

    it("are hidden until a tower is dropped", () => {
      const view = new PlacementView(circle, bounds);
      expect(view.prompt.visible()).toBe(false);
      view.show({ x: 3, y: 3 }, true); // still being dragged
      expect(view.prompt.visible()).toBe(false);
    });

    it("show a green and a red square with the keys that do the same, below them", () => {
      const view = new PlacementView(circle, bounds);
      view.showPrompt({ x: 3, y: 3 });
      expect(view.prompt.visible()).toBe(true);
      const [confirm, cancel] = squares(view);
      expect(confirm.findOne<Konva.Rect>("Rect")!.fill()).not.toBe(
        cancel.findOne<Konva.Rect>("Rect")!.fill(),
      );
      expect(hints(view)).toEqual(["Enter", "Esc"]);
      // the green one is on the left, the red one beside it
      expect(confirm.x()).toBeLessThan(cancel.x());
    });

    it("sit at the tower's bottom right corner", () => {
      const view = new PlacementView(circle, bounds);
      view.showPrompt({ x: 3, y: 3 });
      expect(view.prompt.x()).toBe(4 * TILE);
      expect(view.prompt.y()).toBe(4 * TILE);
    });

    it("move to the left of a tower at the right edge, and above one at the bottom edge", () => {
      const view = new PlacementView(circle, bounds);
      const redSquare = () => squares(view)[1];
      view.showPrompt({ x: 15, y: 3 });
      // the red square is the one furthest right, and it ends where the tower's tile begins
      const right =
        view.prompt.x() + redSquare().x() + redSquare().findOne<Konva.Rect>("Rect")!.width();
      expect(right).toBeLessThanOrEqual(15 * TILE);
      view.showPrompt({ x: 3, y: 9 });
      expect(view.prompt.y()).toBeLessThan(9 * TILE);
    });

    it("press confirm and cancel by their own handler", () => {
      const view = new PlacementView(circle, bounds);
      const calls: string[] = [];
      view.onConfirm = () => calls.push("confirm");
      view.onCancel = () => calls.push("cancel");
      view.showPrompt({ x: 3, y: 3 });
      const [confirm, cancel] = squares(view);
      confirm.fire("pointerdown");
      cancel.fire("pointerdown");
      expect(calls).toEqual(["confirm", "cancel"]);
    });

    it("do not let the press reach the map underneath", () => {
      const view = new PlacementView(circle, bounds);
      view.showPrompt({ x: 3, y: 3 });
      let reached = false;
      view.prompt.on("pointerdown", () => (reached = true));
      squares(view)[0].fire("pointerdown", {}, true);
      expect(reached).toBe(false);
    });

    it("hide() hides them", () => {
      const view = new PlacementView(circle, bounds);
      view.showPrompt({ x: 3, y: 3 });
      view.hide();
      expect(view.prompt.visible()).toBe(false);
    });

    it("work without map bounds, and then never move aside", () => {
      const view = new PlacementView(circle);
      view.showPrompt({ x: 15, y: 9 });
      expect(view.prompt.x()).toBe(16 * TILE);
    });
  });

  describe("locked aim", () => {
    const cellsOf = (view: PlacementView) =>
      view.group.find<Konva.Rect>("Rect").filter((r) => r.stroke() === "#e8a14a");
    const cfg = { kind: "rect", facing: "up", width: 2, depth: 2, side: 1 } as const;

    it("draws the block with a heavier outline while locked, and the usual one otherwise", () => {
      const view = new PlacementView(rectangle);
      view.showRect({ x: 5, y: 5 }, cfg);
      const normal = cellsOf(view)[0].strokeWidth();
      view.setLocked(true);
      expect(cellsOf(view).every((c) => c.strokeWidth() > normal)).toBe(true);
      view.setLocked(false);
      expect(cellsOf(view).every((c) => c.strokeWidth() === normal)).toBe(true);
    });

    it("keeps the heavier outline when the block is drawn again", () => {
      const view = new PlacementView(rectangle);
      view.showRect({ x: 5, y: 5 }, cfg);
      const normal = cellsOf(view)[0].strokeWidth();
      view.setLocked(true);
      view.showRect({ x: 5, y: 5 }, { ...cfg, width: 3 });
      expect(cellsOf(view).every((c) => c.strokeWidth() > normal)).toBe(true);
    });

    it("gives the cone a heavier outline too", () => {
      const view = new PlacementView(triangle);
      view.showSector({ x: 2, y: 2 }, { facing: 0, spread: 1 });
      const normal = wedgeOf(view).strokeWidth();
      view.setLocked(true);
      expect(wedgeOf(view).strokeWidth()).toBeGreaterThan(normal);
    });

    it("hide() unlocks", () => {
      const view = new PlacementView(rectangle);
      view.setLocked(true);
      view.hide();
      view.showRect({ x: 5, y: 5 }, cfg);
      const [cell] = cellsOf(view);
      view.setLocked(false);
      expect(cell.strokeWidth()).toBe(cellsOf(view)[0].strokeWidth());
    });
  });
});
