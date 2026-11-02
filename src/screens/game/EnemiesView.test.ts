import { describe, it, expect } from "vitest";
import { EnemiesView } from "./EnemiesView";
import { Enemy } from "../../model/Enemy";
import { Path } from "../../model/Path";
import type { EnemyDef } from "../../model/types";
import { TILE } from "./GameScreenView";

describe("EnemiesView", () => {
  const enemyDef: EnemyDef = {
    id: "basic",
    name: "Basic Enemy",
    hp: 20,
    speed: 1.5,
    reward: 5,
    color: "#7fb3ff",
  };

  function createEnemy(): Enemy {
    const path = new Path([
      { x: 0, y: 0 },
      { x: 3, y: 0 },
    ]);

    return new Enemy(1, enemyDef, path);
  }

  it("creates a circle for a new enemy", () => {
    const view = new EnemiesView();
    const enemy = createEnemy();

    view.sync([enemy]);

    expect(view.group.getChildren().length).toBe(1);
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
});
