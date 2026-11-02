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
