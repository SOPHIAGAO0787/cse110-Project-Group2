import type { MapConfig } from "./types";

// Coins the mini-game gives for each correct answer
export const COINS_PER_CORRECT_ANSWER = 5;
// The most bonus coins the player can save up, so replaying the mini-game can't give endless coins
export const MAX_BONUS_COINS = 50;

// What the player has done across games: which map they picked, the best stars on each map,
// and the bonus coins earned in the mini-game. It lives in memory only, so refreshing the page
// starts over.
export class Progress {
  currentMapId: string; // the map the player picked to play
  bonusCoins: number; // mini-game coins waiting to be added to the next game
  private mapIds: string[]; // in unlock order
  private bestStars: number[]; // one per map, same order as mapIds. 0 = not won yet

  constructor(maps: MapConfig[]) {
    this.mapIds = [];
    this.bestStars = [];
    for (const map of maps) {
      this.mapIds.push(map.id);
      this.bestStars.push(0);
    }
    this.currentMapId = this.mapIds[0];
    this.bonusCoins = 0;
  }

  // The first map is always open. Every other map opens once the map before it is won.
  isUnlocked(mapId: string): boolean {
    const index = this.indexOf(mapId);
    if (index === 0) {
      return true;
    }
    return this.bestStars[index - 1] > 0;
  }

  starsFor(mapId: string): number {
    return this.bestStars[this.indexOf(mapId)];
  }

  // Saves a finished game. A win earns 1–3 stars and a loss earns 0 (see starRating),
  // so keeping the highest count also means a loss never undoes a win.
  recordResult(mapId: string, stars: number): void {
    const index = this.indexOf(mapId);
    if (stars > this.bestStars[index]) {
      this.bestStars[index] = stars;
    }
  }

  // Saves a finished mini-game round. Bonus coins add up until a game uses them,
  // but never past MAX_BONUS_COINS.
  // Mini-game rewards only touch bonusCoins, never stars or unlocks.
  addMiniGameReward(correctAnswers: number): void {
    this.addBonusCoins(correctAnswers * COINS_PER_CORRECT_ANSWER);
  }

  addRoomBuilderReward(areaUsed: number): number {
    return this.addBonusCoins(Math.floor(areaUsed / 8) * 5);
  }

  private addBonusCoins(coins: number): number {
    if (coins <= 0) return 0;
    const awarded = Math.max(0, Math.min(coins, MAX_BONUS_COINS - this.bonusCoins));
    this.bonusCoins += awarded;
    return awarded;
  }

  // Called when a game ends: that game got the bonus coins, so they are gone now.
  useBonusCoins(): void {
    this.bonusCoins = 0;
  }

  private indexOf(mapId: string): number {
    for (let i = 0; i < this.mapIds.length; i++) {
      if (this.mapIds[i] === mapId) {
        return i;
      }
    }
    throw new Error(`Unknown map "${mapId}"`);
  }
}
