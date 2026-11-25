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
import { CIRCLE_TOWER_COLOR, SQUARE_TOWER_COLOR, TRIANGLE_TOWER_COLOR } from "../theme";

const circle = TOWERS.find((d) => d.id === "circle")!;
const triangle = TOWERS.find((d) => d.id === "triangle")!;
const rectangle = TOWERS.find((d) => d.id === "rectangle")!;

describe("TowersView", () => {
  it("puts a sprite at the centre of the tower's tile", () => {
    const view = new TowersView();
    view.add(new Tower(1, circle, { x: 3, y: 2 }));

    const sprite = view.group.getChildren()[0];
    expect(sprite.position()).toEqual({ x: 3.5 * TILE, y: 2.5 * TILE });
  });

  it("draws each tower in the same color as the main menu and the shop", () => {
    const view = new TowersView();
    view.add(new Tower(1, circle, { x: 1, y: 1 }));
    view.add(new Tower(2, triangle, { x: 4, y: 1 }));
    view.add(new Tower(3, rectangle, { x: 7, y: 1 }));

    expect(view.group.find<Konva.Circle>("Circle")[0].fill()).toBe(CIRCLE_TOWER_COLOR);
    expect(view.group.find<Konva.Line>("Line")[0].fill()).toBe(TRIANGLE_TOWER_COLOR);
    expect(view.group.find<Konva.Rect>("Rect")[0].fill()).toBe(SQUARE_TOWER_COLOR);
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

describe("TowersView square tower", () => {
  const config = { kind: "rect", facing: "right", width: 2, depth: 3, side: -1 } as const;

  it("points the barrel the way the block extends", () => {
    const view = new TowersView();
    view.add(new Tower(1, rectangle, { x: 1, y: 1 }, config));
    const sprite = view.group.getChildren()[0] as Konva.Group;
    const body = sprite.getChildren()[0] as Konva.Group;
    expect(body.rotation()).toBe(0); // right is how the barrel is drawn

    const up = new TowersView();
    up.add(new Tower(2, rectangle, { x: 1, y: 1 }, { ...config, facing: "up" }));
    const upBody = (up.group.getChildren()[0] as Konva.Group).getChildren()[0] as Konva.Group;
    expect(upBody.rotation()).toBe(270);
  });

  it("flashes exactly the block it hits when it fires", () => {
    const view = new TowersView();
    view.add(new Tower(1, rectangle, { x: 1, y: 1 }, config));
    const sprite = view.group.getChildren()[0] as Konva.Group;
    const before = sprite.getChildren().length;

    view.fire(1);

    const flash = sprite.getChildren()[before] as Konva.Rect;
    // facing right from (1, 1): 3 wide along x, 2 tall, side -1 puts the extra row above the tower.
    // Relative to the tower's centre: starts half a tile after it, and one tile above.
    expect(flash.x()).toBe(0.5 * TILE);
    expect(flash.y()).toBe(-1.5 * TILE);
    expect(flash.width()).toBe(3 * TILE);
    expect(flash.height()).toBe(2 * TILE);
  });

  it("stays put when an enemy walks past (only the triangle turns)", () => {
    const view = new TowersView();
    const tower = new Tower(1, rectangle, { x: 0, y: 2 }, config);
    view.add(tower);
    const enemy = new Enemy(
      1,
      ENEMIES[0],
      new Path([
        { x: 0, y: 0 },
        { x: 5, y: 0 },
      ]),
    );
    enemy.pos = { x: 2, y: 1 }; // inside its block, off to one side
    expect(tower.aimTarget([enemy])).toBe(enemy);
    const body = (view.group.getChildren()[0] as Konva.Group).getChildren()[0] as Konva.Group;

    view.update([tower], [enemy], 0.5);
    expect(body.rotation()).toBe(0);
  });
});
