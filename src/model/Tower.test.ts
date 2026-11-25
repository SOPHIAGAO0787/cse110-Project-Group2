import { describe, expect, it } from "vitest";
import { GameModel } from "./GameModel";
import { MAX_SPREAD, MIN_SPREAD } from "./geometry/sector";
import { TOWERS, loadMap } from "./loadContent";
import { SHOP_TOWERS } from "./shop/loadShopContent";
import map1 from "../data/maps/map1.json";
import type { Enemy } from "./Enemy";
import { Tower } from "./Tower";
import { TowerProgress } from "./TowerProgress";
import type { TowerConfig } from "./types";

// A game where every tower is already bought in the Tower Shop (only the circle is by default).
function unlockedProgress(): TowerProgress {
  const progress = new TowerProgress();
  for (const def of TOWERS) progress.maxLevels.set(def.id, 0);
  return progress;
}

const NORTH = -Math.PI / 2; // the spawn point (0, 1) is straight above the tile (0, 2)

// A game with one tower on the tile (0, 2), one tile below the enemy spawn.
function setup(defId = "circle", config?: TowerConfig) {
  const game = new GameModel(loadMap(map1), unlockedProgress());
  expect(game.tryPlaceTower(defId, { x: 0, y: 2 }, config)).toBe("ok");
  const tower = game.towers[0];
  return { game, tower, interval: 1 / tower.fireRate };
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

  it("reloads while idle, so it fires the moment an enemy arrives", () => {
    const { game, tower } = setup();
    const interval = 1 / tower.def.fireRatePerSec;
    tower.update(interval, []); // nothing to shoot at, so it just reloads
    const [enemy] = spawn(game);

    expect(tower.update(0.001, game.enemies)).toBe(1);
    expect(enemy.hp).toBe(enemy.def.hp - tower.def.damage);
  });

  it("keeps at most one shot ready while idle", () => {
    const { game, tower } = setup();
    tower.update(10, []); // a long wait must not bank ten shots
    spawn(game);

    expect(tower.update(0.001, game.enemies)).toBe(1);
    expect(tower.update(0.001, game.enemies)).toBe(0);
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
    expect(ahead.hp).toBe(Math.max(0, ahead.def.hp - tower.def.damage));
  });

  it("breaks equal-distance ties using the lowest enemy ID", () => {
    const { game, tower, interval } = setup("triangle", coneFacingNorth(MAX_SPREAD));
    const [first, second] = spawn(game, 2); // same distance, ids differ

    tower.update(interval, game.enemies);

    expect(first.hp).toBe(Math.max(0, first.def.hp - tower.def.damage));
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

    expect(front.hp).toBe(Math.max(0, front.def.hp - tower.def.damage));
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
    const game = new GameModel(loadMap(map1), unlockedProgress());
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
    expect(tower.reach).toBe(tower.def.range.kind === "circle" ? tower.def.range.radius : 0);
  });
});

type RectConfig = Extract<TowerConfig, { kind: "rect" }>;

