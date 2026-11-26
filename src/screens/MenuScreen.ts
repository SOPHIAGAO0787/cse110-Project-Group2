import Konva from "konva";
import type { Screen, ScreenSwitcher } from "../app/types";
import type { Sound } from "../core/Sound";
import type { Progress } from "../model/Progress";
import { DEFAULT_BUTTON_WIDTH, makeButton, setButtonLabel } from "./button";
import { CARD_CORNER_RADIUS, CARD_HEIGHT, CARD_WIDTH, Page } from "./Page";
import {
  CARD_BORDER,
  CARD_FILL,
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
const MUSIC_BUTTON_WIDTH = 180;
const RESET_BUTTON_WIDTH = 220;
// The panel that asks before resetting, centered in the card
const CONFIRM_WIDTH = 640;
const CONFIRM_HEIGHT = 250;
const CONFIRM_X = (CARD_WIDTH - CONFIRM_WIDTH) / 2;
const CONFIRM_Y = (CARD_HEIGHT - CONFIRM_HEIGHT) / 2;

// The first screen. The player starts a game, opens the tower shop or plays the mini-game from here.
export class MenuScreen implements Screen {
  group: Konva.Group;
  private page: Page;
  private app: ScreenSwitcher;
  private progress: Progress;
  private sound: Sound;
  // The music switch in the top right corner. The settings in a game switch the same music.
  private musicButton: Konva.Group;
  // Tells the player how many mini-game coins their next game starts with
  private bonusText: Konva.Text;
  // Puts the maps, stars and tower shop back to a new game (the App's resetProgress)
  private onReset: () => void;
  // The "Reset all progress?" panel, shown after clicking Reset progress
  private confirmPanel: Konva.Group;

  constructor(app: ScreenSwitcher, progress: Progress, sound: Sound, onReset: () => void) {
    this.app = app;
    this.progress = progress;
    this.sound = sound;
    this.onReset = onReset;
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

    // Gets its label in refreshMusicLabel()
    this.musicButton = makeButton(
      "",
      () => {
        this.sound.toggleMusic();
        this.refreshMusicLabel();
      },
      MUSIC_BUTTON_WIDTH,
    );
    // Level with the title, as far from the right edge as the title is from the left
    this.musicButton.position({ x: CARD_WIDTH - 56 - MUSIC_BUTTON_WIDTH, y: 37 });
    this.refreshMusicLabel();

    // Left of the music switch. It only asks first; the panel's Reset button does the reset.
    const resetButton = makeButton(
      "Reset progress",
      () => this.confirmPanel.visible(true),
      RESET_BUTTON_WIDTH,
    );
    resetButton.position({ x: this.musicButton.x() - 16 - RESET_BUTTON_WIDTH, y: 37 });
    this.confirmPanel = this.makeConfirmPanel();

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
      this.musicButton,
      resetButton,
      this.bonusText,
      this.confirmPanel, // last, so it covers everything else
    );
  }

  // A see-through cover over the whole card (so the buttons behind it can't be clicked) with the
  // question and the Reset and Cancel buttons. Starts hidden.
  private makeConfirmPanel(): Konva.Group {
    const panel = new Konva.Group({ visible: false });
    const cover = new Konva.Rect({
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      fill: "black",
      opacity: 0.3,
      cornerRadius: CARD_CORNER_RADIUS,
    });
    const box = new Konva.Rect({
      x: CONFIRM_X,
      y: CONFIRM_Y,
      width: CONFIRM_WIDTH,
      height: CONFIRM_HEIGHT,
      fill: CARD_FILL,
      stroke: CARD_BORDER,
      strokeWidth: 2,
      cornerRadius: 16,
    });
    const question = new Konva.Text({
      x: CONFIRM_X + 40,
      y: CONFIRM_Y + 36,
      width: CONFIRM_WIDTH - 80,
      text: "Reset all progress?",
      fontSize: 28,
      fontFamily: FONT,
      fontStyle: "bold",
      fill: TITLE_TEXT,
    });
    const details = new Konva.Text({
      x: CONFIRM_X + 40,
      y: CONFIRM_Y + 84,
      width: CONFIRM_WIDTH - 80,
      text: "Unlocked maps, stars and the tower shop go back to the start.",
      fontSize: 20,
      fontFamily: FONT,
      fill: MUTED_TEXT,
    });
    const reset = makeButton("Reset", () => {
      this.onReset();
      panel.visible(false);
      this.show(); // the bonus line may be gone now
    });
    reset.position({ x: CONFIRM_X + 40, y: CONFIRM_Y + CONFIRM_HEIGHT - 88 });
    const cancel = makeButton("Cancel", () => panel.visible(false));
    cancel.position({
      x: CONFIRM_X + CONFIRM_WIDTH - 40 - DEFAULT_BUTTON_WIDTH,
      y: CONFIRM_Y + CONFIRM_HEIGHT - 88,
    });
    panel.add(cover, box, question, details, reset, cancel);
    return panel;
  }

  // The bonus can change between visits (a mini-game round adds to it, a finished game uses it)
  show(): void {
    const bonus = this.progress.bonusCoins;
    this.bonusText.text(`Mini-game bonus: +${bonus} coins in your next game`);
    this.bonusText.visible(bonus > 0);
    // The music may have been switched in a game's settings since the last visit
    this.refreshMusicLabel();
    this.group.visible(true);
  }

  // Same labels as the music switch in the game's settings
  private refreshMusicLabel(): void {
    if (this.sound.musicOn) {
      setButtonLabel(this.musicButton, "Music: On");
    } else {
      setButtonLabel(this.musicButton, "Music: Off");
    }
  }

  hide(): void {
    this.confirmPanel.visible(false);
    this.group.visible(false);
  }

  resize(width: number, height: number): void {
    this.page.resize(width, height);
  }
}
