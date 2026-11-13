import { describe, expect, it } from "vitest";
import { GameModel } from "./GameModel";
import { MAX_SPREAD, MIN_SPREAD } from "./geometry/sector";
import { loadMap } from "./loadContent";
import map1 from "../data/maps/map1.json";
import type { Enemy } from "./Enemy";
import type { Tower } from "./Tower";
import type { TowerConfig } from "./types";

const NORTH = -Math.PI / 2; // the spawn point (0, 1) is straight above the tile (0, 2)

// A game with one tower on the tile (0, 2), one tile below the enemy spawn.
function setup(defId = "circle", config?: TowerConfig) {
  const game = new GameModel(loadMap(map1));
  expect(game.tryPlaceTower(defId, { x: 0, y: 2 }, config)).toBe("ok");
  const tower = game.towers[0];
  return { game, tower, interval: 1 / tower.def.fireRatePerSec };
}

function spawn(game: GameModel, count = 1): Enemy[] {
  for (let i = 0; i < count; i++) game.spawnEnemy("basic");
  return game.enemies.slice(-count);
}

function coneFacingNorth(spread: number): TowerConfig {
  return { kind: "sector", facing: NORTH, spread };
}

describe("Tower.update (firing)", () => {
  it("waits for its firing interval, then damages an enemy in range", () => {
    const { game, tower, interval } = setup();
    const [enemy] = spawn(game);

    expect(tower.update(interval / 2, game.enemies)).toBe(0);
    expect(enemy.hp).toBe(enemy.def.hp);

    expect(tower.update(interval / 2, game.enemies)).toBe(1);
    expect(enemy.hp).toBe(enemy.def.hp - tower.def.damage);
  });

  it("fires several times when a long step covers several intervals", () => {
    const { game, tower, interval } = setup();
    const [enemy] = spawn(game);

    expect(tower.update(interval * 2.5, game.enemies)).toBe(2);
    expect(enemy.hp).toBe(enemy.def.hp - 2 * tower.def.damage);
  });

  it("ignores steps that are zero, negative or not a number", () => {
    const { game, tower } = setup();
    const [enemy] = spawn(game);

    for (const dt of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(tower.update(dt, game.enemies)).toBe(0);
    }
    expect(enemy.hp).toBe(enemy.def.hp);
  });

  it("does not save up shots while there are no targets", () => {
    const { game, tower, interval } = setup();
    tower.update(10, []);
    const [enemy] = spawn(game);

    expect(tower.update(interval / 2, game.enemies)).toBe(0);
    expect(enemy.hp).toBe(enemy.def.hp);
  });

  it("ignores enemies outside the range", () => {
    const { game, tower, interval } = setup();
    const [enemy] = spawn(game);
    enemy.update(10); // walk it far from the tower

    expect(tower.update(interval, game.enemies)).toBe(0);
    expect(enemy.hp).toBe(enemy.def.hp);
  });

  it("ignores dead enemies and enemies that reached the end", () => {
    const { game, tower, interval } = setup();
    const [dead, finished, alive] = spawn(game, 3);
    dead.takeDamage(dead.hp);
    finished.update(1000);

    tower.update(interval, game.enemies);

    expect(finished.hp).toBe(finished.def.hp);
    expect(alive.hp).toBe(alive.def.hp - tower.def.damage);
  });
});

