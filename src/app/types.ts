import type Konva from "konva";

export type ScreenName = "menu" | "game" | "result" | "shop";

// Lets a screen ask the App to show a different screen (pattern from Lab 3).
export interface ScreenSwitcher {
  switchTo(name: ScreenName, data?: { won: boolean }): void;
}

// Every screen has one Konva Group that the App shows or hides.
export interface Screen {
  group: Konva.Group;
  show(data?: { won: boolean }): void;
  hide(): void;
  resize(width: number, height: number): void;
}