describe("Square tower block", () => {
  // The tower stands on (0, 2). Facing up with width 2 and depth 3, the block is columns 0–1, rows -1–1.
  const block = (width: number, depth: number): RectConfig => ({
    kind: "rect",
    facing: "up",
    width,
    depth,
    side: 1,
  });

  it("hits every enemy inside its block, and nothing outside it", () => {
    const { game, tower, interval } = setup("rectangle", block(2, 3));
    const [rear, front, outside] = spawn(game, 3);
    rear.pos = { x: 0, y: 1 };
    rear.distance = 1;
    front.pos = { x: 1, y: 0 }; // the other column of the block
    front.distance = 2;
    outside.pos = { x: 2, y: 1 }; // just to the right of the block
    outside.distance = 9;

    expect(tower.update(interval, game.enemies)).toBe(1);

    expect(front.hp).toBe(Math.max(0, front.def.hp - tower.def.damage));
    expect(rear.hp).toBe(Math.max(0, rear.def.hp - tower.def.damage)); // the block hits everyone
    expect(outside.hp).toBe(outside.def.hp);
  });

  it("does not reach past the end of its block", () => {
    const { game, tower } = setup("rectangle", block(2, 2)); // rows 0–1
    const [enemy] = spawn(game);
    enemy.pos = { x: 0, y: -1 };
    expect(tower.aimTarget(game.enemies)).toBeUndefined();
    enemy.pos = { x: 0, y: 0 };
    expect(tower.aimTarget(game.enemies)).toBe(enemy);
  });

  it("flips an even-width block to the other side of the tower", () => {
    const left = setup("rectangle", { ...block(2, 2), side: -1 }).tower; // columns -1–0
    const right = setup("rectangle", block(2, 2)).tower; // columns 0–1
    expect(left.range.contains({ x: -1, y: 1 })).toBe(true);
    expect(left.range.contains({ x: 1, y: 1 })).toBe(false);
    expect(right.range.contains({ x: 1, y: 1 })).toBe(true);
    expect(right.range.contains({ x: -1, y: 1 })).toBe(false);
  });

  it("fires faster the smaller the block, from the area", () => {
    const small = setup("rectangle", block(2, 2)).tower;
    const big = setup("rectangle", block(2, 3)).tower;
    const def = big.def;
    const range = def.range.kind === "rect" ? def.range : { rateArea: 0, maxArea: 0 };

    expect(small.fireRate).toBeGreaterThan(big.fireRate);
    expect(small.fireRate).toBeCloseTo((def.fireRatePerSec * range.rateArea) / 4);
    expect(big.fireRate).toBeCloseTo((def.fireRatePerSec * range.rateArea) / 6);
    // the other towers do not depend on what the player chose
    expect(setup("circle").tower.fireRate).toBe(setup("circle").tower.def.fireRatePerSec);
  });

  it("really fires at the rate of its area", () => {
    const { game, tower } = setup("rectangle", block(2, 2));
    const [enemy] = spawn(game);
    enemy.pos = { x: 0, y: 1 };
    // 1 second at fireRate shots/sec
    const shots = tower.update(1 / tower.fireRate + 1e-9, game.enemies);
    expect(shots).toBe(1);
  });

  it("rejects shapes that are not allowed, and costs nothing", () => {
    const game = new GameModel(loadMap(map1), unlockedProgress());
    const coins = game.wallet.coins;
    for (const [w, d] of [
      [1, 6],
      [6, 1],
      [2, 4],
      [3, 3],
      [2.5, 2],
    ]) {
      expect(() => game.tryPlaceTower("rectangle", { x: 0, y: 2 }, block(w, d))).toThrow();
    }
    expect(game.wallet.coins).toBe(coins);
    expect(game.towers).toHaveLength(0);
  });

  it("rejects a bad facing or side, and a cone config", () => {
    const game = new GameModel(loadMap(map1), unlockedProgress());
    const t = { x: 0, y: 2 };
    expect(() =>
      game.tryPlaceTower("rectangle", t, { ...block(2, 2), facing: "north" as never }),
    ).toThrow();
    expect(() =>
      game.tryPlaceTower("rectangle", t, { ...block(2, 2), side: 0 as never }),
    ).toThrow();
    expect(() => game.tryPlaceTower("rectangle", t, coneFacingNorth(1))).toThrow();
  });

  it("treats the side of an odd width as irrelevant", () => {
    const { tower } = setup("rectangle", { ...block(3, 2), side: -1 });
    expect(tower.config).toMatchObject({ width: 3, side: 1 });
  });

  it("defaults to the biggest block facing up", () => {
    const { tower } = setup("rectangle");
    expect(tower.config).toMatchObject({ kind: "rect", facing: "up" });
    const { width, depth } = tower.config as Extract<TowerConfig, { kind: "rect" }>;
    expect(width * depth).toBe(6);
  });

  it("allows bigger blocks once maxArea is raised (upgrades)", () => {
    const base = TOWERS.find((d) => d.id === "rectangle")!;
    const upgraded = { ...base, range: { kind: "rect" as const, maxArea: 8, rateArea: 6 } };
    const tile = { x: 0, y: 2 };

    expect(() => new Tower(1, base, tile, block(2, 4))).toThrow();
    const tower = new Tower(1, upgraded, tile, block(2, 4));
    expect(tower.range.contains({ x: 0, y: -1 })).toBe(true); // reaches 4 tiles up
    expect(tower.fireRate).toBeCloseTo((base.fireRatePerSec * 6) / 8);
  });
});

describe("Tower upgrades", () => {
  const shopCircle = SHOP_TOWERS.find((item) => item.def.id === "circle")!;

  it("starts at level 1 (0) and goes up one level per upgrade", () => {
    const { tower } = setup("circle");
    expect(tower.level).toBe(0);
    tower.upgrade(shopCircle.levels[1]);
    expect(tower.level).toBe(1);
  });

  it("uses the upgraded damage, attack speed and range during combat", () => {
    const { game, tower } = setup("circle");
    const [enemy] = spawn(game);
    const next = shopCircle.levels[1];
    const before = tower.reach;
    enemy.pos = { x: (before + next.radius) / 2, y: 2 }; // beyond the old reach, inside the new one
    expect(tower.range.contains(enemy.pos)).toBe(false);

    tower.upgrade(next);

    expect(tower.reach).toBe(next.radius);
    expect(tower.config).toEqual({ kind: "circle", radius: next.radius });
    expect(tower.range.contains(enemy.pos)).toBe(true);
    expect(tower.fireRate).toBe(next.attackSpeed);
    expect(tower.update(0.5 / next.attackSpeed, game.enemies)).toBe(0);
    expect(tower.update(0.5 / next.attackSpeed + 0.001, game.enemies)).toBe(1);
    expect(enemy.hp).toBe(enemy.def.hp - next.damage);
  });

  it("does not change the original tower definition", () => {
    const { tower } = setup("circle");
    const before = TOWERS.find((d) => d.id === "circle")!.fireRatePerSec;
    tower.upgrade(shopCircle.levels[1]);
    expect(TOWERS.find((d) => d.id === "circle")!.fireRatePerSec).toBe(before);
  });

  it("changes damage and speed of an aimed tower but keeps the shape the player chose", () => {
    for (const [id, config] of [
      ["triangle", coneFacingNorth(MAX_SPREAD)],
      ["rectangle", { kind: "rect", facing: "up", width: 2, depth: 2, side: 1 }],
    ] as const) {
      const { tower } = setup(id, config);
      const reach = tower.reach;

      tower.upgrade({ damage: 50, attackSpeed: 2, radius: 99, upgradeCost: null });

      expect(tower.level).toBe(1);
      expect(tower.def.damage).toBe(50);
      expect(tower.def.fireRatePerSec).toBe(2);
      expect(tower.config).toMatchObject(config);
      expect(tower.reach).toBe(reach); // the shop's circle radius does not apply
    }
  });

  it("keeps the square tower's rate tied to its area after an upgrade", () => {
    const { tower } = setup("rectangle", {
      kind: "rect",
      facing: "up",
      width: 2,
      depth: 2,
      side: 1,
    });
    tower.upgrade({ damage: 20, attackSpeed: 1, radius: 0, upgradeCost: null });
    expect(tower.fireRate).toBeCloseTo(1 * (6 / 4)); // rateArea 6, block area 4
  });
});
