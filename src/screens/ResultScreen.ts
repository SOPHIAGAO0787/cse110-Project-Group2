import Konva from "konva";
import type { Screen, ScreenSwitcher } from "../app/types";
import { makeButton } from "./button";

// Shown when the game ends.
// TODO(N3): show "Victory!" or "Defeat" using data.won, and polish this screen.
export class ResultScreen implements Screen {
  group = new Konva.Group();
  private app: ScreenSwitcher;
  private message = new Konva.Text({
    text: "Game over",
    fontSize: 48,
    fill: "white",
    align: "center",
  });
  private menuButton: Konva.Group;

  constructor(app: ScreenSwitcher) {
    this.app = app;
    this.menuButton = makeButton("Back to menu", () => this.app.switchTo("menu"));
    this.group.add(this.message, this.menuButton);
  }

  // data.won says whether the player won (unused until N3)
  show(data?: { won: boolean }): void {
    this.group.visible(true);
  }

  hide(): void {
    this.group.visible(false);
  }

  resize(width: number, height: number): void {
    this.message.width(width);
    this.message.y(height / 2 - 100);
    this.menuButton.position({ x: width / 2 - 100, y: height / 2 });
  }
}
