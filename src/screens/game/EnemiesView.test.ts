import { afterEach, describe, it, expect, vi } from "vitest";
import Konva from "konva";
import { EnemiesView } from "./EnemiesView";
import { Enemy } from "../../model/Enemy";
import { Path } from "../../model/Path";
import type { EnemyDef } from "../../model/types";
import { TILE } from "./GameScreenView";

describe("EnemiesView", () => {
  afterEach(() => vi.restoreAllMocks());

  it("flashes red after damage, then returns to the enemy color", () => {
    const now = vi.spyOn(performance, "now").mockReturnValue(100);
    const view = new EnemiesView();
    const enemy = createEnemy();
    view.sync([enemy]);
    enemy.takeDamage(5);
    view.sync([enemy]);
    const circle = view.group.getChildren()[0] as Konva.Circle;
    expect(circle.fill()).toBe("#ff3b3b");

    now.mockReturnValue(221);
    view.sync([enemy]);
    expect(circle.fill()).toBe(enemy.def.color);
  });

  const enemyDef: EnemyDef = {
    id: "basic",
    name: "Basic Enemy",
    hp: 20,
    speed: 1.5,
    reward: 5,
    color: "#7fb3ff",
  };

  function createEnemy(
    type: string = "basic",
    points = [
      { x: 0, y: 0 },
      { x: 3, y: 0 },
    ],
  ): Enemy {
    const path = new Path(points);

    return new Enemy(1, { ...enemyDef, id: type }, path);
  }

  //Basic enemy
  it("creates a circle for a basic enemy", () => {
    const view = new EnemiesView();
    const enemy = createEnemy("basic");

    view.sync([enemy]);

    const children = view.group.getChildren();

    expect(children.length).toBe(1);
    expect(children[0]).toBeInstanceOf(Konva.Circle);
  });

  it("updates the circle position when the enemy moves", () => {
    const view = new EnemiesView();
    const enemy = createEnemy();

    view.sync([enemy]);

    enemy.update(1);
    view.sync([enemy]);

    const circle = view.group.getChildren()[0];

    expect(circle.x()).toBe((enemy.pos.x + 0.5) * TILE);
    expect(circle.y()).toBe((enemy.pos.y + 0.5) * TILE);
  });

  it("removes the circle when the enemy disappears", () => {
    const view = new EnemiesView();
    const enemy = createEnemy();

    view.sync([enemy]);
    expect(view.group.getChildren().length).toBe(1);

    view.sync([]);

    expect(view.group.getChildren().length).toBe(0);
  });

  it("handles an empty enemy list", () => {
    const view = new EnemiesView();

    expect(() => view.sync([])).not.toThrow();
    expect(view.group.getChildren().length).toBe(0);
  });

  //Fast enemy
  it("creates a closed arrowhead for a fast enemy", () => {
    const view = new EnemiesView();
    const enemy = createEnemy("fast");

    view.sync([enemy]);

    const shape = view.group.getChildren()[0];

    expect(shape).toBeInstanceOf(Konva.Line);
    expect((shape as Konva.Line).closed()).toBe(true);
  });

  //Tank enemy
  it("creates a hexagon for a tank enemy", () => {
    const view = new EnemiesView();
    const enemy = createEnemy("tank");

    view.sync([enemy]);

    const shape = view.group.getChildren()[0];

    expect(shape).toBeInstanceOf(Konva.RegularPolygon);
    expect((shape as Konva.RegularPolygon).sides()).toBe(6);
  });

  //Test directional rotation
  it.each([
    { dx: 3, dy: 0, angle: 0 },
    { dx: 0, dy: 3, angle: 90 },
    { dx: -3, dy: 0, angle: 180 },
    { dx: 0, dy: -3, angle: -90 },
  ])("rotates a fast enemy to $angle degrees", ({ dx, dy, angle }) => {
    const view = new EnemiesView();

    const enemy = createEnemy("fast", [
      { x: 3, y: 3 },
      { x: 3 + dx, y: 3 + dy },
    ]);

    view.sync([enemy]);

    enemy.update(1);
    view.sync([enemy]);

    const shape = view.group.getChildren()[0];

    expect(shape.rotation()).toBeCloseTo(angle);
  });

  //Rotation when changing direction
  it("updates rotation when a fast enemy changes direction", () => {
    const view = new EnemiesView();

    const enemy = createEnemy("fast", [
      { x: 0, y: 0 },
      { x: 3, y: 0 },
      { x: 3, y: 3 },
    ]);

    view.sync([enemy]);

    enemy.update(2);
    view.sync([enemy]);

    const shape = view.group.getChildren()[0];

    expect(shape.rotation()).toBeCloseTo(0);

    enemy.update(1);
    view.sync([enemy]);

    expect(shape.rotation()).toBeCloseTo(90);
  });

  //Stationary enemy retains rotation
  it("retains rotation when a fast enemy does not move", () => {
    const view = new EnemiesView();

    const enemy = createEnemy("fast", [
      { x: 0, y: 0 },
      { x: 0, y: 3 },
    ]);

    view.sync([enemy]);

    enemy.update(1);
    view.sync([enemy]);

    const shape = view.group.getChildren()[0];

    expect(shape.rotation()).toBeCloseTo(90);

    view.sync([enemy]);

    expect(shape.rotation()).toBeCloseTo(90);
  });

  // Initial spawn rotation
  it("does not incorrectly rotate a newly spawned fast enemy", () => {
    const view = new EnemiesView();

    const enemy = createEnemy("fast", [
      { x: 3, y: 3 },
      { x: 3, y: 6 },
    ]);

    view.sync([enemy]);

    const shape = view.group.getChildren()[0];

    expect(shape.rotation()).toBe(0);
  });

  // Other enemies do not rotate when moving
  it.each(["basic", "tank"])("does not rotate a %s enemy when moving", (type) => {
    const view = new EnemiesView();

    const enemy = createEnemy(type, [
      { x: 0, y: 0 },
      { x: 0, y: 3 },
    ]);

    view.sync([enemy]);

    enemy.update(1);
    view.sync([enemy]);

    const shape = view.group.getChildren()[0];

    expect(shape.rotation()).toBe(0);
  });
});
