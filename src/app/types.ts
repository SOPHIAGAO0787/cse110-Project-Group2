import type Konva from "konva";

export type ScreenName = "menu" | "game" | "result";

// Lets a screen ask the App to show a different screen (pattern from Lab 3).
export interface ScreenSwitcher {
  switchTo(name: ScreenName, data?: GameResultData): void;
}

// Every screen has one Konva Group that the App shows or hides.
export interface Screen {
  group: Konva.Group;
  show(data?: GameResultData): void;
  hide(): void;
  resize(width: number, height: number): void;
}

//sog: game result
export interface GameResultData {
  won: boolean;

  elapsedSeconds?: number;
  towersPlaced?: number;
  remainingLives?: number;
  finalCoins?: number;

  // Optional: requires integration with the question module.
  questionsSolved?: number;
}