// So1: everything the result screen shows about a finished game.
export interface GameResult {
  won: boolean;
  stars: number; // 0 on defeat, 1–3 on victory
  elapsedSeconds: number; // time the game ran; paused while a question is open
  towersPlaced: number;
  remainingLives: number;
  finalCoins: number;
  questionsSolved: number; // tower questions answered correctly
  enemiesDefeated: number;
  coinsEarned: number; // kill rewards earned this run, before spending
  score: number; // proposed rule: 100 points per enemy defeated
}

export const MAX_STARS = 3;

// Victory earns stars by the share of lives kept: all of them = 3, at least half = 2, fewer = 1.
// Defeat always earns 0.
export function starRating(won: boolean, remainingLives: number, startingLives: number): number {
  if (!won) return 0;
  if (startingLives <= 0 || remainingLives >= startingLives) return MAX_STARS;
  return remainingLives / startingLives >= 0.5 ? 2 : 1;
}
