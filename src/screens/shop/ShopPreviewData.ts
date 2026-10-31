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

// Temporary UI fixtures, not final game balance.
// upgradeCost is the price to move from this level to the next.
export const SHOP_TOWERS: ShopTower[] = TOWERS.map((def) => ({
  def,
  unlockCost: 50,
  levels: [
    {
      damage: def.damage,
      attackSpeed: def.fireRatePerSec,
      radius: def.range.radius,
      upgradeCost: def.id === "circle" ? 75 : null,
    },
    ...(def.id === "circle"
      ? [
          {
            damage: 8,
            attackSpeed: 1.2,
            radius: 2.8,
            upgradeCost: 125,
          },
          {
            damage: 10,
            attackSpeed: 1.5,
            radius: 3,
            upgradeCost: null,
          },
        ]
      : []),
  ],
}));
