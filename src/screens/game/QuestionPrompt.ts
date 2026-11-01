import Konva from "konva";
import type { Question, Vec } from "../../model/types";
import type { QuestionService } from "../../model/questions/QuestionService";
import { makeButton } from "../button";

const PANEL_W = 320;
const PANEL_H = 240;
const GAP = 16; // space between the tower tile and the popup
const DIM_OPACITY = 0.3; // set to 0 if you don't want the screen dimmed
const MAX_ATTEMPTS = 2; // total tries per question

export class QuestionPrompt {
  group = new Konva.Group({ visible: false });
  private dim = new Konva.Rect({ fill: "black", opacity: DIM_OPACITY }); // also blocks clicks on the map
  private panelGroup = new Konva.Group();
  private panel = new Konva.Rect({
    width: PANEL_W,
    height: PANEL_H,
    fill: "#222",
    stroke: "white",
    strokeWidth: 2,
    cornerRadius: 8,
  });
  private promptText = new Konva.Text({
    x: 16,
    y: 16,
    width: PANEL_W - 32,
    fontSize: 18,
    fill: "white",
    align: "center",
  });
  private inputBox = new Konva.Rect({
    x: 60,
    y: 90,
    width: PANEL_W - 120,
    height: 40,
    fill: "white",
    cornerRadius: 4,
  });
  private inputText = new Konva.Text({
    x: 60,
    y: 90,
    width: PANEL_W - 120,
    height: 40,
    fontSize: 22,
    fill: "black",
    align: "center",
    verticalAlign: "middle",
  });
  private feedback = new Konva.Text({
    x: 16,
    y: 140,
    width: PANEL_W - 32,
    fontSize: 14,
    fill: "#ff6b6b",
    align: "center",
  });
  private submitButton: Konva.Group;
  private continueButton: Konva.Group;

  private service: QuestionService;
  private question: Question | null = null;
  private typed = "";
  private phase: "typing" | "wrong" = "typing";
  private resolve: ((correct: boolean) => void) | null = null;
  private attemptsLeft = 0;
  private width = 0;
  private height = 0;

  constructor(service: QuestionService) {
    this.service = service;

    this.submitButton = makeButton("Submit", () => this.submit());
    this.continueButton = makeButton("Continue", () => this.finish(false));
    this.submitButton.position({ x: PANEL_W / 2 - 100, y: 185 });
    this.continueButton.position({ x: PANEL_W / 2 - 100, y: 185 });
    this.continueButton.visible(false);

    this.panelGroup.add(
      this.panel,
      this.promptText,
      this.inputBox,
      this.inputText,
      this.feedback,
      this.submitButton,
      this.continueButton,
    );
    this.group.add(this.dim, this.panelGroup);
  }

  // Shows the popup next to `anchor` (screen pixels, not map pixels).
  // Resolves true if the player answers correctly, false otherwise.
  ask(question: Question, anchor: Vec): Promise<boolean> {
    this.cancel(); // in case a previous question is somehow still open

    this.question = question;
    this.typed = "";
    this.phase = "typing";
    this.attemptsLeft = MAX_ATTEMPTS;
    this.promptText.text(question.prompt);
    this.feedback.text("");
    this.submitButton.visible(true);
    this.continueButton.visible(false);
    this.refreshInput();
    this.placeNear(anchor);

    this.group.visible(true);
    window.addEventListener("keydown", this.onKeyDown);
    this.redraw();

    return new Promise((resolve) => {
      this.resolve = resolve;
    });
  }

  // Closes the popup and resolves false. Call this from the controller's hide().
  cancel(): void {
    if (this.resolve !== null) {
      this.finish(false);
    }
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.dim.size({ width, height });
  }

  // Puts the popup to the right of the anchor, flipping left if it would run off screen
  private placeNear(anchor: Vec): void {
    let x = anchor.x + GAP;
    if (x + PANEL_W > this.width) {
      x = anchor.x - GAP - PANEL_W;
    }
    const y = Math.min(Math.max(anchor.y - PANEL_H / 2, 0), Math.max(this.height - PANEL_H, 0));
    this.panelGroup.position({ x: Math.max(x, 0), y });
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === "Escape") {
      e.preventDefault();
      this.finish(false); // close without placing the tower
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (this.phase === "typing") this.submit();
      else this.finish(false);
      return;
    }
    if (this.phase !== "typing") return;

    if (e.key === "Backspace") {
      e.preventDefault(); // stop the browser navigating back
      this.typed = this.typed.slice(0, -1);
    } else if (/^[0-9.\-]$/.test(e.key)) {
      this.typed += e.key;
    } else {
      return;
    }
    this.refreshInput();
  };

  private submit(): void {
    if (this.question === null || this.phase !== "typing") return;

    this.attemptsLeft -= 1;

    if (this.service.check(this.question, this.typed)) {
      this.finish(true);
    } else if (this.attemptsLeft > 0) {
      // wrong, but the player gets another try: show the hint and clear the input
      const left = this.attemptsLeft === 1 ? "1 try left" : `${this.attemptsLeft} tries left`;
      this.feedback.text(`Not quite. ${this.question.hint} (${left})`);
      this.typed = "";
      this.refreshInput(); // also redraws
    } else {
      // out of tries: the player can only dismiss the popup
      this.phase = "wrong";
      this.feedback.text(`Not quite. ${this.question.hint}`);
      this.submitButton.visible(false);
      this.continueButton.visible(true);
      this.redraw();
    }
  }

  private finish(correct: boolean): void {
    window.removeEventListener("keydown", this.onKeyDown);
    this.group.visible(false);
    this.redraw();
    const resolve = this.resolve;
    this.resolve = null;
    this.question = null;
    resolve?.(correct);
  }

  private refreshInput(): void {
    this.inputText.text(this.typed + "|"); // simple static cursor
    this.redraw();
  }

  private redraw(): void {
    this.group.getLayer()?.batchDraw();
  }
}
