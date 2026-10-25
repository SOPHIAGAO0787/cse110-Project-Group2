import Konva from "konva";
import { GameScreenController } from "../screens/game/GameScreenController";
import { MenuScreen } from "../screens/MenuScreen";
import { ResultScreen } from "../screens/ResultScreen";
import type { Screen, ScreenName, ScreenSwitcher } from "./types";

// Owns the Konva stage and switches between screens.
export class App implements ScreenSwitcher {
  private stage: Konva.Stage;
  private layer = new Konva.Layer();
  private menu: MenuScreen;
  private game: GameScreenController;
  private result: ResultScreen;
  private current: Screen;

  constructor(containerId: string) {
    this.stage = new Konva.Stage({ container: containerId });
    this.stage.add(this.layer);

    this.menu = new MenuScreen(this);
    this.game = new GameScreenController(this);
    this.result = new ResultScreen(this);
    for (const screen of this.allScreens()) {
      this.layer.add(screen.group);
      screen.group.visible(false);
    }

    this.current = this.menu;
    this.current.show();
    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  switchTo(name: ScreenName, data?: { won: boolean }): void {
    this.current.hide();
    if (name === "menu") {
      this.current = this.menu;
    } else if (name === "game") {
      this.current = this.game;
    } else {
      this.current = this.result;
    }
    this.current.show(data);
  }

  private allScreens(): Screen[] {
    return [this.menu, this.game, this.result];
  }

  private resize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.stage.size({ width, height });
    for (const screen of this.allScreens()) {
      screen.resize(width, height);
    }
  }
}
