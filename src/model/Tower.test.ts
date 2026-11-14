import { describe, expect, it } from "vitest";
import { Enemy } from "./Enemy";
import { Path } from "./Path";
import { Tower } from "./Tower";
import { TOWERS } from "./loadContent";
import { SHOP_TOWERS } from "./shop/loadShopContent";

const circle = TOWERS.find((tower) => tower.id === "circle")!;
const shopCircle = SHOP_TOWERS.find((tower) => tower.def.id === "circle")!;

function createEnemy(id = 1): Enemy {
  const path = new Path([
    { x: 0, y: 0 },
    { x: 10, y: 0 },
  ]);

  return new Enemy(
    id,
    { id: "test", name: "Test Enemy", hp: 100, speed: 1, reward: 5, color: "red" },
    path,
  );
}

describe("Tower (R3)", () => {
  it("fires immediately, then waits for its cooldown", () => {
    const tower = new Tower(1, circle, { x: 0, y: 0 });
    const enemy = createEnemy();
    const interval = 1 / circle.fireRatePerSec;

    expect(tower.update(0, [enemy])).toBe(true);
    expect(enemy.hp).toBe(100 - circle.damage);
    expect(tower.update(interval / 2, [enemy])).toBe(false);
    expect(enemy.hp).toBe(100 - circle.damage);
    expect(tower.update(interval / 2, [enemy])).toBe(true);
    expect(enemy.hp).toBe(100 - circle.damage * 2);
  });

  it("ignores enemies outside its range", () => {
    const tower = new Tower(1, circle, { x: 0, y: 0 });
    const enemy = createEnemy();
    enemy.pos = { x: 9, y: 0 };

    tower.update(10, [enemy]);

    expect(enemy.hp).toBe(100);
  });

  it("targets the enemy furthest along the path", () => {
    const tower = new Tower(1, circle, { x: 0, y: 0 });
    const first = createEnemy(1);
    const second = createEnemy(2);
    first.distance = 1;
    second.distance = 2;

    tower.update(1 / circle.fireRatePerSec, [first, second]);

    expect(first.hp).toBe(100);
    expect(second.hp).toBe(100 - circle.damage);
  });

  it("breaks equal-distance ties using the lowest enemy ID", () => {
    const tower = new Tower(1, circle, { x: 0, y: 0 });
    const first = createEnemy(2);
    const second = createEnemy(1);

    tower.update(1 / circle.fireRatePerSec, [first, second]);

    expect(first.hp).toBe(100);
    expect(second.hp).toBe(100 - circle.damage);
  });

  it("uses upgraded damage, attack speed, and range during combat", () => {
    const tower = new Tower(1, circle, { x: 0, y: 0 });
    const enemy = createEnemy();
    const next = shopCircle.levels[1];
    enemy.pos = { x: (circle.range.radius + next.radius) / 2, y: 0 };
    expect(tower.range.contains(enemy.pos)).toBe(false);

    tower.upgrade(next);
    expect(tower.range.contains(enemy.pos)).toBe(true);

    expect(tower.update(0, [enemy])).toBe(true);
    expect(enemy.hp).toBe(100 - next.damage);
    expect(tower.update(0.5 / next.attackSpeed, [enemy])).toBe(false);
    expect(tower.update(0.5 / next.attackSpeed + 0.001, [enemy])).toBe(true);
    expect(enemy.hp).toBe(100 - next.damage * 2);
  });

  it("fires only once when a target arrives after a long idle period", () => {
    const tower = new Tower(1, circle, { x: 0, y: 0 });
    const enemy = createEnemy();
    tower.update(10, []);

    tower.update(0.5 / circle.fireRatePerSec, [enemy]);

    expect(enemy.hp).toBe(100 - circle.damage);
  });

  it("ignores dead enemies and enemies that reached the end", () => {
    const tower = new Tower(1, circle, { x: 0, y: 0 });
    const dead = createEnemy(1);
    dead.hp = 0;
    const finished = createEnemy(2);
    finished.distance = 10;
    const alive = createEnemy(3);

    tower.update(1 / circle.fireRatePerSec, [dead, finished, alive]);

    expect(dead.hp).toBe(0);
    expect(finished.hp).toBe(100);
    expect(alive.hp).toBe(100 - circle.damage);
  });
});
