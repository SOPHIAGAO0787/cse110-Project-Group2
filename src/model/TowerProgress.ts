import { SHOP_TOWERS } from "./shop/loadShopContent";

// The part of TowerProgress that is saved in the browser
export interface TowerProgressSave {
  shopCoins: number;
  levels: { [towerId: string]: number }; // level index of each unlocked tower, by tower id
}

export class TowerProgress {
  shopCoins = 200; // coins to spend in the tower shop, kept in the browser by saveGame.ts

  // Stored values are array indexes:
  // 0 means Level 1.
  // 1 means Level 2.
  // 2 means Level 3.
  maxLevels = new Map<string, number>();

  constructor() {
    // Circle is available from the beginning.
    this.maxLevels.set("circle", 0);
  }

  getMaxLevel(towerId: string): number {
    const level = this.maxLevels.get(towerId);

    if (level === undefined) {
      return -1; // Locked
    }

    return level;
  }

  // A plain copy of the coins and tower levels, ready to be turned into JSON
  toSave(): TowerProgressSave {
    const levels: { [towerId: string]: number } = {};
    for (const [towerId, level] of this.maxLevels) {
      levels[towerId] = level;
    }
    return { shopCoins: this.shopCoins, levels: levels };
  }

  // Copies the coins and tower levels back from a save. The save comes from the browser and could
  // be old or edited by hand, so each value is checked and a bad one is skipped. A level must be
  // one the tower has in the shop, which also skips towers the game does not know.
  loadSave(data: TowerProgressSave): void {
    if (typeof data !== "object" || data === null) {
      return;
    }
    const coins = data.shopCoins;
    if (Number.isInteger(coins) && coins >= 0) {
      this.shopCoins = coins;
    }
    const savedLevels = data.levels;
    if (typeof savedLevels === "object" && savedLevels !== null) {
      for (const towerId in savedLevels) {
        const level = savedLevels[towerId];
        if (Number.isInteger(level) && level >= 0 && level < levelCount(towerId)) {
          this.maxLevels.set(towerId, level);
        }
      }
    }
  }
}

// How many levels a tower has in the shop, or 0 for a tower id the game does not know
function levelCount(towerId: string): number {
  for (const tower of SHOP_TOWERS) {
    if (tower.def.id === towerId) {
      return tower.levels.length;
    }
  }
  return 0;
}
