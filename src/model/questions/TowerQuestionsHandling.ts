import { defaultConfig, fireRateFor, rangeReach } from "../towerConfig";
import type { TowerConfig, TowerDef } from "../types";

const round = (n: number, places = 2): number => {
  const factor = 10 ** places;
  return Math.round(n * factor) / factor;
};

// The numbers a tower hands to question templates. Rounded values are what the player sees,
// and the same values go into the answer formula, so the answer always matches the prompt.
// Templates may only use plain names like {diameter}, so every number a prompt shows is here.
export function towerVariables(
  def: TowerDef,
  config: TowerConfig = defaultConfig(def),
): Record<string, number> {
  const vars: Record<string, number> = {
    damage: def.damage,
    rate: round(fireRateFor(def, config)),
  };

  if (def.range.kind === "circle") {
    const radius = round(def.range.radius);
    vars.radius = radius;
    vars.diameter = round(2 * radius);
    vars.circumference = round(2 * Math.PI * radius);
    vars.area = round(Math.PI * radius ** 2);

    // The same numbers divided by π, so prompts show "9π" instead of 28.27 for instance
    vars.circumferenceOverPi = round(2 * radius);
    vars.areaOverPi = round(radius ** 2);
  } else if (def.range.kind === "sector" && config.kind === "sector") {
    const degrees = Math.round((config.spread * 180) / Math.PI);
    const radius = round(rangeReach(def, config), 1);
    const fraction = degrees / 360;
    vars.degrees = degrees;
    vars.radius = radius;
    vars.fraction = fraction; // exact, only for answer formulas
    vars.fractionDecimal = round(fraction, 3); // what the player sees, e.g. 0.125 for 45°
    vars.area = round(fraction * Math.PI * radius ** 2);
    vars.arc = round(fraction * 2 * Math.PI * radius);

    // The same numbers divided by π, so prompts show "9π" instead of 28.27 for instance
    vars.areaOverPi = round(fraction * radius ** 2);
    vars.arcOverPi = round(fraction * 2 * radius);
  } else if (def.range.kind === "rect" && config.kind === "rect") {
    vars.width = config.width;
    vars.depth = config.depth;
    vars.area = config.width * config.depth;
    vars.baseRate = round(def.fireRatePerSec);
    vars.rateArea = def.range.rateArea;
  }
  return vars;
}
