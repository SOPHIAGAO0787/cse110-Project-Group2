import { TOWERS } from "../../model/loadContent";
import type { TowerDef } from "../../model/types";

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