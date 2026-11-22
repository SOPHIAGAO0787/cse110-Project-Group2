import Konva from "konva";
import type { Screen, ScreenSwitcher } from "../app/types";
import type { GameResult } from "../model/GameResult";
import { makeButton } from "./button";
import { CARD_WIDTH, Page } from "./Page";
import { formatStars, resultSubtitle, resultTitle, statLines } from "./resultFormat";
import { FONT, LOSE_TEXT, MUTED_TEXT, STAR_COLOR, TITLE_TEXT, WIN_TEXT } from "./theme";

const BUTTON_WIDTH = 240;
const BUTTON_GAP = 24; // space between the two buttons

// Shown when the game ends: victory or defeat, a star rating, and the game's stats.
// Everything is centered in the page's card.
export class ResultScreen implements Screen {
  group: Konva.Group;
  private page: Page;
  private app: ScreenSwitcher;
  private title: Konva.Text;
  private stars: Konva.Text;
  private subtitle: Konva.Text;
  private stats: Konva.Text;

  constructor(app: ScreenSwitcher) {
    this.app = app;
    this.page = new Page();
    this.group = this.page.group;

    this.title = this.makeLine(90, 64, TITLE_TEXT);
    this.title.fontStyle("bold");
    this.stars = this.makeLine(180, 56, STAR_COLOR);
    this.subtitle = this.makeLine(262, 24, MUTED_TEXT);
    this.stats = this.makeLine(322, 22, TITLE_TEXT);
    this.stats.lineHeight(1.5);

    // The two buttons sit side by side, centered under the stats
    const mapsButton = makeButton("Choose a map", () => this.app.switchTo("maps"), BUTTON_WIDTH);
    const menuButton = makeButton("Back to menu", () => this.app.switchTo("menu"), BUTTON_WIDTH);
    const firstX = (CARD_WIDTH - 2 * BUTTON_WIDTH - BUTTON_GAP) / 2;
    mapsButton.position({ x: firstX, y: 640 });
    menuButton.position({ x: firstX + BUTTON_WIDTH + BUTTON_GAP, y: 640 });

    this.page.content.add(
      this.title,
      this.stars,
      this.subtitle,
      this.stats,
      mapsButton,
      menuButton,
    );
  }

  // One centered line of text across the card. show() fills in the words.
  private makeLine(y: number, fontSize: number, fill: string): Konva.Text {
    return new Konva.Text({
      y: y,
      width: CARD_WIDTH,
      align: "center",
      fontSize: fontSize,
      fontFamily: FONT,
      fill: fill,
    });
  }

  // The game screen always passes a result; without one, fall back to a plain "Game over".
  show(result?: GameResult): void {
    if (result) {
      this.title.text(resultTitle(result.won));
      if (result.won) {
        this.title.fill(WIN_TEXT);
      } else {
        this.title.fill(LOSE_TEXT);
      }
      this.stars.text(formatStars(result.stars));
      this.subtitle.text(resultSubtitle(result.won));
      this.stats.text(statLines(result).join("\n"));
    } else {
      this.title.text("Game over");
      this.title.fill(TITLE_TEXT);
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
    this.page.resize(width, height);
  }
}
