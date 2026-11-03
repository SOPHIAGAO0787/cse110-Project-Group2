import { MAX_STARS, type GameResult } from "../model/GameResult";

// So1: turns a GameResult into the text the result screen shows. No Konva, so it is easy to test.

// 75.4 -> "1:15". Bad or negative input shows "0:00".
export function formatTime(seconds: number): string {
  const total = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const minutes = Math.floor(total / 60);
  const rest = String(total % 60).padStart(2, "0");
  return `${minutes}:${rest}`;
}

// 2 -> "★★☆"
export function formatStars(stars: number): string {
  const filled = Math.min(Math.max(Math.round(stars), 0), MAX_STARS);
  return "★".repeat(filled) + "☆".repeat(MAX_STARS - filled);
}

export function resultTitle(won: boolean): string {
  return won ? "Victory!" : "Defeat";
}

export function resultSubtitle(won: boolean): string {
  return won ? "You cleared every wave!" : "The enemies broke through.";
}

export function statLines(result: GameResult): string[] {
  return [
    `Time: ${formatTime(result.elapsedSeconds)}`,
    `Towers Placed: ${result.towersPlaced}`,
    `Questions Solved: ${result.questionsSolved}`,
    `Lives Left: ${result.remainingLives}`,
    `Coins Left: ${result.finalCoins}`,
  ];
}
