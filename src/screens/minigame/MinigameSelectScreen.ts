import Konva from "konva";
import type { Screen, ScreenSwitcher } from "../../app/types";
import { makeBackButton, makeButton } from "../button";
import { CARD_WIDTH, Page } from "../Page";
import { FONT, TITLE_TEXT } from "../theme";

export class MinigameSelectScreen implements Screen {
  private page = new Page();
  readonly group = this.page.group;

  constructor(app: ScreenSwitcher) {
    const back = makeBackButton(() => app.switchTo("menu"));
    back.position({ x: 48, y: 42 });
    const title = new Konva.Text({
      x: 104,
      y: 47,
      text: "Geometry mini-games",
      fontFamily: FONT,
      fontSize: 32,
      fontStyle: "bold",
      fill: TITLE_TEXT,
    });
    const quiz = makeButton("Geometry Quiz", () => app.switchTo("quiz"), 320);
    const room = makeButton("Room Builder", () => app.switchTo("roomBuilder"), 320);
    quiz.position({ x: (CARD_WIDTH - 320) / 2, y: 300 });
    room.position({ x: quiz.x(), y: 380 });
    this.page.content.add(back, title, quiz, room);
  }

  show(): void {
    this.group.show();
  }

  hide(): void {
    this.group.hide();
    document.body.style.cursor = "default";
  }

  resize(width: number, height: number): void {
    this.page.resize(width, height);
  }
}
