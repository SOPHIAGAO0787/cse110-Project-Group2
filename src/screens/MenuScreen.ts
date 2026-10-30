import Konva from "konva";
import type { Screen, ScreenSwitcher } from "../app/types";
import { makeButton } from "./button";

export class MenuScreen implements Screen {
  group = new Konva.Group();
  private title = new Konva.Text({
    text: "Geometry Tower Defense",
    fontSize: 48,
    fill: "white",
    align: "center",
  });
  private playButton: Konva.Group;
  private app: ScreenSwitcher;
  private shopButton: Konva.Group;

  constructor(app: ScreenSwitcher) {
    this.app = app;
    this.playButton = makeButton("Play Map 1", () => this.app.switchTo("game"));
    this.shopButton = makeButton("Tower Shop", () => this.app.switchTo("shop"));
    this.group.add(this.title, this.playButton, this.shopButton);
  }

  show(): void {
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
  }
}
