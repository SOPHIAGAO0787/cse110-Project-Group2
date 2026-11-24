import { shopCoinReward, type GameResult } from "./GameResult";

export class TowerProgress {
  shopCoins = 200; // FIX: needs to be connected to the database in sprint3

  // Stored values are array indexes:
  // 0 means Level 1.
  // 1 means Level 2.
  // 2 means Level 3.
  maxLevels = new Map<string, number>();

  constructor() {
    // Circle is available from the beginning.
    this.maxLevels.set("circle", 0);
  }

  addMatchReward(result: GameResult): void {
    this.shopCoins += shopCoinReward(result);
  }

  getMaxLevel(towerId: string): number {
    const level = this.maxLevels.get(towerId);

    if (level === undefined) {
      return -1; // Locked
    }

    return level;
  }
}
