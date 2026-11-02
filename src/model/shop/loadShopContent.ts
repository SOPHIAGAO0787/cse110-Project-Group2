import upgradesJson from "../../data/towerUpgrades.json";
import { TOWERS } from "../loadContent";
import type { ShopLevel, ShopTower } from "./types";

// Check for unknown tower IDs and duplicate upgrade records.
const configuredIds = new Set<string>();

for (const entry of upgradesJson) {
  if (!TOWERS.some((tower) => tower.id === entry.towerId)) {
    throw new Error(`Unknown tower in upgrades: "${entry.towerId}"`);
  }

  if (configuredIds.has(entry.towerId)) {
    throw new Error(`Duplicate upgrades for "${entry.towerId}"`);
  }

  configuredIds.add(entry.towerId);

  for (const upgrade of entry.upgrades) {
    if (!Number.isSafeInteger(upgrade.cost) || upgrade.cost <= 0) {
      throw new Error(`Invalid upgrade cost for "${entry.towerId}"`);
    }

    const stats = [
      upgrade.damage,
      upgrade.attackSpeed,
      upgrade.radius,
    ];

    if (stats.some((value) => !Number.isFinite(value) || value <= 0)) {
      throw new Error(`Invalid upgrade stats for "${entry.towerId}"`);
    }
  }
}

export const SHOP_TOWERS: ShopTower[] = TOWERS.map((def) => {
  const config = upgradesJson.find(
    (entry) => entry.towerId === def.id,
  );

  // A tower without upgrade configuration has only its base level.
  const upgrades = config?.upgrades ?? [];

  const baseLevel: ShopLevel = {
    damage: def.damage,
    attackSpeed: def.fireRatePerSec,
    radius: def.range.radius,
    upgradeCost: upgrades[0]?.cost ?? null,
  };

  const upgradedLevels: ShopLevel[] = upgrades.map(
    (upgrade, index) => ({
      damage: upgrade.damage,
      attackSpeed: upgrade.attackSpeed,
      radius: upgrade.radius,

      // This level's price to reach the following level.
      upgradeCost: upgrades[index + 1]?.cost ?? null,
    }),
  );

  return {
    def,
    unlockCost: def.cost,
    levels: [baseLevel, ...upgradedLevels],
  };
});