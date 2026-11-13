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
    const view = new PlacementView(triangle);
    const spread = Math.PI / 3; // 60°
    view.showSector({ x: 2, y: 2 }, { facing: 0, spread }); // facing right

    const wedge = wedgeOf(view);
    expect(wedge.visible()).toBe(true);
    expect(wedge.angle()).toBeCloseTo(60);
    expect(wedge.rotation()).toBeCloseTo(-30); // starts 30° before the facing direction
    expect(wedge.radius()).toBeCloseTo(sectorRadius(spread, 2.6) * TILE);
  });

  it("makes a wider cone shorter", () => {
    const view = new PlacementView(triangle);
    view.showSector({ x: 2, y: 2 }, { facing: 0, spread: MAX_SPREAD });
    const wide = wedgeOf(view).radius();
    view.showSector({ x: 2, y: 2 }, { facing: 0, spread: MAX_SPREAD / 3 });
    expect(wedgeOf(view).radius()).toBeGreaterThan(wide);
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
});
