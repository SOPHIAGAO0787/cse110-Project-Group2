// @vitest-environment jsdom
import Konva from "konva";
import "vitest-canvas-mock";
import { describe, expect, it } from "vitest";
import { Enemy } from "../../model/Enemy";
import { MAX_SPREAD } from "../../model/geometry/sector";
import { Path } from "../../model/Path";
import { Tower } from "../../model/Tower";
import { ENEMIES, TOWERS } from "../../model/loadContent";
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
    // facing right: the dart already points along +x, so it is not turned at all
    view.add(new Tower(1, triangle, { x: 1, y: 1 }, { kind: "sector", facing: 0, spread: 1 }));

    const body = view.group.findOne<Konva.Line>("Line")!;
    expect(body.rotation()).toBeCloseTo(0);
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

  describe("triangle aiming", () => {
    const path = new Path([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ]);
    function enemyAt(pos: { x: number; y: number }): Enemy {
      const enemy = new Enemy(1, ENEMIES[0], path);
      enemy.pos = pos;
      return enemy;
    }

    // tower on tile (1, 1), cone facing right and as wide as it gets (75°)
    function setup() {
      const view = new TowersView();
      const tower = new Tower(
        1,
        triangle,
        { x: 1, y: 1 },
        { kind: "sector", facing: 0, spread: MAX_SPREAD },
      );
      view.add(tower);
      const body = view.group.findOne<Konva.Line>("Line")!;
      return { view, tower, body };
    }

    it("swings towards an enemy inside its cone", () => {
      const { view, tower, body } = setup();
      const angle = Math.PI / 6; // 30° below straight ahead
      const enemy = enemyAt({ x: 1 + 2 * Math.cos(angle), y: 1 + 2 * Math.sin(angle) });

      view.update([tower], [enemy], 1); // a long step: the turn is finished

      expect(body.rotation()).toBeCloseTo(30);
    });

    it("turns gradually, not instantly", () => {
      const { view, tower, body } = setup();
      const angle = Math.PI / 6;
      const enemy = enemyAt({ x: 1 + 2 * Math.cos(angle), y: 1 + 2 * Math.sin(angle) });

      view.update([tower], [enemy], 0.01);

      expect(body.rotation()).toBeGreaterThan(0);
      expect(body.rotation()).toBeLessThan(30);
    });

    it("swings back to its facing when the target is gone", () => {
      const { view, tower, body } = setup();
      const angle = Math.PI / 6;
      view.update(
        [tower],
        [enemyAt({ x: 1 + 2 * Math.cos(angle), y: 1 + 2 * Math.sin(angle) })],
        1,
      );

      view.update([tower], [], 1);

      expect(body.rotation()).toBeCloseTo(0);
    });

    it("ignores an enemy outside the cone", () => {
      const { view, tower, body } = setup();
      view.update([tower], [enemyAt({ x: 1, y: 3 })], 1); // straight below, the cone faces right
      expect(body.rotation()).toBeCloseTo(0);
    });
  });
});
