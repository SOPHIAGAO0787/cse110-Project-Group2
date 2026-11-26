import { MAX_STARS } from "./GameResult";
import type { MapConfig } from "./types";

// Coins the mini-game gives for each correct answer
export const COINS_PER_CORRECT_ANSWER = 5;
// The most bonus coins the player can save up, so replaying the mini-game can't give endless coins
export const MAX_BONUS_COINS = 50;

// The part of Progress that is saved in the browser. Map unlocks are not saved because they
// follow from the stars.
export interface ProgressSave {
  stars: { [mapId: string]: number }; // best stars on each map, by map id
  bonusCoins: number;
  tutorialDone: boolean;
}

// What the player has done across games: which map they picked, the best stars on each map,
// the bonus coins earned in the mini-game, and whether they have seen the tutorial. The App keeps a
// copy in the browser (see saveGame.ts), so refreshing the page keeps all of them.
export class Progress {
  currentMapId: string; // the map the player picked to play
  bonusCoins: number; // mini-game coins waiting to be added to the next game
  tutorialDone: boolean; // true once the player finished or skipped the tutorial on map 1
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
    this.tutorialDone = false;
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

  addRoomBuilderReward(earnedCoins: number): number {
    return this.addBonusCoins(earnedCoins);
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

  // A plain copy of the stars, bonus coins and tutorial flag, ready to be turned into JSON
  toSave(): ProgressSave {
    const stars: { [mapId: string]: number } = {};
    for (let i = 0; i < this.mapIds.length; i++) {
      stars[this.mapIds[i]] = this.bestStars[i];
    }
    return { stars: stars, bonusCoins: this.bonusCoins, tutorialDone: this.tutorialDone };
  }

  // Copies the stars, bonus coins and tutorial flag back from a save. The save comes from the browser and could
  // be old or edited by hand, so each value is checked and a bad one is skipped.
  loadSave(data: ProgressSave): void {
    if (typeof data !== "object" || data === null) {
      return;
    }
    const savedStars = data.stars;
    if (typeof savedStars === "object" && savedStars !== null) {
      for (let i = 0; i < this.mapIds.length; i++) {
        const stars = savedStars[this.mapIds[i]];
        if (Number.isInteger(stars) && stars >= 0 && stars <= MAX_STARS) {
          this.bestStars[i] = stars;
        }
      }
    }
    const coins = data.bonusCoins;
    if (Number.isInteger(coins) && coins >= 0 && coins <= MAX_BONUS_COINS) {
      this.bonusCoins = coins;
    }
    if (typeof data.tutorialDone === "boolean") {
      this.tutorialDone = data.tutorialDone;
    }
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
