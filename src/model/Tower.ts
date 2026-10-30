import type { TowerDef } from "../model/types";

export const circleTowerDef: TowerDef = {
  id: "circle",
  name: "Circle Tower",
  description: "Hits enemies inside a circle around it.",
  cost: 50,
  damage: 5,
  fireRatePerSec: 1,
  range: { kind: "circle", radius: 2.5 },
};

// If other code expects a list of all defs, export one too:
export const towerDefs: TowerDef[] = [circleTowerDef];
