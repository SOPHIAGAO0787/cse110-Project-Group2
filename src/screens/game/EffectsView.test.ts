// @vitest-environment jsdom
import Konva from "konva";
import "vitest-canvas-mock";
import { describe, expect, it } from "vitest";
import { EffectsView } from "./EffectsView";
import { Enemy } from "../../model/Enemy";
import { Path } from "../../model/Path";
import type { EnemyDef } from "../../model/types";
import { TILE } from "./GameScreenView";

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

describe("EffectsView health bars", () => {
  it("draws no bar for an enemy at full health", () => {
    const view = new EffectsView();
    view.syncHealthBars([createEnemy()]);
    expect(view.group.find("Rect")).toHaveLength(0);
  });

  it("fills half of the bar at half health", () => {
    const view = new EffectsView();
    const enemy = createEnemy();
    enemy.takeDamage(10);
    view.syncHealthBars([enemy]);

    const rects = view.group.find<Konva.Rect>("Rect");
    expect(rects).toHaveLength(2);
    expect(rects[1].width()).toBe(rects[0].width() / 2);
  });

  it("keeps the bar centered above the enemy as it moves", () => {
    const view = new EffectsView();
    const enemy = createEnemy();
    enemy.takeDamage(5);
    enemy.update(1);
    view.syncHealthBars([enemy]);

    const background = view.group.find<Konva.Rect>("Rect")[0];
    expect(background.x() + background.width() / 2).toBe((enemy.pos.x + 0.5) * TILE);
    expect(background.y()).toBeLessThan((enemy.pos.y + 0.5) * TILE);
  });

  it("removes the bar when the enemy is gone", () => {
    const view = new EffectsView();
    const enemy = createEnemy();
    enemy.takeDamage(5);
    view.syncHealthBars([enemy]);
    view.syncHealthBars([]);
    expect(view.group.find("Rect")).toHaveLength(0);
  });

  it("draws no bar for a dead enemy", () => {
    const view = new EffectsView();
    const enemy = createEnemy();
    enemy.takeDamage(20);
    view.syncHealthBars([enemy]);
    expect(view.group.find("Rect")).toHaveLength(0);
  });
});

describe("EffectsView kill feedback", () => {
  it("shows the reward and a ring in the enemy's color where it was defeated", () => {
    const view = new EffectsView();
    const enemy = createEnemy();
    view.showKill(enemy, 5);

    const popups = view.group.find<Konva.Text>("Text");
    expect(popups).toHaveLength(1);
    expect(popups[0].text()).toBe("+5");

    const puffs = view.group.find<Konva.Circle>("Circle");
    expect(puffs).toHaveLength(1);
    expect(puffs[0].stroke()).toBe(enemy.def.color);
    expect(puffs[0].position()).toEqual({ x: 0.5 * TILE, y: 0.5 * TILE });
  });
});
