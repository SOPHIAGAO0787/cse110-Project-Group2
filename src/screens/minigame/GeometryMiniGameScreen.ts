import Konva from "konva";
import type { Screen } from "../../app/types";
import { GameLoop } from "../../core/GameLoop";
import {
  GeometryMiniGame,
  QUESTIONS_PER_ROUND,
  type GeometryMiniGameResult,
} from "../../model/minigame/GeometryMiniGame";
import { COINS_PER_CORRECT_ANSWER, MAX_BONUS_COINS } from "../../model/Progress";
import { makeBackButton, makeButton } from "../button";
import { CARD_FILL, FONT, PAGE_BACKGROUND, TITLE_TEXT } from "../theme";

// How long "Correct!" or the right answer stays on screen before the next question shows
const FEEDBACK_MS = 1200;
// The most characters the answer can have, so it fits on one line
const MAX_TYPED = 28;
// The π and √ buttons are narrow, so both fit under the answer
const SYMBOL_BUTTON_WIDTH = 60;

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
  // Fills the space where the answer and buttons were, so the feedback sits in the middle of it
  private feedback = new Konva.Text({
    x: 20,
    y: 230,
    width: 480,
    height: 160,
    verticalAlign: "middle",
    fontSize: 22,
    fontStyle: "bold",
    fontFamily: FONT,
    fill: TITLE_TEXT,
    align: "center",
  });
  private instructions = new Konva.Text({
    x: 20,
    y: 395,
    width: 480,
    text: "Type a number, fraction, or expression (e.g. 4*pi).\nPress Enter to submit. Backspace deletes.",
    fontSize: 15,
    fontFamily: FONT,
    fill: TITLE_TEXT,
    align: "center",
  });
  // What the round is worth: the coins per answer during it, and the coins earned after it
  private reward = new Konva.Text({
    x: 20,
    y: 440,
    width: 480,
    fontSize: 16,
    fontStyle: "bold",
    fontFamily: FONT,
    fill: TITLE_TEXT,
    align: "center",
  });
  private submitButton = makeButton("Submit", () => this.submit());
  private restartButton = makeButton("Restart", () => this.restart());
  private piButton = makeButton("π", () => this.typeSymbol("π"), SYMBOL_BUTTON_WIDTH);
  private rootButton = makeButton("√", () => this.typeSymbol("√"), SYMBOL_BUTTON_WIDTH);
  private model = new GeometryMiniGame();
  private loop: GameLoop;
  private active = false;
  private notified = false;
  private typed = "";
  private nextTimer: number | null = null; // waits to show the next question; null when not waiting

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
      this.reward,
    );
    for (const button of [this.submitButton, this.restartButton]) {
      button.position({ x: 160, y: 345 });
      this.panel.add(button);
    }
    // The symbol buttons sit side by side, centered under the answer
    this.piButton.position({ x: 195, y: 285 });
    this.rootButton.position({ x: 265, y: 285 });
    this.panel.add(this.piButton, this.rootButton);
    // The back arrow goes in the panel's top-left corner. It works at any point in a round.
    const backButton = makeBackButton(onBack);
    backButton.position({ x: 20, y: 16 });
    this.panel.add(backButton);
    this.group.add(this.background, this.panel);
    this.loop = new GameLoop((dt) => {
      if (!this.active) return;
      this.model.tick(dt);
      this.waitForNext(); // the time may have just run out
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
    this.stopWaitingForNext();
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
    this.stopWaitingForNext();
    this.model.restart();
    this.typed = "";
    this.notified = false;
    this.render();
    this.loop.start();
  }

  private submit(): void {
    if (!this.active) return;
    this.model.submit(this.typed);
    this.waitForNext();
    this.render();
  }

  // While the feedback shows, starts a timer that moves on to the next question by itself
  private waitForNext(): void {
    if (this.model.phase !== "feedback" || this.nextTimer !== null) {
      return;
    }
    this.nextTimer = window.setTimeout(() => {
      this.nextTimer = null;
      this.next();
    }, FEEDBACK_MS);
  }

  // Cancels the timer, so a closed or restarted screen doesn't move on by itself
  private stopWaitingForNext(): void {
    if (this.nextTimer !== null) {
      window.clearTimeout(this.nextTimer);
      this.nextTimer = null;
    }
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

  // The π and √ buttons add their symbol to the answer, the same as typing it
  private typeSymbol(symbol: string): void {
    if (!this.active || this.model.phase !== "answering" || this.typed.length >= MAX_TYPED) {
      return;
    }
    this.typed += symbol;
    this.render();
  }

  private onKey = (event: KeyboardEvent): void => {
    if (!this.active || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === "Enter") {
      event.preventDefault();
      if (this.model.phase === "answering") this.submit();
      return;
    }
    if (this.model.phase !== "answering") return;
    if (event.key === "Backspace") {
      event.preventDefault();
      this.typed = this.typed.slice(0, -1);
    } else if (/^[0-9.piπsqrt√^*+\-/() ]$/i.test(event.key) && this.typed.length < MAX_TYPED) {
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
        : `Question ${this.model.questionIndex + 1}/${QUESTIONS_PER_ROUND}   ·   Time: ${Math.ceil(this.model.remainingSeconds)}s   ·   Correct: ${this.model.correctAnswers}`,
    );
    this.question.text(
      finished
        ? `You answered ${this.model.correctAnswers} of ${QUESTIONS_PER_ROUND} correctly.`
        : this.model.currentQuestion.prompt,
    );
    this.input.text(answering ? `${this.typed}|` : "");
    if (finished) {
      const coins = this.model.correctAnswers * COINS_PER_CORRECT_ANSWER;
      // Bonus coins stop adding up at MAX_BONUS_COINS, so say so instead of promising more
      this.reward.text(
        `+${coins} coins for your next game (you can save up to ${MAX_BONUS_COINS})`,
      );
    } else {
      this.reward.text(
        `${COINS_PER_CORRECT_ANSWER} coins per correct answer, added to your next game`,
      );
    }
    this.feedback.text(
      finished || answering
        ? ""
        : this.model.feedback === "correct"
          ? "Correct!"
          : `${this.model.feedback === "timeout" ? "Time's up!" : "Incorrect."} Answer: ${this.model.currentQuestion.answer.toFixed(2)}`,
    );
    this.submitButton.visible(answering);
    this.restartButton.visible(finished);
    this.piButton.visible(answering);
    this.rootButton.visible(answering);
    this.instructions.visible(answering);
    this.group.getLayer()?.batchDraw();
  }
}
