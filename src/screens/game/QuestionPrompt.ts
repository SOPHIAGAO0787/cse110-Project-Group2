import Konva from "konva";
import type { Question, Vec } from "../../model/types";
import type { PickedQuestion, QuestionService } from "../../model/questions/QuestionService";
import { BUTTON_HEIGHT, makeButton, makeClickable, setHoverCursor } from "../button";

const PANEL_W = 320;
const PAD = 16; // space around the edges of the panel
const SECTION_GAP = 12; // space between the question and the input box
const TITLE_GAP = 6; // space between the title and the question
const INPUT_H = 40;
const FORMAT_H = 16; // the grey line under the input box
const MIN_FEEDBACK_H = 34; // room for two lines of feedback
const SYMBOLS = ["π", "√", "^", "⌫", "C"];
const SYMBOL_W = 40;
const SYMBOL_H = 30;
const SYMBOL_GAP = 8;
const CLOSE_SIZE = 28;
const CLOSE_MARGIN = 8;
const TITLE_SIDE = PAD + CLOSE_SIZE + CLOSE_MARGIN;
const MAX_TYPED = 18; // what fits in the input box
const GAP = 16; // space between the tower tile and the popup
const DIM_OPACITY = 0.3; // set to 0 if you don't want the screen dimmed
const MAX_ATTEMPTS = 2; // total tries per question

// How the correct answer is shown: "9π (≈ 28.27)" for a neat multiple of π, otherwise "28.27"
function formatAnswer(answer: number): string {
  const rounded = String(Math.round(answer * 100) / 100);
  const overPi = answer / Math.PI;
  const neat = Math.round(overPi * 100) / 100;
  if (answer !== 0 && Math.abs(overPi - neat) < 1e-6) {
    const coefficient = neat === 1 ? "" : String(neat); // "π", not "1π"
    return `${coefficient}π (≈ ${rounded})`;
  }
  return rounded;
}

export class QuestionPrompt {
  group = new Konva.Group({ visible: false });
  private dim = new Konva.Rect({ fill: "black", opacity: DIM_OPACITY }); // also blocks clicks on the map
  private panelGroup = new Konva.Group();
  private panel = new Konva.Rect({
    width: PANEL_W,
    fill: "#222",
    stroke: "white",
    strokeWidth: 2,
    cornerRadius: 8,
  });
  private titleText = new Konva.Text({
    x: TITLE_SIDE,
    width: PANEL_W - 2 * TITLE_SIDE, // same width as the question, clear of the 'X'
    fontSize: 14,
    fontStyle: "bold",
    fill: "#ffd166",
    align: "center",
  });
  private promptText = new Konva.Text({
    x: PAD,
    width: PANEL_W - 2 * PAD, // full width: it starts below the 'X'
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
    wrap: "none",
  });
  // Tells the player which kinds of answers the box understands
  private formatText = new Konva.Text({
    x: PAD,
    width: PANEL_W - 2 * PAD,
    height: FORMAT_H,
    text: "You can type π, fractions or decimals",
    fontSize: 12,
    fill: "#aaa",
    align: "center",
  });
  private cursorBar = new Konva.Rect({ y: 98, width: 2, height: 24, fill: "black" });
  private symbolRow = new Konva.Group({
    x: (PANEL_W - (SYMBOLS.length * SYMBOL_W + (SYMBOLS.length - 1) * SYMBOL_GAP)) / 2,
    y: 138,
  });
  private answerLabel = new Konva.Text({
    x: PAD,
    width: PANEL_W - 2 * PAD,
    text: "↑ Correct answer",
    fontSize: 14,
    fontStyle: "bold",
    fill: "#4ade80",
    align: "center",
    visible: false,
  });
  private feedback = new Konva.Text({
    x: 16,
    y: 174,
    width: PANEL_W - 32,
    fontSize: 14,
    fill: "#ff6b6b",
    align: "center",
  });
  private submitButton: Konva.Group;
  private continueButton: Konva.Group;
  private closeButton = new Konva.Group({
    x: PANEL_W - CLOSE_SIZE - CLOSE_MARGIN,
    y: CLOSE_MARGIN,
  });

