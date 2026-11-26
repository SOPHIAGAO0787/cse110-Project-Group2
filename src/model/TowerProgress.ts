import { SHOP_TOWERS } from "./shop/loadShopContent";

// The part of TowerProgress that is saved in the browser
export interface TowerProgressSave {
  shopCoins: number;
  levels: { [towerId: string]: number }; // level index of each unlocked tower, by tower id
}

// The shop coins a new game starts with
const STARTING_SHOP_COINS = 200;

export class TowerProgress {
  shopCoins = STARTING_SHOP_COINS; // coins to spend in the tower shop, kept in the browser by saveGame.ts

  // Stored values are array indexes:
  // 0 means Level 1.
  // 1 means Level 2.
  // 2 means Level 3.
  maxLevels = new Map<string, number>();

  constructor() {
    // Circle is available from the beginning.
    this.maxLevels.set("circle", 0);
  }

  // Back to a new game: the starting coins, and only the circle tower at Level 1
  reset(): void {
    this.shopCoins = STARTING_SHOP_COINS;
    this.maxLevels.clear();
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
  // be old or edited by hand, so each value is checked and a bad one is skipped.
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
      // Read known towers only, and keep levels inside the current upgrade list.
      for (const tower of SHOP_TOWERS) {
        const level = savedLevels[tower.def.id];
        if (Number.isInteger(level) && level >= 0 && level < tower.levels.length) {
          this.maxLevels.set(tower.def.id, level);
        }
      }
    }
  }
}
