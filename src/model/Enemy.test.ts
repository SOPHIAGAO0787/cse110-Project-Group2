import { describe, it, expect } from "vitest";
import { Enemy } from "./Enemy";
import { Path } from "./Path";
import type { EnemyDef } from "./types";

describe("Enemy (R1, R2)", () => {
  const def: EnemyDef = {
    id: "basic",
    name: "Air Molecule",
    hp: 20,
    speed: 1.5,
    reward: 5,
    color: "#7fb3ff",
  };

  const path = new Path([
    { x: 0, y: 0 },
    { x: 3, y: 0 },
    { x: 3, y: 2 },
  ]);

  it("moves speed * dt along the path", () => {
    const enemy = new Enemy(1, def, path);

    enemy.update(2);

    expect(enemy.distance).toBe(3);
    expect(enemy.pos).toEqual({ x: 3, y: 0 });
  });

  it("moves around corners", () => {
    const enemy = new Enemy(1, def, path);

    enemy.update(3);

    expect(enemy.distance).toBe(4.5);
    expect(enemy.pos).toEqual({ x: 3, y: 1.5 });
  });

  it("detects reaching the end", () => {
    const enemy = new Enemy(1, def, path);

    expect(enemy.reachedEnd()).toBe(false);

    enemy.update(10);

    expect(enemy.reachedEnd()).toBe(true);
    expect(enemy.distance).toBe(5);
    expect(enemy.pos).toEqual({ x: 3, y: 2 });
  });

  it("reduces health and detects death", () => {
    const enemy = new Enemy(1, def, path);

    enemy.takeDamage(10);
    expect(enemy.hp).toBe(10);
    expect(enemy.isDead()).toBe(false);

    enemy.takeDamage(10);
    expect(enemy.hp).toBe(0);
    expect(enemy.isDead()).toBe(true);
  });

  it("does not move after death", () => {
    const enemy = new Enemy(1, def, path);

    enemy.takeDamage(20);
    enemy.update(2);

    expect(enemy.distance).toBe(0);
    expect(enemy.pos).toEqual({ x: 0, y: 0 });
  });

  it("does not move past the end", () => {
    const enemy = new Enemy(1, def, path);

    enemy.update(10);
    enemy.update(2);

    expect(enemy.distance).toBe(5);
    expect(enemy.pos).toEqual({ x: 3, y: 2 });
  });

  it("does not move when elapsed time is zero or negative", () => {
    const enemy = new Enemy(1, def, path);

    enemy.update(0);
    enemy.update(-2);

    expect(enemy.distance).toBe(0);
    expect(enemy.pos).toEqual({ x: 0, y: 0 });
  });

  it("ignores zero or negative damage", () => {
    const enemy = new Enemy(1, def, path);

    enemy.takeDamage(0);
    enemy.takeDamage(-10);

    expect(enemy.hp).toBe(20);
    expect(enemy.isDead()).toBe(false);
  });
});