describe("Tower targeting", () => {
  it("an area tower (circle) hits every enemy in range", () => {
    const { game, tower, interval } = setup("circle");
    const [a, b] = spawn(game, 2);
    b.update(0.5); // slightly further along, both still in range

    tower.update(interval, game.enemies);

    expect(a.hp).toBe(a.def.hp - tower.def.damage);
    expect(b.hp).toBe(b.def.hp - tower.def.damage);
  });

  it("a single-target tower hits the enemy furthest along the path", () => {
    const { game, tower, interval } = setup("triangle", coneFacingNorth(MAX_SPREAD));
    const [behind, ahead] = spawn(game, 2);
    behind.pos = { x: 0, y: 1 };
    ahead.pos = { x: 0, y: 1 };
    ahead.distance = 1;

    tower.update(interval, game.enemies);

    expect(behind.hp).toBe(behind.def.hp);
    expect(ahead.hp).toBe(ahead.def.hp - tower.def.damage);
  });

  it("breaks equal-distance ties using the lowest enemy ID", () => {
    const { game, tower, interval } = setup("triangle", coneFacingNorth(MAX_SPREAD));
    const [first, second] = spawn(game, 2); // same distance, ids differ

    tower.update(interval, game.enemies);

    expect(first.hp).toBe(first.def.hp - tower.def.damage);
    expect(second.hp).toBe(second.def.hp);
  });
});

describe("Tower.aimTarget", () => {
  it("is the enemy the tower would shoot, and does not hurt it", () => {
    const { game, tower } = setup("triangle", coneFacingNorth(MAX_SPREAD));
    const [behind, ahead] = spawn(game, 2);
    behind.pos = { x: 0, y: 1 };
    ahead.pos = { x: 0, y: 1 };
    ahead.distance = 1;

    expect(tower.aimTarget(game.enemies)).toBe(ahead);
    expect(ahead.hp).toBe(ahead.def.hp);
  });

  it("is undefined when nothing is in range", () => {
    const { game, tower } = setup("triangle", coneFacingNorth(MAX_SPREAD));
    const [enemy] = spawn(game);
    enemy.pos = { x: 0, y: 5 }; // behind the tower
    expect(tower.aimTarget(game.enemies)).toBeUndefined();
  });
});

describe("Triangle tower cone", () => {
  it("hits an enemy inside the cone but not one behind the tower", () => {
    const { game, tower, interval } = setup("triangle", coneFacingNorth(Math.PI / 4));
    const [front, back] = spawn(game, 2);
    front.pos = { x: 0, y: 1 }; // one tile ahead
    back.pos = { x: 0, y: 3 }; // one tile behind
    back.distance = 5; // would be preferred if it were in range

    tower.update(interval, game.enemies);

    expect(front.hp).toBe(front.def.hp - tower.def.damage);
    expect(back.hp).toBe(back.def.hp);
  });

  it("a narrow cone reaches further than a wide one (same area)", () => {
    const wide = setup("triangle", coneFacingNorth(MAX_SPREAD)).tower;
    const narrow = setup("triangle", coneFacingNorth(MIN_SPREAD)).tower;
    // a point ahead of the tower, between the two reaches, so it does not depend on the area
    const far = { x: 0, y: 2 - (wide.reach + narrow.reach) / 2 };

    expect(narrow.reach).toBeGreaterThan(wide.reach);
    expect(wide.range.contains(far)).toBe(false);
    expect(narrow.range.contains(far)).toBe(true);
  });

  it("clamps a spread outside 15° to 75°", () => {
    expect(setup("triangle", coneFacingNorth(10)).tower.config).toMatchObject({
      spread: MAX_SPREAD,
    });
    expect(setup("triangle", coneFacingNorth(0.01)).tower.config).toMatchObject({
      spread: MIN_SPREAD,
    });
  });

  it("rejects a config of the wrong kind", () => {
    const game = new GameModel(loadMap(map1));
    expect(() =>
      game.tryPlaceTower("triangle", { x: 0, y: 2 }, { kind: "circle", radius: 1 }),
    ).toThrow();
  });
});

describe("Tower defaults", () => {
  it("builds a circle range from the def when no config is given", () => {
    const { tower } = setup("circle");
    expect((tower as Tower).config).toEqual({
      kind: "circle",
      radius: tower.def.range.kind === "circle" ? tower.def.range.radius : 0,
    });
    expect(tower.reach).toBe(2.5);
  });
});
