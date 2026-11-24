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
  // Tower Shop coins this game paid. Only a map's first win pays them. The model doesn't know
  // past games, so it leaves this 0 and the game screen fills it in.
  shopCoinsEarned: number;
}

export const MAX_STARS = 3;

// Tower Shop coins for winning a map for the first time: 25 per star
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
