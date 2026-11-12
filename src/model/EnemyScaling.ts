import { EnemyDef } from "./types";

/**
 * Returns an enemy definition scaled to the given wave.
 *
 * Wave 1 uses the original stats.
 * Each subsequent wave increases HP by 15%
 * and speed by 5% of the original values.
 */
export function scaleEnemyDef(base: EnemyDef, waveNumber: number): EnemyDef {
  if (!Number.isInteger(waveNumber) || waveNumber < 1) {
    throw new Error("Wave number must be a positive integer.");
  }

  const waveLevel = waveNumber - 1;

  // Formula for scaling enemy stats based on wave level
  const healthMultiplier = 1 + 0.15 * waveLevel; // 15% increase per wave
  const speedMultiplier = 1 + 0.05 * waveLevel; // 5% increase per wave

  return {
    ...base, // copies original enemy definition
    hp: Math.ceil(base.hp * healthMultiplier),
    speed: base.speed * speedMultiplier,
  };
}
