import type { TowerDef } from "../types";

export interface ShopLevel {
  damage: number;
  attackSpeed: number;
  radius: number;
  upgradeCost: number | null;
}

export interface ShopTower {
  def: TowerDef;
  unlockCost: number;
  levels: ShopLevel[];
}

export interface PlayerProgress {
  version: 1;
  coins: number;

  // Missing ID = locked.
  // 0 = level 1, 1 = level 2, etc.
  towerLevels: Record<string, number>;
}

export type ShopResult =
  | "ok"
  | "funds"
  | "alreadyUnlocked"
  | "locked"
  | "maxLevel"
  | "unknownTower";