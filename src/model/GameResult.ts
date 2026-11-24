// Everything the result screen shows about a finished game.
export interface GameResult {
  won: boolean;
  stars: number; // 0 on defeat, 1–3 on victory
  elapsedSeconds: number; // time the game ran; paused while the settings are open
  towersPlaced: number;
  remainingLives: number;
  finalCoins: number;
  questionsSolved: number; // tower questions answered correctly
  enemiesDefeated: number;
  coinsEarned: number; // kill rewards earned this run, before spending
  score: number; // 100 points per enemy defeated
  shopCoinsEarned: number; // Tower Shop coins for this game, 0 on defeat (see shopCoinReward)
}

export const MAX_STARS = 3;

// Every win pays Tower Shop coins: 25 per star. Defeat has 0 stars, so it pays nothing.
export function shopCoinReward(stars: number): number {
  return stars * 25;
}

// Victory earns stars by the share of lives kept: all of them = 3, at least half = 2, fewer = 1.
// Defeat always earns 0.
export function starRating(won: boolean, remainingLives: number, startingLives: number): number {
  if (!won) return 0;
  if (startingLives <= 0 || remainingLives >= startingLives) return MAX_STARS;
  return remainingLives / startingLives >= 0.5 ? 2 : 1;
}
