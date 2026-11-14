import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rangeReach } from "../towerConfig";

// A circle tower with two upgrades.
function validConfig() {
  return [
    {
      towerId: "circle",
      upgrades: [
        { cost: 75, damage: 8, attackSpeed: 1.2, radius: 2.8 },
        { cost: 125, damage: 10, attackSpeed: 1.5, radius: 3 },
      ],
    },
  ];
}

// The loader runs on import, so supply the test JSON before importing it.
async function loadShop(config = validConfig()) {
  vi.doMock("../../data/towerUpgrades.json", () => ({ default: config }));
  return import("./loadShopContent");
}

describe("loadShopContent", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock("../../data/towerUpgrades.json");
  });

  it("accepts the real shop data", async () => {
    const { SHOP_TOWERS } = await import("./loadShopContent");
    expect(SHOP_TOWERS.some((tower) => tower.def.id === "circle")).toBe(true);
  });

  it("combines the base stats and upgrades in level order", async () => {
    const { SHOP_TOWERS } = await loadShop();
    const tower = SHOP_TOWERS.find((item) => item.def.id === "circle")!;

    expect(tower.unlockCost).toBe(tower.def.cost);
    expect(tower.levels).toEqual([
      {
        damage: tower.def.damage,
        attackSpeed: tower.def.fireRatePerSec,
        radius: rangeReach(tower.def),
        upgradeCost: 75,
      },
      { damage: 8, attackSpeed: 1.2, radius: 2.8, upgradeCost: 125 },
      { damage: 10, attackSpeed: 1.5, radius: 3, upgradeCost: null },
    ]);
  });

  it("keeps the base level when there is no upgrade record", async () => {
    const { SHOP_TOWERS } = await loadShop([]);
    const tower = SHOP_TOWERS.find((item) => item.def.id === "circle")!;

    expect(tower.levels).toHaveLength(1);
    expect(tower.levels[0].upgradeCost).toBeNull();
  });

  it("accepts a tower with an empty upgrade list", async () => {
    const { SHOP_TOWERS } = await loadShop([{ towerId: "circle", upgrades: [] }]);
    const tower = SHOP_TOWERS.find((item) => item.def.id === "circle")!;

    expect(tower.levels).toHaveLength(1);
    expect(tower.levels[0].upgradeCost).toBeNull();
  });

  it("rejects an unknown tower ID", async () => {
    const config = validConfig();
    config[0].towerId = "missing-tower";

    await expect(loadShop(config)).rejects.toThrow(/Unknown tower/);
  });

  it("rejects duplicate upgrade records", async () => {
    const config = validConfig();
    config.push(config[0]);

    await expect(loadShop(config)).rejects.toThrow(/Duplicate upgrades/);
  });

  it.each([0, -10, 1.5, Infinity])("rejects an invalid upgrade cost of %s", async (cost) => {
    const config = validConfig();
    config[0].upgrades[0].cost = cost;

    await expect(loadShop(config)).rejects.toThrow(/Invalid upgrade cost/);
  });

  it.each(["damage", "attackSpeed", "radius"] as const)(
    "rejects a zero value for %s",
    async (stat) => {
      const config = validConfig();
      config[0].upgrades[0][stat] = 0;

      await expect(loadShop(config)).rejects.toThrow(/Invalid upgrade stats/);
    },
  );

  it("rejects a negative stat", async () => {
    const config = validConfig();
    config[0].upgrades[0].damage = -1;

    await expect(loadShop(config)).rejects.toThrow(/Invalid upgrade stats/);
  });

  it("rejects a non-finite stat", async () => {
    const config = validConfig();
    config[0].upgrades[0].radius = NaN;

    await expect(loadShop(config)).rejects.toThrow(/Invalid upgrade stats/);
  });
});
