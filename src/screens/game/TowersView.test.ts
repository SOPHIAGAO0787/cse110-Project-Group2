// @vitest-environment jsdom
import Konva from "konva";
import "vitest-canvas-mock";
import { describe, expect, it } from "vitest";
import { Tower } from "../../model/Tower";
import { TOWERS } from "../../model/loadContent";
import { TILE } from "./GameScreenView";
import { TowersView } from "./TowersView";

const circle = TOWERS.find((d) => d.id === "circle")!;
const triangle = TOWERS.find((d) => d.id === "triangle")!;

describe("TowersView", () => {
  it("puts a sprite at the centre of the tower's tile", () => {
    const view = new TowersView();
    view.add(new Tower(1, circle, { x: 3, y: 2 }));

    const sprite = view.group.getChildren()[0];
    expect(sprite.position()).toEqual({ x: 3.5 * TILE, y: 2.5 * TILE });
  });

  it("turns the triangle to point along its facing direction", () => {
    const view = new TowersView();
    // facing right: the polygon's tip points up by default, so it turns 90° clockwise
    view.add(new Tower(1, triangle, { x: 1, y: 1 }, { kind: "sector", facing: 0, spread: 1 }));

    const body = view.group.findOne<Konva.RegularPolygon>("RegularPolygon")!;
    expect(body.rotation()).toBeCloseTo(90);
  });

  it("plays a fire effect for the tower that fired, and ignores unknown ids", () => {
    const view = new TowersView();
    view.add(new Tower(1, circle, { x: 1, y: 1 }));
    view.add(new Tower(2, triangle, { x: 4, y: 1 }));
    const [first, second] = view.group.getChildren() as Konva.Group[];
    const before = [first.getChildren().length, second.getChildren().length];

    view.fire(2);
    view.fire(99); // no such tower: nothing happens, nothing throws

    expect(first.getChildren().length).toBe(before[0]);
    expect(second.getChildren().length).toBe(before[1] + 1); // the cone flash
  });
});