  private service: QuestionService;
  private question: Question | null = null;
  private typed = "";
  private cursor = 0;
  private phase: "typing" | "wrong" | "correct" = "typing";
  private resolve: ((correct: boolean) => void) | null = null;
  private attemptsLeft = 0;
  private width = 0;
  private height = 0;
  private panelH = 0; // set by layout(), because it depends on the question

  constructor(service: QuestionService) {
    this.service = service;

    this.submitButton = makeButton("Submit", () => this.submit());
    this.continueButton = makeButton("Continue", () => this.finish(false));
    this.submitButton.x(PANEL_W / 2 - 100);
    this.continueButton.x(PANEL_W / 2 - 100);
    this.continueButton.visible(false);

    SYMBOLS.forEach((symbol, i) => {
      const button = new Konva.Group({ x: i * (SYMBOL_W + SYMBOL_GAP) });
      button.add(
        new Konva.Rect({
          width: SYMBOL_W,
          height: SYMBOL_H,
          fill: "#3a3a52",
          stroke: "white",
          cornerRadius: 4,
        }),
        new Konva.Text({
          text: symbol,
          width: SYMBOL_W,
          height: SYMBOL_H,
          fontSize: 18,
          fill: "white",
          align: "center",
          verticalAlign: "middle",
          listening: false,
        }),
      );
      makeClickable(button, () => this.pressSymbol(symbol));
      this.symbolRow.add(button);
    });

    this.inputBox.on("click tap", () => this.placeCursorAtPointer());
    this.inputText.on("click tap", () => this.placeCursorAtPointer());

    setHoverCursor(this.inputBox, "text", () => this.phase === "typing");
    setHoverCursor(this.inputText, "text", () => this.phase === "typing");

    this.closeButton.add(
      new Konva.Rect({
        width: CLOSE_SIZE,
        height: CLOSE_SIZE,
        fill: "#3a3a52",
        stroke: "white",
        cornerRadius: 4,
      }),
      new Konva.Text({
        text: "✕",
        width: CLOSE_SIZE,
        height: CLOSE_SIZE,
        fontSize: 16,
        fontStyle: "bold",
        fill: "white",
        align: "center",
        verticalAlign: "middle",
        listening: false,
      }),
    );
    makeClickable(this.closeButton, () => this.finish(false));

    this.panelGroup.add(
      this.panel,
      this.titleText,
      this.promptText,
      this.inputBox,
      this.inputText,
      this.formatText,
      this.symbolRow,
      this.answerLabel,
      this.cursorBar,
      this.feedback,
      this.submitButton,
      this.continueButton,
      this.closeButton,
    );
    this.group.add(this.dim, this.panelGroup);

    this.layout("");
  }

  // Stacks everything from the top down, so the panel is as tall as this question needs:
  // question, input box, the grey format line, symbol row, a reserved feedback area, then the buttons.
  private layout(hint: string): void {
    this.titleText.y(PAD);
    const closeBottom = CLOSE_MARGIN + CLOSE_SIZE;
    this.promptText.y(Math.max(PAD + this.titleText.height() + TITLE_GAP, closeBottom + TITLE_GAP));
    const inputY = this.promptText.y() + this.promptText.height() + SECTION_GAP;
    this.inputBox.y(inputY);
    this.inputText.y(inputY);
    this.cursorBar.y(inputY + (INPUT_H - this.cursorBar.height()) / 2);

    const formatY = inputY + INPUT_H + 4;
    this.formatText.y(formatY);
    this.answerLabel.y(formatY); // shown in place of the format line once the tries are used up

    const symbolsY = formatY + FORMAT_H + 4;
    this.symbolRow.y(symbolsY);

    // Reserve room for the longest feedback this question can show, so the panel
    // doesn't change size when a hint appears.
    const feedbackY = symbolsY + SYMBOL_H + 8;
    this.feedback.y(feedbackY);
    let feedbackH = MIN_FEEDBACK_H;
    for (const text of [
      `Not quite. ${hint}\n(${MAX_ATTEMPTS} tries left)`,
      `Not quite.\nYou answered ${"8".repeat(MAX_TYPED)}.\n${hint}`, // the longest answer the box allows
    ]) {
      this.feedback.text(text);
      feedbackH = Math.max(feedbackH, this.feedback.height());
    }
    this.feedback.text("");

    const buttonsY = feedbackY + feedbackH + 10;
    this.submitButton.y(buttonsY);
    this.continueButton.y(buttonsY);

    this.panelH = buttonsY + BUTTON_HEIGHT + PAD;
    this.panel.height(this.panelH);
  }

