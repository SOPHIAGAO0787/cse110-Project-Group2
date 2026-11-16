import Konva from "konva";
import type { Screen, ScreenSwitcher } from "../app/types";
import type { Progress } from "../model/Progress";
import { makeButton } from "./button";
import { CARD_WIDTH, Page } from "./Page";
import {
  CIRCLE_TOWER_COLOR,
  FONT,
  MUTED_TEXT,
  SQUARE_TOWER_COLOR,
  TITLE_TEXT,
  TRIANGLE_TOWER_COLOR,
} from "./theme";

const BUTTON_WIDTH = 320;
// Left edge of anything BUTTON_WIDTH wide that is centered in the card
const BUTTON_X = (CARD_WIDTH - BUTTON_WIDTH) / 2;

// The first screen. The player starts a game, opens the tower shop or plays the mini-game from here.
export class MenuScreen implements Screen {
  group: Konva.Group;
  private page: Page;
  private app: ScreenSwitcher;
  private progress: Progress;
  // Tells the player how many mini-game coins their next game starts with
  private bonusText: Konva.Text;

  constructor(app: ScreenSwitcher, progress: Progress) {
    this.app = app;
    this.progress = progress;
    this.page = new Page();
    this.group = this.page.group;

    const title = new Konva.Text({
      x: 56,
      y: 47,
      text: "Main menu",
      fontSize: 28,
      fontFamily: FONT,
      fontStyle: "bold",
      fill: TITLE_TEXT,
    });

    // The three tower shapes in a row above the buttons, as decoration
    const middle = CARD_WIDTH / 2;
    const circle = new Konva.Circle({
      x: middle - 150,
      y: 290,
      radius: 50,
      fill: CIRCLE_TOWER_COLOR,
    });
    // A right triangle with the right angle at the bottom left
    const triangle = new Konva.Line({
      points: [middle - 50, 240, middle - 50, 340, middle + 50, 340],
      closed: true,
      fill: TRIANGLE_TOWER_COLOR,
    });
    const square = new Konva.Rect({
      x: middle + 100,
      y: 240,
      width: 100,
      height: 100,
      fill: SQUARE_TOWER_COLOR,
    });

    const playButton = makeButton("Play", () => this.app.switchTo("maps"), BUTTON_WIDTH);
    playButton.position({ x: BUTTON_X, y: 420 });
    const shopButton = makeButton("Tower Shop", () => this.app.switchTo("shop"), BUTTON_WIDTH);
    shopButton.position({ x: BUTTON_X, y: 492 });
    const miniGameButton = makeButton(
      "Mini-game",
      () => this.app.switchTo("minigame"),
      BUTTON_WIDTH,
    );
    miniGameButton.position({ x: BUTTON_X, y: 564 });

    this.bonusText = new Konva.Text({
      y: 644,
      width: CARD_WIDTH,
      align: "center",
      fontSize: 20,
      fontFamily: FONT,
      fill: MUTED_TEXT,
    });

    this.page.content.add(
      title,
      circle,
      triangle,
      square,
      playButton,
      shopButton,
      miniGameButton,
      this.bonusText,
    );
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
    this.page.resize(width, height);
  }
}
