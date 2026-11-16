import Konva from "konva";
import type { Screen } from "../../app/types";
import { GameLoop } from "../../core/GameLoop";
import {
  GeometryMiniGame,
  type GeometryMiniGameResult,
} from "../../model/minigame/GeometryMiniGame";
import { makeBackButton, makeButton } from "../button";
import { CARD_FILL, FONT, PAGE_BACKGROUND, TITLE_TEXT } from "../theme";

export class GeometryMiniGameScreen implements Screen {
  group = new Konva.Group({ visible: false });
  private background = new Konva.Rect({ fill: PAGE_BACKGROUND });
  private panel = new Konva.Group();
  private title = new Konva.Text({
    y: 20,
    text: "Geometry Practice",
    fontSize: 30,
    fontFamily: FONT,
    fill: TITLE_TEXT,
    align: "center",
    width: 520,
  });
  private status = new Konva.Text({
    y: 75,
    fontSize: 18,
    fontFamily: FONT,
    fill: TITLE_TEXT,
    align: "center",
    width: 520,
  });
  private question = new Konva.Text({
    x: 20,
    y: 120,
    width: 480,
    fontSize: 22,
    fontFamily: FONT,
    fill: TITLE_TEXT,
    align: "center",
  });
  private input = new Konva.Text({
    x: 20,
    y: 230,
    width: 480,
    height: 45,
    fontSize: 24,
    fontFamily: FONT,
    fill: TITLE_TEXT,
    align: "center",
  });
  private feedback = new Konva.Text({
    x: 20,
    y: 285,
    width: 480,
    fontSize: 18,
    fontFamily: FONT,
    fill: TITLE_TEXT,
    align: "center",
  });
  private instructions = new Konva.Text({
    x: 20,
    y: 405,
    width: 480,
    text: "Type a number, fraction, or expression (e.g. 4*pi).\nPress Enter to submit or continue. Backspace deletes.",
    fontSize: 15,
    fontFamily: FONT,
    fill: TITLE_TEXT,
    align: "center",
  });
  private submitButton = makeButton("Submit", () => this.submit());
  private nextButton = makeButton("Next Question", () => this.next());
  private restartButton = makeButton("Restart", () => this.restart());
  private model = new GeometryMiniGame();
  private loop: GameLoop;
  private active = false;
  private notified = false;
  private typed = "";

  constructor(
    private onComplete: (result: GeometryMiniGameResult) => void = () => {},
    onBack: () => void = () => {},
  ) {
    this.panel.add(
      new Konva.Rect({ width: 520, height: 470, fill: CARD_FILL, cornerRadius: 16 }),
      this.title,
      this.status,
      this.question,
      this.input,
      this.feedback,
      this.instructions,
    );
    for (const button of [this.submitButton, this.nextButton, this.restartButton]) {
      button.position({ x: 160, y: 345 });
      this.panel.add(button);
    }
    // The back arrow goes in the panel's top-left corner. It works at any point in a round.
    const backButton = makeBackButton(onBack);
    backButton.position({ x: 20, y: 16 });
    this.panel.add(backButton);
    this.group.add(this.background, this.panel);
    this.loop = new GameLoop((dt) => {
      if (!this.active) return;
      this.model.tick(dt);
      this.render();
    });
  }

  show(): void {
    if (this.active) return;
    this.active = true;
    this.group.visible(true);
    window.addEventListener("keydown", this.onKey);
    this.restart();
  }

  hide(): void {
    this.active = false;
    this.loop.stop();
    window.removeEventListener("keydown", this.onKey);
    this.group.visible(false);
  }

  resize(width: number, height: number): void {
    this.background.size({ width, height });
    const scale = Math.min(1, width / 560, height / 510);
    this.panel.scale({ x: scale, y: scale });
    this.panel.position({ x: (width - 520 * scale) / 2, y: (height - 470 * scale) / 2 });
  }

  private restart(): void {
    if (!this.active) return;
    this.model.restart();
    this.typed = "";
    this.notified = false;
    this.render();
    this.loop.start();
  }

  private submit(): void {
    if (!this.active) return;
    this.model.submit(this.typed);
    this.render();
  }

  private next(): void {
    if (!this.active || this.model.phase !== "feedback") return;
    this.model.nextQuestion();
    this.typed = "";
    this.render();
    if (this.model.isFinished && !this.notified) {
      this.notified = true;
      this.loop.stop();
      this.onComplete(this.model.result);
    }
  }

  private onKey = (event: KeyboardEvent): void => {
    if (!this.active || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === "Enter") {
      event.preventDefault();
      if (this.model.phase === "answering") this.submit();
      else if (this.model.phase === "feedback") this.next();
      return;
    }
    if (this.model.phase !== "answering") return;
    if (event.key === "Backspace") {
      event.preventDefault();
      this.typed = this.typed.slice(0, -1);
    } else if (/^[0-9.piπsqrt√^*+\-/() ]$/i.test(event.key) && this.typed.length < 28) {
      event.preventDefault();
      this.typed += event.key;
    } else return;
    this.render();
  };

  private render(): void {
    const finished = this.model.phase === "finished";
    const answering = this.model.phase === "answering";
    this.status.text(
      finished
        ? "Round complete"
        : `Question ${this.model.questionIndex + 1}/5   ·   Time: ${Math.ceil(this.model.remainingSeconds)}s   ·   Correct: ${this.model.correctAnswers}`,
    );
    this.question.text(
      finished
        ? `You answered ${this.model.correctAnswers} of 5 correctly.`
        : this.model.currentQuestion.prompt,
    );
    this.input.text(answering ? `${this.typed}|` : "");
    this.feedback.text(
      finished || answering
        ? ""
        : this.model.feedback === "correct"
          ? "Correct!"
          : `${this.model.feedback === "timeout" ? "Time's up!" : "Incorrect."} Answer: ${this.model.currentQuestion.answer.toFixed(2)}`,
    );
    this.submitButton.visible(answering);
    this.nextButton.visible(this.model.phase === "feedback");
    this.restartButton.visible(finished);
    this.instructions.visible(answering);
    this.group.getLayer()?.batchDraw();
  }
}
