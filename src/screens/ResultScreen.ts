import Konva from "konva";
import type { GameResultData, Screen, ScreenSwitcher } from "../app/types";
import { makeButton } from "./button";

// Shown when the game ends.
// TODO(So1): show "Victory!" or "Defeat" using data.won, and polish this screen.
export class ResultScreen implements Screen {
  group = new Konva.Group();
  private app: ScreenSwitcher;
  private message = new Konva.Text({
    text: "Game over",
    fontSize: 48,
    fill: "white",
    align: "center",
  });

  private subtitle = new Konva.Text({
    text: "",
    fontSize: 24,
    fill: "#d1d5db",
    align: "center",
  });

  private stats = new Konva.Text({
    text: "",
    fontSize: 20,
    fill: "#e5e7eb",
    align: "center",
    lineHeight: 1.6,
  });

  private menuButton: Konva.Group;

  constructor(app: ScreenSwitcher) {
    this.app = app;
    this.menuButton = makeButton("Back to menu", () => this.app.switchTo("menu"));
    this.group.add(this.message, this.subtitle, this.stats, this.menuButton);
  }

  // data.won says whether the player won (unused until So1)
  show(data?: GameResultData): void {
    if (!data) {
      this.message.text("Game Over");
      this.message.fill("white");
      this.subtitle.text("");
      this.stats.text("");
      this.group.visible(true);
      return;
    }

    // Show the game outcome.
    this.message.text(data.won ? "Victory!" : "Defeat!");

    this.message.fill(data.won ? "#86efac" : "#fca5a5");

    this.subtitle.text(data.won ? "You cleared all waves!" : "Your base has fallen!");

    // Build the statistics using available data.
    const lines: string[] = [];

    if (data.elapsedSeconds !== undefined) {
      const totalSeconds = Math.floor(Math.max(0, data.elapsedSeconds));

      const minutes = Math.floor(totalSeconds / 60);
      const seconds = String(totalSeconds % 60).padStart(2, "0");

      lines.push(`Time: ${minutes}:${seconds}`);
    }

    if (data.towersPlaced !== undefined) {
      lines.push(`Towers Placed: ${data.towersPlaced}`);
    }

    if (data.remainingLives !== undefined) {
      lines.push(`Remaining Lives: ${data.remainingLives}`);
    }

    if (data.finalCoins !== undefined) {
      lines.push(`Final Coins: ${data.finalCoins}`);
    }

    if (data.questionsSolved !== undefined) {
      lines.push(`Questions Solved: ${data.questionsSolved}`);
    }

    this.stats.text(lines.join("\n"));

    this.group.visible(true);
  }

  hide(): void {
    this.group.visible(false);
  }

  resize(width: number, height: number): void {
    // Main result text.
    this.message.width(width);
    this.message.y(height / 2 - 180);

    // Victory / defeat description.
    this.subtitle.width(width);
    this.subtitle.y(height / 2 - 105);

    // Game statistics.
    this.stats.width(width);
    this.stats.y(height / 2 - 40);

    // Back to menu button.
    this.menuButton.position({
      x: width / 2 - 100,
      y: height / 2 + 150,
    });
  }
}
