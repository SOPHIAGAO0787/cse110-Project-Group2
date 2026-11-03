import Konva from "konva";
import type { Screen, ScreenSwitcher } from "../app/types";
import type { GameResult } from "../model/GameResult";
import { makeButton } from "./button";
import { formatStars, resultSubtitle, resultTitle, statLines } from "./resultFormat";

const WIN_COLOR = "#86efac";
const LOSE_COLOR = "#fca5a5";

// So1: shown when the game ends: victory or defeat, a star rating, and the game's stats.
export class ResultScreen implements Screen {
  group = new Konva.Group();
  private app: ScreenSwitcher;
  private title = new Konva.Text({ fontSize: 48, fill: "white", align: "center" });
  private stars = new Konva.Text({ fontSize: 40, fill: "#facc15", align: "center" });
  private subtitle = new Konva.Text({ fontSize: 24, fill: "#d1d5db", align: "center" });
  private stats = new Konva.Text({
    fontSize: 20,
    fill: "#e5e7eb",
    align: "center",
    lineHeight: 1.6,
  });
  private menuButton: Konva.Group;

  constructor(app: ScreenSwitcher) {
    this.app = app;
    this.menuButton = makeButton("Back to menu", () => this.app.switchTo("menu"));
    this.group.add(this.title, this.stars, this.subtitle, this.stats, this.menuButton);
  }

  // The game screen always passes a result; without one, fall back to a plain "Game over".
  show(result?: GameResult): void {
    if (result) {
      this.title.text(resultTitle(result.won));
      this.title.fill(result.won ? WIN_COLOR : LOSE_COLOR);
      this.stars.text(formatStars(result.stars));
      this.subtitle.text(resultSubtitle(result.won));
      this.stats.text(statLines(result).join("\n"));
    } else {
      this.title.text("Game over");
      this.title.fill("white");
      this.stars.text("");
      this.subtitle.text("");
      this.stats.text("");
    }
    this.group.visible(true);
  }

  hide(): void {
    this.group.visible(false);
  }

  resize(width: number, height: number): void {
    for (const text of [this.title, this.stars, this.subtitle, this.stats]) {
      text.width(width);
    }
    this.title.y(height / 2 - 220);
    this.stars.y(height / 2 - 160);
    this.subtitle.y(height / 2 - 105);
    this.stats.y(height / 2 - 60);
    this.menuButton.position({ x: width / 2 - 100, y: height / 2 + 120 });
  }
}