  // Shows the popup next to `anchor` (screen pixels, not map pixels).
  // Resolves true if the player answers correctly, false otherwise.
  ask(question: PickedQuestion, anchor: Vec): Promise<boolean> {
    this.cancel(); // in case a previous question is somehow still open

    this.question = question;
    this.typed = "";
    this.cursor = 0;
    this.phase = "typing";
    this.attemptsLeft = MAX_ATTEMPTS;
    this.submitButton.visible(true);
    this.continueButton.visible(false);
    this.symbolRow.visible(true);
    this.formatText.visible(true);
    this.answerLabel.visible(false);
    this.inputText.fill("black");
    this.feedback.fill("#ff6b6b");
    this.inputBox.strokeWidth(0);
    this.cursorBar.visible(true);
    this.titleText.text(question.title);
    this.promptText.text(question.prompt);
    this.layout(question.hint); // must come before placeNear, which needs panelH
    this.refreshInput();
    this.feedback.text("");
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
    if (this.resolve !== null || this.group.visible()) {
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
    const y = Math.min(
      Math.max(anchor.y - this.panelH / 2, 0),
      Math.max(this.height - this.panelH, 0),
    );
    this.panelGroup.position({ x: Math.max(x, 0), y });
  }

  // Adds text at the cursor, unless the box is full
  private insert(text: string): void {
    this.inputText.fill("black"); // editing a wrong answer clears the red
    if (this.typed.length + text.length > MAX_TYPED) return;
    this.typed = this.typed.slice(0, this.cursor) + text + this.typed.slice(this.cursor);
    this.cursor += text.length;
  }

  // Removes the character before the cursor
  private deleteBefore(): void {
    this.inputText.fill("black"); // editing a wrong answer clears the red
    if (this.cursor === 0) return;
    this.typed = this.typed.slice(0, this.cursor - 1) + this.typed.slice(this.cursor);
    this.cursor -= 1;
  }

  // Used by the on-screen buttons: adds a symbol, or removes the last character for ⌫
  private pressSymbol(symbol: string): void {
    if (this.question === null || this.phase !== "typing") return;
    if (symbol === "C") {
      this.inputText.fill("black"); // editing a wrong answer clears the red
      this.typed = "";
      this.cursor = 0;
    } else if (symbol === "⌫") {
      this.deleteBefore();
    } else {
      this.insert(symbol);
    }
    this.refreshInput();
  }

  // Moves the cursor to the gap between characters closest to where the player clicked
  private placeCursorAtPointer(): void {
    if (this.question === null || this.phase !== "typing") return;
    const pointer = this.panelGroup.getRelativePointerPosition();
    if (pointer === null) return;

    // Same math as refreshInput: where the centered text starts
    const boxCenter = this.inputText.x() + this.inputText.width() / 2;
    const textStart = boxCenter - this.measure(this.typed) / 2;
    const clickX = pointer.x - textStart;

    // Pick the gap (0..length) whose position is closest to the click
    let best = 0;
    let bestDistance = Infinity;
    for (let i = 0; i <= this.typed.length; i++) {
      const distance = Math.abs(this.measure(this.typed.slice(0, i)) - clickX);
      if (distance < bestDistance) {
        best = i;
        bestDistance = distance;
      }
    }
    this.cursor = best;
    this.refreshInput();
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
      this.deleteBefore();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      this.cursor = Math.max(0, this.cursor - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      this.cursor = Math.min(this.typed.length, this.cursor + 1);
    } else if (/^[0-9./\-()^*+]$/.test(e.key)) {
      this.insert(e.key);
    } else {
      return;
    }
    this.refreshInput();
  };

  private submit(): void {
    if (this.question === null || this.phase !== "typing") return;

    // Blank or whitespace-only: don't count it as an attempt
    if (this.typed.trim() === "") {
      this.feedback.text("Type an answer before submitting.");
      this.redraw();
      return;
    }

    this.attemptsLeft -= 1;

    if (this.service.check(this.question, this.typed)) {
      // Keep the popup open to show it was right, but send the result now,
      // so the tower is placed (and its sound plays) right away, not when the popup closes
      this.phase = "correct";
      this.symbolRow.visible(false);
      this.cursorBar.visible(false);
      this.formatText.visible(false);
      this.inputText.fill("#15803d");
      this.inputBox.stroke("#4ade80");
      this.inputBox.strokeWidth(3);
      this.feedback.fill("#4ade80");
      this.feedback.text("Correct!");
      this.submitButton.visible(false);
      this.continueButton.visible(true);
      this.redraw();
      this.settle(true);
    } else if (this.attemptsLeft > 0) {
      // wrong, but the player gets another try: keep their answer in red so they can fix it
      const left = this.attemptsLeft === 1 ? "1 try left" : `${this.attemptsLeft} tries left`;
      this.feedback.text(`Not quite. ${this.question.hint}\n(${left})`);
      this.inputText.fill("#dc2626");
      this.cursor = this.typed.length; // ready to edit at the end
      this.refreshInput(); // also redraws
    } else {
      // out of tries: the player can only dismiss the popup
      this.phase = "wrong";
      this.symbolRow.visible(false);
      this.cursorBar.visible(false);
      this.formatText.visible(false);
      this.answerLabel.visible(true);
      this.feedback.text(`Not quite.\nYou answered ${this.typed}.\n${this.question.hint}`);
      this.inputText.text(formatAnswer(this.question.answer));
      this.inputText.fill("#15803d");
      this.inputBox.stroke("#4ade80");
      this.inputBox.strokeWidth(3);
      this.submitButton.visible(false);
      this.continueButton.visible(true);
      this.redraw();
    }
  }

  // Hands the result to whoever asked, once. The popup may stay open after this.
  private settle(correct: boolean): void {
    const resolve = this.resolve;
    this.resolve = null;
    resolve?.(correct);
  }

  private finish(correct: boolean): void {
    window.removeEventListener("keydown", this.onKeyDown);
    document.body.style.cursor = "default"; // the mouse may still be over a button
    this.group.visible(false);
    this.redraw();
    this.question = null;
    this.settle(correct); // does nothing if the result was already sent
  }

  private refreshInput(): void {
    this.inputText.text(this.typed);

    // Width of everything typed, and of the part before the cursor
    const fullWidth = this.measure(this.typed);
    const beforeWidth = this.measure(this.typed.slice(0, this.cursor));

    // Centered text starts at the box's center minus half its width
    const boxCenter = this.inputText.x() + this.inputText.width() / 2;
    const textStart = boxCenter - fullWidth / 2;

    this.cursorBar.x(textStart + beforeWidth);
    this.redraw();
  }

  // How wide this text is when drawn in the input box's font
  private measure(text: string): number {
    const probe = new Konva.Text({
      text,
      fontSize: this.inputText.fontSize(),
      fontFamily: this.inputText.fontFamily(),
    });
    const width = probe.width();
    probe.destroy();
    return width;
  }

  private redraw(): void {
    this.group.getLayer()?.batchDraw();
  }
}
