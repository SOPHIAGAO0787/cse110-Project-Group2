import Konva from "konva";
import type { Screen, ScreenSwitcher } from "../app/types";
import type { Progress } from "../model/Progress";
import { makeButton } from "./button";
import { FONT } from "./theme";

export class MenuScreen implements Screen {
  group = new Konva.Group();
  private title = new Konva.Text({
    text: "Geometry Tower Defense",
    fontSize: 48,
    fill: "white",
    align: "center",
  });
  // Tells the player how many mini-game coins their next game starts with
  private bonusText = new Konva.Text({
    fontSize: 20,
    fontFamily: FONT,
    fill: "white",
    align: "center",
  });
  private playButton: Konva.Group;
  private app: ScreenSwitcher;
  private progress: Progress;
  private shopButton: Konva.Group;

  constructor(app: ScreenSwitcher, progress: Progress) {
    this.app = app;
    this.progress = progress;
    this.playButton = makeButton("Play", () => this.app.switchTo("maps"));
    this.shopButton = makeButton("Tower Shop", () => this.app.switchTo("shop"));
    this.group.add(this.title, this.playButton, this.shopButton, this.bonusText);
  }

  // The bonus can change between visits (a mini-game round adds to it, a finished game uses it)
  show(): void {
    const bonus = this.progress.bonusCoins;
    this.bonusText.text(`Mini-game bonus: +${bonus} coins in your next game`);
    this.bonusText.visible(bonus > 0);
    this.group.visible(true);
  }

  hide(): void {
    this.group.visible(false);
  }

  resize(width: number, height: number): void {
    this.title.width(width);
    this.title.y(height / 2 - 100);
    this.playButton.position({ x: width / 2 - 100, y: height / 2 });
    this.shopButton.position({ x: width / 2 - 100, y: height / 2 + 64 });
    this.bonusText.width(width);
    this.bonusText.y(height / 2 + 136);
  }
}
